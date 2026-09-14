import { readFile } from "node:fs/promises";

const [masterPath, profilesPath, photosPath] = process.argv.slice(2);
if (!masterPath || !profilesPath || !photosPath) {
  throw new Error("uso: node audit-content-import.mjs catalogo.json perfis.json fotos.json");
}

const [master, profiles, photos] = await Promise.all(
  [masterPath, profilesPath, photosPath].map(async (path) => JSON.parse(await readFile(path, "utf8"))),
);

const REQUIRED_PHOTO_TYPES = ["retrato_neutro", "retrato_expressivo_discurso", "iconica_contextual"];
const TODAY = new Date("2026-09-13T12:00:00-03:00");

function normalizeName(value = "") {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function duplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts].filter(([, count]) => count > 1).map(([value, count]) => ({ value, count }));
}

function validHttpUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function dimensions(value = "") {
  const match = /^(\d+)x(\d+)$/i.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2])] : null;
}

const masterNames = master.map(({ nome }) => nome);
const profileNames = profiles.map(({ nome_exibicao }) => nome_exibicao);
const photoNames = [...new Set(photos.map(({ pessoa }) => pessoa))];
const masterNormalized = new Map(masterNames.map((name) => [normalizeName(name), name]));
const profileNormalized = new Set(profileNames.map(normalizeName));
const photoNormalized = new Set(photoNames.map(normalizeName));
const byPerson = Map.groupBy(photos, ({ pessoa }) => normalizeName(pessoa));

const photoCoverageFailures = [];
for (const name of masterNames) {
  const personPhotos = byPerson.get(normalizeName(name)) || [];
  const types = personPhotos.map(({ tipo_foto }) => tipo_foto);
  const missingTypes = REQUIRED_PHOTO_TYPES.filter((type) => !types.includes(type));
  const duplicateTypes = duplicates(types);
  if (personPhotos.length !== 3 || missingTypes.length || duplicateTypes.length) {
    photoCoverageFailures.push({ name, count: personPhotos.length, missingTypes, duplicateTypes });
  }
}

const invalidPhotoUrls = photos.filter(({ url_direta, pagina_origem }) => !validHttpUrl(url_direta) || !validHttpUrl(pagina_origem));
const invalidResolutions = photos.filter(({ resolucao }) => !dimensions(resolucao));
const lowResolution = photos.filter(({ resolucao }) => {
  const parsed = dimensions(resolucao);
  return parsed && Math.min(...parsed) < 800;
});
const invalidPhotoDates = photos.filter(({ data_fotografia }) => !/^\d{4}-\d{2}-\d{2}$/.test(data_fotografia || ""));
const futureDatedPhotos = photos.filter(({ data_fotografia }) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data_fotografia || "")) return false;
  return new Date(`${data_fotografia}T12:00:00Z`) > TODAY;
});
const oldNeutralPhotos = photos.filter(({ tipo_foto, data_fotografia }) => tipo_foto === "retrato_neutro" && data_fotografia < "2021-09-13");
const restrictedLicenses = photos.filter(({ licenca_ou_condicao = "" }) => /©|copyright|uso limitado|editorial|all rights|todos os direitos/i.test(licenca_ou_condicao));
const missingAttribution = photos.filter(({ fotografo, licenca_ou_condicao }) => !fotografo?.trim() || !licenca_ou_condicao?.trim());
const duplicateDirectUrls = duplicates(photos.map(({ url_direta }) => url_direta));
const neutralNotReady = photos.filter(({ tipo_foto, recorte_4_5, resolucao, licenca_ou_condicao = "" }) => {
  if (tipo_foto !== "retrato_neutro") return false;
  const parsed = dimensions(resolucao);
  return recorte_4_5 !== "sim" || !parsed || Math.min(...parsed) < 800 || /©|copyright|uso limitado|editorial|all rights|todos os direitos/i.test(licenca_ou_condicao);
});

const profileSourceCounts = profiles.map(({ fontes = [] }) => fontes.length);
const invalidProfileSourceUrls = profiles.flatMap(({ nome_exibicao, fontes = [] }) => fontes.filter((url) => !validHttpUrl(url)).map((url) => ({ nome_exibicao, url })));
const incompleteProfiles = profiles.filter((profile) => [
  "nome_exibicao", "ocupacao_atual", "partido_ou_area", "frase_card", "resumo_30s",
  "relevancia_2026", "realizacao_ou_destaque", "controversia", "data_revisao",
].some((field) => !String(profile[field] || "").trim()) || !Array.isArray(profile.tres_fatos) || profile.tres_fatos.length !== 3 || !Array.isArray(profile.fontes) || !profile.fontes.length);

const result = {
  grain: {
    masterPeople: master.length,
    profiles: profiles.length,
    photoRecords: photos.length,
    distinctPhotoPeople: photoNames.length,
  },
  identity: {
    duplicateMasterNames: duplicates(masterNames.map(normalizeName)),
    duplicateProfileNames: duplicates(profileNames.map(normalizeName)),
    masterWithoutProfile: masterNames.filter((name) => !profileNormalized.has(normalizeName(name))),
    profilesOutsideMaster: profileNames.filter((name) => !masterNormalized.has(normalizeName(name))),
    masterWithoutPhotos: masterNames.filter((name) => !photoNormalized.has(normalizeName(name))),
    photosOutsideMaster: photoNames.filter((name) => !masterNormalized.has(normalizeName(name))),
  },
  editorial: {
    incompleteProfiles: incompleteProfiles.map(({ nome_exibicao }) => nome_exibicao),
    invalidSourceUrls: invalidProfileSourceUrls,
    minSources: Math.min(...profileSourceCounts),
    maxSources: Math.max(...profileSourceCounts),
    averageSources: Number((profileSourceCounts.reduce((sum, value) => sum + value, 0) / profileSourceCounts.length).toFixed(2)),
    reviewDates: Object.fromEntries([...new Set(profiles.map(({ data_revisao }) => data_revisao))].sort().map((date) => [date, profiles.filter((profile) => profile.data_revisao === date).length])),
  },
  photos: {
    coverageFailures: photoCoverageFailures,
    crop45: Object.fromEntries(["sim", "parcial", "nao"].map((value) => [value, photos.filter(({ recorte_4_5 }) => recorte_4_5 === value).length])),
    invalidUrls: invalidPhotoUrls.map(({ pessoa, tipo_foto }) => ({ pessoa, tipo_foto })),
    invalidResolutions: invalidResolutions.map(({ pessoa, tipo_foto, resolucao }) => ({ pessoa, tipo_foto, resolucao })),
    lowResolutionCount: lowResolution.length,
    lowResolution: lowResolution.map(({ pessoa, tipo_foto, resolucao }) => ({ pessoa, tipo_foto, resolucao })),
    invalidDateCount: invalidPhotoDates.length,
    invalidDates: invalidPhotoDates.map(({ pessoa, tipo_foto, data_fotografia }) => ({ pessoa, tipo_foto, data_fotografia })),
    futureDated: futureDatedPhotos.map(({ pessoa, tipo_foto, data_fotografia }) => ({ pessoa, tipo_foto, data_fotografia })),
    neutralOlderThanFiveYearsCount: oldNeutralPhotos.length,
    neutralOlderThanFiveYears: oldNeutralPhotos.map(({ pessoa, data_fotografia }) => ({ pessoa, data_fotografia })),
    restrictedLicenseCount: restrictedLicenses.length,
    restrictedLicenses: restrictedLicenses.map(({ pessoa, tipo_foto, licenca_ou_condicao }) => ({ pessoa, tipo_foto, licenca_ou_condicao })),
    missingAttributionCount: missingAttribution.length,
    duplicateDirectUrls,
    neutralNotImportReadyCount: neutralNotReady.length,
    neutralNotImportReady: neutralNotReady.map(({ pessoa, recorte_4_5, resolucao, licenca_ou_condicao }) => ({ pessoa, recorte_4_5, resolucao, licenca_ou_condicao })),
  },
};

console.log(JSON.stringify(result, null, 2));
