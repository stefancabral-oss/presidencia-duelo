import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import { curatedPortraitPath, hasCuratedPortrait } from "../../shared/curated-portraits.js";

export const TOPICS = Object.freeze([
  {
    id: "eleicoes-2026",
    name: "Eleições 2026",
    description: "Políticos e influenciadores com fotografia aprovada que participam ou influenciam a conversa pública de 2026.",
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

export const CANDIDATES = Object.freeze(CATALOG.map((person) => Object.freeze({
  ...person,
  photo: curatedPortraitPath(person.personId),
  photoApproved: hasCuratedPortrait(person.personId),
  office: person.office || "",
  party: person.party || "",
  location: person.location || "",
  bio: person.bio || person.summary || "",
  facts: Object.freeze(Array.isArray(person.facts) ? person.facts : []),
  sources: Object.freeze(Array.isArray(person.sources) ? person.sources : []),
  reviewStatus: person.reviewStatus || "pending",
  topicIds: person.group === "politica"
    ? ["eleicoes-2026"]
    : ["eleicoes-2026", "influenciadores"],
})));

export const CANDIDATES_BY_ID = new Map(CANDIDATES.map((candidate) => [candidate.id, candidate]));
export const TOPICS_BY_ID = new Map(TOPICS.map((topic) => [topic.id, topic]));

export function candidatesForTopic(topicId) {
  return CANDIDATES.filter((candidate) => candidate.photoApproved && candidate.topicIds.includes(topicId));
}

export function candidateBelongsToTopic(candidateId, topicId) {
  const candidate = CANDIDATES_BY_ID.get(candidateId);
  return candidate?.photoApproved === true && candidate.topicIds.includes(topicId);
}
