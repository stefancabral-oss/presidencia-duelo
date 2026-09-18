import assert from "node:assert/strict";
import { isZebra, ratingDeltas } from "../../shared/elo.js";
import { choiceMessage, isRoundZebra } from "../../shared/player-feedback.js";

// Reproducible synthetic play, never production votes. Winner sampling follows
// a Luce model over latent strengths; Elo updates use the production function.
const runs = [];
const messages = [];
for (let seed = 1; seed <= 10; seed++) {
  let randomState = seed;
  const random = () => ((randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0) / 2 ** 32);
  const people = Array.from({ length: 54 }, (_, id) => ({ id, rating: 1000, strength: 600 + random() * 800 }));
  let before = 0, after = 0;
  for (let round = 1; round <= 400; round++) {
    const deck = [...people];
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const cards = deck.slice(0, 4);
    const weights = cards.map(person => 10 ** (person.strength / 400));
    let draw = random() * weights.reduce((a, b) => a + b, 0), index = 0;
    while (index < 3 && draw >= weights[index]) draw -= weights[index++];
    const winner = cards[index], losers = cards.filter(person => person !== winner);
    const oldEvent = losers.some(person => isZebra(winner.rating, person.rating));
    const zebra = isRoundZebra(winner.rating, losers.map(person => person.rating));
    before += Number(oldEvent); after += Number(zebra);
    if (seed === 1 && round >= 101 && round <= 135) messages.push({ round, winner: winner.id, zebra, message: choiceMessage("Pessoa", round, { zebra }) });
    const initial = winner.rating;
    for (const loser of losers) { const delta = ratingDeltas(initial, loser.rating); winner.rating += delta.winnerDelta; loser.rating += delta.loserDelta; }
  }
  runs.push({ seed, rounds: 400, before, after });
}
const total = runs.reduce((sum, run) => sum + run.rounds, 0);
const before = runs.reduce((sum, run) => sum + run.before, 0) / total;
const after = runs.reduce((sum, run) => sum + run.after, 0) / total;
const distribution = Object.fromEntries([...new Set(messages.map(row => row.message))].map(message => [message, messages.filter(row => row.message === message).length]));
assert.ok(after < before && after <= .1, `round event frequency ${after}`);
assert.equal(messages.length, 35);
assert.ok(Math.max(...Object.values(distribution)) / 35 < .25);
console.log(JSON.stringify({ methodology: "10 fixed seeds; 54 synthetic latent strengths; 400 four-card choices each; Luce winner sampling; production Elo deltas; message probe seed 1 rounds 101–135", rounds: total, beforeRate: before, afterRate: after, runs, distribution, messages }, null, 2));
