import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { completedDailySession } from "./daily-fixture.mjs";
import { capabilityFixture, voteResponseV2 } from "./aggregate-fixture.mjs";

const browser = await ({ chromium, webkit }[process.env.POLIMATCH_E2E_BROWSER || "chromium"]).launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
const base = completedDailySession(Array.from({ length: 4 }, (_, id) => ({ id: `p${id}`, name: `Pessoa ${id}`, role: "Pessoa pública" })));
const catalog = base.catalog;
let version = 0, pairCount = 0, keyNumber = 0, pendingPair, releaseVote, releaseDiscard, failDiscard = true;
const discards = [], votes = [], errors = [];
page.on("pageerror", error => errors.push(error.message));
const ranking = () => catalog.map(person => ({ ...person, elo: 1000, wins: version, losses: 0, decisions: version, winRate: version ? 100 : 0, rank: version ? 1 : null }));
const personal = () => ({ version, duels: version, ranking: ranking() });
await page.addInitScript(() => localStorage.setItem("polimatch:v4:round-coach", "seen"));
await page.route("**/api/**", async route => {
  const path = new URL(route.request().url()).pathname;
  const send = (json, status = 200) => route.fulfill({ status, json });
  if (path === "/api/capabilities") return send(capabilityFixture([]));
  if (path === "/api/game-capabilities") return send({ version: 1, pairs: true, discard: true, mirror: true, collection: true });
  if (path === "/api/candidates") return send({ candidates: catalog });
  if (path === "/api/player") return send({ recoveryKey: `pm2_${String(++keyNumber).repeat(43)}` }, 201);
  if (path === "/api/player/state") return send(personal());
  if (path === "/api/daily-session") return send(base);
  if (path === "/api/pair-round") {
    const mode = route.request().postDataJSON().mode;
    if (mode === "tiebreak") return send({ mode, status: "active", remaining: 7, round: { id: "550e8400-e29b-41d4-a716-000000000099", candidateIds: catalog.slice(0, 2).map(person => person.id) } });
    if (pairCount === 3) return send({ mode: "warmup", status: "completed", remaining: 0, round: null });
    pendingPair = { id: `550e8400-e29b-41d4-a716-${String(pairCount + 1).padStart(12, "0")}`, candidateIds: catalog.slice(pairCount * 2, pairCount * 2 + 2).map(person => person.id) };
    return send({ mode: "warmup", status: "active", remaining: 3 - pairCount, round: pendingPair });
  }
  if (path === "/api/pair-vote") {
    const payload = route.request().postDataJSON(); votes.push(payload);
    assert.equal(payload.roundId, pendingPair.id);
    if (pairCount === 0) await new Promise(resolve => { releaseVote = resolve; });
    version++; pairCount++;
    const tier = { id: "contender", label: "No páreo", level: 2 };
    const feedback = { primaryEvent: "confirm", rankingEvent: "confirm", zebra: false, outcomes: pendingPair.candidateIds.map(id => ({ id, result: id === payload.winnerId ? "winner" : "loser", delta: id === payload.winnerId ? 16 : -16, elo: 1000, previousTier: tier, tier, tierChange: null })) };
    const round = { ...pendingPair, status: "created", winnerId: payload.winnerId, comparisons: 1, winnerDelta: 16, zebra: false, personalFeedback: feedback, feedbackScope: "personal" };
    return send(voteResponseV2({ player: personal(), round, vote: round }, { aggregate: false }));
  }
  if (path === "/api/round-discard") {
    discards.push(route.request().postDataJSON());
    if (failDiscard) { await new Promise(resolve => { releaseDiscard = resolve; }); failDiscard = false; return send({ error: "Rede indisponível. Repita a mesma decisão." }, 503); }
    return send({ ...discards.at(-1), status: "created", rankingEffect: "none" });
  }
  if (path === "/api/collection") return send({ purchasable: false, enabled: true, total: 12, items: [{ id: "jade", title: "Jade", acquiredAt: "2026-09-17T00:00:00Z" }] });
  if (path === "/api/discard-offer") return send({ offered: true });
  return send({ error: "mock não encontrado" }, 404);
});
try {
  await page.goto(process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/");
  await page.locator('.bottom-nav [data-screen="duel"]').click();
  await page.locator('.arena-pair [data-vote]:visible').first().waitFor();
  assert.equal(await page.locator('[data-vote]:visible').count(), 2);
  await page.locator('[data-vote]:visible').first().click();
  await page.waitForFunction(() => document.querySelector('#leave-pair').disabled);
  await page.locator('#leave-pair').evaluate(button => button.click());
  releaseVote();
  const discard = page.locator('[data-discard]').first();
  await discard.waitFor();
  await discard.focus();
  await page.keyboard.press('Enter');
  assert.equal(await discard.evaluate(button => button === document.activeElement), true);
  releaseDiscard();
  await page.getByText('Rede indisponível. Repita a mesma decisão.').waitFor();
  assert.equal(await discard.evaluate(button => button === document.activeElement), true);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-vote]') === document.activeElement);
  assert.deepEqual(discards[0], discards[1]);
  for (let i = 0; i < 2; i++) {
    await page.locator('[data-vote]:visible').first().click();
    await page.getByRole('button', { name: 'Pular descarte' }).click();
  }
  await page.getByText('Aquecimento concluído. Agora vêm as dez escolhas do dia.').waitFor();
  await page.locator('#leave-pair-status').click();
  await page.getByRole('heading', { name: 'Seu Espelho de hoje' }).waitFor();
  assert.equal(await page.locator('.mirror-axes article').count(), 3);
  await page.getByRole('button', { name: 'Coleção', exact: true }).click();
  await page.getByRole('heading', { name: 'Jade', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Ranking', exact: true }).click();
  await page.locator('#start-tiebreak').click();
  await page.locator('[data-game-mode="tiebreak"] .arena-pair [data-vote]:visible').first().waitFor();
  assert.equal(await page.locator('[data-vote]:visible').count(), 2);
  await page.locator('#leave-pair').click();
  await page.locator('#start-free-mode').click();
  assert.equal(await page.locator('[data-vote]:visible').count(), 4, 'free mode retains four cards');
  assert.equal(votes.length, 3);
  assert.deepEqual(errors, []);
  console.log('Game UI: two cards, blocked departure while sending, persistent discard focus, failure/retry identity, three-round completion, mirror and real inventory passed.');
} catch (error) { console.error(await page.locator('body').innerText()); throw error; }
finally { await browser.close(); }
