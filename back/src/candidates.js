import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import EDITORIAL_LEDGER from "../../shared/editorial-publication-ledger.json" with { type: "json" };
import EDITORIAL_ASSETS from "../../shared/editorial-asset-registry.json" with { type: "json" };
import { createCandidateRegistry } from "./editorial-gate.js";

export const TOPICS = Object.freeze([
  {
    id: "eleicoes-2026",
    name: "Eleições 2026",
    description: "Políticos e influenciadores com conteúdo e arte de carta aprovados para a edição de 2026.",
    status: "pilot",
    active: true,
  },
  {
    id: "influenciadores",
    name: "Influenciadores",
    description: "Pessoas conhecidas que influenciam escolhas eleitorais.",
    status: "coming-soon",
    active: false,
  },
  {
    id: "escandalos",
    name: "Escândalos e acontecimentos",
    description: "Curadorias especiais organizadas por caso e período.",
    status: "coming-soon",
    active: false,
  },
]);

export const PRODUCTION_CANDIDATE_REGISTRY = createCandidateRegistry({
  catalog: CATALOG,
  topics: TOPICS,
  ledger: EDITORIAL_LEDGER,
  assetRegistry: EDITORIAL_ASSETS,
});
export const CANDIDATES = PRODUCTION_CANDIDATE_REGISTRY.candidates;
export const CANDIDATES_BY_ID = PRODUCTION_CANDIDATE_REGISTRY.candidatesById;
export const TOPICS_BY_ID = PRODUCTION_CANDIDATE_REGISTRY.topicsById;

export function candidatesForTopic(topicId, registry = PRODUCTION_CANDIDATE_REGISTRY) {
  return registry.candidatesForTopic(topicId);
}

export const PUBLIC_CANDIDATE_SCHEMA_V1 = "candidate-public-v1";
export const PUBLIC_CANDIDATE_SCHEMA_V2 = "candidate-public-v2";
export const CURRENT_PUBLIC_CANDIDATE_SCHEMA = PUBLIC_CANDIDATE_SCHEMA_V2;

// O schema v1 é imutável: novas fichas públicas ganham outro projector e outro
// identificador. Assim uma edição diária já materializada nunca é reescrita
// quando a API corrente acrescenta, remove ou normaliza campos.
const PUBLIC_CANDIDATE_FIELDS_V1 = Object.freeze([
  "personId",
  "id",
  "name",
  "displayName",
  "affiliation",
  "photo",
  "role",
  "summary",
  "office",
  "party",
  "location",
  "bio",
  "relevance2026",
  "facts",
  "highlight",
  "controversy",
  "sources",
  "reviewedAt",
  "reviewStatus",
  "topicIds",
]);

// O schema v2 é a projeção pública da taxonomia estruturada. Ele não altera o
// v1 usado pelas edições diárias já materializadas.
const PUBLIC_CANDIDATE_FIELDS_V2 = Object.freeze([
  "personId",
  "id",
  "name",
  "displayName",
  "photo",
  "role",
  "party",
  "primaryArea",
  "contextAffiliation",
  "taxonomyProvenance",
  "summary",
  "location",
  "bio",
  "relevance2026",
  "facts",
  "highlight",
  "controversy",
  "sources",
  "reviewedAt",
  "reviewStatus",
  "topicIds",
]);

function projectCandidateFields(candidate, fields, schema) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new TypeError(`candidato incompatível com ${schema}`);
  }
  const missing = fields.filter((field) => !Object.hasOwn(candidate, field) || candidate[field] === undefined);
  if (missing.length) {
    throw new TypeError(`candidato incompatível com ${schema}; campos ausentes: ${missing.join(", ")}`);
  }
  return Object.fromEntries(fields.map((field) => [field, candidate[field]]));
}

const PUBLIC_CANDIDATE_PROJECTORS = new Map([
  [PUBLIC_CANDIDATE_SCHEMA_V1, (candidate) => projectCandidateFields(candidate, PUBLIC_CANDIDATE_FIELDS_V1, PUBLIC_CANDIDATE_SCHEMA_V1)],
  [PUBLIC_CANDIDATE_SCHEMA_V2, (candidate) => projectCandidateFields(candidate, PUBLIC_CANDIDATE_FIELDS_V2, PUBLIC_CANDIDATE_SCHEMA_V2)],
]);

export function candidateProjectorBySchema(schema) {
  const projector = PUBLIC_CANDIDATE_PROJECTORS.get(String(schema || ""));
  if (!projector) throw new Error(`schema público histórico não suportado: ${schema}`);
  return projector;
}

// Projeção corrente da API. Snapshots históricos não chamam este alias: eles
// resolvem explicitamente o schema gravado na edição.
export function publicCandidate(candidate = {}) {
  return candidateProjectorBySchema(CURRENT_PUBLIC_CANDIDATE_SCHEMA)(candidate);
}

export function candidateBelongsToTopic(candidateId, topicId, registry = PRODUCTION_CANDIDATE_REGISTRY) {
  return registry.candidateBelongsToTopic(candidateId, topicId);
}

export function serializeCandidate(candidate = {}) {
  return candidateProjectorBySchema(PUBLIC_CANDIDATE_SCHEMA_V2)(candidate);
}
