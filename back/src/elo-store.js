import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyElo, emptyStats } from "../../shared/elo.js";
import { CANDIDATES, CANDIDATE_IDS } from "./candidates.js";

const root = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = process.env.ELO_FILE || join(root, "../data/elo.json");

function blank() {
  return emptyStats(CANDIDATES.map((c) => c.id));
}

function load() {
  try {
    const parsed = JSON.parse(readFileSync(DATA_PATH, "utf8"));
    const base = blank();
    return {
      ratings: { ...base.ratings, ...(parsed.ratings || {}) },
      wins: { ...base.wins, ...(parsed.wins || {}) },
      losses: { ...base.losses, ...(parsed.losses || {}) },
      duels: parsed.duels || 0,
    };
  } catch {
    return blank();
  }
}

function persist(state) {
  mkdirSync(dirname(DATA_PATH), { recursive: true });
  writeFileSync(DATA_PATH, JSON.stringify(state, null, 2));
}

let state = load();

export function vote(winnerId, loserId) {
  if (!CANDIDATE_IDS.has(winnerId) || !CANDIDATE_IDS.has(loserId) || winnerId === loserId) {
    const error = new Error("voto inválido");
    error.status = 400;
    throw error;
  }
  applyElo(state, winnerId, loserId);
  persist(state);
  return snapshot();
}

function winRate(id) {
  const w = state.wins[id] || 0;
  const l = state.losses[id] || 0;
  const t = w + l;
  if (!t) return 0;
  return Math.round((100 * w) / t);
}

export function snapshot() {
  const ranking = CANDIDATES.map((c) => ({
    id: c.id,
    name: c.name,
    party: c.party,
    vice: c.vice,
    photo: c.photo,
    elo: state.ratings[c.id],
    wins: state.wins[c.id] || 0,
    losses: state.losses[c.id] || 0,
    winRate: winRate(c.id),
  })).sort((a, b) => b.elo - a.elo || b.wins - a.wins);

  return {
    duels: state.duels,
    ranking,
  };
}
