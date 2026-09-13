import test from "node:test";
import assert from "node:assert/strict";
import CANDIDATES from "../../shared/candidates.json" with { type: "json" };
import { formatProfileDate, personProfile, personProfileHtml, restorePersonProfileFocus } from "./person-profile.js";

test("all approved people have a profile and an identity source", () => {
  assert.equal(CANDIDATES.length, 360);
  for (const candidate of CANDIDATES) {
    const profile = personProfile(candidate.id);
    assert.ok(profile, candidate.name);
    assert.match(profile.updatedAt, /^20\d{2}-\d{2}-\d{2}$/, candidate.name);
    assert.ok(profile.sources.length > 0, candidate.name);
    assert.ok(profile.sources.every((source) => source.url.startsWith("https://")), candidate.name);
    if (profile.currentMoment) {
      assert.ok(profile.sources.some((source) => source.publishedAt), candidate.name);
    }
  }
});

test("information controls are separate from voting cards", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("./game.js", import.meta.url), "utf8");
  assert.match(source, /<\/button>\s*<button type="button" class="card-info" id="info-card-a">/);
  assert.match(source, /infoCardA\.addEventListener\("click", \(\) => showProfile/);
  assert.doesNotMatch(source, /infoCardA\.addEventListener\("click", \(\) => pick/);
  assert.match(source, /if \(els\.personProfileDialog\.open\) return;/);
});

test("profile renders current-only facts, topic, dated sources, and safe links", () => {
  const html = personProfileHtml(
    { id: "pessoa-3", name: "Adriana Ventura" },
    personProfile("pessoa-3"),
    { label: "Corrida 2026" },
  );
  assert.match(html, /Atuação atual/);
  assert.match(html, /Corrida 2026/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /<time datetime="2026-/);
  assert.doesNotMatch(html, /históric/i);
});

test("missing current news is explicit instead of invented", () => {
  const html = personProfileHtml(
    { id: "missing", name: "Sem fonte" },
    { updatedAt: "2026-09-12", sources: [] },
    { label: "Política em Jogo" },
  );
  assert.match(html, /Ainda não há notícia atual com fonte vinculada/);
  assert.match(html, /Nenhuma fonte cadastrada/);
});

test("date formatting is stable and focus returns to the separate info button", () => {
  assert.equal(formatProfileDate("2026-09-12"), "12/09/2026");
  const trigger = { focused: false, focus() { this.focused = true; } };
  const dialog = { dataset: { returnFocus: "info-card-a" } };
  restorePersonProfileFocus(dialog, { getElementById: () => trigger });
  assert.equal(trigger.focused, true);
  assert.equal("returnFocus" in dialog.dataset, false);
});
