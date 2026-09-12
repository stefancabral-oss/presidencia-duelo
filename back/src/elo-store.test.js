import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const dataPath = join(tmpdir(), `presidencia-duelo-${randomUUID()}.json`);
process.env.ELO_FILE = dataPath;
const { snapshot, vote } = await import("./elo-store.js");

after(() => rmSync(dataPath, { force: true }));

test("president and vice aggregate rankings are persisted independently", () => {
  vote("lula", "zema", "presidentes");
  vote("zema", "lula", "vices");

  const presidentes = snapshot("presidentes");
  const vices = snapshot("vices");
  assert.equal(presidentes.duels, 1);
  assert.equal(vices.duels, 1);
  assert.equal(presidentes.ranking.find((row) => row.id === "lula").wins, 1);
  assert.equal(vices.ranking.find((row) => row.id === "zema").wins, 1);
});

test("unknown ranking modes are rejected", () => {
  assert.throws(() => snapshot("outro"), /modo inválido/);
});
