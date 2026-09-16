import { chromium, webkit } from "playwright";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const browserType = { chromium, webkit }[browserName];
const googleEnabled = process.env.POLIMATCH_E2E_GOOGLE === "1";
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const candidates = [
  {
    personId: 1,
    id: "lula",
    name: "Luiz Inácio Lula da Silva (Lula)",
    displayName: "Lula",
    party: "PT",
    role: "Presidente da República",
    office: "Presidente da República",
    summary: "Presidente do Brasil e possível candidato em 2026.",
    bio: "Perfil editorial de teste do primeiro candidato.",
  },
  {
    personId: 3,
    id: "renan-santos",
    name: "Renan Santos",
    displayName: "Renan Santos",
    party: "Missão",
    role: "Ativista e candidato à Presidência",
    office: "Fundador do MBL",
    summary: "Atuação política e liderança ligada ao Movimento Brasil Livre.",
    bio: "Perfil editorial de teste do segundo candidato.",
  },
  {
    personId: 101,
    id: "anitta",
    name: "Anitta",
    displayName: "Anitta",
    affiliation: "Cultura",
    role: "Cantora e empresária",
    office: "Artista",
    summary: "Artista brasileira com projeção internacional.",
    bio: "Perfil editorial de teste da terceira pessoa.",
  },
  {
    personId: 102,
    id: "neymar-jr",
    name: "Neymar Jr.",
    displayName: "Neymar Jr.",
    affiliation: "Esporte",
    role: "Jogador de futebol",
    office: "Atleta",
    summary: "Atleta brasileiro de projeção internacional.",
    bio: "Perfil editorial de teste da quarta pessoa.",
  },
];

function ranking(decisions = 0, winnerId = "") {
  return candidates.map((candidate) => ({
    ...candidate,
    elo: decisions ? (candidate.id === winnerId ? 1085 : 1025) : 1040,
    wins: decisions && candidate.id === winnerId ? 3 : 0,
    losses: decisions && candidate.id !== winnerId ? 1 : 0,
    decisions: decisions ? (candidate.id === winnerId ? 3 : 1) : 0,
    winRate: decisions && candidate.id === winnerId ? 100 : 0,
  }));
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
page.on("pageerror", (error) => pageErrors.push(error.message));

if (googleEnabled) {
  await page.route("https://accounts.google.com/gsi/client", (route) => route.fulfill({
    contentType: "application/javascript",
    body: `window.google={accounts:{id:{initialize(options){window.__polimatchGoogleCallback=options.callback},renderButton(element){const button=document.createElement('button');button.type='button';button.textContent='Continuar com Google';button.addEventListener('click',()=>window.__polimatchGoogleCallback({credential:'mock-google-id-token'}));element.replaceChildren(button)}}}};`,
  }));
}

await page.route(/\/api(?:\/|$)/, async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  let body;
  if (path === "/api/candidates") body = { candidates };
  else if (path === "/api/ranking") body = { duels: 0, ranking: ranking() };
  else if (path === "/api/player" && request.method() === "POST") body = { recoveryKey: "e2e-recovery-key" };
  else if (path === "/api/player/state") body = { version: 0, duels: 0, ranking: ranking() };
  else if (path === "/api/auth/google" && request.method() === "POST") body = { sessionToken: `pms_${"s".repeat(43)}`, account: { displayName: "Bia", avatarUrl: "" }, player: { version: 0, duels: 0, ranking: ranking(), account: { displayName: "Bia", avatarUrl: "" } } };
  else if (path === "/api/auth/logout" && request.method() === "POST") {
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
    body = {
      duels: 1,
      ranking: ranking(1, payload.winnerId),
      player: { version: 1, duels: 1, ranking: ranking(1, payload.winnerId) },
      round: { winnerDelta: 45, zebra: false, comparisons: 3, rankingEvent: "overtake" },
      vote: { winnerDelta: 45, zebra: false, comparisons: 3, rankingEvent: "overtake", feedback },
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
    await page.getByRole("button", { name: "Sair desta conta" }).click();
    await page.getByText("Você saiu. Um jogo novo começou neste aparelho.").waitFor();
    if (await page.locator("#retry-vote").count()) throw new Error("O logout preservou um voto pendente da conta anterior");

    failNextRoundVote = true;
    await page.locator(".candidate-card").first().click();
    await page.locator("#retry-vote").waitFor();
    const roundBeforeLogin = roundVoteRequests.at(-1)?.roundId;
    if (!roundBeforeLogout || !roundBeforeLogin || roundBeforeLogout === roundBeforeLogin) {
      throw new Error("O logout não rotacionou o roundId ligado à identidade anterior");
    }

    await page.getByRole("button", { name: "Salvar seu jogo com Google" }).click();
    await page.getByRole("button", { name: "Continuar com Google" }).click();
    await page.getByRole("heading", { name: "Tudo certo, Bia!" }).waitFor();
    await page.getByRole("button", { name: "Voltar ao jogo" }).click();
    if (await page.locator("#retry-vote").count()) throw new Error("O login preservou um voto pendente do jogador anônimo");

    await page.locator(".candidate-card").first().click();
    await page.getByText(/subiu de patente/i).waitFor();
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
  if (process.env.POLIMATCH_E2E_DUEL_SCREENSHOT) {
    await page.screenshot({ path: process.env.POLIMATCH_E2E_DUEL_SCREENSHOT, fullPage: true });
  }

  await page.setViewportSize({ width: 320, height: 568 });
  const shortMobileCards = await page.locator(".candidate-card").evaluateAll((cards) => cards.map((card) => {
    const box = card.getBoundingClientRect();
    return { top: box.top, right: box.right, bottom: box.bottom, left: box.left };
  }));
  if (shortMobileCards.length !== 4 || shortMobileCards.some(({ top, right, bottom, left }) => top < 0 || left < 0 || right > 320 || bottom > 568)) {
    throw new Error("As quatro cartas não cabem juntas no viewport móvel curto de 320 por 568");
  }
  const shortNavBox = await page.locator(".bottom-nav").boundingBox();
  if (!shortNavBox || Math.max(...shortMobileCards.map(({ bottom }) => bottom)) >= shortNavBox.y) {
    throw new Error("A navegação inferior cobriu as cartas no viewport móvel curto");
  }
  await page.setViewportSize({ width: 390, height: 844 });

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

  const selectedWinnerId = await firstCard.getAttribute("data-vote");
  await firstCard.click();
  await page.getByText(/subiu de patente/i).waitFor();
  if (!await page.locator("#skip-round").isDisabled()) throw new Error("A troca de rodada permaneceu ativa durante o resultado");
  if (await page.locator(".card-outcome").count() !== 4) throw new Error("O resultado visual não apareceu nas quatro cartas");
  if (await page.locator(".candidate-card.is-round-winner").count() !== 1 || await page.locator(".candidate-card.is-round-loser").count() !== 3) {
    throw new Error("Vitória e derrotas não receberam tratamentos visuais distintos");
  }
  if (!await page.locator(".candidate-card.is-round-winner").getByText("+45 Elo").isVisible()) throw new Error("O ganho real de Elo não apareceu na carta escolhida");
  if (await page.locator(".candidate-card.is-round-loser").getByText("-15 Elo").count() !== 3) throw new Error("As perdas reais de Elo não apareceram nas outras cartas");
  if (process.env.POLIMATCH_E2E_OUTCOME_SCREENSHOT) {
    await page.waitForTimeout(180);
    await page.screenshot({ path: process.env.POLIMATCH_E2E_OUTCOME_SCREENSHOT });
  }
  await page.locator(".card-outcome").first().waitFor({ state: "hidden", timeout: 2500 });
  await page.getByRole("button", { name: "Ranking" }).click();
  await page.getByRole("heading", { name: "Ranking" }).waitFor();
  await page.getByText("1 escolha confirmada").waitFor();
  await page.getByText("Mais derrotas").waitFor();
  const rejected = await page.locator(".ranking-highlight-rejected").innerText();
  const expectedRejected = candidates.filter(({ id }) => id !== selectedWinnerId).map(({ displayName }) => displayName);
  if (!expectedRejected.every((name) => rejected.includes(name)) || !rejected.includes("−1")) {
    throw new Error("As três comparações negativas não apareceram no resumo do ranking");
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
    await page.screenshot({ path: process.env.POLIMATCH_E2E_SCREENSHOT, fullPage: true });
  }

  if (pageErrors.length) throw new Error(`Erros na página: ${pageErrors.join(" | ")}`);
  console.log(`${browserName}: navegação Início/Duelo, rodada de quatro, pressão longa e ranking validados`);
} catch (error) {
  console.error(await page.locator("body").innerText());
  console.error(`Erros capturados: ${pageErrors.join(" | ") || "nenhum"}`);
  throw error;
} finally {
  await browser.close();
}
