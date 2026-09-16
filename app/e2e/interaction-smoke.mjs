import { chromium, webkit } from "playwright";
import { writeFile } from "node:fs/promises";
import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import { hasCuratedPortrait } from "../../shared/curated-portraits.js";
import { completedDailySession } from "./daily-fixture.mjs";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const browserType = { chromium, webkit }[browserName];
const googleEnabled = process.env.POLIMATCH_E2E_GOOGLE === "1";
const includeGlobalEvent = process.env.POLIMATCH_E2E_GLOBAL_EVENT !== "0";
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);
const personalRankingPolicy = {
  id: "pairwise-majority-scc-v1",
  label: "maioria nos confrontos observados",
  explanation: "A ordem usa os confrontos diretos e mantém empates sem usar exposição.",
};

const playableDisplayNames = CATALOG
  .filter(({ personId }) => hasCuratedPortrait(personId))
  .map(({ displayName, name }) => displayName || name);

async function measureCardHierarchy(page) {
  const geometry = await page.evaluate(() => {
    const bounds = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { top: box.top, right: box.right, bottom: box.bottom, left: box.left, width: box.width, height: box.height };
    };
    const skip = bounds("#skip-round");
    const nav = bounds(".bottom-nav");
    return {
      viewport: { width: innerWidth, height: innerHeight, scrollY, documentHeight: document.documentElement.scrollHeight },
      card: bounds(".candidate-card"),
      portrait: bounds(".candidate-card .portrait"),
      copy: bounds(".candidate-card .candidate-copy"),
      skipToNavGap: skip && nav ? nav.top - skip.bottom : null,
    };
  });
  const typography = await page.locator(".candidate-card").first().evaluate((card) => {
    const read = (selector) => {
      const element = card.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        text: element.textContent.trim(),
        display: style.display,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        color: style.color,
        overflow: style.overflow,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      };
    };
    return {
      name: read(".candidate-name, .candidate-copy > strong"),
      affiliation: read(".candidate-affiliation"),
      office: read(".candidate-office"),
      brand: read(".card-brand b"),
      rarity: read(".card-rarity"),
    };
  });
  const names = await page.locator(".candidate-name, .candidate-copy > strong").first().evaluate((element, catalogNames) => {
    const original = element.textContent;
    const measurements = catalogNames.map((name) => {
      element.textContent = name;
      const style = getComputedStyle(element);
      return {
        name,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      };
    });
    element.textContent = original;
    return measurements;
  }, playableDisplayNames);
  return {
    geometry,
    typography,
    names,
    descenderNames: names.filter(({ name }) => /[gjpqyç]/.test(name)),
  };
}

async function measureRoundOutcomes(page) {
  return page.locator(".card-outcome").evaluateAll((outcomes) => outcomes.map((outcome) => {
    const delta = outcome.querySelector("b");
    const message = outcome.querySelector("small");
    const deltaStyle = getComputedStyle(delta);
    const messageStyle = getComputedStyle(message);
    return {
      state: outcome.classList.contains("gain") ? "gain" : "loss",
      delta: delta.textContent.trim(),
      message: message.textContent.trim(),
      deltaColor: deltaStyle.color,
      messageColor: messageStyle.color,
      deltaFontSize: deltaStyle.fontSize,
      messageFontSize: messageStyle.fontSize,
    };
  }));
}

function assertOutcomeSemantics(outcomes, viewportLabel) {
  const gain = outcomes.find(({ state }) => state === "gain");
  const loss = outcomes.find(({ state }) => state === "loss");
  if (!gain || !loss || gain.deltaColor === loss.deltaColor || gain.messageColor === loss.messageColor) {
    throw new Error(`Ganho e perda perderam a distinção semântica de cor em ${viewportLabel}`);
  }
  if (outcomes.some(({ deltaFontSize, messageFontSize }) => Number.parseFloat(deltaFontSize) < 11 || Number.parseFloat(messageFontSize) < 11)) {
    throw new Error(`O resultado voltou a usar texto abaixo de 11px em ${viewportLabel}`);
  }
}

const smokeCandidateIds = new Set([46, 48, 95, 125, 1, 2, 3, 4]);
const candidates = CATALOG.filter(({ personId }) => smokeCandidateIds.has(personId));

function ranking(decisions = 0, winnerId = "", comparedIds = []) {
  const compared = new Set(comparedIds);
  return candidates.map((candidate) => {
    const played = Boolean(decisions && compared.has(candidate.id));
    return {
      ...candidate,
      elo: played ? (candidate.id === winnerId ? 1085 : 1025) : 1040,
      wins: played && candidate.id === winnerId ? 3 : 0,
      losses: played && candidate.id !== winnerId ? 1 : 0,
      decisions: played ? (candidate.id === winnerId ? 3 : 1) : 0,
      winRate: played && candidate.id === winnerId ? 100 : 0,
      rank: played ? (candidate.id === winnerId ? 1 : 2) : null,
    };
  }).sort((left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER) || left.id.localeCompare(right.id));
}

const browser = await browserType.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  serviceWorkers: "block",
});
const page = await context.newPage();
const pageErrors = [];
const roundVoteRequests = [];
let failNextRoundVote = false;
let failNextGoogleLogin = false;
let failNextLogout = false;
let failNextDailySession = false;
let holdNextSuccessfulRoundVote = false;
let successfulRoundVotes = 0;
page.on("pageerror", (error) => pageErrors.push(error.message));

await page.route("https://accounts.google.com/gsi/client", (route) => route.fulfill({
  contentType: "application/javascript",
  body: `window.google={accounts:{id:{initialize(options){window.__polimatchGoogleCallback=options.callback},renderButton(element){const button=document.createElement('button');button.type='button';button.textContent='Continuar com Google';button.addEventListener('click',()=>window.__polimatchGoogleCallback({credential:'mock-google-id-token'}));element.replaceChildren(button)}}}};`,
}));

await page.route(/\/api(?:\/|$)/, async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  let body;
  if (path === "/api/candidates") body = { candidates };
  else if (path === "/api/ranking") body = { duels: 0, ranking: ranking() };
  else if (path === "/api/player" && request.method() === "POST") body = { recoveryKey: "e2e-recovery-key" };
  else if (path === "/api/player/state") body = { version: 0, duels: 0, rankingPolicy: personalRankingPolicy, ranking: ranking() };
  else if (path === "/api/daily-session") {
    if (failNextDailySession) {
      failNextDailySession = false;
      await route.fulfill({ status: 503, json: { error: "serviço diário indisponível" } });
      return;
    }
    body = completedDailySession(candidates);
  }
  else if (path === "/api/auth/google" && request.method() === "POST") {
    if (failNextGoogleLogin) {
      failNextGoogleLogin = false;
      await route.fulfill({ status: 503, json: { error: "falha passageira de login" } });
      return;
    }
    body = { sessionToken: `pms_${"s".repeat(43)}`, account: { displayName: "Bia", avatarUrl: "" }, player: { version: 0, duels: 0, rankingPolicy: personalRankingPolicy, ranking: ranking(), account: { displayName: "Bia", avatarUrl: "" } } };
  }
  else if (path === "/api/auth/logout" && request.method() === "POST") {
    if (failNextLogout) {
      failNextLogout = false;
      await route.fulfill({ status: 503, json: { error: "falha passageira de logout" } });
      return;
    }
    await route.fulfill({ status: 204 });
    return;
  }
  else if (path === "/api/round-vote") {
    const payload = request.postDataJSON();
    roundVoteRequests.push({ roundId: payload.roundId, authorization: request.headers().authorization || "" });
    if (failNextRoundVote) {
      failNextRoundVote = false;
      await route.fulfill({ status: 503, json: { error: "falha passageira de teste" } });
      return;
    }
    if (holdNextSuccessfulRoundVote) {
      holdNextSuccessfulRoundVote = false;
      await new Promise((resolve) => setTimeout(resolve, 160));
    }
    successfulRoundVotes += 1;
    const feedback = {
      primaryEvent: "tierUp",
      rankingEvent: "overtake",
      zebra: false,
      outcomes: payload.candidateIds.map((id) => ({
        id,
        result: id === payload.winnerId ? "winner" : "loser",
        delta: id === payload.winnerId ? 45 : -15,
        elo: id === payload.winnerId ? 1055 : 985,
        previousTier: { id: "contender", label: "No páreo", level: 2 },
        tier: id === payload.winnerId
          ? { id: "rising", label: "Em ascensão", level: 3 }
          : { id: "contender", label: "No páreo", level: 2 },
        tierChange: id === payload.winnerId ? "up" : null,
      })),
    };
    const globalFeedback = { ...feedback, primaryEvent: "top10", rankingEvent: "top10" };
    body = {
      duels: successfulRoundVotes,
      ranking: ranking(1, payload.winnerId, payload.candidateIds),
      player: { version: successfulRoundVotes, duels: successfulRoundVotes, rankingPolicy: personalRankingPolicy, ranking: ranking(1, payload.winnerId, payload.candidateIds) },
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
        globalEvent: includeGlobalEvent
          ? { scope: "global", rankingEvent: "top10", winnerDelta: 45, zebra: false, feedback: globalFeedback }
          : null,
      },
    };
  } else {
    await route.fulfill({ status: 404, json: { error: "mock não encontrado" } });
    return;
  }
  await route.fulfill({ status: 200, json: body });
});

try {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  const soundToggle = page.getByRole("button", { name: "Desativar efeitos sonoros" });
  await soundToggle.waitFor();
  if (await soundToggle.getAttribute("aria-pressed") !== "true") throw new Error("O som não iniciou disponível para a primeira interação");
  await soundToggle.click();
  const enableSound = page.getByRole("button", { name: "Ativar efeitos sonoros" });
  if (await enableSound.getAttribute("aria-pressed") !== "false") throw new Error("O controle não desligou os efeitos sonoros");
  if (!await enableSound.evaluate((button) => button === document.activeElement)) throw new Error("O controle de som perdeu foco depois de desligado");
  if (await page.evaluate(() => localStorage.getItem("polimatch:sound")) !== "off") throw new Error("A preferência de som desligado não foi persistida");
  await enableSound.click();
  if (!await page.getByRole("button", { name: "Desativar efeitos sonoros" }).evaluate((button) => button === document.activeElement)) throw new Error("O controle de som perdeu foco depois de ligado");
  if (await page.evaluate(() => localStorage.getItem("polimatch:sound")) !== "on") throw new Error("A preferência de som ligado não foi persistida");
  const primaryNavLabels = await page.locator(".bottom-nav .nav-button").allTextContents();
  if (primaryNavLabels.join("|") !== "Início|Duelo|Ranking") throw new Error("A navegação principal não apresenta Início, Duelo e Ranking nesta ordem");
  if (await page.getByRole("button", { name: "Coleção" }).count()) throw new Error("Coleção/Chromas ainda aparece na navegação pública");
  await page.getByRole("button", { name: "Salvar seu jogo com Google" }).click();
  await page.getByRole("heading", { name: "Entrou, salvou, jogou." }).waitFor();
  if (!await page.getByText("Sem cadastro, sem senha nova").isVisible()) throw new Error("O acesso opcional ficou burocrático ou sem contexto");
  if (process.env.POLIMATCH_E2E_AUTH_SCREENSHOT) {
    await page.waitForTimeout(280);
    await page.screenshot({ path: process.env.POLIMATCH_E2E_AUTH_SCREENSHOT });
  }
  if (googleEnabled) {
    failNextGoogleLogin = true;
    await page.getByRole("button", { name: "Continuar com Google" }).click();
    await page.getByRole("alert").waitFor();
    if (!await page.locator(".auth-overlay").evaluate((dialog) => dialog.contains(document.activeElement))) {
      throw new Error("A falha de login deixou o foco fora do diálogo de autenticação");
    }
    await page.getByRole("button", { name: "Continuar com Google" }).waitFor();
    failNextDailySession = true;
    await page.getByRole("button", { name: "Continuar com Google" }).click();
    await page.getByRole("heading", { name: "Tudo certo, Bia!" }).waitFor();
    const storedToken = await page.evaluate(() => localStorage.getItem("polimatch:v3:recovery-key"));
    if (!storedToken?.startsWith("pms_") || storedToken.includes("mock-google-id-token")) throw new Error("O frontend persistiu a credencial Google em vez da sessão própria");
    await page.getByRole("button", { name: "Voltar ao jogo" }).click();
    if (!await page.getByRole("button", { name: "Abrir sua conta" }).isVisible()) throw new Error("A conta salva não apareceu no cabeçalho");
  } else {
    await page.getByRole("button", { name: "Continuar jogando" }).click();
  }
  if (await page.locator(".auth-overlay").count()) throw new Error("A entrada com Google bloqueou quem prefere continuar anonimamente");
  await page.getByRole("button", { name: "Duelo" }).click();
  await page.getByRole("button", { name: "Continuar no modo livre" }).click();
  await page.getByRole("heading", { name: "Quem você prefere?" }).waitFor();
  await page.getByRole("button", { name: "Começar rodada" }).click();
  if (googleEnabled) {
    // Uma tentativa pertence à identidade que a iniciou. Login e logout devem
    // abandonar o retry pendente e gerar outro roundId antes do próximo voto.
    failNextRoundVote = true;
    await page.locator(".candidate-card").first().click();
    await page.locator("#retry-vote").waitFor();
    const roundBeforeLogout = roundVoteRequests.at(-1)?.roundId;

    await page.getByRole("button", { name: "Abrir sua conta" }).click();
    failNextLogout = true;
    await page.getByRole("button", { name: "Sair desta conta" }).click();
    await page.getByRole("alert").waitFor();
    if (!await page.locator(".auth-overlay").evaluate((dialog) => dialog.contains(document.activeElement))) {
      throw new Error("A falha de logout deixou o foco fora do diálogo de autenticação");
    }
    failNextDailySession = true;
    await page.getByRole("button", { name: "Sair desta conta" }).click();
    await page.getByRole("heading", { name: "Não conseguimos atualizar a rodada." }).waitFor();
    if (!await page.getByRole("button", { name: "Salvar seu jogo com Google" }).isVisible()) {
      throw new Error("A falha diária pós-logout deixou a conta revogada aparecendo como conectada");
    }
    if (await page.evaluate(() => localStorage.getItem("polimatch:v3:recovery-key")) !== "e2e-recovery-key") {
      throw new Error("A falha diária pós-logout restaurou o token revogado");
    }
    if (await page.locator("#retry-vote").isVisible()) throw new Error("O logout preservou um voto pendente da conta anterior");
    await page.getByRole("button", { name: "Ir para o modo livre" }).click();

    failNextRoundVote = true;
    await page.locator(".candidate-card").first().click();
    await page.locator("#retry-vote").waitFor();
    const roundBeforeLogin = roundVoteRequests.at(-1)?.roundId;
    if (!roundBeforeLogout || !roundBeforeLogin || roundBeforeLogout === roundBeforeLogin) {
      throw new Error("O logout não rotacionou o roundId ligado à identidade anterior");
    }

    await page.getByRole("button", { name: "Salvar seu jogo com Google" }).click();
    failNextDailySession = true;
    await page.getByRole("button", { name: "Continuar com Google" }).click();
    await page.getByRole("heading", { name: "Tudo certo, Bia!" }).waitFor();
    await page.getByRole("button", { name: "Voltar ao jogo" }).click();
    await page.getByRole("heading", { name: "Não conseguimos atualizar a rodada." }).waitFor();
    if (!await page.getByRole("button", { name: "Abrir sua conta" }).isVisible()) {
      throw new Error("A falha diária pós-login desfez a identidade já confirmada");
    }
    if (await page.locator("#retry-vote").isVisible()) throw new Error("O login preservou um voto pendente do jogador anônimo");
    await page.getByRole("button", { name: "Ir para o modo livre" }).click();

    await page.locator(".candidate-card").first().click();
    await page.locator("[data-personal-feedback]", { hasText: /subiu de patente/i }).waitFor();
    const roundAfterLogin = roundVoteRequests.at(-1)?.roundId;
    if (!roundAfterLogin || roundAfterLogin === roundBeforeLogin) {
      throw new Error("O login não rotacionou o roundId ligado ao jogador anônimo");
    }
    await page.locator(".card-outcome").first().waitFor({ state: "hidden", timeout: 2500 });
    // A confirmação ainda agenda uma última renderização para limpar a mensagem.
    // Esperar por ela evita que o DOM seja trocado no meio dos gestos seguintes.
    await page.getByText("Toque na sua preferida. Segure para conhecer o perfil.", { exact: true }).waitFor();
  }
  const mobileCards = await page.locator(".candidate-card").evaluateAll((cards) => cards.map((card) => {
    const box = card.getBoundingClientRect();
    return { top: box.top, right: box.right, bottom: box.bottom, left: box.left };
  }));
  if (mobileCards.length !== 4
    || Math.abs(mobileCards[0].top - mobileCards[1].top) > 2
    || Math.abs(mobileCards[2].top - mobileCards[3].top) > 2
    || mobileCards[2].top <= mobileCards[0].bottom
    || mobileCards[1].left <= mobileCards[0].right
    || mobileCards[3].left <= mobileCards[2].right) {
    throw new Error("As quatro cartas não ficaram organizadas em uma grade 2 por 2 no viewport móvel");
  }
  if (mobileCards.some(({ top, right, bottom, left }) => top < 0 || left < 0 || right > 390 || bottom > 844)) {
    throw new Error("Uma das cartas ficou cortada no viewport móvel");
  }
  const mobileWidths = mobileCards.map(({ left, right }) => right - left);
  const mobileHeights = mobileCards.map(({ top, bottom }) => bottom - top);
  if (Math.max(...mobileWidths) - Math.min(...mobileWidths) > 2 || Math.max(...mobileHeights) - Math.min(...mobileHeights) > 2) {
    throw new Error("As quatro cartas não receberam a mesma exposição no viewport móvel");
  }
  if (await page.locator(".basic-card").count() !== 4) throw new Error("A carta básica não foi aplicada aos quatro perfis");
  if (await page.locator(".candidate-summary").count() !== 4) throw new Error("O resumo deixou de fazer parte da carta básica");
  if (await page.locator(".candidate-summary").first().isVisible()) throw new Error("O resumo extenso deveria ficar reservado ao perfil no celular");
  if (!await page.locator(".candidate-office").first().isVisible()) throw new Error("A função da pessoa precisa permanecer visível no celular");
  if (await page.locator(".candidate-profile-hint").count() !== 4) throw new Error("A dica de segurar deixou de fazer parte da carta básica");
  if (await page.locator(".profile-button").count()) throw new Error("Um botão externo voltou a ocupar espaço junto à carta");
  for (const layer of [".card-material", ".card-facets", ".card-corners"]) {
    if (await page.locator(`.candidate-card ${layer}`).count() !== 4) {
      throw new Error(`A camada premium ${layer} não foi renderizada nas quatro cartas`);
    }
  }
  const cardHierarchyEvidence = await measureCardHierarchy(page);
  const mobileText = [
    cardHierarchyEvidence.typography.name,
    cardHierarchyEvidence.typography.affiliation,
    cardHierarchyEvidence.typography.office,
    cardHierarchyEvidence.typography.rarity,
  ];
  if (mobileText.some((measurement) => !measurement || Number.parseFloat(measurement.fontSize) < 11)) {
    throw new Error("A carta móvel voltou a exibir texto funcional abaixo de 11px");
  }
  if (cardHierarchyEvidence.typography.name.overflow !== "visible") {
    throw new Error("O nome voltou a esconder glifos descendentes com overflow");
  }
  if (cardHierarchyEvidence.names.length !== playableDisplayNames.length || playableDisplayNames.length !== 54) {
    throw new Error("A verificação tipográfica não percorreu os 54 nomes jogáveis");
  }
  const clippedNames = cardHierarchyEvidence.names.filter(({ clientHeight, scrollHeight }) => scrollHeight > clientHeight);
  if (clippedNames.length) {
    throw new Error(`Nomes com glifo ou linha cortada: ${clippedNames.map(({ name }) => name).join(", ")}`);
  }
  const portraitRatio = cardHierarchyEvidence.geometry.portrait.height / (cardHierarchyEvidence.geometry.card.height - 12);
  if (cardHierarchyEvidence.geometry.card.height < 276
    || cardHierarchyEvidence.geometry.card.height > 282
    || portraitRatio < .6
    || portraitRatio > .68) {
    throw new Error("A anatomia móvel perdeu a carta de cerca de 280px com retrato dominante");
  }
  if (cardHierarchyEvidence.geometry.skipToNavGap < 12 || cardHierarchyEvidence.geometry.skipToNavGap > 40) {
    throw new Error(`O espaço entre a rodada e a navegação não foi redistribuído pela nova carta: ${cardHierarchyEvidence.geometry.skipToNavGap}px`);
  }
  if (cardHierarchyEvidence.typography.brand.display !== "none") {
    throw new Error("A assinatura textual microscópica reapareceu no card móvel");
  }
  if (process.env.POLIMATCH_E2E_DUEL_SCREENSHOT) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: process.env.POLIMATCH_E2E_DUEL_SCREENSHOT });
  }

  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const shortMobile = await page.evaluate(() => {
    const navTop = document.querySelector(".bottom-nav").getBoundingClientRect().top;
    const cards = [...document.querySelectorAll(".candidate-card")].map((card) => {
      const portrait = card.querySelector(".portrait");
      const copy = card.querySelector(".candidate-copy");
      const name = card.querySelector(".candidate-title > strong");
      const affiliation = card.querySelector(".candidate-affiliation");
      const office = card.querySelector(".candidate-office");
      const box = card.getBoundingClientRect();
      const copyStyle = getComputedStyle(copy);
      const portraitHeight = portrait.getBoundingClientRect().height;
      const copyHeight = copy.getBoundingClientRect().height;
      return {
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        left: box.left,
        width: box.width,
        height: box.height,
        portraitShare: portraitHeight / (portraitHeight + copyHeight),
        copyHeight,
        copyClientHeight: copy.clientHeight,
        copyScrollHeight: copy.scrollHeight,
        copyBottom: copy.getBoundingClientRect().bottom - Number.parseFloat(copyStyle.paddingBottom),
        nameFontSize: Number.parseFloat(getComputedStyle(name).fontSize),
        nameLineHeight: Number.parseFloat(getComputedStyle(name).lineHeight),
        nameClientHeight: name.clientHeight,
        nameScrollHeight: name.scrollHeight,
        affiliationFontSize: Number.parseFloat(getComputedStyle(affiliation).fontSize),
        officeFontSize: Number.parseFloat(getComputedStyle(office).fontSize),
        officeLineHeight: Number.parseFloat(getComputedStyle(office).lineHeight),
        officeClientHeight: office.clientHeight,
        officeScrollHeight: office.scrollHeight,
        officeBottom: office.getBoundingClientRect().bottom,
        touchAction: getComputedStyle(card).touchAction,
      };
    });
    return {
      cards,
      navTop,
      documentHeight: document.documentElement.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  const shortWidths = shortMobile.cards.map(({ width }) => width);
  const shortHeights = shortMobile.cards.map(({ height }) => height);
  const invalidShortCards = shortMobile.cards.filter((card) => (
    card.height < 276
      || card.portraitShare < .6
      || card.portraitShare > .68
      || card.copyHeight < 104
      || card.copyScrollHeight > card.copyClientHeight
      || card.nameFontSize < 15
      || card.nameLineHeight < 18
      || card.nameScrollHeight > card.nameClientHeight
      || card.affiliationFontSize < 11
      || card.officeFontSize < 11
      || card.officeLineHeight < 14
      || card.officeClientHeight + 1 < Math.min(card.officeScrollHeight, 28)
      || card.officeBottom > card.copyBottom + 1
      || card.touchAction !== "manipulation"
  ));
  if (shortMobile.cards.length !== 4
    || Math.max(...shortWidths) - Math.min(...shortWidths) > 2
    || Math.max(...shortHeights) - Math.min(...shortHeights) > 2
    || Math.abs(shortMobile.cards[0].top - shortMobile.cards[1].top) > 2
    || Math.abs(shortMobile.cards[2].top - shortMobile.cards[3].top) > 2
    || shortMobile.cards[2].top <= shortMobile.cards[0].bottom
    || shortMobile.cards[0].bottom >= shortMobile.navTop
    || shortMobile.cards.some(({ left, right }) => left < 0 || right > 320)
    || shortMobile.documentHeight <= 568
    || shortMobile.horizontalOverflow
    || invalidShortCards.length) {
    throw new Error(`A anatomia das cartas não foi preservada em 320 por 568: ${JSON.stringify({ ...shortMobile, invalidShortCards })}`);
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const shortScroll = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".candidate-card")];
    const secondRow = cards.slice(2).map((card) => card.getBoundingClientRect().toJSON());
    const navTop = document.querySelector(".bottom-nav").getBoundingClientRect().top;
    const skipBottom = document.querySelector("#skip-round").getBoundingClientRect().bottom;
    return { secondRow, navTop, skipBottom, scrollY, maxScroll: document.documentElement.scrollHeight - innerHeight };
  });
  if (shortScroll.scrollY < shortScroll.maxScroll - 1
    || shortScroll.secondRow.some(({ top, bottom }) => top < 0 || bottom >= shortScroll.navTop)
    || shortScroll.skipBottom >= shortScroll.navTop) {
    throw new Error(`A segunda linha ficou sob a navegação fixa: ${JSON.stringify(shortScroll)}`);
  }
  const shortSecondRowCard = page.locator(".candidate-card").nth(2);
  const shortSecondRowBox = await shortSecondRowCard.boundingBox();
  if (!shortSecondRowBox) throw new Error("A segunda linha não ficou acessível no viewport curto");
  await page.mouse.move(shortSecondRowBox.x + shortSecondRowBox.width / 2, shortSecondRowBox.y + shortSecondRowBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(520);
  await page.mouse.up();
  await page.locator("dialog[open]").waitFor();
  await page.getByRole("button", { name: "Fechar resumo" }).click();
  await page.locator("dialog[open]").waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));

  const firstCard = page.locator(".candidate-card").first();
  const box = await firstCard.boundingBox();
  if (!box) throw new Error("Carta de duelo não foi renderizada");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(520);
  await page.mouse.up();
  await page.locator("dialog[open]").waitFor();
  const closeSummary = page.getByRole("button", { name: "Fechar resumo" });
  await closeSummary.waitFor();
  if (!await closeSummary.isVisible()) throw new Error("O fechamento do resumo não está visível");
  if (process.env.POLIMATCH_E2E_PROFILE_SCREENSHOT) {
    await page.screenshot({ path: process.env.POLIMATCH_E2E_PROFILE_SCREENSHOT, fullPage: true });
  }
  await closeSummary.click();
  await page.locator("dialog[open]").waitFor({ state: "hidden" });

  const reopenBox = await firstCard.boundingBox();
  if (!reopenBox) throw new Error("Não foi possível reabrir o perfil por pressão longa");
  await page.mouse.move(reopenBox.x + reopenBox.width / 2, reopenBox.y + reopenBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(520);
  await page.mouse.up();
  await page.locator("dialog[open]").waitFor();
  await page.keyboard.press("Escape");
  await page.locator("dialog[open]").waitFor({ state: "hidden" });

  if (await page.locator('[role="status"]').count() !== 1) throw new Error("O app deve manter uma única região viva persistente");
  if (!googleEnabled && await page.locator(".app-live-region").innerText()) throw new Error("A região viva deveria nascer vazia antes do primeiro anúncio");
  const selectedRoundIds = await page.locator(".candidate-card").evaluateAll((cards) => cards.map((card) => card.dataset.vote));
  const votingCard = page.locator(".candidate-card").nth(1);
  await page.getByRole("button", { name: "Desativar efeitos sonoros" }).focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  if (!await votingCard.evaluate((card) => card === document.activeElement && card.matches(":focus-visible"))) {
    throw new Error("A carta de voto não recebeu foco visível pela navegação de teclado");
  }
  await page.evaluate(() => {
    const tracked = {
      topbar: document.querySelector(".topbar"),
      nav: document.querySelector(".bottom-nav"),
      instruction: document.querySelector(".round-instruction"),
      retryVote: document.querySelector("#retry-vote"),
      liveRegion: document.querySelector(".app-live-region"),
      slots: [...document.querySelectorAll("[data-candidate-slot]")],
      cards: [...document.querySelectorAll(".candidate-card")],
    };
    const trackedNodes = [tracked.topbar, tracked.nav, tracked.instruction, tracked.retryVote, tracked.liveRegion, ...tracked.slots, ...tracked.cards];
    const announcements = [];
    const substitutions = [];
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.type === "childList") {
          record.removedNodes.forEach((removed) => {
            trackedNodes.forEach((node) => {
              if (removed === node || (removed.nodeType === Node.ELEMENT_NODE && removed.contains(node))) substitutions.push(node.className);
            });
          });
        }
        if (record.target === tracked.liveRegion || tracked.liveRegion.contains(record.target)) {
          const message = tracked.liveRegion.textContent.trim();
          if (message && announcements.at(-1) !== message) announcements.push(message);
        }
      });
    });
    observer.observe(document.querySelector("#app"), { childList: true, characterData: true, subtree: true });
    window.__polimatchDomProbe = {
      tracked,
      focusedCard: document.activeElement,
      observer,
      announcements,
      substitutions,
      initialAccessibleName: document.activeElement.getAttribute("aria-label"),
    };
  });

  const selectedWinnerId = await votingCard.getAttribute("data-vote");
  holdNextSuccessfulRoundVote = true;
  await page.keyboard.press("Enter");
  await page.locator(".round-instruction", { hasText: "Confirmando sua escolha…" }).waitFor();
  if (await page.locator('.candidate-card[aria-disabled="true"]').count() !== 4) throw new Error("Os quatro votos não ficaram temporariamente indisponíveis durante a confirmação");
  const pendingEvidence = await page.locator('.candidate-card.is-selected[aria-disabled="true"]').evaluate((card) => {
    const name = card.querySelector(".candidate-name");
    const office = card.querySelector(".candidate-office");
    return {
      className: card.className,
      nameFontSize: getComputedStyle(name).fontSize,
      officeFontSize: getComputedStyle(office).fontSize,
      filter: getComputedStyle(card).filter,
    };
  });
  await page.locator("[data-personal-feedback]", { hasText: /subiu de patente/i }).waitFor();
  const feedbackChannels = page.locator(".feedback-channel:visible");
  if (await feedbackChannels.count() !== (includeGlobalEvent ? 2 : 1)) throw new Error("Os canais de feedback não respeitaram o contrato da resposta");
  if (!await feedbackChannels.nth(0).getByText("No seu ranking").isVisible()) throw new Error("O feedback pessoal não veio primeiro");
  if (includeGlobalEvent && !await feedbackChannels.nth(1).getByText("No placar do público").isVisible()) throw new Error("O evento público não veio rotulado como secundário");
  if (!await page.locator("#skip-round").isDisabled()) throw new Error("A troca de rodada permaneceu ativa durante o resultado");
  if (await page.locator(".card-outcome").count() !== 4) throw new Error("O resultado visual não apareceu nas quatro cartas");
  if (await page.locator(".candidate-card.is-round-winner").count() !== 1 || await page.locator(".candidate-card.is-round-loser").count() !== 3) {
    throw new Error("Vitória e derrotas não receberam tratamentos visuais distintos");
  }
  if (!await page.locator(".candidate-card.is-round-winner").getByText("+45 Elo").isVisible()) throw new Error("O ganho real de Elo não apareceu na carta escolhida");
  if (await page.locator(".candidate-card.is-round-loser").getByText("-15 Elo").count() !== 3) throw new Error("As perdas reais de Elo não apareceram nas outras cartas");
  const outcomeEvidence = await measureRoundOutcomes(page);
  assertOutcomeSemantics(outcomeEvidence, "390 × 844");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const shortOutcome = await page.evaluate(() => {
    const navTop = document.querySelector(".bottom-nav").getBoundingClientRect().top;
    const skipBottom = document.querySelector("#skip-round").getBoundingClientRect().bottom;
    const cards = [...document.querySelectorAll(".candidate-card")].map((card) => {
      const portrait = card.querySelector(".portrait");
      const copy = card.querySelector(".candidate-copy");
      const name = card.querySelector(".candidate-title");
      const outcome = card.querySelector(".card-outcome");
      const copyStyle = getComputedStyle(copy);
      const cardBox = card.getBoundingClientRect();
      const portraitHeight = portrait.getBoundingClientRect().height;
      const copyHeight = copy.getBoundingClientRect().height;
      return {
        width: card.offsetWidth,
        height: card.offsetHeight,
        top: cardBox.top,
        bottom: cardBox.bottom,
        portraitShare: portraitHeight / (portraitHeight + copyHeight),
        copyClientHeight: copy.clientHeight,
        copyScrollHeight: copy.scrollHeight,
        copyBottom: copy.getBoundingClientRect().bottom - Number.parseFloat(copyStyle.paddingBottom),
        nameBottom: name.getBoundingClientRect().bottom,
        outcomeTop: outcome.getBoundingClientRect().top,
        outcomeBottom: outcome.getBoundingClientRect().bottom,
        outcomeClientHeight: outcome.clientHeight,
        outcomeScrollHeight: outcome.scrollHeight,
        valueFontSize: Number.parseFloat(getComputedStyle(outcome.querySelector("b")).fontSize),
        messageFontSize: Number.parseFloat(getComputedStyle(outcome.querySelector("small")).fontSize),
      };
    });
    return { cards, navTop, skipBottom, scrollY, maxScroll: document.documentElement.scrollHeight - innerHeight };
  });
  const invalidShortOutcomes = shortOutcome.cards.filter((card) => (
    Math.abs(card.width - shortOutcome.cards[0].width) > 2
      || Math.abs(card.height - shortOutcome.cards[0].height) > 2
      || card.portraitShare < .6
      || card.portraitShare > .68
      || card.copyScrollHeight > card.copyClientHeight
      || card.outcomeScrollHeight > card.outcomeClientHeight
      || card.outcomeTop < card.nameBottom - 1
      || card.outcomeBottom > card.copyBottom + 1
      || card.valueFontSize < 11
      || card.messageFontSize < 11
  ));
  if (shortOutcome.cards.length !== 4
    || invalidShortOutcomes.length
    || shortOutcome.scrollY < shortOutcome.maxScroll - 1
    || shortOutcome.cards.slice(2).some(({ top, bottom }) => top < 0 || bottom >= shortOutcome.navTop)
    || shortOutcome.skipBottom >= shortOutcome.navTop) {
    throw new Error(`Ganho ou perda ficou recortado em 320 por 568: ${JSON.stringify({ ...shortOutcome, invalidShortOutcomes })}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  if (process.env.POLIMATCH_E2E_CARD_METRICS) {
    await writeFile(process.env.POLIMATCH_E2E_CARD_METRICS, `${JSON.stringify({ card: cardHierarchyEvidence, pending: pendingEvidence, outcomes: outcomeEvidence }, null, 2)}\n`);
  }
  if (process.env.POLIMATCH_E2E_OUTCOME_SCREENSHOT) {
    await page.waitForTimeout(180);
    await page.evaluate(() => {
      document.activeElement?.blur();
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(60);
    await page.screenshot({ path: process.env.POLIMATCH_E2E_OUTCOME_SCREENSHOT });
  }
  await page.locator(".card-outcome").first().waitFor({ state: "hidden", timeout: 2500 });
  await page.locator(".round-instruction", { hasText: "Nova rodada disponível" }).waitFor();
  const persistence = await page.evaluate(() => {
    const probe = window.__polimatchDomProbe;
    probe.observer.disconnect();
    const currentCards = [...document.querySelectorAll(".candidate-card")];
    return {
      topbar: probe.tracked.topbar === document.querySelector(".topbar"),
      nav: probe.tracked.nav === document.querySelector(".bottom-nav"),
      instruction: probe.tracked.instruction === document.querySelector(".round-instruction"),
      retryVote: probe.tracked.retryVote === document.querySelector("#retry-vote"),
      liveRegion: probe.tracked.liveRegion === document.querySelector(".app-live-region"),
      slots: probe.tracked.slots.every((slot, index) => slot === document.querySelectorAll("[data-candidate-slot]")[index]),
      cards: probe.tracked.cards.every((card, index) => card === currentCards[index]),
      focused: document.activeElement === probe.focusedCard,
      focusVisible: probe.focusedCard.matches(":focus-visible") && getComputedStyle(probe.focusedCard).outlineStyle !== "none",
      accessibleNameChanged: probe.initialAccessibleName !== probe.focusedCard.getAttribute("aria-label"),
      substitutions: probe.substitutions,
      announcements: probe.announcements,
      nextRoundIds: currentCards.map((card) => card.dataset.vote),
      statusCount: document.querySelectorAll('[role="status"]').length,
    };
  });
  if (!persistence.topbar || !persistence.nav || !persistence.instruction || !persistence.retryVote || !persistence.liveRegion || !persistence.slots || !persistence.cards) {
    throw new Error("Topbar, navegação, instrução, repetição, região viva ou slots foram substituídos durante o voto");
  }
  if (persistence.substitutions.length) throw new Error(`O MutationObserver detectou substituições persistentes: ${persistence.substitutions.join(", ")}`);
  if (!persistence.focused || !persistence.focusVisible) throw new Error("O botão votado perdeu o foco ou o anel visível durante a nova rodada");
  if (!persistence.accessibleNameChanged) throw new Error("O mesmo botão persistiu, mas seu nome acessível não acompanhou a nova pessoa");
  if (persistence.statusCount !== 1) throw new Error("A região viva foi duplicada durante o voto");
  if (persistence.nextRoundIds.some((id) => selectedRoundIds.includes(id))) throw new Error("O smoke não produziu conteúdo novo suficiente para provar a atualização granular dos slots");
  const confirmingAnnouncement = persistence.announcements.findIndex((message) => message === "Confirmando sua escolha…");
  const resultAnnouncement = persistence.announcements.findIndex((message, index) => index > confirmingAnnouncement && /subiu de patente/i.test(message));
  const nextRoundAnnouncement = persistence.announcements.findIndex((message, index) => index > resultAnnouncement && message === "Nova rodada disponível");
  if (confirmingAnnouncement < 0 || resultAnnouncement < 0 || nextRoundAnnouncement < 0) {
    throw new Error(`A região viva não anunciou a sequência completa: ${persistence.announcements.join(" | ")}`);
  }
  await page.getByRole("button", { name: "Ranking" }).click();
  await page.getByRole("heading", { name: "Ranking" }).waitFor();
  await page.getByText(`${successfulRoundVotes} ${successfulRoundVotes === 1 ? "escolha confirmada" : "escolhas confirmadas"}`, { exact: true }).waitFor();
  await page.getByText("Mais derrotas").waitFor();
  const rejected = await page.locator(".ranking-highlight-rejected").innerText();
  const expectedRejected = candidates.filter(({ id }) => selectedRoundIds.includes(id) && id !== selectedWinnerId).map(({ displayName }) => displayName);
  if (!expectedRejected.every((name) => rejected.includes(name)) || !rejected.includes("−1")) {
    throw new Error("As três comparações negativas não apareceram no resumo do ranking");
  }
  await page.getByRole("button", { name: "Seu ranking" }).click();
  await page.getByText("Ordenado por maioria nos confrontos observados").waitFor();
  if (process.env.POLIMATCH_E2E_PERSONAL_RANKING_SCREENSHOT) {
    await page.evaluate(() => {
      document.activeElement?.blur();
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(60);
    await page.screenshot({ path: process.env.POLIMATCH_E2E_PERSONAL_RANKING_SCREENSHOT });
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Início" }).click();
  await page.getByRole("heading", { name: "Quem representa o Brasil que você imagina?" }).waitFor();
  await page.getByRole("button", { name: "Duelo" }).click();
  await page.getByRole("heading", { name: "Quem você prefere?" }).waitFor();
  const desktopCards = await page.locator(".candidate-card").evaluateAll((cards) => cards.map((card) => {
    const box = card.getBoundingClientRect();
    return { top: box.top, right: box.right, bottom: box.bottom, left: box.left };
  }));
  if (desktopCards.length !== 4
    || desktopCards.some((card) => Math.abs(card.top - desktopCards[0].top) > 2)
    || desktopCards.slice(1).some((card, index) => card.left <= desktopCards[index].right)) {
    throw new Error("As quatro cartas não ficaram lado a lado no viewport desktop");
  }
  const desktopWidths = desktopCards.map(({ left, right }) => right - left);
  const desktopHeights = desktopCards.map(({ top, bottom }) => bottom - top);
  if (Math.max(...desktopWidths) - Math.min(...desktopWidths) > 2 || Math.max(...desktopHeights) - Math.min(...desktopHeights) > 2) {
    throw new Error("As quatro cartas não receberam a mesma exposição no desktop");
  }
  if (desktopCards.some(({ top, right, bottom, left }) => top < 0 || left < 0 || right > 1280 || bottom > 900)) {
    throw new Error("Uma das cartas escapou do viewport desktop");
  }
  const desktopRatio = desktopWidths[0] / desktopHeights[0];
  if (desktopRatio < .69 || desktopRatio > .73) {
    throw new Error("As cartas desktop perderam a proporção 5 por 7");
  }
  const desktopHeaderLeft = await page.locator(".duel-head").evaluate((element) => element.getBoundingClientRect().left);
  const desktopInstructionLeft = await page.locator(".round-instruction").evaluate((element) => element.getBoundingClientRect().left);
  if (Math.abs(desktopHeaderLeft - desktopInstructionLeft) > 2) {
    throw new Error("A instrução desktop ficou desconectada do cabeçalho");
  }
  if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) {
    throw new Error("O duelo criou overflow horizontal no desktop");
  }
  const desktopTypography = await page.locator(".candidate-card").first().evaluate((card) => [
    ".candidate-name",
    ".card-rarity",
    ".candidate-affiliation",
    ".candidate-office",
    ".candidate-summary",
    ".candidate-profile-hint",
  ].map((selector) => {
    const element = card.querySelector(selector);
    const style = getComputedStyle(element);
    return { selector, display: style.display, fontSize: style.fontSize };
  }));
  if (desktopTypography.some(({ display, fontSize }) => display !== "none" && Number.parseFloat(fontSize) < 11)) {
    throw new Error("A carta desktop voltou a exibir texto funcional abaixo de 11px");
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  const imacCards = await page.locator(".candidate-card").evaluateAll((cards) => cards.map((card) => {
    const box = card.getBoundingClientRect();
    return { top: box.top, right: box.right, bottom: box.bottom, left: box.left };
  }));
  if (imacCards.length !== 4
    || imacCards.some(({ top, right, bottom, left }) => top < 0 || left < 0 || right > 1440 || bottom > 900)
    || imacCards.slice(1).some((card, index) => card.left <= imacCards[index].right)) {
    throw new Error("As quatro cartas não ficaram integralmente visíveis no viewport de iMac");
  }
  if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) {
    throw new Error("O duelo criou overflow horizontal no iMac");
  }

  if (process.env.POLIMATCH_E2E_SCREENSHOT) {
    await page.screenshot({ path: process.env.POLIMATCH_E2E_SCREENSHOT });
  }

  await page.locator(".candidate-card").first().click();
  await page.locator("[data-personal-feedback]", { hasText: /subiu de patente/i }).waitFor();
  const desktopOutcomeEvidence = await measureRoundOutcomes(page);
  assertOutcomeSemantics(desktopOutcomeEvidence, "1440 × 900");
  await page.locator(".card-outcome").first().waitFor({ state: "hidden", timeout: 2500 });

  if (pageErrors.length) throw new Error(`Erros na página: ${pageErrors.join(" | ")}`);
  console.log(`${browserName}: navegação, rodada de quatro, DOM/foco persistentes, pressão longa e ranking validados`);
} catch (error) {
  console.error(await page.locator("body").innerText());
  console.error(`Erros capturados: ${pageErrors.join(" | ") || "nenhum"}`);
  throw error;
} finally {
  await browser.close();
}
