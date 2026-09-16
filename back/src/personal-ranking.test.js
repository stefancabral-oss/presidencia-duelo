import assert from "node:assert/strict";
import test from "node:test";
import { PERSONAL_RANKING_POLICY, personalRankingFromRows } from "./personal-ranking.js";

const people = (...ids) => ids.map((id) => ({ id, name: id.toUpperCase() }));
const stats = (ids, ratings = {}) => ids.map((candidate_id) => ({ candidate_id, rating: ratings[candidate_id] || 1000 }));
const pair = (winnerId, loserId, winnerCount = 1, loserCount = 0) => winnerId < loserId
  ? { a_id: winnerId, b_id: loserId, a_wins: winnerCount, b_wins: loserCount }
  : { a_id: loserId, b_id: winnerId, a_wins: loserCount, b_wins: winnerCount };
const compact = (result) => result.ranking
  .filter(({ decisions }) => decisions > 0)
  .map(({ id, rank, rankBasis }) => [id, rank, rankBasis]);
const round = (winnerId, ...loserIds) => ({ winnerId, candidateIds: [winnerId, ...loserIds] });

function pairRowsFromRounds(rounds) {
  const totals = new Map();
  for (const { winnerId, candidateIds } of rounds) {
    assert.equal(candidateIds.length, 4);
    assert.equal(new Set(candidateIds).size, 4);
    for (const loserId of candidateIds.filter((id) => id !== winnerId)) {
      const row = pair(winnerId, loserId);
      const key = `${row.a_id}\u0000${row.b_id}`;
      const current = totals.get(key) || { ...row, a_wins: 0, b_wins: 0 };
      current.a_wins += row.a_wins;
      current.b_wins += row.b_wins;
      totals.set(key, current);
    }
  }
  return [...totals.values()];
}

test("declares pairwise majority as the personal ranking contract", () => {
  assert.equal(PERSONAL_RANKING_POLICY.id, "pairwise-majority-scc-v1");
  assert.match(PERSONAL_RANKING_POLICY.explanation, /Ciclos/);
  assert.match(PERSONAL_RANKING_POLICY.explanation, /Elo/);
});

test("the measured 35-round regression no longer uses exposure or Elo as a tiebreak", () => {
  const featured = ["janja", "gleisi", "vitor", "haddad", "ratinho", "lula"];
  const rounds = [
    round("janja", "lula", "relay", "j-01"),
    round("janja", "j-02", "j-03", "j-04"),
    round("janja", "j-05", "j-06", "j-07"),
    round("gleisi", "g-01", "g-02", "g-03"),
    round("gleisi", "g-04", "g-05", "g-06"),
    round("gleisi", "g-07", "g-08", "g-09"),
    round("vitor", "v-01", "v-02", "v-03"),
    round("vitor", "v-04", "v-05", "v-06"),
    round("vitor", "v-07", "v-08", "v-09"),
    round("haddad", "h-01", "h-02", "h-03"),
    round("haddad", "h-04", "h-05", "h-06"),
    round("ratinho", "r-01", "r-02", "r-03"),
    round("ratinho", "r-04", "r-05", "r-06"),
    round("lula", "l-01", "l-02", "l-03"),
    round("lula", "l-04", "l-05", "l-06"),
    ...Array.from({ length: 20 }, () => round("relay", "filler-a", "filler-b", "filler-c")),
  ];
  assert.equal(rounds.length, 35);

  const appearances = new Map();
  const choices = new Map();
  for (const { winnerId, candidateIds } of rounds) {
    choices.set(winnerId, (choices.get(winnerId) || 0) + 1);
    for (const id of candidateIds) appearances.set(id, (appearances.get(id) || 0) + 1);
  }
  assert.deepEqual(featured.map((id) => [id, appearances.get(id), choices.get(id) || 0]), [
    ["janja", 3, 3], ["gleisi", 3, 3], ["vitor", 3, 3],
    ["haddad", 2, 2], ["ratinho", 2, 2], ["lula", 3, 2],
  ]);

  const catalogIds = [...new Set(rounds.flatMap(({ candidateIds }) => candidateIds))];
  const result = personalRankingFromRows("topic", rounds.length, people(...catalogIds), stats(catalogIds, {
    janja: 1123, gleisi: 1122, vitor: 1120, haddad: 1091, relay: 1089,
    ratinho: 1087, "filler-a": 1080, "filler-b": 1075, lula: 1071,
  }), pairRowsFromRounds(rounds));
  const measured = new Map(result.ranking.filter(({ id }) => featured.includes(id)).map((entry) => [entry.id, entry]));
  for (const id of ["janja", "gleisi", "vitor", "haddad", "ratinho"]) assert.equal(measured.get(id).rank, 1);
  assert.equal(measured.get("lula").rank, 6);
  assert.deepEqual(featured.map((id) => {
    const { wins, losses, winRate, elo } = measured.get(id);
    return [id, wins, losses, winRate, elo];
  }), [
    ["janja", 9, 0, 100, 1123], ["gleisi", 9, 0, 100, 1122], ["vitor", 9, 0, 100, 1120],
    ["haddad", 6, 0, 100, 1091], ["ratinho", 6, 0, 100, 1087], ["lula", 6, 1, 86, 1071],
  ]);
  assert.equal(result.rankingPolicy, PERSONAL_RANKING_POLICY);
});

test("direct majority beats a misleading approval-rate order", () => {
  const ids = ["a", "b", "x", "y"];
  const result = personalRankingFromRows("topic", 1, people(...ids), stats(ids), [
    pair("a", "b", 2, 1), pair("x", "a", 3), pair("b", "y", 10),
  ]);
  assert.deepEqual(result.ranking.filter(({ decisions }) => decisions).map(({ id, rank }) => [id, rank]), [
    ["x", 1], ["a", 2], ["b", 3], ["y", 4],
  ]);
  assert.ok(result.ranking.find(({ id }) => id === "a").winRate < result.ranking.find(({ id }) => id === "b").winRate);
});

test("ties, cycles and disconnected comparisons receive honest competition ranks", () => {
  const tied = personalRankingFromRows("topic", 1, people("a", "b", "c"), stats(["a", "b", "c"]), [
    pair("a", "c"), pair("b", "c", 1, 1),
  ]);
  assert.deepEqual(compact(tied), [["a", 1, "unresolved-frontier"], ["b", 1, "unresolved-frontier"], ["c", 3, "strict-frontier"]]);

  const cycle = personalRankingFromRows("topic", 1, people("a", "b", "c", "d"), stats(["a", "b", "c", "d"]), [
    pair("a", "b"), pair("b", "c"), pair("c", "a"), pair("c", "d"),
  ]);
  assert.deepEqual(compact(cycle), [
    ["a", 1, "majority-cycle"], ["b", 1, "majority-cycle"], ["c", 1, "majority-cycle"], ["d", 4, "strict-frontier"],
  ]);

  const disconnected = personalRankingFromRows("topic", 1, people("a", "b", "c", "d"), stats(["a", "b", "c", "d"]), [
    pair("a", "b"), pair("c", "d"),
  ]);
  assert.deepEqual(compact(disconnected), [
    ["a", 1, "unresolved-frontier"], ["c", 1, "unresolved-frontier"], ["b", 3, "unresolved-frontier"], ["d", 3, "unresolved-frontier"],
  ]);
});

test("uniform duplication and Elo changes cannot alter majority ranks", () => {
  const ids = ["a", "b", "c"];
  const base = personalRankingFromRows("topic", 1, people(...ids), stats(ids, { a: 800, b: 1000, c: 1400 }), [
    pair("a", "b", 2, 1), pair("b", "c", 4, 2),
  ]);
  const mutated = personalRankingFromRows("topic", 1, people(...ids), stats(ids, { a: 5000, b: 1, c: 9000 }), [
    pair("b", "c", 8, 4), pair("a", "b", 4, 2),
  ]);
  assert.deepEqual(base.ranking.map(({ id, rank, preferenceScore }) => [id, rank, preferenceScore]),
    mutated.ranking.map(({ id, rank, preferenceScore }) => [id, rank, preferenceScore]));
});

test("pending comparisons build the transactional after-snapshot before persistence", () => {
  const result = personalRankingFromRows("topic", 1, people("a", "b", "c", "d"), stats(["a", "b", "c", "d"]), [], {
    pendingComparisons: [
      { winnerId: "a", loserId: "b" }, { winnerId: "a", loserId: "c" }, { winnerId: "a", loserId: "d" },
    ],
  });
  assert.deepEqual(result.ranking.map(({ id, rank }) => [id, rank]), [["a", 1], ["b", 2], ["c", 2], ["d", 2]]);
  assert.equal(Object.is(result.ranking[0].preferenceScore, -0), false);
  assert.deepEqual(JSON.parse(JSON.stringify(result)).ranking, result.ranking);
});
