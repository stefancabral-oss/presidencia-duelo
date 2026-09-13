import assert from "node:assert/strict";
import { test } from "node:test";
import {
  completedTournamentDuels,
  createTournament,
  currentTournamentMatch,
  formatTournamentShareText,
  isValidTournament,
  tournamentPick,
} from "./tournament.js";

const ids = Array.from({ length: 12 }, (_, index) => `c${index + 1}`);

test("12 candidates produce four opening matches and four byes", () => {
  const tournament = createTournament(ids, () => 0.999999);
  assert.equal(tournament.rounds[0].matches.length, 4);
  assert.equal(tournament.byes.length, 4);
  assert.equal(new Set([...tournament.entrants]).size, 12);
});

test("tournament ends after 11 picks with one champion", () => {
  const tournament = createTournament(ids, () => 0.999999);
  while (!tournament.champion) {
    const match = currentTournamentMatch(tournament);
    assert.ok(match);
    assert.equal(tournamentPick(tournament, match.candidates[0]), true);
    assert.equal(isValidTournament(JSON.parse(JSON.stringify(tournament)), ids), true);
  }
  assert.equal(completedTournamentDuels(tournament), 11);
  assert.equal(tournament.rounds.length, 4);
  assert.deepEqual(tournament.rounds.map((round) => round.matches.length), [4, 4, 2, 1]);
  assert.ok(ids.includes(tournament.champion));
});

test("a pick outside the active match is ignored", () => {
  const tournament = createTournament(ids, () => 0.999999);
  assert.equal(tournamentPick(tournament, "not-playing"), false);
  assert.equal(completedTournamentDuels(tournament), 0);
});

test("winner share text includes candidate and disclaimer", () => {
  const text = formatTournamentShareText({ name: "Candidata Teste", party: "ABC" });
  assert.match(text, /Meu vencedor é Candidata Teste \(ABC\)/);
  assert.match(text, /Não é pesquisa oficial/);
  assert.doesNotMatch(formatTournamentShareText({ name: "Pessoa Básica", party: "" }), /\(\)/);
});

test("persisted tournament validation rejects duplicate and unknown candidates", () => {
  const tournament = createTournament(ids, () => 0.999999);
  assert.equal(isValidTournament(tournament, ids), true);
  tournament.entrants[0] = tournament.entrants[1];
  assert.equal(isValidTournament(tournament, ids), false);
});
