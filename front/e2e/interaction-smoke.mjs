import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

const baseUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173";
const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const expectedCollectionFilters = Number(process.env.POLIMATCH_E2E_COLLECTION_FILTERS || 7);
const legacyCollection = process.env.POLIMATCH_E2E_LEGACY_COLLECTION === "1";
const browserType = browserName === "webkit" ? webkit : chromium;
const browser = await browserType.launch({ headless: true });

function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/Failed to load resource:.*(?:429|500)/.test(text)) return;
    errors.push(text);
  });
  return errors;
}

async function exerciseMainUi(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("#tab-duel");

  async function assertTab(button, panel) {
    await page.locator(button).click();
    await page.waitForTimeout(80);
    const active = await page.locator(panel).evaluate((el) => el.classList.contains("active"));
    assert.equal(active, true, `${browserName}: ${button} não ativou ${panel}`);
  }

  await assertTab("#tab-duel", "#panel-duel");
  await assertTab("#tab-tournament", "#panel-tournament");
  await assertTab("#tab-rank", "#panel-rank");
  await assertTab("#tab-credits", "#panel-credits");
  await assertTab("#tab-home", "#panel-home");

  await page.locator("#home-play").click();
  await page.waitForTimeout(80);
  assert.equal(await page.locator("#panel-duel").evaluate((el) => el.classList.contains("active")), true, `${browserName}: Jogar agora não abriu Duelo`);

  const topicButtons = page.locator("#panel-duel .topic-btn");
  if (await topicButtons.count() > 1) {
    const second = topicButtons.nth(1);
    await second.click();
    await page.waitForTimeout(100);
    assert.equal(await second.getAttribute("aria-pressed"), "true");
  }

  const beforeSkip = await page.locator("#card-a").getAttribute("data-id");
  await page.locator("#skip-duel").click();
  await page.waitForTimeout(100);
  const afterSkip = await page.locator("#card-a").getAttribute("data-id");
  assert.notEqual(beforeSkip, afterSkip, `${browserName}: Pular não trocou o duelo`);

  const beforeCount = Number(await page.locator("#duel-count").textContent());
  await page.locator("#card-a").click();
  await page.waitForTimeout(900);
  const afterCount = Number(await page.locator("#duel-count").textContent());
  assert.ok(afterCount >= beforeCount + 1, `${browserName}: Card não registrou duelo`);

  await page.locator("#info-card-a").click();
  await page.waitForTimeout(80);
  assert.equal(await page.locator("#person-profile-dialog").evaluate((el) => el.open), true);
  await page.locator("[data-profile-close]").click();

  const hiddenBlocking = await page.locator(".podium-overlay[hidden], .reset-overlay[hidden]").evaluateAll((els) => els.some((el) => {
    const style = getComputedStyle(el);
    return style.display !== "none" && style.pointerEvents !== "none";
  }));
  assert.equal(hiddenBlocking, false, `${browserName}: Overlay oculto intercepta cliques`);

  await page.waitForSelector("#tab-chromas");
  await page.locator("#tab-chromas").click();
  await page.waitForURL(/\/chromas\.html$/);
  await page.waitForSelector("#chroma-grid");
  assert.equal(
    await page.locator(".chroma-filter").count(),
    expectedCollectionFilters,
    `${browserName}: coleção não expôs todos os filtros`,
  );
  if (!legacyCollection) {
    assert.match(await page.locator("h1").textContent(), /Minha coleção/);
    await page.locator('[data-filter="regular"]').click();
    await page.locator("#chroma-search").fill("Lula");
    await page.locator("#chroma-sort").selectOption("name");
  }
}

try {
  const cleanPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const cleanErrors = trackErrors(cleanPage);
  await exerciseMainUi(cleanPage);
  assert.deepEqual(cleanErrors, [], `${browserName}: erros no browser limpo: ${cleanErrors.join(" | ")}`);
  await cleanPage.close();

  // Reproduz um usuário recorrente vindo de versões anteriores: muitos duelos,
  // campos incompletos/legados e torneio persistido inválido. O bootstrap deve
  // migrar ou descartar o dado ruim sem deixar a Home desenhada e os botões mortos.
  const legacyPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const legacyErrors = trackErrors(legacyPage);
  await legacyPage.addInitScript(() => {
    localStorage.setItem("presidencia-duelo-v1", JSON.stringify({
      duels: 841,
      ratings: {},
      wins: {},
      losses: {},
      zebras: {},
      lastPair: ["legacy-a", "legacy-b"],
      pairCount: { "legacy-a|legacy-b": 37 },
      progressGoal: 30,
      celebratedGoal: 30,
      achievements: ["primeiro-duelo"],
      combo: 2,
      lastVoteAt: Date.now() - 86400000,
    }));
    localStorage.setItem("presidencia-duelo-topic-v1", "politica");
    localStorage.setItem("presidencia-duelo-tournament-v1-politica", JSON.stringify({ version: 0, broken: true }));
  });
  await legacyPage.goto(baseUrl, { waitUntil: "networkidle" });
  await legacyPage.waitForSelector("#tab-chromas", { timeout: 5000 });
  assert.equal(await legacyPage.locator(".tabs").evaluate((el) => el.classList.contains("pm-nav-v2")), true, `${browserName}: bootstrap legado não instalou navegação v2`);
  await legacyPage.locator("#home-play").click();
  await legacyPage.waitForTimeout(80);
  assert.equal(await legacyPage.locator("#panel-duel").evaluate((el) => el.classList.contains("active")), true, `${browserName}: estado legado deixou Jogar agora sem resposta`);
  assert.deepEqual(legacyErrors, [], `${browserName}: erros com estado legado: ${legacyErrors.join(" | ")}`);
  await legacyPage.close();
} finally {
  await browser.close();
}
