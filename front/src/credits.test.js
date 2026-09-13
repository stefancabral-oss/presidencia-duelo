import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  GITHUB_README_URL,
  GITHUB_REPO_URL,
  PHOTO_CREDITS,
  SEARCHABLE_PHOTO_CREDITS,
  creditsGroupsHtml,
  creditsPanelHtml,
  filterPhotoCredits,
  normalizeCreditSearch,
  updateCreditsSearch,
} from "./credits.js";

const here = dirname(fileURLToPath(import.meta.url));
const gameSrc = readFileSync(join(here, "game.js"), "utf8");
const candidates = JSON.parse(readFileSync(join(here, "../../shared/candidates.json"), "utf8"));

const RAW_MD_HREF = /href\s*=\s*["'](?:\.\/|\/)?(?:CREDITS|README)\.md["']/;

test("README points at the GitHub-rendered blob, not a local markdown file", () => {
  assert.equal(
    GITHUB_README_URL,
    "https://github.com/stefancabral-oss/presidencia-duelo/blob/main/README.md",
  );
  assert.equal(GITHUB_REPO_URL, "https://github.com/stefancabral-oss/presidencia-duelo");
  assert.match(GITHUB_README_URL, /^https:\/\//);
});

test("photo credits cover every candidate with local attribution text", () => {
  const photographedCandidates = candidates.filter((candidate) => candidate.photo);
  assert.equal(PHOTO_CREDITS.length, photographedCandidates.length);
  const names = new Set(PHOTO_CREDITS.map((row) => row.name));
  for (const candidate of photographedCandidates) {
    assert.ok(names.has(candidate.name), `missing credits for ${candidate.name}`);
  }
  for (const row of PHOTO_CREDITS) {
    assert.ok(row.license);
    assert.ok(row.author);
    assert.match(row.commons, /^https:\/\//);
  }
});

test("credits panel HTML stays in-app and has no raw .md file links", () => {
  const html = creditsPanelHtml();
  assert.match(html, /Créditos das fotos/);
  assert.match(html, /Wikimedia Commons/);
  assert.match(html, /id="credits-search"/);
  assert.match(html, /id="credits-count"/);
  assert.doesNotMatch(html, RAW_MD_HREF);
  assert.doesNotMatch(html, /href\s*=\s*["'][^"']*\.md["']/);
  for (const row of PHOTO_CREDITS) {
    assert.match(html, new RegExp(row.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, new RegExp(row.license.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("credit search ignores case and accents and includes party", () => {
  assert.equal(normalizeCreditSearch("  JOÃO  "), "joao");
  assert.ok(filterPhotoCredits("joao").every((row) => normalizeCreditSearch(row.name).includes("joao")));
  const pt = filterPhotoCredits("PT");
  assert.ok(pt.length > 0);
  assert.ok(pt.some((row) => row.party === "PT"));
  assert.equal(SEARCHABLE_PHOTO_CREDITS.length, PHOTO_CREDITS.length);
});

test("credit groups are collapsible and empty search is explicit", () => {
  assert.match(creditsGroupsHtml(SEARCHABLE_PHOTO_CREDITS.slice(0, 3)), /<details class="credit-group"/);
  assert.match(creditsGroupsHtml([]), /Nenhum crédito encontrado/);
});

test("search updates result count and expands matching groups", () => {
  const count = { textContent: "" };
  const groups = { innerHTML: "" };
  const total = updateCreditsSearch({ query: "Alexandre de Moraes", count, groups });
  assert.equal(total, 1);
  assert.equal(count.textContent, "1 resultado");
  assert.match(groups.innerHTML, /Alexandre de Moraes/);
  assert.match(groups.innerHTML, /<details class="credit-group" open>/);
});

test("game shell uses a Créditos tab and does not footer-link raw markdown", () => {
  assert.match(gameSrc, /id="tab-credits"/);
  assert.match(gameSrc, /id="panel-credits"/);
  assert.match(gameSrc, /id="open-credits"/);
  assert.match(gameSrc, /GITHUB_README_URL/);
  assert.match(gameSrc, /creditsPanelHtml\(\)/);
  assert.doesNotMatch(gameSrc, RAW_MD_HREF);
});
