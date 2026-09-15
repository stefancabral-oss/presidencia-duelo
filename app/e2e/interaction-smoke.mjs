import { chromium, webkit } from "playwright";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const browserType = { chromium, webkit }[browserName];
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

function ranking(decisions = 0) {
  return candidates.map((candidate, index) => ({
    ...candidate,
    elo: decisions ? (index ? 1484 : 1516) : 1500,
    wins: decisions && !index ? 3 : 0,
    losses: decisions && index ? 1 : 0,
    decisions: decisions ? (!index ? 3 : 1) : 0,
    winRate: decisions && !index ? 100 : 0,
  }));
}

const browser = await browserType.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  serviceWorkers: "block",
});
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

await page.route(/\/api(?:\/|$)/, async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  let body;
  if (path === "/api/candidates") body = { candidates };
  else if (path === "/api/ranking") body = { duels: 0, ranking: ranking() };
  else if (path === "/api/player" && request.method() === "POST") body = { recoveryKey: "e2e-recovery-key" };
  else if (path === "/api/player/state") body = { version: 0, duels: 0, ranking: ranking() };
  else if (path === "/api/round-vote") {
    body = {
      duels: 1,
      ranking: ranking(1),
      player: { version: 1, duels: 1, ranking: ranking(1) },
      round: { winnerDelta: 45, zebra: false, comparisons: 3 },
      vote: { winnerDelta: 45, zebra: false, comparisons: 3 },
    };
  } else {
    await route.fulfill({ status: 404, json: { error: "mock não encontrado" } });
    return;
  }
  await route.fulfill({ status: 200, json: body });
});

try {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Começar agora|Continuar escolhendo/ }).click();
  await page.getByRole("button", { name: "Começar rodada" }).click();
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

  await firstCard.click();
  await page.getByText(/confirmado · \+45 Elo/).waitFor();
  await page.getByRole("button", { name: "Ranking" }).click();
  await page.getByRole("heading", { name: "Ranking" }).waitFor();
  await page.getByText("1 escolha confirmada").waitFor();
  await page.getByText("Mais derrotas").waitFor();
  const rejected = await page.locator(".ranking-highlight-rejected").innerText();
  if (!["Renan Santos", "Anitta", "Neymar Jr."].every((name) => rejected.includes(name)) || !rejected.includes("−1")) {
    throw new Error("As três comparações negativas não apareceram no resumo do ranking");
  }

  await page.getByRole("button", { name: "Coleção" }).click();
  await page.getByRole("heading", { name: "Coleção" }).waitFor();
  const chromaCards = page.locator(".featured-chroma-card[data-hologram]");
  if (await chromaCards.count() !== 4) throw new Error("As quatro Chromas demonstrativas não foram renderizadas");
  for (const variant of ["supreme-rays", "supreme-rings", "prism-shards", "prism-aurora"]) {
    if (await page.locator(`.${variant}`).count() !== 1) throw new Error(`O holograma ${variant} não é exclusivo`);
  }
  await page.waitForFunction(() => [...document.querySelectorAll(".featured-chroma-card .chroma-art")].every((image) => image.complete && image.naturalWidth > 0));
  const previewImagesReady = await page.locator(".featured-chroma-card .chroma-art").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0));
  if (!previewImagesReady) throw new Error("As artes completas das Chromas não carregaram");
  const chromaBox = await chromaCards.first().boundingBox();
  if (!chromaBox) throw new Error("A primeira Chroma não possui área visível");
  await chromaCards.first().scrollIntoViewIfNeeded();
  const visibleChromaBox = await chromaCards.first().boundingBox();
  if (!visibleChromaBox) throw new Error("A primeira Chroma não pode ser trazida à área visível");
  await page.mouse.move(visibleChromaBox.x + visibleChromaBox.width * .82, visibleChromaBox.y + visibleChromaBox.height * .25);
  const lightPosition = await chromaCards.first().evaluate((card) => card.style.getPropertyValue("--holo-x"));
  if (lightPosition === "50.0%" || !lightPosition) throw new Error("O holograma não respondeu ao movimento do ponteiro");
  const initialApprovedCards = page.locator(".approved-chroma-card");
  if (await initialApprovedCards.count() !== 6) throw new Error("A seleção inicial do lote Chroma não possui seis cartas");
  await initialApprovedCards.first().scrollIntoViewIfNeeded();
  await initialApprovedCards.first().locator(".chroma-art").waitFor({ state: "visible" });
  await initialApprovedCards.first().locator(".chroma-art").evaluate((image) => image.decode());
  if (!await initialApprovedCards.first().locator(".chroma-art").evaluate((image) => image.complete && image.naturalWidth > 0)) throw new Error("A primeira arte aprovada não carregou");
  if (process.env.POLIMATCH_E2E_BATCH_SCREENSHOT) {
    await page.screenshot({ path: process.env.POLIMATCH_E2E_BATCH_SCREENSHOT });
  }
  await page.getByRole("button", { name: "Ver as 35 cartas básicas" }).click();
  const approvedCards = page.locator(".approved-chroma-card");
  if (await approvedCards.count() !== 35) throw new Error("O lote completo de 35 cartas básicas não foi aberto");
  const aiDisclosures = page.locator(".approved-chroma-card .approved-chroma-copy em");
  if (await aiDisclosures.count() !== 35 || !(await aiDisclosures.allTextContents()).every((text) => text.includes("ARTE EDITADA POR IA"))) {
    throw new Error("A transparência sobre edição por IA não acompanha todas as artes");
  }
  for (let index = 0; index < await approvedCards.count(); index += 1) {
    const approvedCard = approvedCards.nth(index);
    await approvedCard.scrollIntoViewIfNeeded();
    await approvedCard.locator(".chroma-art").evaluate((image) => image.decode());
    const imageReady = await approvedCard.locator(".chroma-art").evaluate((image) => image.complete && image.naturalWidth > 0);
    if (!imageReady) throw new Error(`A arte Chroma ${index + 1} não carregou durante a rolagem`);
  }
  if (process.env.POLIMATCH_E2E_COLLECTION_SCREENSHOT) {
    await page.screenshot({ path: process.env.POLIMATCH_E2E_COLLECTION_SCREENSHOT, fullPage: true });
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('[data-screen="topics"]').click();
  await page.getByRole("button", { name: /Começar agora|Continuar escolhendo/ }).click();
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

  await page.getByRole("button", { name: "Coleção" }).click();
  const desktopApproved = page.locator(".approved-chroma-card");
  await desktopApproved.first().scrollIntoViewIfNeeded();
  await Promise.all([0, 1].map((index) => desktopApproved.nth(index).locator(".chroma-art").evaluate((image) => image.decode())));
  const desktopApprovedBoxes = await desktopApproved.evaluateAll((cards) => cards.slice(0, 2).map((card) => {
    const box = card.getBoundingClientRect();
    return { top: box.top, right: box.right, bottom: box.bottom, left: box.left };
  }));
  if (desktopApprovedBoxes.length !== 2 || Math.abs(desktopApprovedBoxes[0].top - desktopApprovedBoxes[1].top) > 2 || desktopApprovedBoxes[1].left <= desktopApprovedBoxes[0].right) {
    throw new Error("As Chromas aprovadas não ficaram lado a lado no desktop");
  }
  if (process.env.POLIMATCH_E2E_BATCH_DESKTOP_SCREENSHOT) {
    await page.screenshot({ path: process.env.POLIMATCH_E2E_BATCH_DESKTOP_SCREENSHOT });
  }

  if (process.env.POLIMATCH_E2E_SCREENSHOT) {
    await page.screenshot({ path: process.env.POLIMATCH_E2E_SCREENSHOT, fullPage: true });
  }

  if (pageErrors.length) throw new Error(`Erros na página: ${pageErrors.join(" | ")}`);
  console.log(`${browserName}: rodada de quatro, pressão longa e ranking validados`);
} catch (error) {
  console.error(await page.locator("body").innerText());
  console.error(`Erros capturados: ${pageErrors.join(" | ") || "nenhum"}`);
  throw error;
} finally {
  await browser.close();
}
