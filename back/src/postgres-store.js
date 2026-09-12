import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { emptyStats, isZebra, mergeStats, ratingDeltas } from "../../shared/elo.js";
import { CANDIDATES, CANDIDATE_IDS } from "./candidates.js";

const { Pool } = pg;
const root = dirname(fileURLToPath(import.meta.url));
const LEGACY_DATA_PATH = process.env.ELO_FILE || join(root, "../data/elo.json");
const MODES = new Set(["presidentes", "vices"]);

function blank() {
  return emptyStats(CANDIDATES.map((candidate) => candidate.id));
}

export function validateMode(mode) {
  if (!MODES.has(mode)) {
    const error = new Error("modo inválido");
    error.status = 400;
    throw error;
  }
  return mode;
}

export function validateVote(winnerId, loserId) {
  if (!CANDIDATE_IDS.has(winnerId) || !CANDIDATE_IDS.has(loserId) || winnerId === loserId) {
    const error = new Error("voto inválido");
    error.status = 400;
    throw error;
  }
}

export function normalizeLegacyPools(parsed) {
  if (parsed?.pools) {
    return {
      presidentes: mergeStats(blank(), parsed.pools.presidentes),
      vices: mergeStats(blank(), parsed.pools.vices),
    };
  }
  return {
    presidentes: mergeStats(blank(), parsed),
    vices: blank(),
  };
}

function winRate(wins, losses) {
  const total = wins + losses;
  return total ? Math.round((100 * wins) / total) : 0;
}

export function snapshotFromRows(mode, duels, rows) {
  const stats = new Map(rows.map((row) => [row.candidate_id, row]));
  const ranking = CANDIDATES.map((candidate) => {
    const row = stats.get(candidate.id) || {};
    const wins = Number(row.wins) || 0;
    const losses = Number(row.losses) || 0;
    return {
      id: candidate.id,
      name: candidate.name,
      party: candidate.party,
      vice: candidate.vice,
      photo: candidate.photo,
      elo: Number(row.rating) || 1000,
      wins,
      losses,
      zebras: Number(row.zebras) || 0,
      winRate: winRate(wins, losses),
    };
  }).sort((a, b) => b.elo - a.elo || b.wins - a.wins);

  return { mode, duels: Number(duels) || 0, ranking };
}

async function selectSnapshot(queryable, mode) {
  const [poolResult, statsResult] = await Promise.all([
    queryable.query("SELECT duels FROM ranking_pools WHERE mode = $1", [mode]),
    queryable.query(
      "SELECT candidate_id, rating, wins, losses, zebras FROM ranking_stats WHERE mode = $1",
      [mode],
    ),
  ]);
  return snapshotFromRows(mode, poolResult.rows[0]?.duels, statsResult.rows);
}

async function createSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ranking_pools (
      mode text PRIMARY KEY CHECK (mode IN ('presidentes', 'vices')),
      duels bigint NOT NULL DEFAULT 0 CHECK (duels >= 0)
    );

    CREATE TABLE IF NOT EXISTS ranking_stats (
      mode text NOT NULL REFERENCES ranking_pools(mode) ON DELETE CASCADE,
      candidate_id text NOT NULL,
      rating integer NOT NULL DEFAULT 1000,
      wins bigint NOT NULL DEFAULT 0 CHECK (wins >= 0),
      losses bigint NOT NULL DEFAULT 0 CHECK (losses >= 0),
      zebras bigint NOT NULL DEFAULT 0 CHECK (zebras >= 0),
      PRIMARY KEY (mode, candidate_id)
    );

    CREATE TABLE IF NOT EXISTS votes (
      id bigserial PRIMARY KEY,
      mode text NOT NULL REFERENCES ranking_pools(mode),
      winner_id text NOT NULL,
      loser_id text NOT NULL,
      winner_rating_before integer NOT NULL,
      loser_rating_before integer NOT NULL,
      winner_delta integer NOT NULL,
      loser_delta integer NOT NULL,
      zebra boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK (winner_id <> loser_id)
    );

    CREATE INDEX IF NOT EXISTS votes_created_at_idx ON votes (created_at DESC);
    CREATE INDEX IF NOT EXISTS votes_mode_created_at_idx ON votes (mode, created_at DESC);

    CREATE TABLE IF NOT EXISTS app_metadata (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  for (const mode of MODES) {
    await client.query(
      "INSERT INTO ranking_pools (mode) VALUES ($1) ON CONFLICT (mode) DO NOTHING",
      [mode],
    );
    for (const candidate of CANDIDATES) {
      await client.query(
        `INSERT INTO ranking_stats (mode, candidate_id)
         VALUES ($1, $2)
         ON CONFLICT (mode, candidate_id) DO NOTHING`,
        [mode, candidate.id],
      );
    }
  }
}

function readLegacyPools() {
  try {
    return normalizeLegacyPools(JSON.parse(readFileSync(LEGACY_DATA_PATH, "utf8")));
  } catch (error) {
    if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    return null;
  }
}

async function migrateLegacyJson(client) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('polimatch-legacy-json-migration'))");
  const existing = await client.query(
    "SELECT value FROM app_metadata WHERE key = 'legacy_json_migration'",
  );
  if (existing.rowCount) return existing.rows[0].value;

  const current = await client.query("SELECT COALESCE(SUM(duels), 0) AS duels FROM ranking_pools");
  const currentDuels = Number(current.rows[0].duels) || 0;
  const pools = currentDuels === 0 ? readLegacyPools() : null;

  if (pools) {
    for (const mode of MODES) {
      const state = pools[mode];
      await client.query("UPDATE ranking_pools SET duels = $2 WHERE mode = $1", [mode, state.duels]);
      for (const candidate of CANDIDATES) {
        await client.query(
          `UPDATE ranking_stats
           SET rating = $3, wins = $4, losses = $5, zebras = $6
           WHERE mode = $1 AND candidate_id = $2`,
          [
            mode,
            candidate.id,
            state.ratings[candidate.id],
            state.wins[candidate.id],
            state.losses[candidate.id],
            state.zebras[candidate.id],
          ],
        );
      }
    }
  }

  const result = {
    imported: Boolean(pools),
    skippedBecauseDatabaseHasVotes: currentDuels > 0,
    source: pools ? LEGACY_DATA_PATH : null,
    duels: pools
      ? { presidentes: pools.presidentes.duels, vices: pools.vices.duels }
      : null,
  };
  await client.query(
    `INSERT INTO app_metadata (key, value)
     VALUES ('legacy_json_migration', $1::jsonb)`,
    [JSON.stringify(result)],
  );
  return result;
}

export function createPostgresStore(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL é obrigatória");
  const pool = new Pool({ connectionString, max: Number(process.env.PG_POOL_MAX) || 10 });

  return {
    async init() {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await createSchema(client);
        const migration = await migrateLegacyJson(client);
        await client.query("COMMIT");
        return migration;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async health() {
      await pool.query("SELECT 1");
    },

    async snapshot(mode = "presidentes") {
      validateMode(mode);
      return selectSnapshot(pool, mode);
    },

    async vote(winnerId, loserId, mode = "presidentes") {
      validateMode(mode);
      validateVote(winnerId, loserId);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT duels FROM ranking_pools WHERE mode = $1 FOR UPDATE", [mode]);
        const locked = await client.query(
          `SELECT candidate_id, rating
           FROM ranking_stats
           WHERE mode = $1 AND candidate_id = ANY($2::text[])
           FOR UPDATE`,
          [mode, [winnerId, loserId]],
        );
        const ratings = new Map(locked.rows.map((row) => [row.candidate_id, Number(row.rating)]));
        const winnerRating = ratings.get(winnerId);
        const loserRating = ratings.get(loserId);
        if (!Number.isFinite(winnerRating) || !Number.isFinite(loserRating)) {
          throw new Error("ranking não inicializado");
        }

        const deltas = ratingDeltas(winnerRating, loserRating);
        const zebra = isZebra(winnerRating, loserRating);
        await client.query(
          `UPDATE ranking_stats
           SET rating = rating + $3, wins = wins + 1, zebras = zebras + $4
           WHERE mode = $1 AND candidate_id = $2`,
          [mode, winnerId, deltas.winnerDelta, zebra ? 1 : 0],
        );
        await client.query(
          `UPDATE ranking_stats
           SET rating = rating + $3, losses = losses + 1
           WHERE mode = $1 AND candidate_id = $2`,
          [mode, loserId, deltas.loserDelta],
        );
        await client.query("UPDATE ranking_pools SET duels = duels + 1 WHERE mode = $1", [mode]);
        await client.query(
          `INSERT INTO votes (
             mode, winner_id, loser_id, winner_rating_before, loser_rating_before,
             winner_delta, loser_delta, zebra
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            mode,
            winnerId,
            loserId,
            winnerRating,
            loserRating,
            deltas.winnerDelta,
            deltas.loserDelta,
            zebra,
          ],
        );
        const result = await selectSnapshot(client, mode);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async close() {
      await pool.end();
    },
  };
}
