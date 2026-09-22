import assert from "node:assert/strict";
import test from "node:test";
import { anyCivicArea, areaEnabled, civicFlags } from "./civic/flags.js";

test("sem capacidades do servidor e sem variáveis, as duas áreas ficam desligadas", () => {
  const flags = civicFlags({}, {});
  assert.deepEqual(flags, { directory: false, news: false });
  assert.equal(anyCivicArea(flags), false);
  assert.equal(anyCivicArea(civicFlags(null, undefined)), false);
});

test("capacidades do servidor ligam cada área separadamente", () => {
  const flags = civicFlags({ version: 1, collection: true, civicDirectory: true }, {});
  assert.deepEqual(flags, { directory: true, news: false });
  assert.equal(areaEnabled(flags, "directory"), true);
  assert.equal(areaEnabled(flags, "news"), false);
  assert.equal(civicFlags({ civicNews: "true" }, {}).news, false, "só booleano verdadeiro liga");
});

test("variáveis de build ligam áreas em desenvolvimento sem tocar no servidor", () => {
  assert.deepEqual(civicFlags({}, { VITE_CIVIC_NEWS: "1" }), { directory: false, news: true });
  assert.deepEqual(civicFlags({}, { VITE_CIVIC_DIRECTORY: "true", VITE_CIVIC_NEWS: "0" }), { directory: true, news: false });
});
