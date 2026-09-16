import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { buildContentCatalog } from "../src/content-import.js";

const [masterPath, profilesPath, taxonomyPath, chromasOutputPath, candidatesOutputPath, ...chromaPaths] = process.argv.slice(2);
if (!masterPath || !profilesPath || !taxonomyPath || !chromasOutputPath || !candidatesOutputPath || !chromaPaths.length) {
  throw new Error("uso: node build-content-catalog.mjs mestre.json perfis.json taxonomia.json chromas-saida.json candidatos-saida.json chromas-parte*.json");
}

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const [master, profiles, taxonomySource, chromaParts] = await Promise.all([
  readJson(masterPath),
  readJson(profilesPath),
  readJson(taxonomyPath),
  Promise.all(chromaPaths.map(readJson)),
]);
const result = buildContentCatalog(master, profiles, taxonomySource.records, chromaParts.flat());

await Promise.all([dirname(chromasOutputPath), dirname(candidatesOutputPath)].map((path) => mkdir(path, { recursive: true })));
await Promise.all([
  writeFile(chromasOutputPath, `${JSON.stringify(result.chromas, null, 2)}\n`),
  writeFile(candidatesOutputPath, `${JSON.stringify(result.candidates, null, 2)}\n`),
]);
console.log(JSON.stringify(result.summary));
