import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { capabilityFixture, voteResponseV2 } from "./aggregate-fixture.mjs";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const ruleset = {
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
  id: `prediction-person-${index + 1}`,
  name: `Pessoa da aposta ${index + 1}`,
  displayName: `Pessoa ${index + 1}`,
  affiliation: "E2E",
  office: "Perfil de teste",
  summary: "Resumo editorial de teste.",
  facts: [],
  sources: [],
}));
const edition = {
  id: "daily-four-card-v1:v1:eleicoes-2026:2026-09-16:e2e-prediction",
  date: "2026-09-16",
  topicId: "eleicoes-2026",
  rulesetId: ruleset.id,
  rulesetVersion: ruleset.version,
  catalogSchema: ruleset.catalogSchema,
  catalogHash: "a".repeat(64),
  snapshotHash: "b".repeat(64),
  candidateCount: 40,
  totalRounds: 10,
  cardsPerRound: 4,
  opensAt: "2026-09-16T03:00:00.000Z",
  closesAt: "2026-09-17T03:00:00.000Z",
};

function uuid(prefix, slot) {
  return `${prefix}50e8400-e29b-41d4-a716-${String(slot).padStart(12, "0")}`;
}

function ranking() {
  return catalog.map((candidate) => ({ ...candidate, elo: 1000, wins: 0, losses: 0, decisions: 0, winRate: 0, rank: null }));
}

function publicSession(server) {
  const answered = server.answers.length;
  const responded = server.predictions.length;
  return {
    ruleset,
    edition,
    status: answered === 10 ? "completed" : "active",
    progress: { answered, total: 10 },
    catalog,
    rounds: Array.from({ length: 10 }, (_, index) => ({
      slot: index + 1,
      candidateIds: catalog.slice(index * 4, index * 4 + 4).map(({ id }) => id),
    })),
    answers: structuredClone(server.answers),
    predictions: structuredClone(server.predictions),
    predictionProgress: {
      responded,
      predicted: server.predictions.filter(({ skipped }) => !skipped).length,
      skipped: server.predictions.filter(({ skipped }) => skipped).length,
      total: answered,
    },
    pendingPrediction: responded < answered ? {
      slot: responded + 1,
      candidateIds: catalog.slice(responded * 4, responded * 4 + 4).map(({ id }) => id),
    } : null,
    round: answered === 10 ? null : {
      slot: answered + 1,
      candidateIds: catalog.slice(answered * 4, answered * 4 + 4).map(({ id }) => id),
    },
    completion: answered === 10 ? { completedAt: "2026-09-16T22:00:00.000Z" } : null,
    cut: {
      status: "pending",
      availableAt: edition.closesAt,
      methodology: "entre quem concluiu a rodada de 16/09",
    },
  };
}

function voteResponse(server, payload) {
  const candidateIds = catalog.slice((payload.slot - 1) * 4, payload.slot * 4).map(({ id }) => id);
  const feedback = {
    primaryEvent: "confirm",
    rankingEvent: "confirm",
    zebra: false,
    outcomes: candidateIds.map((id) => ({
      id,
      result: id === payload.winnerId ? "winner" : "loser",
      delta: id === payload.winnerId ? 45 : -15,
      elo: id === payload.winnerId ? 1045 : 985,
      previousTier: { id: "contender", label: "No páreo", level: 2 },
      tier: { id: "contender", label: "No páreo", level: 2 },
      tierChange: null,
    })),
  };
  const round = {
    id: payload.answerId,
    status: "created",
    winnerId: payload.winnerId,
    candidateIds,
    winnerDelta: 45,
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
    duels: server.version,
    ranking: ranking(),
    player: { version: server.version, duels: server.version, ranking: ranking() },
    round,
    vote: round,
    dailySession: publicSession(server),
  };
}

function closedResults() {
  const completedPlayers = 10;
  const rounds = Array.from({ length: 10 }, (_, index) => {
    const candidateIds = catalog.slice(index * 4, index * 4 + 4).map(({ id }) => id);
    const counts = index === 1 ? [4, 4, 1, 1] : [4, 3, 2, 1];
    const leaderIds = index === 1 ? candidateIds.slice(0, 2) : [candidateIds[0]];
    const preference = index < 4 ? {
      answerId: uuid("5", index + 1),
      candidateId: candidateIds[1],
      answeredAt: `2026-09-15T${String(index + 12).padStart(2, "0")}:00:00.000Z`,
    } : null;
    const prediction = index < 3 ? {
      predictionId: uuid("6", index + 1),
      candidateId: index === 2 ? null : candidateIds[0],
      skipped: index === 2,
      respondedAt: `2026-09-15T${String(index + 12).padStart(2, "0")}:01:00.000Z`,
    } : null;
    const result = index === 0 ? "correct" : index === 1 ? "tie" : index === 2 ? "skipped" : "not-answered";
    return {
      slot: index + 1,
      candidateIds,
      choices: candidateIds.map((candidateId, choiceIndex) => ({
        candidateId,
        count: counts[choiceIndex],
        percent: counts[choiceIndex] * 10,
      })),
      leaderIds,
      winnerId: index === 1 ? null : candidateIds[0],
      outcome: index === 1 ? "tie" : "decided",
      preference,
      prediction,
      result,
    };
  });
  return {
    baselinePercent: 25,
    score: { correct: 1, scored: 1, attempted: 2, skipped: 1, ties: 1, noSample: 0, accuracyPercent: 100 },
    sessions: [{
      edition: {
        ...edition,
        id: `daily-four-card-v1:v1:eleicoes-2026:2026-09-15:${edition.catalogHash.slice(0, 16)}`,
        date: "2026-09-15",
        opensAt: "2026-09-15T03:00:00.000Z",
        closesAt: "2026-09-16T03:00:00.000Z",
      },
      methodology: "entre quem concluiu a rodada de 15/09",
      completedPlayers,
      sampleNotice: "Recorte de baixa participação; apresente contagens, não uma conclusão populacional.",
      publishedAt: "2026-09-16T03:00:01.000Z",
      catalog,
      completed: false,
      rounds,
    }],
  };
}

function createServer() {
  return {
    answers: [],
    predictions: [],
    predictionResponses: new Map(),
    version: 0,
    loseNextPredictionResponse: true,
    divergeNextPredictionResponse: false,
    failResults: true,
    predictionRequestCount: 0,
    dailySessionOverride: null,
    dailySessionGate: null,
  };
}

async function installApi(page, server) {
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname === "/api/capabilities") return route.fulfill({ status: 200, json: capabilityFixture() });
    if (pathname === "/api/candidates") return route.fulfill({ status: 200, json: { candidates: catalog } });
    if (pathname === "/api/ranking") return route.fulfill({ status: 200, json: { duels: server.version, ranking: ranking() } });
    if (pathname === "/api/player" && request.method() === "POST") return route.fulfill({ status: 201, json: { recoveryKey: `pm2_${"p".repeat(43)}` } });
    if (pathname === "/api/player/state") return route.fulfill({ status: 200, json: { version: server.version, duels: server.version, ranking: ranking() } });
    if (pathname === "/api/daily-session") {
      if (server.dailySessionGate) {
        const gate = server.dailySessionGate;
        server.dailySessionGate = null;
        await gate;
      }
      return route.fulfill({ status: 200, json: server.dailySessionOverride || publicSession(server) });
    }
    if (pathname === "/api/daily-vote" && request.method() === "POST") {
      const payload = request.postDataJSON();
      assert.equal(payload.predictionContractVersion, 1);
      assert.equal(server.answers.length, server.predictions.length, "preferência avançou com aposta pendente");
      const candidateIds = catalog.slice((payload.slot - 1) * 4, payload.slot * 4).map(({ id }) => id);
      assert.ok(candidateIds.includes(payload.winnerId));
      server.answers.push({
        slot: payload.slot,
        answerId: payload.answerId,
        winnerId: payload.winnerId,
        answeredAt: `2026-09-16T${String(payload.slot + 11).padStart(2, "0")}:00:00.000Z`,
      });
      server.version += 1;
      return route.fulfill({ status: 200, json: voteResponseV2(voteResponse(server, payload)) });
    }
    if (pathname === "/api/daily-prediction" && request.method() === "POST") {
      server.predictionRequestCount += 1;
      const payload = request.postDataJSON();
      assert.equal(Object.hasOwn(payload, "answerId"), false);
      assert.equal(Object.hasOwn(payload, "candidateIds"), false);
      const replay = server.predictionResponses.get(payload.predictionId);
      if (replay) {
        const body = structuredClone(replay);
        body.prediction.status = "alreadyProcessed";
        return route.fulfill({ status: 200, json: body });
      }
      const candidateIds = catalog.slice((payload.slot - 1) * 4, payload.slot * 4).map(({ id }) => id);
      assert.deepEqual(candidateIds, publicSession(server).pendingPrediction.candidateIds);
      const skipped = payload.decision === "skip";
      if (!skipped) assert.ok(candidateIds.includes(payload.candidateId));
      server.predictions.push({
        slot: payload.slot,
        predictionId: payload.predictionId,
        candidateId: skipped ? null : payload.candidateId,
        skipped,
        respondedAt: `2026-09-16T${String(payload.slot + 11).padStart(2, "0")}:01:00.000Z`,
      });
      const body = {
        prediction: { id: payload.predictionId, status: "created", slot: payload.slot, candidateId: skipped ? null : payload.candidateId, skipped },
        dailySession: publicSession(server),
      };
      server.predictionResponses.set(payload.predictionId, structuredClone(body));
      if (server.loseNextPredictionResponse) {
        server.loseNextPredictionResponse = false;
        return route.abort("failed");
      }
      if (server.divergeNextPredictionResponse) {
        server.divergeNextPredictionResponse = false;
        const divergent = structuredClone(body);
        divergent.prediction.candidateId = candidateIds.find((id) => id !== body.prediction.candidateId);
        return route.fulfill({ status: 200, json: divergent });
      }
      return route.fulfill({ status: 200, json: body });
    }
    if (pathname === "/api/daily-prediction-results") {
      if (server.failResults) return route.fulfill({ status: 503, json: { error: "placar temporariamente indisponível" } });
      return route.fulfill({ status: 200, json: closedResults() });
    }
    return route.fulfill({ status: 404, json: { error: "rota não encontrada" } });
  });
}

const browser = await browserType.launch();
const context = await browser.newContext({ viewport: { width: 320, height: 568 }, serviceWorkers: "block" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const server = createServer();
await installApi(page, server);

try {
  await page.addInitScript(() => localStorage.setItem("polimatch:v4:round-coach", "seen"));
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.locator("#start-election").click();
  await page.getByRole("heading", { name: "Quem você prefere?" }).waitFor();
  const preferenceCards = await page.locator("[data-vote]").evaluateAll((cards) => cards.map((card) => card.dataset.vote));
  await page.locator("[data-vote]").first().focus();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "E o Brasil, escolhe quem?" }).waitFor({ timeout: 5000 });
  const predictionCards = await page.locator("[data-predict]").evaluateAll((cards) => cards.map((card) => card.dataset.predict));
  assert.deepEqual(predictionCards, preferenceCards);
  assert.equal(await page.getByText("25%", { exact: true }).count(), 1);
  assert.equal(await page.getByText(/Mais escolhida:/).count(), 0, "distribuição vazou antes do fechamento");
  assert.equal(await page.locator(".prediction-screen").getByText("Toque para apostar", { exact: true }).count(), 4);
  assert.equal(await page.locator(".prediction-screen").getByText(/Segure para conhecer/).count(), 0);
  assert.match(await page.locator("[data-predict]").first().getAttribute("aria-label"), /Toque para apostar\.$/);
  const geometry = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    cards: [...document.querySelectorAll("[data-predict]")].map((card) => {
      const box = card.getBoundingClientRect();
      return { left: box.left, right: box.right };
    }),
  }));
  assert.equal(geometry.overflow, false);
  assert.ok(geometry.cards.every(({ left, right }) => left >= -1 && right <= 321));

  const heldCard = await page.locator("[data-predict]").first().boundingBox();
  assert.ok(heldCard);
  await page.mouse.move(heldCard.x + heldCard.width / 2, heldCard.y + heldCard.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(520);
  await page.mouse.up();
  await page.waitForTimeout(50);
  assert.equal(server.predictions.length, 0, "pressão longa registrou aposta acidentalmente");
  assert.equal(await page.locator("#modal[open]").count(), 0, "pressão longa prometeu/abriu perfil na aposta");

  await page.locator("[data-predict]").nth(1).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Tentar a mesma aposta novamente" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "Tentar a mesma aposta novamente" }).click();
  await page.getByText("2/10", { exact: true }).waitFor({ timeout: 5000 });
  assert.equal(server.predictions.length, 1, "retry idempotente duplicou a aposta");

  await page.locator("[data-vote]").first().click();
  await page.getByRole("heading", { name: "E o Brasil, escolhe quem?" }).waitFor({ timeout: 5000 });
  server.divergeNextPredictionResponse = true;
  await page.locator("[data-predict]").first().click();
  await page.getByRole("button", { name: "Tentar a mesma aposta novamente" }).waitFor({ timeout: 5000 });
  assert.equal(await page.getByText("E o Brasil, escolhe quem?", { exact: true }).count(), 1, "200 divergente avançou o slot");
  assert.equal(server.predictions.length, 2);
  await page.getByRole("button", { name: "Tentar a mesma aposta novamente" }).click();
  await page.getByText("3/10", { exact: true }).waitFor({ timeout: 5000 });
  assert.equal(server.predictions.length, 2, "retry do 200 divergente duplicou a aposta");

  await page.getByRole("button", { name: "Início" }).click();
  await page.getByRole("button", { name: "Meu placar de apostas" }).click();
  await page.getByRole("heading", { name: "Não conseguimos abrir o placar." }).waitFor();
  await page.getByRole("button", { name: "Voltar ao início" }).click();
  await page.getByRole("button", { name: "Ver ranking do público" }).click();
  await page.getByRole("heading", { name: "Ranking", exact: true }).waitFor();
  await page.getByRole("button", { name: "Início" }).click();
  server.failResults = false;
  await page.getByRole("button", { name: "Meu placar de apostas" }).click();
  await page.getByRole("heading", { name: "100%", exact: true }).waitFor();
  await page.getByText("1 de 1", { exact: false }).waitFor();
  await page.getByText("Empate — não pontua", { exact: true }).waitFor();
  await page.getByText("Acima de", { exact: false }).waitFor();

  const midnightPage = await context.newPage();
  const midnightErrors = [];
  midnightPage.on("pageerror", (error) => midnightErrors.push(error.message));
  const midnightServer = createServer();
  await installApi(midnightPage, midnightServer);
  await midnightPage.addInitScript(() => localStorage.setItem("polimatch:v4:round-coach", "seen"));
  await midnightPage.goto(appUrl, { waitUntil: "networkidle" });
  await midnightPage.locator("#start-election").click();
  await midnightPage.getByRole("heading", { name: "Quem você prefere?" }).waitFor();
  await midnightPage.locator("[data-vote]").first().click();
  await midnightPage.getByRole("heading", { name: "E o Brasil, escolhe quem?" }).waitFor();
  await midnightPage.locator("[data-predict]").first().click();
  await midnightPage.getByRole("button", { name: "Tentar a mesma aposta novamente" }).waitFor();
  const nextEditionSession = publicSession({ answers: [], predictions: [] });
  nextEditionSession.edition = {
    ...nextEditionSession.edition,
    id: "daily-four-card-v1:v1:eleicoes-2026:2026-09-17:e2e-prediction-next",
    date: "2026-09-17",
    catalogHash: "c".repeat(64),
    snapshotHash: "d".repeat(64),
    opensAt: "2026-09-17T03:00:00.000Z",
    closesAt: "2026-09-18T03:00:00.000Z",
  };
  nextEditionSession.cut = {
    status: "pending",
    availableAt: nextEditionSession.edition.closesAt,
    methodology: "entre quem concluiu a rodada de 17/09",
  };
  midnightServer.dailySessionOverride = nextEditionSession;
  let releaseDailySession;
  midnightServer.dailySessionGate = new Promise((resolve) => { releaseDailySession = resolve; });
  await midnightPage.getByRole("button", { name: "Tentar a mesma aposta novamente" }).click();
  await midnightPage.getByRole("heading", { name: "Buscando a edição vigente…" }).waitFor();
  assert.equal(await midnightPage.locator("[data-vote], [data-predict]").count(), 0, "a edição antiga voltou a ficar interativa durante o resync");
  releaseDailySession();
  await midnightPage.getByRole("heading", { name: "Quem você prefere?" }).waitFor({ timeout: 5000 });
  await midnightPage.getByText("1/10", { exact: true }).waitFor();
  await midnightPage.getByText(/Aposta guardada.*edição vigente já foi aberta/).waitFor();
  assert.equal(midnightServer.predictions.length, 1, "replay após a meia-noite duplicou a aposta antiga");
  assert.equal(midnightServer.predictionRequestCount, 2, "replay confirmado entrou em loop de retry");
  assert.deepEqual(midnightErrors, []);
  await midnightPage.close();
  assert.deepEqual(errors, []);
  console.log(`${browserName}: aposta separada, correlação 200, retry na meia-noite, pressão longa, teclado, 320x568 e revelação fechada validados`);
} finally {
  await context.close();
  await browser.close();
}
