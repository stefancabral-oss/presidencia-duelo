import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { homePanelHtml } from "./home.js";

const cssUrl = new URL("./home-v2.css", import.meta.url);
const navCssUrl = new URL("./nav-v2.css", import.meta.url);
const enhancementUrl = new URL("./frontend-enhancements.js", import.meta.url);

test("home v2 tem um CTA dominante e atalhos enxutos", () => {
  const html = homePanelHtml();
  assert.match(html, /pm-home-v2/);
  assert.match(html, /id="home-play"/);
  assert.match(html, /Jogar agora/);
  for (const id of ["home-tournament", "home-ranking", "home-podium", "home-achievements", "home-credits"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test("home v2 usa porcelana clara e malaquita estrutural", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /background:#faf8f3/);
  assert.match(css, /background:#073326/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /prefers-reduced-motion/);
});

test("nav v2 tem cinco destinos e iconografia svg propria", async () => {
  const [css, js] = await Promise.all([
    readFile(navCssUrl, "utf8"),
    readFile(enhancementUrl, "utf8"),
  ]);
  assert.match(css, /grid-template-columns:repeat\(5/);
  assert.match(css, /pm-nav-v2__item/);
  assert.match(js, /function navIcon/);
  for (const id of ["tab-home", "tab-duel", "tab-tournament", "tab-rank", "tab-credits"]) {
    assert.match(js, new RegExp(`"${id}"`));
  }
});
