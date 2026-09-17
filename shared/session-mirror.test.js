import test from "node:test";
import assert from "node:assert/strict";
import { sessionMirror } from "./session-mirror.js";
import { choiceMessage, isRoundZebra, roundWinProbability } from "./player-feedback.js";

test("mirror counts only known structured snapshot fields of the completed session", () => {
  const person = (id, party, area, status = "extracted") => ({ id, party, primaryArea: area, mirrorGroup: "politica",
    taxonomyProvenance: { party: { status }, primaryArea: { status } }, publication: { content: { status: "approved" } } });
  const session = { status: "completed", edition: { id: "today" }, progress: { total: 3 },
    catalog: [person("a", "PT", "Executivo"), person("b", "PL", "Legislativo"), person("c", "inventado", "inventada", "inferred")],
    answers: [{ winnerId: "a" }, { winnerId: "b" }, { winnerId: "c" }] };
  const mirror = sessionMirror(session);
  assert.equal(mirror.axes.length, 3);
  assert.deepEqual(mirror.axes[1].values, [{ value: "PL", count: 1 }, { value: "PT", count: 1 }]);
  assert.equal(mirror.axes[1].unknown, 1);
  assert.equal(JSON.stringify(mirror).includes("inventad"), false);
  assert.deepEqual(mirror.axes[2].values, [{ value: "Política", count: 3 }, { value: "Influência no debate", count: 0 }]);
  assert.equal(sessionMirror({ ...session, status: "active" }), null);
  const unreviewed = sessionMirror({ ...session, catalog: session.catalog.map(person => ({ ...person, publication: { content: { status: "pending" } } })) });
  assert.ok(unreviewed.axes.every(axis => axis.known === 0 && axis.unknown === 3));
});
test("a round upset needs low round probability, not simply one stronger opponent", () => {
  assert.equal(isRoundZebra(1000, [1060, 950, 900]), false);
  assert.equal(isRoundZebra(800, [1200, 1250, 1300]), true);
  assert.equal(isRoundZebra(1000, [1000, 1000, 1000]), false);
  assert.equal(roundWinProbability(1000, [1000, 1000, 1000]), 0.25);
});
test("35 ordinary rounds distribute feedback across seven comprehensible messages", () => {
  const counts = new Map();
  for (let i = 1; i <= 35; i++) { const message = choiceMessage("Pessoa", i); counts.set(message, (counts.get(message) || 0) + 1); }
  assert.equal(counts.size, 7);
  assert.ok([...counts.values()].every(count => count === 5));
  assert.ok([...counts.keys()].every(text => !/Elo|patente/.test(text)));
});
