import { capabilityFixture, voteResponseV2 } from "./aggregate-fixture.mjs";
import { approvedEditorialCandidates } from "./editorial-fixtures.mjs";
import { writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import { hasCuratedPortrait } from "../../shared/curated-portraits.js";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const candidates = approvedEditorialCandidates(CATALOG.filter(({ personId }) => hasCuratedPortrait(personId)).slice(0, 8));
const personalRankingPolicy = {
  id: "pairwise-majority-scc-v1",
  label: "maioria nos confrontos observados",
  explanation: "A ordem usa os confrontos diretos e mantém empates sem usar exposição.",
};

function ranking(decisions = 0, winnerId = "", comparedIds = []) {
  const compared = new Set(comparedIds);
  return candidates.map((candidate) => {
    const played = Boolean(decisions && compared.has(candidate.id));
    return {
      ...candidate,
      elo: played ? (candidate.id === winnerId ? 1045 : 985) : 1000,
      wins: played && candidate.id === winnerId ? 3 : 0,
      losses: played && candidate.id !== winnerId ? 1 : 0,
      decisions: played ? (candidate.id === winnerId ? 3 : 1) : 0,
      winRate: played && candidate.id === winnerId ? 100 : 0,
      rank: played ? (candidate.id === winnerId ? 1 : 2) : null,
    };
  });
}

function voteResponse(payload, progress = 1) {
  const outcomes = payload.candidateIds.map((id) => ({
    id,
    result: id === payload.winnerId ? "winner" : "loser",
    delta: id === payload.winnerId ? 45 : -15,
    elo: id === payload.winnerId ? 1045 : 985,
    previousTier: { id: "contender", label: "No páreo", level: 2 },
    tier: id === payload.winnerId
      ? { id: "rising", label: "Em ascensão", level: 3 }
      : { id: "contender", label: "No páreo", level: 2 },
    tierChange: id === payload.winnerId ? "up" : null,
  }));
  const feedback = { primaryEvent: "tierUp", rankingEvent: "overtake", zebra: false, outcomes };
  const updatedRanking = ranking(1, payload.winnerId, payload.candidateIds);
  return {
    duels: progress,
    ranking: updatedRanking,
    player: { version: progress, duels: progress, rankingPolicy: personalRankingPolicy, ranking: updatedRanking },
    round: {
      id: payload.roundId,
      status: "created",
      winnerId: payload.winnerId,
      candidateIds: [...payload.candidateIds],
      winnerDelta: 45,
      zebra: false,
      comparisons: 3,
      rankingEvent: "overtake",
    },
    vote: {
      id: payload.roundId,
      status: "created",
      winnerId: payload.winnerId,
      candidateIds: [...payload.candidateIds],
      winnerDelta: 45,
      zebra: false,
      comparisons: 3,
      rankingEvent: "overtake",
      feedback,
      personalFeedback: feedback,
      feedbackScope: "personal",
      globalEvent: null,
    },
  };
}

async function activateWithKeyboard(page, locator, key = "Enter") {
  await locator.focus();
  await page.keyboard.press(key);
}

async function tabTo(page, locator, limit = 40) {
  for (let step = 0; step < limit; step += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`O foco não alcançou ${await locator.getAttribute("id") || "o controle esperado"} usando Tab`);
}

const browser = await browserType.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
const page = await context.newPage();
const pageErrors = [];
const voteRequests = [];
let rankingReads = 0;
let capabilityReads = 0;
let holdNextVoteResponse = false;
let releaseHeldVoteResponse = null;
page.on("pageerror", (error) => pageErrors.push(error.message));

await page.addInitScript(() => {
  localStorage.clear();
  let sequence = 0;
  window.__generatedRoundIds = [];
  Object.defineProperty(window.crypto, "randomUUID", {
    configurable: true,
    value() {
      sequence += 1;
      const id = `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
      window.__generatedRoundIds.push(id);
      return id;
    },
  });
});

await page.route(/\/api(?:\/|$)/, async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  if (path === "/api/capabilities") {
    capabilityReads += 1;
    return route.fulfill({ status: 200, json: capabilityFixture() });
  }
  if (path === "/api/candidates") return route.fulfill({ status: 200, json: { candidates } });
  if (path === "/api/ranking") {
    rankingReads += 1;
    return route.fulfill({ status: 200, json: { duels: 0, ranking: ranking() } });
  }
  if (path === "/api/player" && request.method() === "POST") {
    return route.fulfill({ status: 200, json: { recoveryKey: "accessible-profile-key" } });
  }
  if (path === "/api/player/state") {
    return route.fulfill({ status: 200, json: { version: 0, duels: 0, rankingPolicy: personalRankingPolicy, ranking: ranking() } });
  }
  if (path === "/api/round-vote") {
    const payload = request.postDataJSON();
    voteRequests.push(payload);
    if (holdNextVoteResponse) {
      holdNextVoteResponse = false;
      await new Promise((resolve) => { releaseHeldVoteResponse = resolve; });
      releaseHeldVoteResponse = null;
    }
    return route.fulfill({ status: 200, json: voteResponseV2(voteResponse(payload, voteRequests.length)) });
  }
  return route.fulfill({ status: 404, json: { error: "mock não encontrado" } });
});

try {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await activateWithKeyboard(page, page.locator('.nav-button[data-screen="duel"]'));
  await page.getByRole("heading", { name: "Não conseguimos atualizar a rodada.", exact: true }).waitFor();
  await activateWithKeyboard(page, page.locator("#daily-loading-free"));
  await page.getByRole("heading", { name: "Quem você prefere?", exact: true }).waitFor();

  const coach = page.locator("#coach-dialog");
  const start = page.getByRole("button", { name: "Começar rodada", exact: true });
  await coach.waitFor();
  const coachSemantics = await coach.evaluate((dialog) => ({
    tag: dialog.tagName,
    open: dialog.open,
    modal: dialog.matches(":modal"),
    labelledBy: dialog.getAttribute("aria-labelledby"),
    activeId: document.activeElement?.id || "",
  }));
  if (coachSemantics.tag !== "DIALOG" || !coachSemantics.open || !coachSemantics.modal
    || coachSemantics.labelledBy !== "coach-title" || coachSemantics.activeId !== "dismiss-coach") {
    throw new Error(`O coach não abriu como diálogo modal focado: ${JSON.stringify(coachSemantics)}`);
  }
  const firstVote = page.locator(".vote-target").first();
  await firstVote.evaluate((button) => button.focus());
  if (!await start.evaluate((button) => button === document.activeElement)) {
    throw new Error("O conteúdo atrás do coach aceitou foco apesar da modalidade nativa");
  }
  for (let step = 0; step < 4; step += 1) {
    await page.keyboard.press("Tab");
    const focusedBehindCoach = await page.evaluate(() => document.activeElement?.matches(
      ".vote-target, .profile-trigger, .nav-button, .account-button, .sound-toggle",
    ));
    if (focusedBehindCoach) throw new Error("Tab alcançou um controle atrás do coach modal");
  }
  await page.keyboard.press("Escape");
  await coach.waitFor({ state: "hidden" });
  await page.waitForTimeout(20);
  if (!await firstVote.evaluate((button) => button === document.activeElement)) {
    throw new Error("Fechar o coach não entregou foco ao primeiro voto");
  }

  const slotEvidence = await page.locator(".candidate-wrap").evaluateAll((slots) => slots.map((slot) => {
    const vote = slot.querySelector(":scope > .vote-target");
    const profile = slot.querySelector(":scope > .profile-trigger");
    const portrait = vote.querySelector(".portrait").getBoundingClientRect();
    const rarity = vote.querySelector(".card-rarity").getBoundingClientRect();
    const voteBox = vote.getBoundingClientRect();
    const profileBox = profile.getBoundingClientRect();
    return {
      tag: slot.tagName,
      directButtons: slot.querySelectorAll(":scope > button").length,
      nestedButtons: slot.querySelectorAll("button button").length,
      voteName: vote.getAttribute("aria-label"),
      profileName: profile.getAttribute("aria-label"),
      profileText: profile.textContent.trim(),
      voteBox: voteBox.toJSON(),
      profileBox: profileBox.toJSON(),
      portraitBottom: portrait.bottom,
      rarityBottom: rarity.bottom,
    };
  }));
  if (slotEvidence.length !== 4 || slotEvidence.some((slot) => (
    slot.tag !== "ARTICLE"
      || slot.directButtons !== 2
      || slot.nestedButtons !== 0
      || !slot.voteName.startsWith("Escolher ")
      || !slot.profileName.startsWith("Conhecer ")
      || !slot.profileText.includes("Conhecer perfil")
      || slot.profileBox.height < 44
      || slot.profileBox.top < slot.voteBox.bottom - 2
      || slot.profileBox.top < slot.portraitBottom
      || slot.profileBox.top < slot.rarityBottom
      || slot.profileBox.bottom > 844
  ))) {
    throw new Error(`A árvore ou a geometria dos controles está incorreta: ${JSON.stringify(slotEvidence)}`);
  }
  const accessibilityTree = await page.locator(".arena-four").ariaSnapshot();
  if (slotEvidence.some(({ voteName, profileName }) => (
    !accessibilityTree.includes(voteName) || !accessibilityTree.includes(profileName)
  ))) {
    throw new Error(`A árvore de acessibilidade não expôs os oito nomes esperados: ${accessibilityTree}`);
  }
  if (process.env.POLIMATCH_E2E_ACCESSIBLE_SCREENSHOT) {
    await page.screenshot({ path: process.env.POLIMATCH_E2E_ACCESSIBLE_SCREENSHOT });
  }

  const beforeProfiles = await page.evaluate(() => ({
    progress: document.querySelector(".progress-pill").textContent,
    candidateIds: [...document.querySelectorAll(".vote-target")].map((button) => button.dataset.vote),
    generatedRoundIds: [...window.__generatedRoundIds],
  }));
  const focusReturns = [];
  const profileActivationKeys = ["Enter", "Space", "Shift+Enter", "Enter"];
  for (let index = 0; index < 4; index += 1) {
    const profile = page.locator(".profile-trigger").nth(index);
    if (index === 0) {
      await page.keyboard.press("Tab");
    } else {
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
    }
    if (!await profile.evaluate((button) => button === document.activeElement)) {
      const active = await page.evaluate(() => ({
        tag: document.activeElement?.tagName,
        className: document.activeElement?.className,
        label: document.activeElement?.getAttribute?.("aria-label"),
        text: document.activeElement?.textContent?.trim(),
      }));
      throw new Error(`Tab não alcançou o perfil ${index + 1} depois do voto correspondente: ${JSON.stringify(active)}`);
    }
    await page.keyboard.press(profileActivationKeys[index]);
    const modal = page.locator("#modal");
    await modal.waitFor();
    const expectedName = await profile.getAttribute("aria-label");
    const profileSemantics = await modal.evaluate((dialog) => ({
      tag: dialog.tagName,
      modal: dialog.matches(":modal"),
      labelledBy: dialog.getAttribute("aria-labelledby"),
      voteInside: Boolean(dialog.querySelector("#vote-from-profile, [data-vote]")),
    }));
    if (profileSemantics.tag !== "DIALOG" || !profileSemantics.modal
      || profileSemantics.labelledBy !== "profile-title" || profileSemantics.voteInside) {
      throw new Error(`O perfil ${index + 1} não preservou a separação entre conhecer e escolher`);
    }
    if (index === 0) {
      await firstVote.evaluate((button) => button.focus());
      if (!await modal.evaluate((dialog) => dialog.contains(document.activeElement))) {
        throw new Error("O conteúdo atrás do perfil aceitou foco enquanto o diálogo estava modal");
      }
    }
    if (index % 2 === 0) {
      await page.keyboard.press("Escape");
    } else {
      const back = page.locator("#close-modal");
      if (await back.textContent() !== "Voltar à rodada") throw new Error("O perfil perdeu a ação Voltar à rodada");
      await tabTo(page, back);
      await page.keyboard.press("Enter");
    }
    await modal.waitFor({ state: "hidden" });
    await page.waitForTimeout(20);
    const returned = await profile.evaluate((button) => button === document.activeElement);
    focusReturns.push({ index, expectedName, returned });
    if (!returned) throw new Error(`O perfil ${index + 1} não devolveu foco ao gatilho exato`);
  }

  const afterProfiles = await page.evaluate(() => ({
    progress: document.querySelector(".progress-pill").textContent,
    candidateIds: [...document.querySelectorAll(".vote-target")].map((button) => button.dataset.vote),
    generatedRoundIds: [...window.__generatedRoundIds],
  }));
  if (voteRequests.length !== 0
    || afterProfiles.progress !== beforeProfiles.progress
    || JSON.stringify(afterProfiles.candidateIds) !== JSON.stringify(beforeProfiles.candidateIds)
    || JSON.stringify(afterProfiles.generatedRoundIds) !== JSON.stringify(beforeProfiles.generatedRoundIds)) {
    throw new Error(`Conhecer perfil alterou voto, contagem ou roundId: ${JSON.stringify({ beforeProfiles, afterProfiles, voteRequests })}`);
  }

  await activateWithKeyboard(page, page.locator('.nav-button[data-screen="ranking"]'));
  await page.getByRole("heading", { name: "Ranking", exact: true }).waitFor();
  await page.locator("[data-ranking-total]", { hasText: "0 escolhas confirmadas" }).waitFor();
  const rankingProfile = page.locator(".ranking-row[data-profile]").first();
  await activateWithKeyboard(page, rankingProfile);
  const rankingModal = page.locator("#modal");
  await rankingModal.waitFor();
  const rankingBack = page.locator("#close-modal");
  if (await rankingBack.textContent() !== "Voltar ao ranking") {
    throw new Error("O perfil aberto pelo ranking não expôs a ação contextual Voltar ao ranking");
  }
  await tabTo(page, rankingBack);
  await page.keyboard.press("Enter");
  await rankingModal.waitFor({ state: "hidden" });
  await page.waitForTimeout(20);
  if (!await rankingProfile.evaluate((button) => button === document.activeElement)) {
    throw new Error("Fechar o perfil do ranking não devolveu foco à linha exata");
  }
  await activateWithKeyboard(page, page.locator('[data-ranking-view="personal"]'));
  await page.getByText("Faça uma escolha para começar seu ranking pessoal.", { exact: true }).waitFor();
  if (voteRequests.length !== 0 || rankingReads < 1 || rankingReads > capabilityReads) {
    throw new Error("Abrir perfis alterou votos ou recarregou ranking sem revalidar autorização");
  }

  await activateWithKeyboard(page, page.locator('.nav-button[data-screen="duel"]'));
  const roundBeforeLongPress = await page.locator(".vote-target").evaluateAll((buttons) => buttons.map((button) => button.dataset.vote));
  const chosen = page.locator(".vote-target").first();
  const chosenId = await chosen.getAttribute("data-vote");
  const chosenBox = await chosen.boundingBox();
  if (!chosenBox) throw new Error("O alvo da pressão longa não tem geometria visível");
  await page.mouse.move(chosenBox.x + chosenBox.width / 2, chosenBox.y + chosenBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(520);
  await page.mouse.up();
  const modal = page.locator("#modal");
  await modal.waitFor();
  await page.waitForTimeout(30);
  if (voteRequests.length !== 0) {
    throw new Error("A pressão longa deixou o click de ponteiro votar junto com a abertura do perfil");
  }
  await page.keyboard.press("Escape");
  await modal.waitFor({ state: "hidden" });
  await page.waitForTimeout(20);
  if (!await chosen.evaluate((button) => button === document.activeElement)) {
    throw new Error("A pressão longa não devolveu foco ao mesmo alvo de voto após Escape");
  }

  holdNextVoteResponse = true;
  await page.keyboard.press("Enter");
  await page.locator(".round-instruction", { hasText: "Confirmando sua escolha…" }).waitFor();
  for (let attempt = 0; attempt < 50 && !releaseHeldVoteResponse; attempt += 1) {
    await page.waitForTimeout(20);
  }
  if (!releaseHeldVoteResponse || voteRequests.length !== 1 || voteRequests[0].winnerId !== chosenId) {
    throw new Error(`Enter no mesmo alvo após a pressão longa não enviou exatamente um voto: ${JSON.stringify(voteRequests)}`);
  }

  const profileLockWhileBusy = await page.locator(".profile-trigger").evaluateAll((buttons) => (
    buttons.map((button) => button.getAttribute("aria-disabled"))
  ));
  if (profileLockWhileBusy.some((value) => value !== "true")) {
    throw new Error(`Os perfis não herdaram o bloqueio do voto pendente: ${JSON.stringify(profileLockWhileBusy)}`);
  }
  const busyProfile = page.locator(".profile-trigger").first();
  await busyProfile.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(40);
  const pendingRace = await page.evaluate(() => ({
    modalOpen: document.querySelector("#modal").open,
    candidateIds: [...document.querySelectorAll(".vote-target")].map((button) => button.dataset.vote),
  }));
  if (pendingRace.modalOpen || JSON.stringify(pendingRace.candidateIds) !== JSON.stringify(roundBeforeLongPress)) {
    throw new Error(`Um perfil abriu ou a rodada mudou enquanto a resposta estava pendente: ${JSON.stringify(pendingRace)}`);
  }

  releaseHeldVoteResponse();
  await page.locator(".round-instruction", { hasText: "Nova rodada disponível" }).waitFor({ timeout: 4000 });
  const roundAfterLongPressVote = await page.locator(".vote-target").evaluateAll((buttons) => buttons.map((button) => button.dataset.vote));
  if (await modal.evaluate((dialog) => dialog.open)
    || voteRequests[0].roundId !== beforeProfiles.generatedRoundIds.at(-1)
    || roundBeforeLongPress.some((id) => roundAfterLongPressVote.includes(id))) {
    throw new Error(`A rodada não concluiu íntegra após a regressão de pressão longa: ${JSON.stringify({ voteRequests, roundBeforeLongPress, roundAfterLongPressVote })}`);
  }

  const modifiedChosen = page.locator(".vote-target").first();
  const modifiedRoundId = await page.evaluate(() => window.__generatedRoundIds.at(-1));
  await activateWithKeyboard(page, modifiedChosen, "Shift+Enter");
  await page.locator(".round-instruction", { hasText: "Nova rodada disponível" }).waitFor({ timeout: 4000 });
  const roundAfterModifiedVote = await page.locator(".vote-target").evaluateAll((buttons) => buttons.map((button) => button.dataset.vote));
  if (voteRequests.length !== 2
    || voteRequests[1].roundId !== modifiedRoundId
    || roundAfterLongPressVote.some((id) => roundAfterModifiedVote.includes(id))) {
    throw new Error(`O roteiro com Shift+Enter não concluiu uma rodada íntegra: ${JSON.stringify({ voteRequests, roundAfterLongPressVote, roundAfterModifiedVote })}`);
  }

  const report = {
    browser: browserName,
    viewport: { width: 390, height: 844 },
    entry: { dailyFirstFallbackToFree: true },
    coach: { ...coachSemantics, closedWith: "Escape" },
    slots: slotEvidence.map(({ tag, directButtons, nestedButtons, voteName, profileName, profileText, profileBox }) => ({
      tag, directButtons, nestedButtons, voteName, profileName, profileText, profileHeight: profileBox.height,
    })),
    focusReturns,
    accessibilityTree,
    keyboard: { profileActivationKeys, longPressFollowUpKey: "Enter", voteActivationKey: "Shift+Enter" },
    contextualReturnLabels: { duel: "Voltar à rodada", ranking: "Voltar ao ranking" },
    longPressRegression: {
      winnerId: chosenId,
      pointerVotesBeforeEscape: 0,
      keyboardVotesAfterEscape: 1,
    },
    pendingProfileLock: { ariaDisabled: profileLockWhileBusy, pendingRace },
    negativeState: {
      before: beforeProfiles,
      after: afterProfiles,
      voteRequestsBeforeChoice: 0,
      rankingReads,
      personalRankingEmpty: true,
    },
    completedRounds: [
      { roundId: voteRequests[0].roundId, before: roundBeforeLongPress, after: roundAfterLongPressVote },
      { roundId: voteRequests[1].roundId, before: roundAfterLongPressVote, after: roundAfterModifiedVote },
    ],
    pageErrors,
  };
  if (process.env.POLIMATCH_E2E_ACCESSIBLE_REPORT) {
    await writeFile(process.env.POLIMATCH_E2E_ACCESSIBLE_REPORT, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (pageErrors.length) throw new Error(`Erros na página: ${pageErrors.join(" | ")}`);
  console.log(`${browserName}: coach e perfis nativos, dois controles por carta, foco e rodada por teclado validados`);
} catch (error) {
  console.error(await page.locator("body").innerText());
  console.error(`Erros capturados: ${pageErrors.join(" | ") || "nenhum"}`);
  throw error;
} finally {
  await browser.close();
}
