// E2E — shell das áreas cívicas (A01 · #223, A02 · #224, protótipo F01 · #217).
//
// Cobre: flags desligadas (área indisponível legível), proposta de navegação com
// Ranking alcançável por "Mais", deep link recarregado, destino inexistente,
// filtros na URL com voltar/avançar, preservação da rodada e do foco ao sair e
// voltar, retirada (410), corrida na troca de UF, notícias/acontecimento e
// teclado. API do jogo e API cívica são simuladas; nenhum voto é enviado.
import { writeFile, mkdir } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import { hasCuratedPortrait } from "../../shared/curated-portraits.js";
import { capabilityFixture } from "./aggregate-fixture.mjs";
import { approvedEditorialCandidates } from "./editorial-fixtures.mjs";
import { createCivicMock } from "../src/civic/mock-transport.js";
import { candidacyId } from "../../shared/civic-contract.js";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const shotsDir = process.env.POLIMATCH_E2E_CIVIC_SHOTS || "";
const resultsPath = process.env.POLIMATCH_E2E_CIVIC_RESULTS || "";
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const candidates = approvedEditorialCandidates(CATALOG.filter(({ personId }) => hasCuratedPortrait(personId)).slice(0, 8));
const personalRankingPolicy = { id: "pairwise-majority-scc-v1", label: "maioria nos confrontos observados", explanation: "A ordem usa os confrontos diretos e mantém empates sem usar exposição." };
const PRESIDENT_1 = candidacyId("test-2032", "BR", "president", "1");
const PRESIDENT_2 = candidacyId("test-2032", "BR", "president", "2");

const state = { civicFlags: true, delays: {}, voteRequests: [], pageErrors: [], civicCalls: [] };
const civic = createCivicMock({ delayMs: (url) => Object.entries(state.delays).find(([needle]) => url.includes(needle))?.[1] ?? 0 });
const results = { browser: browserName, appUrl, scenarios: [] };

function ranking() {
  return candidates.map((candidate) => ({ ...candidate, elo: 1000, wins: 0, losses: 0, decisions: 0, winRate: 0, rank: null }));
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function installRoutes(page) {
  await page.route(/\/api(?:\/|$)/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.startsWith("/api/civic/")) {
      state.civicCalls.push(`${path}${url.search}`);
      const response = await civic.fetch(`${path}${url.search}`, {});
      const headers = { "content-type": "application/json" };
      const retryAfter = response.headers.get("retry-after");
      if (retryAfter) headers["retry-after"] = retryAfter;
      return route.fulfill({ status: response.status, headers, body: JSON.stringify(await response.json()) });
    }
    if (path === "/api/capabilities") return route.fulfill({ status: 200, json: capabilityFixture() });
    if (path === "/api/candidates") return route.fulfill({ status: 200, json: { candidates } });
    if (path === "/api/ranking") return route.fulfill({ status: 200, json: { duels: 0, ranking: ranking() } });
    if (path === "/api/player" && request.method() === "POST") return route.fulfill({ status: 200, json: { recoveryKey: "civic-navigation-key" } });
    if (path === "/api/player/state") return route.fulfill({ status: 200, json: { version: 0, duels: 0, rankingPolicy: personalRankingPolicy, ranking: ranking() } });
    if (path === "/api/game-capabilities") {
      return route.fulfill({ status: 200, json: state.civicFlags ? { version: 1, civicDirectory: true, civicNews: true } : { version: 1 } });
    }
    if (path === "/api/round-vote") {
      state.voteRequests.push(request.postDataJSON());
      return route.fulfill({ status: 503, json: { error: "nenhum voto deveria ser enviado neste cenário" } });
    }
    return route.fulfill({ status: 404, json: { error: "mock não encontrado" } });
  });
}

async function newPage(browser, viewport = { width: 390, height: 844 }) {
  const context = await browser.newContext({ viewport, serviceWorkers: "block" });
  const page = await context.newPage();
  page.on("pageerror", (error) => state.pageErrors.push(error.message));
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
  await installRoutes(page);
  return { context, page };
}

async function shot(page, name) {
  if (!shotsDir) return;
  await mkdir(shotsDir, { recursive: true });
  const viewport = page.viewportSize();
  await page.screenshot({ path: `${shotsDir}/${name}-${viewport.width}x${viewport.height}.jpg`, type: "jpeg", quality: 70, fullPage: true });
}

async function record(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.scenarios.push({ name, ok: true, ms: Date.now() - started, detail: detail ?? null });
    console.log(`ok - ${name}`);
  } catch (error) {
    results.scenarios.push({ name, ok: false, ms: Date.now() - started, error: error.message });
    console.error(`not ok - ${name}: ${error.message}`);
    throw error;
  }
}

async function enterFreeRound(page) {
  await page.locator('.nav-button[data-screen="duel"]').click();
  await page.getByRole("heading", { name: "Não conseguimos atualizar a rodada.", exact: true }).waitFor();
  await page.locator("#daily-loading-free").click();
  await page.getByRole("heading", { name: "Quem você prefere?", exact: true }).waitFor();
  const coach = page.locator("#coach-dialog");
  if (await coach.evaluate((dialog) => dialog.open)) {
    await page.keyboard.press("Escape");
    await coach.waitFor({ state: "hidden" });
  }
  return page.evaluate(() => ({
    candidateIds: [...document.querySelectorAll(".vote-target")].map((button) => button.dataset.vote),
    roundIds: [...window.__generatedRoundIds],
  }));
}

const activeText = (page) => page.evaluate(() => ({
  tag: document.activeElement?.tagName ?? "",
  text: document.activeElement?.textContent?.trim() ?? "",
  id: document.activeElement?.id ?? "",
  dataset: { ...(document.activeElement?.dataset ?? {}) },
}));

const browser = await browserType.launch();
try {
  // ---------------------------------------------------------------- flags desligadas
  state.civicFlags = false;
  {
    const { context, page } = await newPage(browser);
    await record("flags desligadas: barra original e deep link vira área indisponível", async () => {
      await page.goto(appUrl, { waitUntil: "networkidle" });
      const labels = await page.locator(".bottom-nav .nav-button:not([hidden])").allTextContents();
      check(labels.join("|") === "Início|Duelo|Ranking", `Barra alterada com flags desligadas: ${labels.join("|")}`);
      await page.goto(`${appUrl}#/candidatos`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "Esta área ainda não está aberta", exact: true }).waitFor();
      check(await page.locator(".bottom-nav").isVisible(), "A barra sumiu na área indisponível");
      await page.getByRole("button", { name: "Voltar ao jogo", exact: true }).click();
      await page.locator('.app-shell[data-screen="topics"]').waitFor();
      check((await page.evaluate(() => location.hash)) === "", "O hash não foi limpo ao voltar ao jogo");
      return { labels };
    });
    await context.close();
  }

  // ---------------------------------------------------------------- flags ligadas
  state.civicFlags = true;
  const { context, page } = await newPage(browser);

  await record("proposta de navegação: Jogar, Candidatos, Notícias e Mais com Ranking alcançável", async () => {
    await page.goto(appUrl, { waitUntil: "networkidle" });
    const labels = await page.locator(".bottom-nav .nav-button:not([hidden])").allTextContents();
    check(labels.join("|") === "Início|Jogar|Candidatos|Notícias|Mais", `Barra proposta incorreta: ${labels.join("|")}`);
    const more = page.locator("[data-nav-more]");
    await more.click();
    check((await more.getAttribute("aria-expanded")) === "true", "Mais não expandiu");
    const sheetButtons = await page.locator("#nav-more-sheet .nav-button:not([hidden])").allTextContents();
    check(sheetButtons.includes("Ranking"), `Ranking não está em Mais: ${sheetButtons.join("|")}`);
    await shot(page, "nav-mais-aberto");
    await page.keyboard.press("Escape");
    check(await page.locator("#nav-more-sheet").isHidden(), "Escape não fechou Mais");
    check((await activeText(page)).text === "Mais", "Escape não devolveu o foco ao botão Mais");
    await more.click();
    await page.locator('#nav-more-sheet .nav-button[data-screen="ranking"]').click();
    await page.locator('.app-shell[data-screen="ranking"]').waitFor();
    check(await page.locator("#nav-more-sheet").isHidden(), "Mais não fechou após escolher Ranking");
    return { labels, sheetButtons };
  });

  await record("deep link recarregado abre o diretório com foco no título", async () => {
    await page.goto(`${appUrl}#/candidatos?uf=BR&disputa=president`, { waitUntil: "networkidle" });
    await page.locator('.civic-view[data-civic-view="directory"] .civic-card').first().waitFor();
    const cards = await page.locator(".civic-results .civic-card").count();
    check(cards === 2, `Esperava 2 cartões, veio ${cards}`);
    check((await page.title()).startsWith("Candidatos"), `Título não atualizado: ${await page.title()}`);
    const active = await activeText(page);
    check(active.tag === "H1", `Foco inicial não está no título: ${JSON.stringify(active)}`);
    const coverage = await page.locator(".civic-coverage").textContent();
    check(/2 de 2 candidaturas/.test(coverage), `Cobertura inesperada: ${coverage}`);
    const photoStates = await page.locator(".civic-card .civic-photo").evaluateAll((nodes) => nodes.map((node) => node.dataset.photoState));
    check(photoStates.includes("pending"), `Fotografia pendente não representada: ${photoStates.join(",")}`);
    await shot(page, "diretorio");
    return { cards, coverage, photoStates };
  });

  await record("destino inexistente e parâmetros inválidos produzem estado legível sem quebrar o shell", async () => {
    await page.goto(`${appUrl}#/ranking-secreto/1`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Destino não encontrado", exact: true }).waitFor();
    check(await page.locator(".bottom-nav").isVisible(), "Barra sumiu no destino inexistente");
    const requested = await page.locator('.civic-view[data-civic-view="not-found"] .civic-section-note').textContent();
    check(requested.includes("#/ranking-secreto/1"), `Endereço pedido não mostrado: ${requested}`);
    await shot(page, "destino-inexistente");
    await page.goto(`${appUrl}#/candidatos?uf=XX&voto=1`, { waitUntil: "networkidle" });
    await page.locator(".civic-results .civic-card").first().waitFor();
    const notices = await page.locator(".civic-notice").allTextContents();
    check(notices.some((text) => text.includes('"XX"')), `Aviso de UF inválida ausente: ${notices.join(" | ")}`);
    check(notices.some((text) => text.includes("voto")), `Aviso de parâmetro ignorado ausente: ${notices.join(" | ")}`);
    return { requested, notices };
  });

  await record("filtros vivem na URL e voltar/avançar restauram resultados", async () => {
    await page.goto(`${appUrl}#/candidatos?uf=BR&disputa=president`, { waitUntil: "networkidle" });
    await page.locator(".civic-results .civic-card").first().waitFor();
    await page.locator("#civic-filters-search").fill("ninguém");
    await page.locator("#civic-filters-search").press("Enter");
    await page.locator('.civic-state[data-civic-state="empty"]').waitFor();
    check((await page.evaluate(() => location.hash)).includes("busca=ningu"), "Busca não foi para a URL");
    const emptyText = await page.locator(".civic-state-empty").textContent();
    check(/Nenhuma candidatura publicada combina/.test(emptyText), `Texto de vazio inesperado: ${emptyText}`);
    await shot(page, "diretorio-vazio-filtro");
    await page.goBack();
    await page.locator(".civic-results .civic-card").first().waitFor();
    check((await page.locator(".civic-results .civic-card").count()) === 2, "Voltar não restaurou a lista");
    check((await page.locator("#civic-filters-search").inputValue()) === "", "Voltar não limpou o campo de busca");
    await page.goForward();
    await page.locator('.civic-state[data-civic-state="empty"]').waitFor();
    check((await page.locator("#civic-filters-search").inputValue()) === "ninguém", "Avançar não restaurou o filtro");
    return { emptyText };
  });

  await record("sair para uma ficha durante a rodada e voltar preserva as quatro cartas, sem voto e com foco de volta", async () => {
    await page.goto(appUrl, { waitUntil: "networkidle" });
    const before = await enterFreeRound(page);
    check(before.candidateIds.length === 4, "Rodada livre não montou quatro cartas");
    const trigger = page.locator('.nav-button[data-civic-area="directory"]');
    await trigger.click();
    await page.locator(".civic-results .civic-card").first().waitFor();
    await page.locator(`.civic-results a[data-civic-candidacy="${PRESIDENT_1}"]`).click();
    await page.locator('.civic-view[data-civic-view="candidacy"] .civic-profile-top').waitFor();
    check((await page.title()).startsWith("Candidatura"), "Título da ficha não aplicado");
    const ticketRoles = await page.locator(".civic-member-role").allTextContents();
    check(ticketRoles.includes("Titular") && ticketRoles.includes("Vice"), `Chapa sem titular/vice: ${ticketRoles.join(",")}`);
    await shot(page, "ficha");
    await page.getByRole("button", { name: "Voltar ao jogo", exact: true }).click();
    await page.locator('.app-shell[data-screen="duel"]').waitFor();
    const after = await page.evaluate(() => ({
      candidateIds: [...document.querySelectorAll(".vote-target")].map((button) => button.dataset.vote),
      roundIds: [...window.__generatedRoundIds],
      hash: location.hash,
    }));
    check(JSON.stringify(after.candidateIds) === JSON.stringify(before.candidateIds), `Cartas mudaram: ${before.candidateIds} → ${after.candidateIds}`);
    check(after.roundIds.length === before.roundIds.length, "Uma nova rodada foi gerada pela navegação");
    check(state.voteRequests.length === 0, "Algum voto foi enviado pela navegação");
    check(after.hash === "", `Hash não limpo ao voltar: ${after.hash}`);
    const active = await activeText(page);
    check(active.dataset.civicArea === "directory", `Foco não voltou ao acionador: ${JSON.stringify(active)}`);
    check((await page.title()) === "PoliMatch — Eleições 2026", `Título não restaurado: ${await page.title()}`);
    return { before: before.candidateIds, after: after.candidateIds, ticketRoles };
  });

  await record("voltar do navegador a partir da área cívica devolve ao jogo com a rodada intacta", async () => {
    const before = await page.evaluate(() => [...document.querySelectorAll(".vote-target")].map((button) => button.dataset.vote));
    await page.locator('.nav-button[data-civic-area="news"]').click();
    await page.locator('.civic-view[data-civic-view="news"]').waitFor();
    await page.goBack();
    await page.locator('.app-shell[data-screen="duel"]').waitFor();
    const after = await page.evaluate(() => [...document.querySelectorAll(".vote-target")].map((button) => button.dataset.vote));
    check(JSON.stringify(before) === JSON.stringify(after), "Voltar do navegador alterou a rodada");
    check(state.voteRequests.length === 0, "Voto enviado ao voltar");
    return { before, after };
  });

  await record("comparação: seleção de duas candidaturas com temas equivalentes e recusa de seleção inválida", async () => {
    await page.goto(`${appUrl}#/candidatos?uf=BR&disputa=president`, { waitUntil: "networkidle" });
    await page.locator(".civic-results .civic-card").first().waitFor();
    const compare = page.locator('[data-civic-action="compare"]');
    check(await compare.isHidden(), "Barra de comparação visível sem seleção");
    await page.locator(`input[data-civic-compare="${PRESIDENT_1}"]`).check();
    check(await compare.isDisabled(), "Comparar habilitado com uma só candidatura");
    await page.locator(`input[data-civic-compare="${PRESIDENT_2}"]`).check();
    await compare.click();
    await page.locator('.civic-view[data-civic-view="comparison"] .civic-compare-theme').first().waitFor();
    const columns = await page.locator(".civic-compare-columns").first().locator(".civic-card").count();
    check(columns === 2, `Esperava duas colunas, veio ${columns}`);
    const emptyCells = await page.locator(".civic-compare-empty").count();
    check(emptyCells === 1, `Lacuna equivalente não mostrada: ${emptyCells}`);
    await shot(page, "comparacao");
    await page.goto(`${appUrl}#/candidatos/comparar?ids=${encodeURIComponent(PRESIDENT_1)}`, { waitUntil: "networkidle" });
    await page.locator('.civic-view[data-civic-view="comparison"] .civic-state[data-civic-state="error"]').waitFor();
    const invalidText = await page.locator(".civic-state-title").textContent();
    check(invalidText === "Consulta inválida", `Estado inválido inesperado: ${invalidText}`);
    check(state.civicCalls.every((call) => !call.includes("/comparisons?ids=" + encodeURIComponent(PRESIDENT_1) + "&") && !call.endsWith(`/comparisons?ids=${encodeURIComponent(PRESIDENT_1)}`)), "Comparação inválida gerou requisição");
    return { columns, emptyCells };
  });

  await record("retirada (410) e limite de consultas aparecem como estados distintos", async () => {
    civic.setScenario("candidacy", "withdrawn");
    await page.goto(`${appUrl}#/candidatos/${encodeURIComponent(PRESIDENT_1)}`, { waitUntil: "networkidle" });
    await page.locator('.civic-view[data-civic-view="candidacy"] .civic-state[data-civic-state="error"]').waitFor();
    const withdrawn = await page.locator(".civic-state-title").textContent();
    check(withdrawn === "Conteúdo retirado", `Retirada não sinalizada: ${withdrawn}`);
    check(await page.locator(".civic-profile").isHidden(), "Conteúdo retirado continuou visível");
    await shot(page, "ficha-retirada");
    civic.setScenario("candidacy", "ok");
    civic.setScenario("directory", "rate-limited");
    // Lista já carregada nesta sessão: a última versão permitida permanece, marcada como desatualizada.
    await page.goto(`${appUrl}#/candidatos?uf=BR&disputa=president`, { waitUntil: "networkidle" });
    await page.locator('.civic-notice[data-tone="warning"]').first().waitFor();
    const softNotices = await page.locator(".civic-notice").allTextContents();
    check(softNotices.some((text) => text.startsWith("Muitas consultas")), `Aviso de limite ausente: ${softNotices.join(" | ")}`);
    check(softNotices.some((text) => /desatualizad/.test(text)), `Aviso de desatualização ausente: ${softNotices.join(" | ")}`);
    // A candidatura retirada acima já saiu da lista local; resta a outra publicada.
    const preserved = await page.locator(".civic-results .civic-card").count();
    check(preserved === 1, `Última versão permitida não preservada como esperado: ${preserved} cartões`);
    check((await page.locator(`.civic-results a[data-civic-candidacy="${PRESIDENT_1}"]`).count()) === 0, "Candidatura retirada reapareceu na lista");
    await shot(page, "diretorio-desatualizado");
    // Recorte nunca carregado: sem versão anterior, o limite vira estado de erro com espera.
    await page.goto(`${appUrl}#/candidatos?uf=SP&disputa=governor`, { waitUntil: "networkidle" });
    await page.locator('.civic-view[data-civic-view="directory"] .civic-state[data-civic-state="error"]').waitFor();
    const limited = await page.locator(".civic-state-title").textContent();
    check(limited === "Muitas consultas", `Limite não sinalizado: ${limited}`);
    const retry = page.locator('.civic-view[data-civic-view="directory"] [data-civic-action="retry"]');
    check(await retry.isDisabled(), "Repetição habilitada durante Retry-After");
    check((await page.locator(".civic-results .civic-card").count()) === 0, "Cartões de outro recorte exibidos durante o erro");
    await shot(page, "diretorio-limite");
    civic.setScenario("directory", "ok");
    return { withdrawn, softNotices, limited };
  });

  await record("trocar UF durante a leitura nunca mostra o recorte anterior", async () => {
    state.delays = { "jurisdiction=SP": 700 };
    await page.goto(`${appUrl}#/candidatos?uf=BR&disputa=president`, { waitUntil: "networkidle" });
    await page.locator(".civic-results .civic-card").first().waitFor();
    await page.locator("#civic-filters-uf").selectOption("SP");
    await page.waitForTimeout(80);
    await page.locator("#civic-filters-uf").selectOption("BR");
    await page.waitForTimeout(1200);
    const uf = await page.locator("#civic-filters-uf").inputValue();
    const contestLabels = await page.locator("#civic-filters-contest option").allTextContents();
    const contestIds = await page.locator(".civic-results .civic-card .civic-card-meta").allTextContents();
    check(uf === "BR", `Recorte final incorreto: ${uf}`);
    check(contestLabels.every((label) => !/Governo|Senado/.test(label)), `Disputas de SP vazaram: ${contestLabels.join("|")}`);
    check(contestIds.length === 2 && contestIds.every((text) => /Presidência/.test(text)), `Resultados de outro recorte: ${contestIds.join("|")}`);
    check((await page.evaluate(() => localStorage.getItem("polimatch:civic:uf"))) === "BR", "Preferência de UF não persistida");
    const gameKeys = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("polimatch:civic:")));
    check(gameKeys.join() === "polimatch:civic:uf", `Chaves cívicas inesperadas: ${gameKeys.join(",")}`);
    state.delays = {};
    return { uf, contestLabels };
  });

  await record("notícias: edição com três espaços por acontecimento e lacunas explícitas", async () => {
    await page.goto(`${appUrl}#/noticias?uf=SP`, { waitUntil: "networkidle" });
    await page.locator('.civic-view[data-civic-view="news"] .civic-event-card').first().waitFor();
    const dots = await page.locator(".civic-slot-dots li").evaluateAll((nodes) => nodes.map((node) => node.dataset.state));
    check(JSON.stringify(dots) === JSON.stringify(["present", "collection_failed", "not_found"]), `Estados dos espaços inesperados: ${dots.join(",")}`);
    await shot(page, "noticias");
    await page.locator(".civic-event-title a").click();
    await page.locator('.civic-view[data-civic-view="event"] .civic-slot').first().waitFor();
    const slotStates = await page.locator(".civic-slot").evaluateAll((nodes) => nodes.map((node) => `${node.dataset.slot}:${node.dataset.state}`));
    check(slotStates.length === 3, `Esperava três espaços, veio ${slotStates.length}`);
    const international = await page.locator('.civic-slot[data-slot="international"] .civic-slot-gap').textContent();
    check(international.length > 0, "Lacuna internacional sem motivo");
    const externalLinks = await page.locator(".civic-slot a[target=_blank]").evaluateAll((nodes) => nodes.map((node) => `${node.getAttribute("rel")}|${node.href}`));
    check(externalLinks.every((entry) => entry.startsWith("noreferrer noopener|https://")), `Links externos inseguros: ${externalLinks.join(" ")}`);
    await shot(page, "acontecimento");
    await page.goto(`${appUrl}#/noticias?uf=BR`, { waitUntil: "networkidle" });
    await page.locator('.civic-view[data-civic-view="news"] .civic-state[data-civic-state="empty"]').waitFor();
    const emptyText = await page.locator(".civic-state-empty").textContent();
    check(/Nenhuma edição publicada para Brasil/.test(emptyText), `Vazio de edição inesperado: ${emptyText}`);
    await shot(page, "noticias-vazio");
    return { dots, slotStates, externalLinks };
  });

  await record("teclado: Tab percorre título, filtros e cartões em ordem", async () => {
    await page.goto(`${appUrl}#/candidatos?uf=BR&disputa=president`, { waitUntil: "networkidle" });
    await page.locator(".civic-results .civic-card").first().waitFor();
    const sequence = [];
    for (let step = 0; step < 9; step += 1) {
      await page.keyboard.press("Tab");
      const active = await activeText(page);
      sequence.push(active.id || active.dataset.civicCandidacy || active.dataset.civicCompare || active.text);
    }
    check(sequence[0] === "civic-filters-uf", `Primeiro Tab não foi ao recorte: ${sequence.join(" > ")}`);
    check(sequence.includes(PRESIDENT_1), `Cartão não alcançado por Tab: ${sequence.join(" > ")}`);
    return { sequence };
  });

  await context.close();

  // ---------------------------------------------------------------- desktop
  {
    const { context: desktopContext, page: desktop } = await newPage(browser, { width: 1280, height: 800 });
    await record("desktop: mesma proposta de navegação e grade de cartões", async () => {
      await desktop.goto(`${appUrl}#/candidatos?uf=BR&disputa=president`, { waitUntil: "networkidle" });
      await desktop.locator(".civic-results .civic-card").first().waitFor();
      const labels = await desktop.locator(".bottom-nav .nav-button:not([hidden])").allTextContents();
      check(labels.join("|") === "Início|Jogar|Candidatos|Notícias|Mais", `Barra desktop incorreta: ${labels.join("|")}`);
      const widths = await desktop.locator(".civic-results .civic-card").evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().width)));
      check(new Set(widths).size === 1, `Cartões com larguras diferentes: ${widths.join(",")}`);
      await shot(desktop, "diretorio");
      await desktop.goto(`${appUrl}#/candidatos/${encodeURIComponent(PRESIDENT_1)}`, { waitUntil: "networkidle" });
      await desktop.locator(".civic-profile-top").waitFor();
      await shot(desktop, "ficha");
      await desktop.goto(`${appUrl}#/noticias/acontecimentos/event-a`, { waitUntil: "networkidle" });
      await desktop.locator(".civic-slot").first().waitFor();
      await shot(desktop, "acontecimento");
      return { labels, widths };
    });
    await desktopContext.close();
  }

  check(state.pageErrors.length === 0, `Erros de página: ${state.pageErrors.join(" | ")}`);
  results.pageErrors = state.pageErrors;
  results.voteRequests = state.voteRequests.length;
  results.ok = true;
} catch (error) {
  results.ok = false;
  results.error = error.message;
  throw error;
} finally {
  if (resultsPath) await writeFile(resultsPath, `${JSON.stringify(results, null, 2)}\n`);
  await browser.close();
}
console.log(`civic-navigation: ${results.scenarios.filter((scenario) => scenario.ok).length}/${results.scenarios.length} cenários aprovados em ${browserName}`);
