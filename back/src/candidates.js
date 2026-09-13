import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decorateCandidate } from "../../shared/topics.js";
import { enrichCandidateEditorial } from "../../shared/editorial.js";
import PERSON_PROFILES from "../../shared/person-profiles.json" with { type: "json" };

const root = dirname(fileURLToPath(import.meta.url));
const file = join(root, "../../shared/candidates.json");

const profilesById = new Map(PERSON_PROFILES.map((profile) => [profile.id, profile]));

export const CANDIDATES = JSON.parse(readFileSync(file, "utf8"))
  .map((candidate) => enrichCandidateEditorial(candidate, profilesById.get(candidate.id)))
  .map(decorateCandidate);
export const CANDIDATE_IDS = new Set(CANDIDATES.map((c) => c.id));
