import assert from "node:assert/strict";
import test from "node:test";
import {
  DAILY_SESSION_RULESET,
  DAILY_SESSION_RULESET_V1,
  DAILY_SESSION_RULESET_V2,
  DAILY_SESSION_RULESET_V3,
  buildDailyEdition,
  dailyCutMethodology,
  dailyRulesetByIdentity,
  editionWindow,
  editorialDateKey,
  nextEditionDate,
  validateEditionDate,
} from "./daily-session.js";

const catalog = Array.from({ length: 54 }, (_, index) => `person-${String(index + 1).padStart(2, "0")}`);

test("São Paulo defines the editorial day and its hard midnight boundary", () => {
  assert.equal(editorialDateKey("2026-09-16T02:59:59.999Z"), "2026-09-15");
  assert.equal(editorialDateKey("2026-09-16T03:00:00.000Z"), "2026-09-16");
  assert.equal(nextEditionDate("2026-12-31"), "2027-01-01");
  assert.deepEqual(editionWindow("2026-09-16"), {
    opensAt: "2026-09-16T03:00:00.000Z",
    closesAt: "2026-09-17T03:00:00.000Z",
  });
});

test("the daily edition is identical for every player and reproducible from date plus sorted catalog", () => {
  const firstPlayer = buildDailyEdition({ topicId: "eleicoes-2026", candidateIds: catalog, dateKey: "2026-09-16" });
  const secondPlayer = buildDailyEdition({ topicId: "eleicoes-2026", candidateIds: [...catalog].reverse(), dateKey: "2026-09-16" });

  assert.deepEqual(secondPlayer, firstPlayer);
  assert.equal(firstPlayer.rounds.length, 10);
  assert.equal(firstPlayer.rounds.every(({ candidateIds }) => candidateIds.length === 4), true);
  assert.equal(firstPlayer.catalogSchema, "candidate-public-v3");
  assert.equal(new Set(firstPlayer.rounds.flatMap(({ candidateIds }) => candidateIds)).size, 40);
  assert.match(firstPlayer.catalogHash, /^[a-f0-9]{64}$/);
  assert.equal(firstPlayer.rounds.every(({ selectionHash }) => /^[a-f0-9]{64}$/.test(selectionHash)), true);
});

test("the next editorial day has a different fixed deck", () => {
  const today = buildDailyEdition({ topicId: "eleicoes-2026", candidateIds: catalog, dateKey: "2026-09-16" });
  const tomorrow = buildDailyEdition({ topicId: "eleicoes-2026", candidateIds: catalog, dateKey: "2026-09-17" });
  assert.notDeepEqual(tomorrow.rounds.map(({ candidateIds }) => candidateIds), today.rounds.map(({ candidateIds }) => candidateIds));
});

test("ruleset fixes ten daily choices plus twenty free choices in the same editorial day", () => {
  assert.deepEqual(DAILY_SESSION_RULESET.quota, {
    id: "editorial-day-v2",
    totalChoices: 30,
    dailyChoices: 10,
    freeChoices: 20,
  });
  assert.equal(DAILY_SESSION_RULESET, DAILY_SESSION_RULESET_V3);
  assert.equal(DAILY_SESSION_RULESET.catalogSchema, "candidate-public-v3");
  assert.equal(dailyCutMethodology("2026-09-15"), "entre quem concluiu a rodada de 15/09");
  assert.equal(dailyRulesetByIdentity("daily-four-card-v1", 1), DAILY_SESSION_RULESET_V1);
  assert.equal(dailyRulesetByIdentity("daily-four-card-v2", 2), DAILY_SESSION_RULESET_V2);
  assert.equal(dailyRulesetByIdentity("daily-four-card-v3", 3), DAILY_SESSION_RULESET_V3);
  assert.throws(() => dailyRulesetByIdentity("daily-four-card-v4", 4), /histórico não suportado/);
});

test("invalid or insufficient edition inputs fail closed", () => {
  assert.throws(() => validateEditionDate("2026-02-30"), /inválida/);
  assert.throws(
    () => buildDailyEdition({ topicId: "eleicoes-2026", candidateIds: catalog.slice(0, 39), dateKey: "2026-09-16" }),
    /ao menos 40/,
  );
});
