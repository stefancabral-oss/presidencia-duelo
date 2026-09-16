import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import { curatedPortraitPath, hasCuratedPortrait } from "../../shared/curated-portraits.js";
import { completedDailySession } from "./daily-fixture.mjs";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const metricsPath = process.env.POLIMATCH_E2E_RESPONSIVE_METRICS;
const screenshotsDir = process.env.POLIMATCH_E2E_RESPONSIVE_SCREENSHOTS_DIR;
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const viewports = [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 479, height: 844 },
  { width: 480, height: 844 },
  { width: 699, height: 900 },
  { width: 700, height: 900 },
  { width: 768, height: 900 },
  { width: 900, height: 900 },
  { width: 999, height: 900 },
  { width: 1000, height: 900 },
  { width: 1200, height: 900 },
  { width: 1279, height: 900 },
  { width: 1280, height: 620 },
  { width: 1440, height: 640 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];
const screenshotViewports = new Set(["768x900", "1000x900", "1440x640"]);
const candidates = CATALOG
  .filter(({ personId }) => hasCuratedPortrait(personId))
  .map((candidate, index) => ({
    ...candidate,
    photo: curatedPortraitPath(candidate.personId),
    photoApproved: true,
    elo: 1200 - index,
    wins: Math.max(1, 18 - (index % 17)),
    losses: 1 + (index % 8),
    decisions: 24,
    winRate: Math.round((Math.max(1, 18 - (index % 17)) / 24) * 100),
  }));
const playableNames = candidates.map(({ displayName, name }) => displayName || name);

async function screenMetrics(page, screen) {
  return page.evaluate(({ currentScreen, names }) => {
    const readBox = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      return {
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height,
      };
    };
    const result = {
      screen: currentScreen,
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      },
      shell: readBox(".app-shell"),
      topbar: readBox(".topbar"),
      brand: readBox(".brand"),
      main: readBox("main.screen:not([hidden])"),
    };

    if (currentScreen === "home") {
      result.hero = readBox(".home-hero");
    }

    if (currentScreen === "duel") {
      const arena = document.querySelector(".arena-four");
      const cards = [...document.querySelectorAll(".candidate-wrap")];
      result.arena = readBox(".arena-four");
      result.gridColumns = arena ? getComputedStyle(arena).gridTemplateColumns.split(" ").filter(Boolean).length : 0;
      result.cards = cards.map((card) => card.getBoundingClientRect().toJSON());
      result.profileTriggers = [...document.querySelectorAll(".profile-trigger")].map((button) => button.getBoundingClientRect().toJSON());
      result.skip = readBox("#skip-round");
      result.navigation = readBox(".bottom-nav");
      const nameElement = document.querySelector(".candidate-name, .candidate-copy > strong");
      const originalName = nameElement?.textContent || "";
      result.names = nameElement ? names.map((name) => {
        nameElement.textContent = name;
        const style = getComputedStyle(nameElement);
        return {
          name,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          overflow: style.overflow,
          clientHeight: nameElement.clientHeight,
          scrollHeight: nameElement.scrollHeight,
        };
      }) : [];
      if (nameElement) nameElement.textContent = originalName;
    }

    if (currentScreen === "ranking") {
      result.heading = readBox(".ranking-heading");
      result.overview = readBox(".ranking-overview");
      result.results = readBox(".ranking-results");
      result.search = readBox(".ranking-search");
      result.list = readBox(".ranking-list");
      result.firstRow = readBox(".ranking-row");
    }
    return result;
  }, { currentScreen: screen, names: playableNames });
}

async function compactDuelScrollMetrics(page) {
  const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  if (maxScroll <= 0) return null;

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(() => Math.abs(
    scrollY - (document.documentElement.scrollHeight - innerHeight),
  ) <= 1);
  const metrics = await page.evaluate(() => {
    const readBox = (element) => element?.getBoundingClientRect().toJSON() || null;
    return {
      scrollY,
      maxScroll: document.documentElement.scrollHeight - innerHeight,
      secondRow: [...document.querySelectorAll(".candidate-wrap")].slice(2).map(readBox),
      skip: readBox(document.querySelector("#skip-round")),
      navigation: readBox(document.querySelector(".bottom-nav")),
    };
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  return metrics;
}

const browser = await browserType.launch();
const context = await browser.newContext({ viewport: viewports[0], serviceWorkers: "block" });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

await page.route(/\/api(?:\/|$)/, async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  if (path === "/api/candidates") return route.fulfill({ status: 200, json: { candidates } });
  if (path === "/api/ranking") return route.fulfill({ status: 200, json: { duels: 240, ranking: candidates } });
  if (path === "/api/player" && request.method() === "POST") return route.fulfill({ status: 200, json: { recoveryKey: "responsive-layout-key" } });
  if (path === "/api/player/state") return route.fulfill({ status: 200, json: { version: 0, duels: 0, ranking: candidates } });
  if (path === "/api/daily-session") return route.fulfill({ status: 200, json: completedDailySession(candidates) });
  return route.fulfill({ status: 404, json: { error: "mock não encontrado" } });
});

async function goTo(screen) {
  const labels = { home: "Início", duel: "Duelo", ranking: "Ranking" };
  const headings = {
    home: "Quem representa o Brasil que você imagina?",
    duel: "Quem você prefere?",
    ranking: "Ranking",
  };
  await page.getByRole("button", { name: labels[screen] }).click();
  if (screen === "duel") {
    await page.locator("#start-free-mode:visible, .candidate-card:visible").first().waitFor();
    if (await page.getByRole("button", { name: "Continuar no modo livre" }).count()) {
      await page.getByRole("button", { name: "Continuar no modo livre" }).click();
    }
  }
  await page.getByRole("heading", { name: headings[screen], exact: true }).waitFor();
  if (screen === "duel" && await page.getByRole("button", { name: "Começar rodada", exact: true }).count()) {
    await page.getByRole("button", { name: "Começar rodada", exact: true }).click();
  }
  if (screen === "duel") await page.locator(".candidate-card").first().waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
}

function assertResponsiveLayout(evidence) {
  const problems = [];
  const byViewport = new Map();
  for (const measurement of evidence) {
    const viewportKey = `${measurement.viewport.width}x${measurement.viewport.height}`;
    const screens = byViewport.get(viewportKey) || [];
    screens.push(measurement);
    byViewport.set(viewportKey, screens);
    if (measurement.document.horizontalOverflow) problems.push(`${viewportKey}/${measurement.screen}: overflow horizontal`);
    if (!measurement.main || measurement.main.width <= 0 || measurement.main.height <= 0) {
      problems.push(`${viewportKey}/${measurement.screen}: painel ativo sem geometria mensurável`);
    }
  }

  for (const [viewportKey, screens] of byViewport) {
    const shellWidths = screens.map(({ shell }) => shell.width);
    const brandPositions = screens.map(({ brand }) => brand.left);
    if (Math.max(...shellWidths) - Math.min(...shellWidths) > 1) problems.push(`${viewportKey}: largura do shell varia entre telas`);
    if (Math.max(...brandPositions) - Math.min(...brandPositions) > 1) problems.push(`${viewportKey}: alinhamento da marca varia entre telas`);

    const duel = screens.find(({ screen }) => screen === "duel");
    const expectedColumns = duel.viewport.width < 1000 ? 2 : 4;
    if (duel.gridColumns !== expectedColumns) problems.push(`${viewportKey}/duel: ${duel.gridColumns} colunas; esperado ${expectedColumns}`);
    for (const card of duel.cards) {
      if (card.left < -1 || card.right > duel.viewport.width + 1) problems.push(`${viewportKey}/duel: carta fora da largura visível`);
    }
    if (duel.profileTriggers.length !== 4 || duel.profileTriggers.some(({ width, height }) => width <= 0 || height < 44)) {
      problems.push(`${viewportKey}/duel: rodapé Conhecer perfil ausente ou abaixo de 44px`);
    }
    if (duel.compactScroll) {
      for (const card of duel.cards.slice(0, 2)) {
        if (card.top < -1 || card.bottom > duel.navigation.top + 1) {
          problems.push(`${viewportKey}/duel: primeira linha coberta pela navegação`);
        }
      }
      const { compactScroll } = duel;
      if (compactScroll.scrollY < compactScroll.maxScroll - 1) {
        problems.push(`${viewportKey}/duel: fim da rodada não foi alcançado pela rolagem`);
      }
      if (compactScroll.secondRow.length !== 2 || compactScroll.secondRow.some((card) => (
        card.top < -1 || card.bottom > compactScroll.navigation.top + 1
      ))) {
        problems.push(`${viewportKey}/duel: segunda linha coberta após a rolagem`);
      }
      if (!compactScroll.skip || compactScroll.skip.bottom > compactScroll.navigation.top + 1) {
        problems.push(`${viewportKey}/duel: ação de pular coberta após a rolagem`);
      }
    } else {
      for (const card of duel.cards) {
        if (card.bottom > duel.navigation.top + 1) problems.push(`${viewportKey}/duel: carta coberta pela navegação`);
      }
    }
    const clippedNames = duel.names.filter(({ overflow, clientHeight, scrollHeight }) => overflow !== "visible" || scrollHeight > clientHeight + 1);
    if (duel.names.length !== playableNames.length) problems.push(`${viewportKey}/duel: nomes não puderam ser medidos`);
    if (clippedNames.length) problems.push(`${viewportKey}/duel: ${clippedNames.length} nomes truncados`);
    const undersizedNames = duel.names.filter(({ fontSize }) => Number.parseFloat(fontSize) < 11);
    if (undersizedNames.length) problems.push(`${viewportKey}/duel: nomes abaixo de 11px`);

    const ranking = screens.find(({ screen }) => screen === "ranking");
    if (ranking.viewport.width < 1000 && ranking.list.width < ranking.main.width * .95) {
      problems.push(`${viewportKey}/ranking: lista não usa a largura disponível`);
    }
    if (ranking.viewport.width >= 1000) {
      if (ranking.list.width < ranking.main.width * .55) problems.push(`${viewportKey}/ranking: lista desktop estreita`);
      if (ranking.search.top >= ranking.viewport.height || ranking.firstRow.top >= ranking.viewport.height) {
        problems.push(`${viewportKey}/ranking: busca ou primeira linha fora da área visível`);
      }
    }
  }

  if (problems.length) throw new Error(`Falhas responsivas:\n- ${problems.join("\n- ")}`);
}

try {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  if (screenshotsDir) await mkdir(screenshotsDir, { recursive: true });
  const evidence = [];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const viewportKey = `${viewport.width}x${viewport.height}`;
    for (const screen of ["home", "duel", "ranking"]) {
      await goTo(screen);
      const measurement = await screenMetrics(page, screen);
      if (screen === "duel" && viewport.width < 480) {
        measurement.compactScroll = await compactDuelScrollMetrics(page);
      }
      evidence.push(measurement);
      if (screenshotsDir && screenshotViewports.has(viewportKey)) {
        await page.screenshot({ path: `${screenshotsDir}/${viewportKey}-${screen}.png` });
      }
    }
  }
  assertResponsiveLayout(evidence);
  if (metricsPath) await writeFile(metricsPath, `${JSON.stringify(evidence, null, 2)}\n`);
  if (pageErrors.length) throw new Error(`Erros na página: ${pageErrors.join(" | ")}`);
  console.log(`${browserName}: 3 telas validadas em ${viewports.length} viewports responsivos`);
} catch (error) {
  console.error(await page.locator("body").innerText());
  console.error(`Erros capturados: ${pageErrors.join(" | ") || "nenhum"}`);
  throw error;
} finally {
  await browser.close();
}
