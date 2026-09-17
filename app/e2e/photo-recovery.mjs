import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { PRODUCTION_CANDIDATE_REGISTRY, publicCandidate } from "../../back/src/candidates.js";
import { DAILY_SESSION_RULESET, buildDailyEdition } from "../../back/src/daily-session.js";
import { capabilityFixture } from "./aggregate-fixture.mjs";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const candidates = PRODUCTION_CANDIDATE_REGISTRY.candidatesForTopic("eleicoes-2026").map(publicCandidate);
const definition = buildDailyEdition({ topicId: "eleicoes-2026", candidateIds: candidates.map(({ id }) => id), dateKey: "2026-09-17" });
const selectedIds = new Set(definition.rounds.flatMap(({ candidateIds }) => candidateIds));
const session = {
  ruleset: DAILY_SESSION_RULESET,
  edition: { ...definition, snapshotHash: "b".repeat(64) },
  status: "active", progress: { answered: 0, total: 10 },
  catalog: candidates.filter(({ id }) => selectedIds.has(id)), rounds: definition.rounds,
  answers: [], predictions: [], predictionProgress: { responded: 0, predicted: 0, skipped: 0, total: 0 },
  pendingPrediction: null, round: definition.rounds[0], completion: null,
  cut: { status: "pending", availableAt: definition.closesAt, methodology: "entre quem concluiu a rodada de 17/09" },
};
const ranking = candidates.map((candidate) => ({ ...candidate, elo: 1000, wins: 0, losses: 0, decisions: 0, rank: null, winRate: 0 }));
const browser = await { chromium, webkit }[browserName].launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.route(/\/api(?:\/|$)/, (route) => {
  const path = new URL(route.request().url()).pathname;
  const response = {
    "/api/capabilities": capabilityFixture([]),
    "/api/candidates": { topicId: "eleicoes-2026", candidates },
    "/api/player": { recoveryKey: "photo-recovery-e2e" },
    "/api/player/state": { topicId: "eleicoes-2026", version: 0, duels: 0, ranking },
    "/api/daily-session": session,
  }[path];
  return route.fulfill({ status: response ? 200 : 404, json: response || { error: "fixture missing" } });
});
try {
  await page.goto(process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await page.locator("#start-election").click();
  await page.getByRole("button", { name: "Começar rodada", exact: true }).click();
  await page.locator(".candidate-card .portrait img:visible").first().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll(".candidate-card .portrait img")].filter((image) => !image.hidden).every((image) => image.complete && image.naturalWidth > 0));
  const images = await page.locator(".candidate-card .portrait img:visible").evaluateAll((elements) => elements.map((image) => ({ src: new URL(image.src).pathname, width: image.naturalWidth })));
  assert.equal(images.length, 4);
  assert.ok(images.every(({ src, width }) => /^\/portraits\/\d{3}\.jpg$/.test(src) && width > 0));
  await page.locator(".profile-trigger:visible").first().click();
  const profile = page.locator("#modal[open]");
  await profile.waitFor();
  assert.match(await profile.innerText(), /após revisão editorial/);
  assert.doesNotMatch(await profile.innerText(), /Conteúdo revisado em/);
  assert.equal(await profile.getByRole("link", { name: "Créditos e origem das imagens" }).count(), 1);
  assert.deepEqual(errors, []);
  console.log(`${browserName}: restored real photos loaded in V3 daily cards and profile; editorial claims withheld`);
} finally {
  await browser.close();
}
