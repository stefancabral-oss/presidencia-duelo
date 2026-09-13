import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { CANDIDATES } from "../../back/src/candidates.js";
import { applyElo, emptyStats } from "../../shared/elo.js";

const baseUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4174";
const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const browserType = browserName === "webkit" ? webkit : chromium;
const browser = await browserType.launch({ headless: true });

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

function playerState() {
  return emptyStats(CANDIDATES.map(({ id }) => id));
}

async function installApi(page) {
  const states = { presidentes: playerState(), vices: playerState() };
  const versions = { presidentes: 0, vices: 0 };
  const calls = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push(`${request.method()} ${url.pathname}${url.search}`);
    const mode = url.searchParams.get("mode") || "presidentes";
    if (url.pathname === "/api/health") {
      return json(route, { ok: true, service: "polimatch-api", database: "postgresql" });
    }
    if (url.pathname === "/api/candidates") return json(route, { candidates: CANDIDATES });
    if (url.pathname === "/api/player" && request.method() === "POST") {
      return json(route, { recoveryKey: "pwa_smoke_recovery_key" }, 201);
    }
    if (url.pathname === "/api/player/state" && request.method() === "GET") {
      return json(route, { mode, version: versions[mode], state: states[mode] });
    }
    if (url.pathname === "/api/player/state" && request.method() === "PUT") {
      const body = request.postDataJSON();
      states[body.mode] = body.state;
      versions[body.mode] += 1;
      return json(route, { mode: body.mode, version: versions[body.mode], state: states[body.mode] });
    }
    if (url.pathname === "/api/ranking") return json(route, { mode, duels: 0, ranking: [] });
    if (url.pathname === "/api/vote" && request.method() === "POST") {
      const body = request.postDataJSON();
      applyElo(states[body.mode], body.winnerId, body.loserId);
      versions[body.mode] += 1;
      return json(route, {
        vote: { id: body.voteId },
        player: { mode: body.mode, version: versions[body.mode], state: states[body.mode] },
      });
    }
    return json(route, { error: "mock route missing" }, 404);
  });
  return calls;
}

async function waitForOnlineShell(page, calls, errors) {
  try {
    await page.waitForSelector("#home-play", { timeout: 8000 });
  } catch (error) {
    const text = (await page.locator("body").innerText()).slice(0, 500);
    throw new Error(`${browserName}: PWA não concluiu bootstrap com API simulada (${calls.join(" | ")}; ${errors.join(" | ")}): ${text}`, { cause: error });
  }
}

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const unavailable = await context.newPage();
  await unavailable.goto(baseUrl, { waitUntil: "networkidle" });
  await unavailable.waitForSelector("#retry-connection");
  assert.equal(await unavailable.locator("#tab-duel").count(), 0, `${browserName}: PWA liberou jogo sem API`);
  await unavailable.close();

  const online = await context.newPage();
  const errors = [];
  online.on("pageerror", (error) => errors.push(error.message));
  online.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  online.on("response", async (response) => {
    if (response.status() >= 400) {
      errors.push(`${response.status()} ${new URL(response.url()).pathname}: ${await response.text().catch(() => "")}`);
    }
  });
  const calls = await installApi(online);
  await online.goto(baseUrl, { waitUntil: "networkidle" });
  await waitForOnlineShell(online, calls, errors);
  await online.locator("#home-play").click();
  await online.locator("#card-a").click();
  await online.waitForTimeout(200);
  assert.equal(
    await online.locator("#panel-duel").evaluate((element) => element.classList.contains("active")),
    true,
    `${browserName}: voto sincronizado desviou para o ranking`,
  );
  assert.equal(Number(await online.locator("#duel-count").textContent()), 1);
  assert.match(await online.locator("#api-status").textContent(), /salvo/i);
  await online.close();
  await context.close();
} finally {
  await browser.close();
}
