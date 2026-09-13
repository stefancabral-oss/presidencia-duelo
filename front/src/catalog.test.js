import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const catalog = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../shared/candidates.json"), "utf8"),
);

test("approved people catalog contains all 387 stable records", () => {
  assert.equal(catalog.length, 387);
  assert.deepEqual(catalog.map((person) => person.personId), Array.from({ length: 387 }, (_, i) => i + 1));
  assert.equal(new Set(catalog.map((person) => person.id)).size, 387);
  assert.equal(new Set(catalog.map((person) => person.name)).size, 387);
});

test("approved list endpoints and representative names are present", () => {
  assert.equal(catalog[0].name, "Acelino Popó Freitas");
  assert.equal(catalog.at(-1).name, "Zeina Latif");
  for (const name of ["Alexandre de Moraes", "Felipe Neto", "Jair Messias Bolsonaro", "Luiz Inácio Lula da Silva", "Pablo Marçal"]) {
    assert.ok(catalog.some((person) => person.name === name), `${name} não encontrado`);
  }
});

test("existing profiles keep their IDs and curated metadata", () => {
  const lula = catalog.find((person) => person.name === "Luiz Inácio Lula da Silva");
  assert.equal(lula.id, "lula");
  assert.equal(lula.party, "PT");
  assert.equal(lula.photo, "/candidates/lula.jpg");

  const basic = catalog.find((person) => person.name === "Felipe Neto");
  assert.equal(basic.id, "pessoa-135");
  assert.equal(basic.party, "");
  assert.equal(basic.vice, "");
  assert.match(basic.photo, /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:Redirect\/file\//);
  assert.equal(basic.initials, "FN");
});

test("every licensed profile reference is shown as a photo", () => {
  const photographed = catalog.filter((person) => person.photo);
  assert.equal(photographed.length, 310);
  for (const person of photographed) {
    assert.ok(
      person.photo.startsWith("/candidates/") ||
        person.photo.startsWith("https://commons.wikimedia.org/wiki/Special:Redirect/file/"),
      `origem de foto inesperada para ${person.name}`,
    );
  }
});
