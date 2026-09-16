import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

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

function candidate(index) {
  return {
    personId: index,
    id: `candidate-${index}`,
    name: `Pessoa Histórica ${index}`,
    displayName: `Pessoa ${index}`,
    affiliation: "E2E",
    party: "E2E",
    role: "Perfil de teste",
    office: "Perfil de teste",
    summary: `Snapshot editorial ${index}`,
    bio: `Biografia preservada no snapshot ${index}.`,
    facts: [],
    sources: [],
  };
}

const dayOneCatalog = Array.from({ length: 40 }, (_, index) => candidate(index + 1));
const dayTwoCatalog = Array.from({ length: 40 }, (_, index) => candidate(index + 2));
// candidate-1 foi retirado depois da materialização; candidate-41 só entra no
// catálogo corrente e na edição seguinte.
const currentCatalog = dayTwoCatalog;

function edition(day) {
  const date = day === 1 ? "2026-09-16" : "2026-09-17";
  const nextDate = day === 1 ? "2026-09-17" : "2026-09-18";
  return {
    id: `daily-four-card-v1:v1:eleicoes-2026:${date}:e2e-day-${day}`,
    date,
    topicId: "eleicoes-2026",
    rulesetId: RULESET.id,
    rulesetVersion: RULESET.version,
    catalogSchema: RULESET.catalogSchema,
    catalogHash: String(day).repeat(64),
    snapshotHash: String(day + 2).repeat(64),
    candidateCount: 40,
    totalRounds: 10,
    cardsPerRound: 4,
    opensAt: `${date}T03:00:00.000Z`,
    closesAt: `${nextDate}T03:00:00.000Z`,
  };
}

function createDailyState(day) {
  const catalog = day === 1 ? dayOneCatalog : dayTwoCatalog;
  return { day, edition: edition(day), catalog, answers: [], predictions: [], completion: null };
}

function publicSession(state) {
  const answered = state.answers.length;
  const responded = state.predictions.length;
  const completed = answered === 10;
  const [, month, day] = state.edition.date.split("-");
  return {
    ruleset: RULESET,
    edition: state.edition,
    status: completed ? "completed" : "active",
    progress: { answered, total: 10 },
    catalog: state.catalog,
    answers: structuredClone(state.answers),
    predictions: structuredClone(state.predictions),
    predictionProgress: {
      responded,
      predicted: state.predictions.filter(({ skipped }) => !skipped).length,
      skipped: state.predictions.filter(({ skipped }) => skipped).length,
      total: answered,
    },
    pendingPrediction: responded < answered ? {
      slot: responded + 1,
      candidateIds: state.catalog.slice(responded * 4, responded * 4 + 4).map(({ id }) => id),
    } : null,
    round: completed ? null : {
      slot: answered + 1,
      candidateIds: state.catalog.slice(answered * 4, answered * 4 + 4).map(({ id }) => id),
    },
    completion: completed ? { completedAt: state.completion } : null,
    cut: {
      status: "pending",
      availableAt: state.edition.closesAt,
      methodology: `entre quem concluiu a rodada de ${day}/${month}`,
    },
  };
}

function ranking() {
  return currentCatalog.map((person) => ({
    ...person,
    elo: 1000,
    wins: 0,
    losses: 0,
    decisions: 0,
    winRate: 0,
    rank: null,
  }));
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

function createServer() {
  return {
    currentDay: 1,
    days: new Map([[1, createDailyState(1)], [2, createDailyState(2)]]),
    duels: 0,
    version: 0,
    loseNextResponse: false,
    failDailySession: false,
    requests: [],
    responses: new Map(),
    predictionResponses: new Map(),
  };
}

function voteResponse(server, dailyState, payload, status = "created") {
  const roundCandidates = dailyState.catalog
    .slice((payload.slot - 1) * 4, payload.slot * 4)
    .map(({ id }) => id);
  const personalFeedback = feedback(roundCandidates, payload.winnerId);
  const round = {
    id: payload.answerId,
    status,
    winnerId: payload.winnerId,
    candidateIds: roundCandidates,
    winnerDelta: 45,
    zebra: false,
    comparisons: 3,
    rankingEvent: "confirm",
    feedback: personalFeedback,
    personalFeedback,
    feedbackScope: "personal",
    globalEvent: null,
  };
  return {
    topicId: "eleicoes-2026",
    duels: server.duels,
    ranking: ranking(),
    player: { version: server.version, duels: server.duels, ranking: ranking() },
    round,
    vote: round,
    dailySession: publicSession(dailyState),
  };
}

async function installApi(page, server) {
  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    if (pathname === "/api/candidates") return route.fulfill({ status: 200, json: { candidates: currentCatalog } });
    if (pathname === "/api/ranking") return route.fulfill({ status: 200, json: { duels: server.duels, ranking: ranking() } });
    if (pathname === "/api/player" && request.method() === "POST") {
      return route.fulfill({ status: 201, json: { recoveryKey: `pm2_${"d".repeat(43)}` } });
    }
    if (pathname === "/api/player/state") {
      return route.fulfill({
        status: 200,
        json: { version: server.version, duels: server.duels, ranking: ranking() },
      });
    }
    if (pathname === "/api/daily-session") {
      if (server.failDailySession) {
        return route.fulfill({ status: 503, json: { error: "serviço diário indisponível" } });
      }
      return route.fulfill({ status: 200, json: publicSession(server.days.get(server.currentDay)) });
    }
    if (pathname === "/api/daily-vote" && request.method() === "POST") {
      const payload = request.postDataJSON();
      assert.equal(Object.hasOwn(payload, "candidateIds"), false, "o cliente enviou a ordem do baralho diário");
      server.requests.push(payload);
      const replay = server.responses.get(payload.answerId);
      if (replay) {
        const body = structuredClone(replay);
        body.round.status = "alreadyProcessed";
        body.vote.status = "alreadyProcessed";
        return route.fulfill({ status: 200, json: body });
      }
      const dailyState = [...server.days.values()].find(({ edition: value }) => value.id === payload.editionId);
      if (!dailyState) return route.fulfill({ status: 409, json: { code: "DAILY_EDITION_CLOSED", error: "edição fechada" } });
      if (dailyState.answers.length !== dailyState.predictions.length) {
        return route.fulfill({ status: 409, json: { code: "DAILY_PREDICTION_REQUIRED", error: "aposta pendente" } });
      }
      const expectedSlot = dailyState.answers.length + 1;
      const candidateIds = dailyState.catalog.slice((payload.slot - 1) * 4, payload.slot * 4).map(({ id }) => id);
      assert.equal(payload.slot, expectedSlot);
      assert.ok(candidateIds.includes(payload.winnerId));
      dailyState.answers.push({
        slot: payload.slot,
        answerId: payload.answerId,
        winnerId: payload.winnerId,
        answeredAt: `${dailyState.edition.date}T${String(payload.slot + 9).padStart(2, "0")}:00:00.000Z`,
      });
      if (dailyState.answers.length === 10) dailyState.completion = `${dailyState.edition.date}T22:00:00.000Z`;
      server.duels += 1;
      server.version += 1;
      const body = voteResponse(server, dailyState, payload);
      server.responses.set(payload.answerId, structuredClone(body));
      if (server.loseNextResponse) {
        server.loseNextResponse = false;
        return route.abort("failed");
      }
      return route.fulfill({ status: 200, json: body });
    }
    if (pathname === "/api/daily-prediction" && request.method() === "POST") {
      const payload = request.postDataJSON();
      assert.equal(Object.hasOwn(payload, "answerId"), false);
      assert.equal(Object.hasOwn(payload, "candidateIds"), false);
      const replay = server.predictionResponses.get(payload.predictionId);
      if (replay) {
        const body = structuredClone(replay);
        body.prediction.status = "alreadyProcessed";
        return route.fulfill({ status: 200, json: body });
      }
      const dailyState = [...server.days.values()].find(({ edition: value }) => value.id === payload.editionId);
      if (!dailyState || dailyState.day !== server.currentDay) {
        return route.fulfill({ status: 409, json: { code: "DAILY_PREDICTION_CLOSED", error: "edição fechada" } });
      }
      assert.equal(payload.slot, dailyState.predictions.length + 1);
      assert.equal(dailyState.answers.length, dailyState.predictions.length + 1);
      const candidateIds = dailyState.catalog.slice((payload.slot - 1) * 4, payload.slot * 4).map(({ id }) => id);
      if (payload.decision === "predict") assert.ok(candidateIds.includes(payload.candidateId));
      else assert.equal(payload.decision, "skip");
      dailyState.predictions.push({
        slot: payload.slot,
        predictionId: payload.predictionId,
        candidateId: payload.decision === "skip" ? null : payload.candidateId,
        skipped: payload.decision === "skip",
        respondedAt: `${dailyState.edition.date}T${String(payload.slot + 9).padStart(2, "0")}:01:00.000Z`,
      });
      const body = {
        prediction: {
          id: payload.predictionId,
          status: "created",
          slot: payload.slot,
          candidateId: payload.decision === "skip" ? null : payload.candidateId,
          skipped: payload.decision === "skip",
        },
        dailySession: publicSession(dailyState),
      };
      server.predictionResponses.set(payload.predictionId, structuredClone(body));
      return route.fulfill({ status: 200, json: body });
    }
    return route.fulfill({ status: 404, json: { error: "rota não encontrada" } });
  });
}

async function openDaily(page) {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.locator("#start-election").click();
  await page.getByRole("heading", { name: "Quem você prefere?" }).waitFor();
  const coach = page.getByRole("button", { name: "Começar rodada" });
  if (await coach.count()) await coach.click();
}

async function voteAndWait(page, expectedAnswered) {
  await page.locator(".candidate-card").first().click();
  await page.getByRole("heading", { name: "E o Brasil, escolhe quem?" }).waitFor({ timeout: 5000 });
  if (expectedAnswered % 2) await page.locator("[data-predict]").nth(1).click();
  else await page.getByRole("button", { name: "Pular esta aposta" }).click();
  if (expectedAnswered === 10) {
    await page.getByRole("heading", { name: "Você fechou a rodada." }).waitFor({ timeout: 5000 });
  } else {
    await page.getByText(`${expectedAnswered + 1}/10`, { exact: true }).waitFor({ timeout: 5000 });
  }
}

const browser = await browserType.launch();
try {
  {
    const server = createServer();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await installApi(page, server);
    await openDaily(page);

    await page.getByText("1/10", { exact: true }).waitFor();
    assert.equal(await page.locator("#skip-round").count(), 0);
    await page.getByText("Este slot é igual para todos e não pode ser trocado.", { exact: true }).waitFor();
    // O perfil retirado do catálogo corrente continua jogável só porque veio
    // do snapshot imutável da edição já aberta.
    await page.locator('[data-vote="candidate-1"]').waitFor();
    assert.equal(currentCatalog.some(({ id }) => id === "candidate-1"), false);

    await voteAndWait(page, 1);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#start-election").click();
    await page.getByText("2/10", { exact: true }).waitFor();
    for (let answered = 2; answered <= 10; answered += 1) await voteAndWait(page, answered);

    await page.getByText("entre quem concluiu a rodada de 16/09", { exact: true }).waitFor();
    assert.equal(await page.locator(".daily-receipt li").count(), 10);
    await page.getByRole("button", { name: "Continuar no modo livre" }).click();
    await page.locator("#skip-round").waitFor();

    // O usuário atravessa a meia-noite no modo livre. Reentrar no diário deve
    // consultar o servidor e abrir a nova edição, nunca o cache de ontem.
    server.currentDay = 2;
    await page.getByRole("button", { name: "Início" }).click();
    await page.locator("#start-election").click();
    await page.getByText("1/10", { exact: true }).waitFor();
    assert.equal(await page.locator('[data-vote="candidate-1"]').count(), 0);
    await page.locator('[data-vote="candidate-2"]').waitFor();
    assert.deepEqual(errors, []);
    await context.close();
  }

  {
    const server = createServer();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem("polimatch:v4:round-coach", "seen"));
    await installApi(page, server);
    await openDaily(page);
    server.loseNextResponse = true;
    await page.locator('[data-vote="candidate-1"]').click();
    await page.locator("#retry-vote").waitFor();
    server.currentDay = 2;
    await page.locator("#retry-vote").click();
    await page.locator('[data-vote="candidate-1"]').waitFor({ state: "detached", timeout: 5000 });
    await page.getByText("1/10", { exact: true }).waitFor({ timeout: 5000 });
    assert.equal(await page.locator('[data-vote="candidate-1"]').count(), 0);
    await page.locator('[data-vote="candidate-2"]').waitFor();
    assert.equal(server.requests.length, 2);
    assert.equal(server.requests[0].answerId, server.requests[1].answerId);
    assert.deepEqual(errors, []);
    await context.close();
  }

  {
    const server = createServer();
    server.failDailySession = true;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem("polimatch:v4:round-coach", "seen"));
    await installApi(page, server);
    await page.goto(appUrl, { waitUntil: "networkidle" });

    // Falhar somente o endpoint diário não derruba o núcleo do aplicativo.
    await page.getByRole("heading", { name: "Quem representa o Brasil que você imagina?" }).waitFor();
    await page.getByRole("button", { name: "Ver ranking do público" }).click();
    await page.getByRole("heading", { name: "Ranking" }).waitFor();
    await page.getByRole("button", { name: "Duelo" }).click();
    await page.getByRole("heading", { name: "Não conseguimos atualizar a rodada." }).waitFor();
    await page.getByRole("button", { name: "Ir para o modo livre" }).click();
    await page.getByRole("heading", { name: "Quem você prefere?" }).waitFor();
    await page.locator("#skip-round").waitFor();

    server.failDailySession = false;
    await page.getByRole("button", { name: "Início" }).click();
    await page.locator("#start-election").click();
    await page.getByText("1/10", { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await context.close();
  }

  console.log(`${browserName}: sessão diária, snapshot, reload, fallback livre e viradas validados`);
} finally {
  await browser.close();
}
