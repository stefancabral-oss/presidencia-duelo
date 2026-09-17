import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { CURATED_PORTRAITS } from "../../shared/curated-portraits.js";

const root = new URL("../../", import.meta.url);
const catalog = JSON.parse(readFileSync(new URL("shared/elections-2026.json", root)));
const photos = catalog.filter(({ personId }) => Object.hasOwn(CURATED_PORTRAITS, personId)).map(({ personId, id, name }) => {
  const image = `/portraits/${String(personId).padStart(3, "0")}.jpg`;
  const bytes = readFileSync(new URL(`app/public${image}`, root));
  return { personId, id, name, image, sha256: createHash("sha256").update(bytes).digest("hex") };
});
const manifest = {
  schemaVersion: 1, authorizationIssue: 202, authorizedAt: "2026-09-17",
  authorization: "Restaurar as fotografias existentes nas cartas e deixar ilustrações para depois",
  scope: "Nomes e fotografias do conjunto anteriormente selecionado; não aprova textos editoriais ou taxonomia.",
  photos,
};
writeFileSync(new URL("shared/photo-recovery-manifest.json", root), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Manifesto de ${photos.length} fotografias fixado.`);
