import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { homePanelHtml } from "./home.js";

const gameSource = fs.readFileSync(new URL("./game.js", import.meta.url), "utf8");

test("home is the default panel and presents the primary duel action", () => {
  const html = homePanelHtml();
  assert.match(html, /id="panel-home" class="panel active pm-home-v2"/);
  assert.match(html, /id="home-play"/);
  assert.match(html, /Jogar agora/);
  assert.match(html, /Jogo casual · não é pesquisa eleitoral/);
});

test("home exposes the requested one-tap destinations", () => {
  const html = homePanelHtml();
  for (const id of ["home-tournament", "home-ranking", "home-podium", "home-achievements", "home-credits"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test("home avoids rarity language and wires its primary destinations", () => {
  const html = homePanelHtml();
  assert.doesNotMatch(html, /raridade|lendário|épico/i);
  assert.match(gameSource, /els\.homePlay\.addEventListener\("click", \(\) => setTab\("duel"\)\)/);
  assert.match(gameSource, /els\.homeTournament\.addEventListener\("click", \(\) => setTab\("tournament"\)\)/);
  assert.match(gameSource, /els\.homePodium\.addEventListener\("click", \(\) => openPodium\(\)\)/);
});
