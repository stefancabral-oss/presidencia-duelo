import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import EDITORIAL_LEDGER from "../../shared/editorial-publication-ledger.json" with { type: "json" };
import EDITORIAL_ASSETS from "../../shared/editorial-asset-registry.json" with { type: "json" };
import EDITORIAL_GOVERNANCE from "../../shared/editorial-governance-policy.json" with { type: "json" };
import {
  PUBLIC_CANDIDATE_SCHEMA_V1,
  PUBLIC_CANDIDATE_SCHEMA_V2,
  candidatePublicProjectorBySchema,
  candidatePublicSnapshot,
} from "./candidate-public.js";
import { createCandidateRegistry } from "./editorial-gate.js";
import { loadRepositoryFile } from "./repository-files.js";

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
  governancePolicy: EDITORIAL_GOVERNANCE,
  loadRepositoryFile,
  contentRuleset: PUBLIC_CANDIDATE_SCHEMA_V2,
});
export const CANDIDATES = PRODUCTION_CANDIDATE_REGISTRY.candidates;
export const CANDIDATES_BY_ID = PRODUCTION_CANDIDATE_REGISTRY.candidatesById;
export const TOPICS_BY_ID = PRODUCTION_CANDIDATE_REGISTRY.topicsById;

export function candidatesForTopic(topicId, registry = PRODUCTION_CANDIDATE_REGISTRY) {
  return registry.candidatesForTopic(topicId);
}

export const CURRENT_PUBLIC_CANDIDATE_SCHEMA = PUBLIC_CANDIDATE_SCHEMA_V2;
export { PUBLIC_CANDIDATE_SCHEMA_V1, PUBLIC_CANDIDATE_SCHEMA_V2 };

export function candidateProjectorBySchema(schema) {
  return candidatePublicProjectorBySchema(schema);
}

// Projeção corrente da API. Snapshots históricos não chamam este alias: eles
// resolvem explicitamente o schema gravado na edição.
export function publicCandidate(candidate = {}) {
  return candidatePublicSnapshot(candidate, CURRENT_PUBLIC_CANDIDATE_SCHEMA);
}

export function candidateBelongsToTopic(candidateId, topicId, registry = PRODUCTION_CANDIDATE_REGISTRY) {
  return registry.candidateBelongsToTopic(candidateId, topicId);
}

export function serializeCandidate(candidate = {}) {
  return candidatePublicSnapshot(candidate, PUBLIC_CANDIDATE_SCHEMA_V2);
}
