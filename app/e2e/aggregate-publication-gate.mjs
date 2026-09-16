import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { capabilityFixture, voteResponseV2 } from "./aggregate-fixture.mjs";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const RULESET = {
  id: "daily-four-card-v1",
  version: 1,
  timeZone: "America/Sao_Paulo",
  rounds: 10,
  cardsPerRound: 4,
  selection: "sha256-ranked-catalog-v1",
  catalogSchema: "candidate-public-v1",
  quota: { id: "editorial-day-v2", totalChoices: 30, dailyChoices: 10, freeChoices: 20 },
};

const catalog = Array.from({ length: 40 }, (_, index) => ({
  personId: index + 1,
  id: `personal-only-${index + 1}`,
  name: `Pessoa pessoal ${index + 1}`,
  displayName: `Pessoa ${index + 1}`,
  affiliation: "E2E",
  office: "Perfil de teste",
  summary: "Resumo editorial de teste.",
  facts: [],
  sources: [],
}));

const edition = {
  id: "daily-four-card-v1:v1:eleicoes-2026:2026-09-16:e2e-personal-only",
  date: "2026-09-16",
  topicId: "eleicoes-2026",
  rulesetId: RULESET.id,
  rulesetVersion: RULESET.version,
  catalogSchema: RULESET.catalogSchema,
  catalogHash: "a".repeat(64),
  snapshotHash: "b".repeat(64),
  candidateCount: 40,
  totalRounds: 10,
  cardsPerRound: 4,
  opensAt: "2026-09-16T03:00:00.000Z",
  closesAt: "2026-09-17T03:00:00.000Z",
};

function createServer() {
  return {
    answers: [],
    version: 0,
    voteRequests: 0,
    predictionRequests: 0,
    aggregateRequests: [],
    metrics: new Map(catalog.map(({ id }) => [id, { wins: 0, losses: 0 }])),
  };
}

function ranking(server) {
  return catalog.map((candidate) => {
    const metrics = server.metrics.get(candidate.id);
    const decisions = metrics.wins + metrics.losses;
    return {
      ...candidate,
      elo: 1000 + (metrics.wins * 15) - (metrics.losses * 5),
      wins: metrics.wins,
      losses: metrics.losses,
      decisions,
      winRate: decisions ? Math.round((metrics.wins / decisions) * 100) : 0,
      rank: decisions ? 1 : null,
    };
  });
}

function session(server) {
  const answered = server.answers.length;
  const rounds = Array.from({ length: 10 }, (_, index) => ({
    slot: index + 1,
    candidateIds: catalog.slice(index * 4, index * 4 + 4).map(({ id }) => id),
  }));
  return {
    ruleset: RULESET,
    edition,
    status: answered === 10 ? "completed" : "active",
    progress: { answered, total: 10 },
    catalog,
    rounds,
    answers: structuredClone(server.answers),
    predictions: [],
    predictionProgress: { responded: 0, predicted: 0, skipped: 0, total: answered },
    // O backend antigo ainda pode devolver este backlog. Sem a capability,
    // ele não deve bloquear a preferência seguinte nem disparar uma aposta.
    pendingPrediction: answered ? { slot: 1, candidateIds: rounds[0].candidateIds } : null,
    round: answered === 10 ? null : rounds[answered],
    completion: answered === 10 ? { completedAt: "2026-09-16T22:00:00.000Z" } : null,
    cut: {
      status: "pending",
      availableAt: edition.closesAt,
      methodology: "entre quem concluiu a rodada de 16/09",
    },
  };
}

function feedback(candidateIds, winnerId) {
  return {
    primaryEvent: "confirm",
    rankingEvent: "confirm",
    zebra: false,
    outcomes: candidateIds.map((id) => ({
      id,
      result: id === winnerId ? "winner" : "loser",
      delta: id === winnerId ? 45 : -15,
      elo: id === winnerId ? 1045 : 985,
      previousTier: { id: "contender", label: "No páreo", level: 2 },
      tier: { id: "contender", label: "No páreo", level: 2 },
      tierChange: null,
    })),
  };
}

function voteResponse(server, payload) {
  const candidateIds = catalog.slice((payload.slot - 1) * 4, payload.slot * 4).map(({ id }) => id);
  const personalFeedback = feedback(candidateIds, payload.winnerId);
  const vote = {
    id: payload.answerId,
    status: "created",
    winnerId: payload.winnerId,
    candidateIds,
    winnerDelta: 45,
    zebra: false,
    comparisons: 3,
    rankingEvent: "confirm",
    feedback: personalFeedback,
    personalFeedback,
    feedbackScope: "personal",
    globalEvent: null,
  };
  return voteResponseV2({
    player: {
      version: server.version,
      duels: server.version,
      rankingPolicy: {
        id: "pairwise-majority-scc-v1",
        label: "maioria nos confrontos observados",
        explanation: "A ordem usa somente as comparações pessoais confirmadas.",
      },
      ranking: ranking(server),
    },
    round: vote,
    vote,
    dailySession: session(server),
  }, { aggregate: false });
}

async function installApi(page, server) {
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname === "/api/capabilities") return route.fulfill({ status: 200, json: capabilityFixture([]) });
    if (pathname === "/api/candidates") return route.fulfill({ status: 200, json: { candidates: catalog } });
    if (pathname === "/api/player" && request.method() === "POST") {
      return route.fulfill({ status: 201, json: { recoveryKey: `pm2_${"g".repeat(43)}` } });
    }
    if (pathname === "/api/player/state") {
      return route.fulfill({ status: 200, json: { version: server.version, duels: server.version, ranking: ranking(server) } });
    }
    if (pathname === "/api/daily-session") return route.fulfill({ status: 200, json: session(server) });
    if (pathname === "/api/daily-vote" && request.method() === "POST") {
      const payload = request.postDataJSON();
      server.voteRequests += 1;
      assert.equal(Object.hasOwn(payload, "predictionContractVersion"), false, "modo pessoal pediu contrato de aposta");
      assert.equal(payload.slot, server.answers.length + 1);
      const candidateIds = catalog.slice((payload.slot - 1) * 4, payload.slot * 4).map(({ id }) => id);
      assert.ok(candidateIds.includes(payload.winnerId));
      server.answers.push({
        slot: payload.slot,
        answerId: payload.answerId,
        winnerId: payload.winnerId,
        answeredAt: `2026-09-16T${String(payload.slot + 9).padStart(2, "0")}:00:00.000Z`,
      });
      for (const id of candidateIds) {
        const metrics = server.metrics.get(id);
        if (id === payload.winnerId) metrics.wins += 3;
        else metrics.losses += 1;
      }
      server.version += 1;
      return route.fulfill({ status: 200, json: voteResponse(server, payload) });
    }
    if (pathname === "/api/daily-prediction") {
      server.predictionRequests += 1;
      return route.fulfill({ status: 500, json: { error: "aposta não deveria ser chamada" } });
    }
    if (["/api/ranking", "/api/daily-cut", "/api/daily-prediction-results"].includes(pathname)) {
      server.aggregateRequests.push(pathname);
      return route.fulfill({ status: 500, json: { error: "agregado não deveria ser chamado" } });
    }
    return route.fulfill({ status: 404, json: { error: "mock não encontrado" } });
  });
}

async function installExpiringApi(page, server, validUntil) {
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname === "/api/capabilities") {
      return route.fulfill({
        status: 200,
        headers: { "cache-control": "no-store" },
        json: capabilityFixture(["global-ranking"], { validUntil }),
      });
    }
    if (pathname === "/api/candidates") return route.fulfill({ status: 200, json: { candidates: catalog } });
    if (pathname === "/api/player" && request.method() === "POST") {
      return route.fulfill({ status: 201, json: { recoveryKey: `pm2_${"h".repeat(43)}` } });
    }
    if (pathname === "/api/player/state") {
      return route.fulfill({ status: 200, json: { version: 0, duels: 0, ranking: ranking(server) } });
    }
    if (pathname === "/api/ranking") {
      return route.fulfill({ status: 200, headers: { "cache-control": "no-store" }, json: {
        topicId: "eleicoes-2026",
        duels: 12,
        rankingPolicy: { id: "elo-v1", label: "Elo do placar público", explanation: "Teste." },
        ranking: ranking(server),
      } });
    }
    if (pathname === "/api/daily-session") return route.fulfill({ status: 200, json: session(server) });
    return route.fulfill({ status: 404, json: { error: "mock não encontrado" } });
  });
}

const browser = await browserType.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
const page = await context.newPage();
const pageErrors = [];
const server = createServer();
page.on("pageerror", (error) => pageErrors.push(error.message));
await installApi(page, server);

try {
  await page.addInitScript(() => localStorage.setItem("polimatch:v4:round-coach", "seen"));
  await page.goto(appUrl, { waitUntil: "networkidle" });
  assert.equal(await page.getByRole("button", { name: "Meu placar de apostas" }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Ver ranking do público" }).count(), 0);
  await page.getByText("A comparação pública está indisponível nesta edição.", { exact: false }).first().waitFor();

  await page.locator("#start-election").click();
  await page.getByRole("heading", { name: "Quem você prefere?" }).waitFor();
  for (let slot = 1; slot <= 10; slot += 1) {
    assert.equal(await page.getByRole("heading", { name: "E o Brasil, escolhe quem?" }).count(), 0);
    await page.locator("[data-vote]").first().click();
    if (slot < 10) {
      await page.getByText(`${slot + 1}/10`, { exact: true }).waitFor({ timeout: 5000 });
      assert.equal(await page.getByRole("heading", { name: "E o Brasil, escolhe quem?" }).count(), 0);
    } else {
      await page.getByRole("heading", { name: "Você fechou a rodada." }).waitFor({ timeout: 5000 });
    }
  }

  await page.getByText("Suas dez preferências ficaram registradas.", { exact: false }).waitFor();
  assert.equal(server.voteRequests, 10);
  assert.equal(server.predictionRequests, 0, "modo pessoal disparou aposta");
  assert.deepEqual(server.aggregateRequests, [], "bootstrap ou navegação consultou agregado retido");
  assert.equal(await page.getByRole("button", { name: "Ver meu placar de apostas" }).count(), 0);

  await page.locator("#daily-open-ranking").click();
  await page.getByRole("heading", { name: "Seu ranking", exact: true }).waitFor();
  assert.equal(await page.locator('[data-ranking-view="general"]').count(), 0);
  assert.equal(await page.locator(".podium, .public-pulse").count(), 0);
  await page.getByText("A comparação pública está indisponível nesta edição.", { exact: false }).waitFor();
  assert.deepEqual(pageErrors, []);

  const expiringPage = await context.newPage();
  const expiringErrors = [];
  expiringPage.on("pageerror", (error) => expiringErrors.push(error.message));
  const expiringServer = createServer();
  const validUntil = new Date(Date.now() + 3_000).toISOString();
  await installExpiringApi(expiringPage, expiringServer, validUntil);
  await expiringPage.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("polimatch:v4:round-coach", "seen");
  });
  await expiringPage.goto(appUrl, { waitUntil: "networkidle" });
  await expiringPage.getByRole("button", { name: "Ver ranking do público" }).waitFor();
  assert.equal(await expiringPage.getByText("A comparação pública está indisponível nesta edição.", { exact: false }).count(), 0);
  await expiringPage.getByRole("button", { name: "Ver meu ranking" }).waitFor({ timeout: 8_000 });
  assert.equal(await expiringPage.getByRole("button", { name: "Ver ranking do público" }).count(), 0);
  await expiringPage.getByText("A comparação pública está indisponível nesta edição.", { exact: false }).first().waitFor();
  assert.deepEqual(expiringErrors, []);
  await expiringPage.close();

  console.log(`${browserName}: modo pessoal conclui 10/10 e capability carregada expira sem manter agregado visível`);
} finally {
  await context.close();
  await browser.close();
}
