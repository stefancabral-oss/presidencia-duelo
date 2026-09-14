import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const [catalogPath, outputPath] = process.argv.slice(2);
if (!catalogPath || !outputPath) {
  throw new Error("uso: node select-photo-sources.mjs catalogo.json saida.json");
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));

function normalize(value = "") {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function slugify(value) {
  return normalize(value)
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function dimensions(value = "") {
  const match = /^(\d+)x(\d+)$/i.exec(value.trim());
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

function licenseStatus(value = "") {
  if (/n[aã]o [ée] licen[cç]a livre|fair-use|uso limitado|uso editorial/i.test(value)) return "rejected";
  if (/^©|confirmar|ver p[aá]gina|ou CC|atribui[cç][aã]o Commons|uso institucional|cr[eé]dito obrigat[oó]rio/i.test(value)) return "review";
  if (/CC0|creative commons|CC BY|CC-BY|public domain|dom[ií]nio p[uú]blico|PDM|GODL/i.test(value)) return "accepted";
  return "review";
}

function yearOf(value = "") {
  const match = /^(20\d{2}|19\d{2})/.exec(value.trim());
  return match ? Number(match[1]) : null;
}

function score(photo) {
  const size = dimensions(photo.resolucao);
  const minDimension = size ? Math.min(size.width, size.height) : 0;
  const year = yearOf(photo.data_fotografia);
  const license = licenseStatus(photo.licenca_ou_condicao);
  let points = 0;

  points += { retrato_neutro: 34, retrato_expressivo_discurso: 22, iconica_contextual: 8 }[photo.tipo_foto] || 0;
  points += { sim: 22, parcial: 10, nao: -24 }[photo.recorte_4_5] || -10;
  points += license === "accepted" ? 28 : license === "review" ? 4 : -200;
  points += minDimension >= 1600 ? 18 : minDimension >= 1000 ? 13 : minDimension >= 800 ? 8 : -35;
  points += year >= 2024 ? 18 : year >= 2021 ? 11 : year >= 2018 ? 2 : year ? -8 : -4;
  if (/grupo|ao lado|comitiva|plateia|plen[aá]rio|entrevista coletiva|multid[aã]o/i.test(photo.observacao_enquadramento || "")) points -= 18;
  if (/frontal|ombros|close|rosto|face clara|meio-corpo|retrato/i.test(photo.observacao_enquadramento || "")) points += 8;
  if (photo.fonte_prioridade === "oficial") points += 4;
  return points;
}

const byPerson = Map.groupBy(catalog, ({ pessoa }) => pessoa);
const seenSlugs = new Set();
const selections = [];

for (const [person, photos] of byPerson) {
  const ranked = photos.map((photo) => ({ ...photo, score: score(photo) })).sort((a, b) => b.score - a.score);
  const selected = ranked[0];
  let slug = slugify(person);
  if (seenSlugs.has(slug)) slug = `${slug}-${selections.length + 1}`;
  seenSlugs.add(slug);
  const size = dimensions(selected.resolucao);
  const minDimension = size ? Math.min(size.width, size.height) : 0;
  const license = licenseStatus(selected.licenca_ou_condicao);
  const blockers = [];
  if (license === "rejected") blockers.push("licenca_rejeitada");
  if (license === "review") blockers.push("licenca_a_confirmar");
  if (!size) blockers.push("resolucao_invalida");
  else if (minDimension < 800) blockers.push("baixa_resolucao");
  if (selected.recorte_4_5 === "nao") blockers.push("recorte_4_5_inadequado");

  selections.push({
    pessoa: person,
    slug,
    status: blockers.length ? "substituir_ou_revisar" : "pronta_para_download",
    blockers,
    selected,
    alternatives: ranked.slice(1),
  });
}

const payload = {
  generated_at: new Date().toISOString(),
  policy: {
    minimum_short_edge_px: 800,
    crop: "4:5 mecânico, sem alteração facial",
    license: "somente licença reutilizável confirmada",
  },
  summary: {
    people: selections.length,
    ready: selections.filter(({ status }) => status === "pronta_para_download").length,
    review: selections.filter(({ status }) => status !== "pronta_para_download").length,
  },
  selections,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload.summary));
for (const item of selections.filter(({ status }) => status !== "pronta_para_download")) {
  console.log(`${item.pessoa}\t${item.blockers.join(",")}\t${item.selected.tipo_foto}`);
}
