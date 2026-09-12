import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyElo, emptyStats, mergeStats } from "../../shared/elo.js";
import { CANDIDATES, CANDIDATE_IDS } from "./candidates.js";

const root = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = process.env.ELO_FILE || join(root, "../data/elo.json");

function blank() {
  return emptyStats(CANDIDATES.map((c) => c.id));
}

function load() {
  try {
    const parsed = JSON.parse(readFileSync(DATA_PATH, "utf8"));
    if (parsed?.pools) {
      return {
        pools: {
          presidentes: mergeStats(blank(), parsed.pools.presidentes),
          vices: mergeStats(blank(), parsed.pools.vices),
        },
      };
    }
    // Migra o arquivo legado sem perder o ranking presidencial existente.
    return { pools: { presidentes: mergeStats(blank(), parsed), vices: blank() } };
  } catch {
    return { pools: { presidentes: blank(), vices: blank() } };
  }
}

function persist(state) {
  mkdirSync(dirname(DATA_PATH), { recursive: true });
  writeFileSync(DATA_PATH, JSON.stringify(state, null, 2));
}

let state = load();

function modePool(mode) {
  if (mode !== "presidentes" && mode !== "vices") {
    const error = new Error("modo inválido");
    error.status = 400;
    throw error;
  }
  return state.pools[mode];
}

export function vote(winnerId, loserId, mode = "presidentes") {
  if (!CANDIDATE_IDS.has(winnerId) || !CANDIDATE_IDS.has(loserId) || winnerId === loserId) {
    const error = new Error("voto inválido");
    error.status = 400;
    throw error;
  }
  applyElo(modePool(mode), winnerId, loserId);
  persist(state);
  return snapshot(mode);
}

function winRate(pool, id) {
  const w = pool.wins[id] || 0;
  const l = pool.losses[id] || 0;
  const t = w + l;
  if (!t) return 0;
  return Math.round((100 * w) / t);
}

export function snapshot(mode = "presidentes") {
  const pool = modePool(mode);
  const ranking = CANDIDATES.map((c) => ({
    id: c.id,
    name: c.name,
    party: c.party,
    vice: c.vice,
    photo: c.photo,
    elo: pool.ratings[c.id],
    wins: pool.wins[c.id] || 0,
    losses: pool.losses[c.id] || 0,
    zebras: pool.zebras?.[c.id] || 0,
    winRate: winRate(pool, c.id),
  })).sort((a, b) => b.elo - a.elo || b.wins - a.wins);

  return {
    mode,
    duels: pool.duels,
    ranking,
  };
}
