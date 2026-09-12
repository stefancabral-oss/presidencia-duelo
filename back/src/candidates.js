import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const file = join(root, "../../shared/candidates.json");

export const CANDIDATES = JSON.parse(readFileSync(file, "utf8"));
export const CANDIDATE_IDS = new Set(CANDIDATES.map((c) => c.id));
