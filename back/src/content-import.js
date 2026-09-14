export const CHROMAS_PER_PERSON = 12;

export function normalizePersonName(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugify(value = "") {
  return normalizePersonName(value).replace(/\s+/g, "-");
}

export function displayName(value = "") {
  const name = String(value).trim();
  const parenthetical = /^(.*?)\s*\(([^)]+)\)$/.exec(name);
  if (!parenthetical) return name;
  const [, before, inside] = parenthetical;
  return before.split(/\s+/).length > 2 ? inside.trim() : before.trim();
}

export function validHttpUrl(value = "") {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function sourceLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Fonte editorial";
  }
}

function uniqueBy(values, key) {
  const seen = new Set();
  return values.filter((value) => {
    const identity = key(value);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function indexedByName(records, field) {
  const result = new Map();
  for (const record of records) {
    const key = normalizePersonName(record[field]);
    if (!key || result.has(key)) throw new Error(`nome ausente ou duplicado em ${field}: ${record[field] || "(vazio)"}`);
    result.set(key, record);
  }
  return result;
}

export function buildContentCatalog(master, profiles, rawChromas) {
  if (!Array.isArray(master) || !Array.isArray(profiles) || !Array.isArray(rawChromas)) {
    throw new Error("catálogos de entrada devem ser listas");
  }
  const profilesByName = indexedByName(profiles, "nome_exibicao");
  const chromasByName = Map.groupBy(rawChromas, ({ pessoa }) => normalizePersonName(pessoa));
  const usedIds = new Set();

  const candidates = master.map((entry, index) => {
    const key = normalizePersonName(entry.nome);
    const profile = profilesByName.get(key);
    if (!profile) throw new Error(`perfil não encontrado: ${entry.nome}`);
    const personChromas = chromasByName.get(key) || [];
    if (personChromas.length !== CHROMAS_PER_PERSON) {
      throw new Error(`${entry.nome} possui ${personChromas.length} Chromas; esperado: ${CHROMAS_PER_PERSON}`);
    }
    const id = slugify(displayName(entry.nome));
    if (!id || usedIds.has(id)) throw new Error(`id ausente ou duplicado: ${id || entry.nome}`);
    usedIds.add(id);
    const political = entry.grupo === "politica";
    const sources = uniqueBy(
      (profile.fontes || []).filter(validHttpUrl).map((url) => ({ label: sourceLabel(url), url })),
      ({ url }) => url,
    );
    return {
      personId: index + 1,
      id,
      name: profile.nome_exibicao,
      displayName: displayName(profile.nome_exibicao),
      group: entry.grupo,
      role: profile.partido_ou_area,
      affiliation: profile.partido_ou_area,
      office: profile.ocupacao_atual,
      party: political ? profile.partido_ou_area : "",
      area: political ? "Política" : profile.partido_ou_area,
      location: "Brasil",
      summary: profile.frase_card,
      bio: profile.resumo_30s,
      relevance2026: profile.relevancia_2026,
      facts: profile.tres_fatos,
      highlight: profile.realizacao_ou_destaque,
      controversy: profile.controversia,
      sources,
      reviewedAt: profile.data_revisao,
      reviewStatus: "pending",
      photo: "",
    };
  });

  const candidateByName = new Map(master.map((entry, index) => [normalizePersonName(entry.nome), candidates[index]]));
  const chromas = rawChromas.map((raw) => {
    const candidate = candidateByName.get(normalizePersonName(raw.pessoa));
    if (!candidate) throw new Error(`Chroma fora do catálogo: ${raw.pessoa}`);
    const number = Number(raw.numero);
    if (!Number.isInteger(number) || number < 1 || number > CHROMAS_PER_PERSON) {
      throw new Error(`número de Chroma inválido para ${raw.pessoa}: ${raw.numero}`);
    }
    const hasSourceUrl = validHttpUrl(raw.fonte);
    return {
      id: `${candidate.id}-chroma-${String(number).padStart(2, "0")}`,
      candidateId: candidate.id,
      number,
      title: raw.titulo_divertido,
      period: raw.ano_ou_periodo,
      context: raw.contexto,
      visualDescription: raw.descricao_visual,
      visualCue: raw.objeto_gesto_cenario,
      cardLine: raw.frase_carta,
      gameEffect: raw.efeito_jogo,
      rarity: raw.raridade,
      sourceUrl: hasSourceUrl ? raw.fonte : "",
      sourceNote: hasSourceUrl ? "" : raw.fonte,
      sourceReviewStatus: hasSourceUrl ? "url-provided" : "source-required",
      riskContext: raw.riscos_contexto,
      artworkUrl: "",
      status: "draft",
    };
  });

  const chromaIds = chromas.map(({ id }) => id);
  if (new Set(chromaIds).size !== chromaIds.length) throw new Error("há IDs de Chroma duplicados");
  const masterKeys = new Set(master.map(({ nome }) => normalizePersonName(nome)));
  const profilesOutsideMaster = [...profilesByName.keys()].filter((key) => !masterKeys.has(key));
  const chromasOutsideMaster = [...chromasByName.keys()].filter((key) => !masterKeys.has(key));
  if (profilesOutsideMaster.length || chromasOutsideMaster.length) throw new Error("há pessoas fora do catálogo mestre");

  return {
    candidates,
    chromas,
    summary: {
      candidates: candidates.length,
      political: candidates.filter(({ group }) => group === "politica").length,
      influencers: candidates.filter(({ group }) => group !== "politica").length,
      candidateSources: candidates.reduce((sum, { sources }) => sum + sources.length, 0),
      chromas: chromas.length,
      chromasPerPerson: CHROMAS_PER_PERSON,
      chromasWithSourceUrl: chromas.filter(({ sourceReviewStatus }) => sourceReviewStatus === "url-provided").length,
      chromasNeedingSource: chromas.filter(({ sourceReviewStatus }) => sourceReviewStatus === "source-required").length,
    },
  };
}
