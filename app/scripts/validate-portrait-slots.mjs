import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const catalog = JSON.parse(await readFile(path.join(root, "shared/elections-2026.json"), "utf8"));
const directory = path.join(root, "app/public/portraits");
const strict = process.argv.includes("--strict");
const expected = new Set(catalog.map(({ personId }) => `${String(personId).padStart(3, "0")}.jpg`));
const files = existsSync(directory) ? await readdir(directory) : [];
const portraits = files.filter((name) => name.toLowerCase().endsWith(".jpg"));
const unexpected = portraits.filter((name) => !expected.has(name));
const missing = catalog.filter(({ personId }) => !portraits.includes(`${String(personId).padStart(3, "0")}.jpg`));

if (catalog.length !== 125 || new Set(catalog.map(({ personId }) => personId)).size !== 125) {
  throw new Error("O catálogo precisa manter 125 IDs únicos antes de receber retratos.");
}
if (unexpected.length) {
  throw new Error(`Arquivos fora dos 125 espaços previstos: ${unexpected.join(", ")}`);
}

console.log(`Retratos prontos: ${125 - missing.length}/125. Espaços aguardando foto: ${missing.length}.`);
if (strict && missing.length) {
  console.error(missing.map(({ personId, displayName }) => `${String(personId).padStart(3, "0")}.jpg — ${displayName}`).join("\n"));
  process.exitCode = 1;
}
