import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [destination] = process.argv.slice(2);
if (!destination) throw new Error("uso: node validate-photo-package.mjs pasta-do-pacote");

const manifest = JSON.parse(await readFile(join(destination, "catalogo-download.json"), "utf8"));
const personFolders = (await readdir(destination, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const issues = [];
const seenFiles = new Set();
for (const record of manifest.records) {
  if (!record.status.startsWith("baixada")) issues.push({ type: "status", pessoa: record.pessoa, status: record.status });
  if (!record.arquivo) {
    issues.push({ type: "arquivo_ausente_no_manifesto", pessoa: record.pessoa, tipo: record.tipo_foto });
    continue;
  }
  if (seenFiles.has(record.arquivo)) issues.push({ type: "arquivo_duplicado", arquivo: record.arquivo });
  seenFiles.add(record.arquivo);
  try {
    const buffer = await readFile(join(destination, record.arquivo));
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    if (sha256 !== record.sha256) issues.push({ type: "checksum", arquivo: record.arquivo });
    if (buffer.length !== record.bytes) issues.push({ type: "tamanho", arquivo: record.arquivo });
  } catch {
    issues.push({ type: "arquivo_nao_encontrado", arquivo: record.arquivo });
  }
}

for (const folder of personFolders) {
  const entries = (await readdir(join(destination, folder), { withFileTypes: true })).filter((entry) => entry.isFile());
  if (entries.length !== 3) issues.push({ type: "quantidade_na_pasta", pasta: folder, quantidade: entries.length });
}

const packageStat = await Promise.all([...seenFiles].map((file) => stat(join(destination, file))));
const verification = {
  generated_at: new Date().toISOString(),
  ok: issues.length === 0,
  people: personFolders.length,
  manifest_records: manifest.records.length,
  unique_image_files: seenFiles.size,
  total_bytes: packageStat.reduce((sum, item) => sum + item.size, 0),
  restricted_records: manifest.records.filter(({ licenca_ou_condicao = "" }) => /direitos reservados|n[aã]o [ée] licen[cç]a livre|fair-use|uso editorial/i.test(licenca_ou_condicao)).length,
  issues,
};
await writeFile(join(destination, "VERIFICACAO.json"), `${JSON.stringify(verification, null, 2)}\n`);
console.log(JSON.stringify(verification));
