import assert from "node:assert/strict";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const evidenceDir = process.env.POLIMATCH_E2E_EVIDENCE_DIR || "";
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const ORIGINAL_KEY = `pm2_${"a".repeat(43)}`;
const POLICY = {
  id: "pairwise-majority-scc-v1",
  label: "maioria nos confrontos observados",
  explanation: "A ordem usa confrontos diretos e mantém empates não resolvidos.",
};
const candidates = ["lula", "anitta", "neymar-jr", "renan-santos"].map((id, index) => ({
  personId: index + 1,
  id,
  name: `Pessoa De Teste ${index + 1}`,
  displayName: `Pessoa ${index + 1}`,
  party: "XX",
  role: "Cargo de teste",
  office: "Cargo de teste",
  summary: "Resumo de teste.",
  bio: "Perfil editorial de teste.",
}));

function createServer() {
  return {
    version: 0,
    duels: 0,
    issuances: 0,
    keys: new Set([ORIGINAL_KEY]),
    requests: [],
    nextFailure: null,
    ranking() {
      return candidates.map((candidate) => ({
        ...candidate,
        elo: 1000,
        wins: 0,
        losses: 0,
        decisions: 0,
        zebras: 0,
        winRate: 0,
        rank: null,
      }));
    },
  };
}

function roundResponse(server, payload) {
  server.version += 1;
  server.duels += 1;
  const feedback = {
    primaryEvent: "confirm",
    rankingEvent: "confirm",
    zebra: false,
    outcomes: payload.candidateIds.map((id) => ({
      id,
      result: id === payload.winnerId ? "winner" : "loser",
      delta: id === payload.winnerId ? 46 : -15,
      elo: id === payload.winnerId ? 1046 : 985,
      previousTier: { id: "contender", label: "No páreo", level: 2 },
      tier: { id: "contender", label: "No páreo", level: 2 },
      tierChange: null,
    })),
  };
  const round = {
    id: payload.roundId,
    status: "created",
    winnerDelta: 46,
    zebra: false,
    comparisons: 3,
    rankingEvent: "confirm",
    feedback,
    personalFeedback: feedback,
    feedbackScope: "personal",
    globalEvent: null,
  };
  return {
    topicId: "eleicoes-2026",
    duels: server.duels,
    ranking: server.ranking(),
    player: { version: server.version, duels: server.duels, rankingPolicy: POLICY, ranking: server.ranking() },
    round,
    vote: round,
  };
}

async function installApi(page, server) {
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname === "/api/candidates") return route.fulfill({ status: 200, json: { candidates } });
    if (pathname === "/api/ranking") return route.fulfill({ status: 200, json: { duels: server.duels, ranking: server.ranking() } });
    if (pathname === "/api/player" && request.method() === "POST") {
      server.issuances += 1;
      const recoveryKey = `pm2_${String(server.issuances).padStart(43, "b")}`;
      server.keys.add(recoveryKey);
      return route.fulfill({ status: 201, json: { recoveryKey } });
    }
    if (pathname === "/api/player/state") {
      const token = String(request.headers().authorization || "").replace(/^Bearer\s+/i, "");
      if (!server.keys.has(token)) return route.fulfill({ status: 401, json: { error: "sessão inválida", code: "PLAYER_SESSION_REQUIRED" } });
      return route.fulfill({
        status: 200,
        json: { topicId: "eleicoes-2026", duels: server.duels, version: server.version, rankingPolicy: POLICY, ranking: server.ranking() },
      });
    }
    if (pathname === "/api/round-vote" && request.method() === "POST") {
      const payload = request.postDataJSON();
      server.requests.push({ payload, authorization: request.headers().authorization || "" });
      if (server.nextFailure) {
        const failure = server.nextFailure;
        server.nextFailure = null;
        if (failure.delayMs) await new Promise((resolve) => setTimeout(resolve, failure.delayMs));
        return route.fulfill({
          status: failure.status,
          headers: failure.retryAfterSeconds ? { "Retry-After": String(failure.retryAfterSeconds) } : {},
          json: failure.body,
        });
      }
      return route.fulfill({ status: 200, json: roundResponse(server, payload) });
    }
    return route.fulfill({ status: 404, json: { error: "rota não encontrada" } });
  });
}

async function openDuel(browser, server) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await installApi(page, server);
  await page.addInitScript((key) => localStorage.setItem("polimatch:v3:recovery-key", key), ORIGINAL_KEY);
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Duelo" }).click();
  const coach = page.getByRole("button", { name: "Começar rodada" });
  if (await coach.count()) await coach.click();
  await page.getByRole("heading", { name: "Quem você prefere?" }).waitFor();
  return { context, page, pageErrors };
}

async function snapshot(page, name, evidence, { screenshot = true } = {}) {
  const file = `${browserName}-${name}.png`;
  if (evidenceDir && screenshot) {
    await mkdir(evidenceDir, { recursive: true });
    await page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(40);
    await page.screenshot({ path: path.join(evidenceDir, file), fullPage: true });
  }
  evidence[name] = await page.evaluate((screenshot) => ({
    screenshot,
    phase: document.querySelector(".duel-screen")?.dataset.votePhase || "",
    instruction: document.querySelector(".round-instruction")?.textContent?.trim() || "",
    progress: document.querySelector(".progress-pill")?.textContent?.trim() || "",
    cardsDisabled: [...document.querySelectorAll(".candidate-card")].map((card) => card.disabled),
    candidateIds: [...document.querySelectorAll(".candidate-card")].map((card) => card.dataset.vote),
    skipDisabled: document.querySelector("#skip-round")?.disabled,
    recovery: document.querySelector(".retry-vote")?.textContent?.trim() || "",
    recoveryDisabled: document.querySelector(".retry-vote")?.disabled ?? null,
  }), file);
  return evidence[name];
}

function assertFrozen(before, after, label) {
  assert.deepEqual(after.candidateIds, before.candidateIds, `${label}: a rodada mudou`);
  assert.equal(after.progress, before.progress, `${label}: o contador avançou sem confirmação`);
  assert.ok(after.cardsDisabled.every(Boolean), `${label}: alguma carta permaneceu ativa`);
  assert.equal(after.skipDisabled, true, `${label}: troca de rodada permaneceu ativa`);
}

const browser = await browserType.launch();
const evidence = {};

try {
  {
    const server = createServer();
    const { context, page, pageErrors } = await openDuel(browser, server);
    const before = await snapshot(page, "ready-before-401", evidence, { screenshot: false });
    server.nextFailure = { status: 401, delayMs: 650, body: { error: "sessão inválida", code: "PLAYER_SESSION_REQUIRED" } };
    await page.locator(".candidate-card").first().click();
    await page.waitForFunction(() => document.querySelector(".duel-screen")?.dataset.votePhase === "sending");
    const sending = await snapshot(page, "sending", evidence);
    assertFrozen(before, sending, "sending");
    await page.getByRole("button", { name: "Restabelecer sessão" }).waitFor();
    const failed = await snapshot(page, "401-session-required", evidence);
    assertFrozen(before, failed, "401");
    assert.equal(server.issuances, 0, "401 emitiu sessão sem ação explícita");
    await page.getByRole("button", { name: "Restabelecer sessão" }).click();
    await page.getByRole("button", { name: "Tentar novamente" }).waitFor();
    assert.equal(server.issuances, 1, "restauração deveria emitir exatamente uma sessão");
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await page.locator(".feedback-channel").waitFor();
    assert.equal(server.duels, 1);
    assert.equal(server.requests.length, 2);
    assert.deepEqual(server.requests[0].payload, server.requests[1].payload);
    assert.notEqual(server.requests[0].authorization, server.requests[1].authorization);
    assert.deepEqual(pageErrors, []);
    await context.close();
  }

  {
    const server = createServer();
    const { context, page, pageErrors } = await openDuel(browser, server);
    const before = await snapshot(page, "ready-before-429", evidence, { screenshot: false });
    server.nextFailure = {
      status: 429,
      retryAfterSeconds: 2,
      body: { error: "limite interno", code: "VOTE_RATE_LIMITED", retryAfterSeconds: 2 },
    };
    await page.locator(".candidate-card").first().click();
    await page.getByText("Muitas tentativas. Tente novamente em 2 segundos.", { exact: true }).waitFor();
    const failed = await snapshot(page, "429-rate-limited", evidence);
    assertFrozen(before, failed, "429");
    assert.equal(failed.recoveryDisabled, true);
    await page.waitForTimeout(2100);
    await page.locator("#retry-vote").click();
    await page.locator(".feedback-channel").waitFor();
    assert.equal(server.duels, 1);
    assert.equal(server.requests.length, 2);
    assert.deepEqual(server.requests[0].payload, server.requests[1].payload);
    assert.deepEqual(pageErrors, []);
    await context.close();
  }

  {
    const server = createServer();
    const { context, page, pageErrors } = await openDuel(browser, server);
    const before = await snapshot(page, "ready-before-503", evidence, { screenshot: false });
    const secret = "postgres://admin:segredo@db/internal";
    server.nextFailure = { status: 503, body: { error: secret, code: "INTERNAL_ERROR", requestId: "req-secret" } };
    await page.locator(".candidate-card").first().click();
    await page.getByText("Não foi possível confirmar agora.", { exact: true }).waitFor();
    const failed = await snapshot(page, "503-server-error", evidence);
    assertFrozen(before, failed, "503");
    assert.equal((await page.locator("body").innerText()).includes(secret), false, "5xx vazou detalhe interno");
    await page.locator("#retry-vote").click();
    await page.locator(".feedback-channel").waitFor();
    assert.equal(server.duels, 1);
    assert.equal(server.requests.length, 2);
    assert.deepEqual(server.requests[0].payload, server.requests[1].payload);
    assert.deepEqual(pageErrors, []);
    await context.close();
  }

  if (evidenceDir) {
    await writeFile(path.join(evidenceDir, `${browserName}-states.json`), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
  console.log(`${browserName}: estados sending, 401, 429 e 5xx preservam rodada, contador e retry idempotente`);
} finally {
  await browser.close();
}
