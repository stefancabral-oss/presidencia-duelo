import { readFileSync } from "node:fs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { applyElo, emptyStats, isZebra, mergeStats, ratingDeltas } from "../../shared/elo.js";
import { CANDIDATES, CANDIDATE_IDS } from "./candidates.js";

const { Pool } = pg;
const root = dirname(fileURLToPath(import.meta.url));
const LEGACY_DATA_PATH = process.env.ELO_FILE || join(root, "../data/elo.json");
const MODES = new Set(["presidentes", "vices"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECOVERY_KEY_PATTERN = /^pm1_[A-Za-z0-9_-]{43}$/;

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

export function normalizeVoteId(value, createId = randomUUID) {
  if (value == null || value === "") return createId();
  const voteId = String(value).trim().toLowerCase();
  if (!UUID_PATTERN.test(voteId)) {
    const error = new Error("voteId inválido");
    error.status = 400;
    throw error;
  }
  return voteId;
}

export function normalizeRequiredUuid(value, fieldName) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    const error = new Error(`${fieldName} inválido`);
    error.status = 400;
    throw error;
  }
  return normalized;
}

export function createRecoveryKey(random = randomBytes) {
  return `pm1_${random(32).toString("base64url")}`;
}

export function recoveryKeyHash(value) {
  const recoveryKey = String(value || "").trim();
  if (!RECOVERY_KEY_PATTERN.test(recoveryKey)) {
    const error = new Error("chave de recuperação inválida");
    error.status = 401;
    throw error;
  }
  return createHash("sha256").update(recoveryKey).digest("hex");
}

export function normalizePlayerState(value) {
  const source = value && typeof value === "object" ? value : {};
  const normalized = blank();
  for (const candidate of CANDIDATES) {
    const id = candidate.id;
    const rating = Number(source.ratings?.[id] ?? normalized.ratings[id]);
    const wins = Number(source.wins?.[id] ?? 0);
    const losses = Number(source.losses?.[id] ?? 0);
    const zebras = Number(source.zebras?.[id] ?? 0);
    if (
      !Number.isInteger(rating)
      || !Number.isInteger(wins) || wins < 0
      || !Number.isInteger(losses) || losses < 0
      || !Number.isInteger(zebras) || zebras < 0
      || zebras > wins
    ) {
      const error = new Error("estado individual inválido");
      error.status = 400;
      throw error;
    }
    normalized.ratings[id] = rating;
    normalized.wins[id] = wins;
    normalized.losses[id] = losses;
    normalized.zebras[id] = zebras;
  }
  const duels = Number(source.duels ?? 0);
  if (!Number.isInteger(duels) || duels < 0) {
    const error = new Error("estado individual inválido");
    error.status = 400;
    throw error;
  }
  const totalWins = Object.values(normalized.wins).reduce((total, count) => total + count, 0);
  const totalLosses = Object.values(normalized.losses).reduce((total, count) => total + count, 0);
  if (totalWins !== duels || totalLosses !== duels) {
    const error = new Error("estado individual inconsistente");
    error.status = 400;
    throw error;
  }
  normalized.duels = duels;
  return normalized;
}

export function assertSameVote(existing, { voteId, winnerId, loserId, mode }) {
  if (
    existing.mode !== mode
    || existing.winner_id !== winnerId
    || existing.loser_id !== loserId
  ) {
    const error = new Error(`voteId ${voteId} já usado com outro voto`);
    error.status = 409;
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
      personId: candidate.personId,
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

export function replayRanking(baselineRows, baselineDuels, votes) {
  const rows = new Map(CANDIDATES.map((candidate) => [candidate.id, {
    candidate_id: candidate.id,
    rating: 1000,
    wins: 0,
    losses: 0,
    zebras: 0,
  }]));

  for (const baseline of baselineRows) {
    if (!rows.has(baseline.candidate_id)) continue;
    rows.set(baseline.candidate_id, {
      candidate_id: baseline.candidate_id,
      rating: Number(baseline.rating) || 1000,
      wins: Number(baseline.wins) || 0,
      losses: Number(baseline.losses) || 0,
      zebras: Number(baseline.zebras) || 0,
    });
  }

  let duels = Number(baselineDuels) || 0;
  for (const vote of votes) {
    const winner = rows.get(vote.winner_id);
    const loser = rows.get(vote.loser_id);
    if (!winner || !loser || winner === loser) {
      throw new Error(`voto ${vote.id || vote.vote_id || "desconhecido"} não pode ser recomposto`);
    }
    const zebra = isZebra(winner.rating, loser.rating);
    const deltas = ratingDeltas(winner.rating, loser.rating);
    winner.rating += deltas.winnerDelta;
    winner.wins += 1;
    winner.zebras += zebra ? 1 : 0;
    loser.rating += deltas.loserDelta;
    loser.losses += 1;
    duels += 1;
  }

  return { duels, rows: [...rows.values()] };
}

export function deriveRankingBaseline(currentRows, currentDuels, votesNewestFirst) {
  const rows = new Map(currentRows.map((row) => [row.candidate_id, {
    candidate_id: row.candidate_id,
    rating: Number(row.rating),
    wins: Number(row.wins),
    losses: Number(row.losses),
    zebras: Number(row.zebras),
  }]));
  let duels = Number(currentDuels);

  for (const vote of votesNewestFirst) {
    const winner = rows.get(vote.winner_id);
    const loser = rows.get(vote.loser_id);
    if (!winner || !loser) throw new Error(`voto ${vote.id} não pode formar o ponto-base`);
    winner.rating = Number(vote.winner_rating_before);
    winner.wins -= 1;
    winner.zebras -= vote.zebra ? 1 : 0;
    loser.rating = Number(vote.loser_rating_before);
    loser.losses -= 1;
    duels -= 1;
  }

  if (
    duels < 0
    || [...rows.values()].some((row) => row.wins < 0 || row.losses < 0 || row.zebras < 0)
  ) {
    throw new Error("histórico de votos incompatível com o ranking materializado");
  }
  return { duels, rows: [...rows.values()] };
}

async function selectSnapshot(queryable, mode) {
  const poolResult = await queryable.query("SELECT duels FROM ranking_pools WHERE mode = $1", [mode]);
  const statsResult = await queryable.query(
    "SELECT candidate_id, rating, wins, losses, zebras FROM ranking_stats WHERE mode = $1",
    [mode],
  );
  return snapshotFromRows(mode, poolResult.rows[0]?.duels, statsResult.rows);
}

function playerStateResult(mode, row) {
  return {
    mode,
    version: Number(row.version),
    state: normalizePlayerState(row.state),
  };
}

async function findPlayer(queryable, recoveryKey) {
  const hash = recoveryKeyHash(recoveryKey);
  const result = await queryable.query(
    "SELECT id FROM anonymous_players WHERE recovery_hash = $1",
    [hash],
  );
  if (!result.rowCount) {
    const error = new Error("chave de recuperação não encontrada");
    error.status = 401;
    throw error;
  }
  return result.rows[0];
}

async function selectPlayerState(queryable, playerId, mode, lock = false) {
  const result = await queryable.query(
    `SELECT version, state
     FROM player_states
     WHERE player_id = $1 AND mode = $2${lock ? " FOR UPDATE" : ""}`,
    [playerId, mode],
  );
  if (!result.rowCount) throw new Error("estado individual não inicializado");
  return playerStateResult(mode, result.rows[0]);
}

function validateExpectedVersion(value, current) {
  const expected = Number(value);
  if (!Number.isInteger(expected) || expected < 0) {
    const error = new Error("versão individual inválida");
    error.status = 400;
    throw error;
  }
  if (expected !== current) {
    const error = new Error("estado individual mais recente disponível no servidor");
    error.status = 409;
    error.code = "PLAYER_VERSION_CONFLICT";
    error.currentVersion = current;
    throw error;
  }
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

    CREATE TABLE IF NOT EXISTS anonymous_players (
      id uuid PRIMARY KEY,
      recovery_hash char(64) NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS player_states (
      player_id uuid NOT NULL REFERENCES anonymous_players(id) ON DELETE CASCADE,
      mode text NOT NULL CHECK (mode IN ('presidentes', 'vices')),
      version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
      state jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (player_id, mode)
    );

    CREATE TABLE IF NOT EXISTS votes (
      id bigserial PRIMARY KEY,
      vote_id uuid,
      player_id uuid REFERENCES anonymous_players(id) ON DELETE RESTRICT,
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

    ALTER TABLE votes ADD COLUMN IF NOT EXISTS vote_id uuid;
    ALTER TABLE votes ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES anonymous_players(id) ON DELETE RESTRICT;
    CREATE UNIQUE INDEX IF NOT EXISTS votes_vote_id_uidx ON votes (vote_id) WHERE vote_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS ranking_baseline_pools (
      mode text PRIMARY KEY CHECK (mode IN ('presidentes', 'vices')),
      duels bigint NOT NULL CHECK (duels >= 0),
      captured_through_vote_id bigint NOT NULL CHECK (captured_through_vote_id >= 0),
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS ranking_baseline_stats (
      mode text NOT NULL REFERENCES ranking_baseline_pools(mode) ON DELETE RESTRICT,
      candidate_id text NOT NULL,
      rating integer NOT NULL,
      wins bigint NOT NULL CHECK (wins >= 0),
      losses bigint NOT NULL CHECK (losses >= 0),
      zebras bigint NOT NULL CHECK (zebras >= 0),
      PRIMARY KEY (mode, candidate_id)
    );

    CREATE TABLE IF NOT EXISTS vote_reversals (
      id bigserial PRIMARY KEY,
      reversal_id uuid NOT NULL UNIQUE,
      vote_row_id bigint NOT NULL UNIQUE REFERENCES votes(id) ON DELETE RESTRICT,
      reason text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE OR REPLACE FUNCTION reject_audit_event_mutation()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'eventos de auditoria são imutáveis';
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS votes_are_immutable ON votes;
    CREATE TRIGGER votes_are_immutable
      BEFORE UPDATE OR DELETE ON votes
      FOR EACH ROW EXECUTE FUNCTION reject_audit_event_mutation();

    DROP TRIGGER IF EXISTS vote_reversals_are_immutable ON vote_reversals;
    CREATE TRIGGER vote_reversals_are_immutable
      BEFORE UPDATE OR DELETE ON vote_reversals
      FOR EACH ROW EXECUTE FUNCTION reject_audit_event_mutation();

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

async function ensureRankingBaseline(client) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('polimatch-ranking-baseline'))");
  const existing = await client.query("SELECT mode FROM ranking_baseline_pools LIMIT 1");
  if (existing.rowCount) return;

  const interleavedLegacyVote = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM votes AS legacy
      WHERE legacy.vote_id IS NULL
        AND legacy.id > (SELECT MIN(id) FROM votes WHERE vote_id IS NOT NULL)
    ) AS found
  `);
  if (interleavedLegacyVote.rows[0]?.found) {
    throw new Error("votos sem voteId aparecem depois do início da trilha auditável");
  }

  for (const mode of MODES) {
    const poolResult = await client.query("SELECT duels FROM ranking_pools WHERE mode = $1", [mode]);
    const statsResult = await client.query(
      "SELECT candidate_id, rating, wins, losses, zebras FROM ranking_stats WHERE mode = $1",
      [mode],
    );
    const auditableVotes = await client.query(
      `SELECT id, winner_id, loser_id, winner_rating_before, loser_rating_before, zebra
       FROM votes
       WHERE mode = $1 AND vote_id IS NOT NULL
       ORDER BY id DESC`,
      [mode],
    );
    const legacyHighWater = await client.query(
      "SELECT COALESCE(MAX(id), 0) AS id FROM votes WHERE mode = $1 AND vote_id IS NULL",
      [mode],
    );
    const baseline = deriveRankingBaseline(
      statsResult.rows,
      poolResult.rows[0]?.duels,
      auditableVotes.rows,
    );
    await client.query(
      `INSERT INTO ranking_baseline_pools (mode, duels, captured_through_vote_id)
       VALUES ($1, $2, $3)`,
      [mode, baseline.duels, legacyHighWater.rows[0].id],
    );
    for (const row of baseline.rows) {
      await client.query(
        `INSERT INTO ranking_baseline_stats
           (mode, candidate_id, rating, wins, losses, zebras)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [mode, row.candidate_id, row.rating, row.wins, row.losses, row.zebras],
      );
    }
  }
}

async function rebuildRanking(client, mode) {
  const baselinePool = await client.query(
    `SELECT duels, captured_through_vote_id
     FROM ranking_baseline_pools
     WHERE mode = $1`,
    [mode],
  );
  const baselineStats = await client.query(
    `SELECT candidate_id, rating, wins, losses, zebras
     FROM ranking_baseline_stats
     WHERE mode = $1`,
    [mode],
  );
  const activeVotes = await client.query(
    `SELECT votes.id, votes.vote_id, votes.winner_id, votes.loser_id
     FROM votes
     JOIN ranking_baseline_pools AS baseline ON baseline.mode = votes.mode
     LEFT JOIN vote_reversals AS reversals ON reversals.vote_row_id = votes.id
     WHERE votes.mode = $1
       AND votes.id > baseline.captured_through_vote_id
       AND reversals.id IS NULL
     ORDER BY votes.id ASC`,
    [mode],
  );
  if (!baselinePool.rowCount) throw new Error("ponto-base do ranking não inicializado");

  const rebuilt = replayRanking(
    baselineStats.rows,
    baselinePool.rows[0].duels,
    activeVotes.rows,
  );
  for (const row of rebuilt.rows) {
    await client.query(
      `UPDATE ranking_stats
       SET rating = $3, wins = $4, losses = $5, zebras = $6
       WHERE mode = $1 AND candidate_id = $2`,
      [mode, row.candidate_id, row.rating, row.wins, row.losses, row.zebras],
    );
  }
  await client.query("UPDATE ranking_pools SET duels = $2 WHERE mode = $1", [mode, rebuilt.duels]);
  return rebuilt;
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
        await ensureRankingBaseline(client);
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

    async createPlayer() {
      const recoveryKey = createRecoveryKey();
      const playerId = randomUUID();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          "INSERT INTO anonymous_players (id, recovery_hash) VALUES ($1, $2)",
          [playerId, recoveryKeyHash(recoveryKey)],
        );
        for (const mode of MODES) {
          await client.query(
            `INSERT INTO player_states (player_id, mode, state)
             VALUES ($1, $2, $3::jsonb)`,
            [playerId, mode, JSON.stringify(blank())],
          );
        }
        await client.query("COMMIT");
        return { recoveryKey };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async playerState(recoveryKey, mode = "presidentes") {
      validateMode(mode);
      const player = await findPlayer(pool, recoveryKey);
      await pool.query("UPDATE anonymous_players SET last_seen_at = now() WHERE id = $1", [player.id]);
      return selectPlayerState(pool, player.id, mode);
    },

    async replacePlayerState(recoveryKey, mode, expectedVersion, requestedState) {
      validateMode(mode);
      const normalized = normalizePlayerState(requestedState);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const player = await findPlayer(client, recoveryKey);
        const current = await selectPlayerState(client, player.id, mode, true);
        try {
          validateExpectedVersion(expectedVersion, current.version);
        } catch (error) {
          if (error.status === 409) error.current = current;
          throw error;
        }
        const updated = await client.query(
          `UPDATE player_states
           SET state = $3::jsonb, version = version + 1, updated_at = now()
           WHERE player_id = $1 AND mode = $2
           RETURNING version, state`,
          [player.id, mode, JSON.stringify(normalized)],
        );
        await client.query("UPDATE anonymous_players SET last_seen_at = now() WHERE id = $1", [player.id]);
        await client.query("COMMIT");
        return playerStateResult(mode, updated.rows[0]);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async snapshot(mode = "presidentes") {
      validateMode(mode);
      return selectSnapshot(pool, mode);
    },

    async vote(winnerId, loserId, mode = "presidentes", requestedVoteId, playerContext = {}) {
      validateMode(mode);
      validateVote(winnerId, loserId);
      const voteId = normalizeVoteId(requestedVoteId);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const player = playerContext.recoveryKey
          ? await findPlayer(client, playerContext.recoveryKey)
          : null;
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [voteId]);
        const previous = await client.query(
          "SELECT mode, winner_id, loser_id, player_id FROM votes WHERE vote_id = $1",
          [voteId],
        );
        if (previous.rowCount) {
          assertSameVote(previous.rows[0], { voteId, winnerId, loserId, mode });
          if ((previous.rows[0].player_id || null) !== (player?.id || null)) {
            const error = new Error(`voteId ${voteId} já usado por outra identidade`);
            error.status = 409;
            throw error;
          }
          const result = await selectSnapshot(client, mode);
          const personal = player ? await selectPlayerState(client, player.id, mode) : null;
          await client.query("COMMIT");
          return { ...result, vote: { id: voteId, status: "alreadyProcessed" }, player: personal };
        }

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

        let personal = null;
        if (player) {
          const current = await selectPlayerState(client, player.id, mode, true);
          try {
            validateExpectedVersion(playerContext.version, current.version);
          } catch (error) {
            if (error.status === 409) error.current = current;
            throw error;
          }
          const nextState = normalizePlayerState(current.state);
          applyElo(nextState, winnerId, loserId);
          const updated = await client.query(
            `UPDATE player_states
             SET state = $3::jsonb, version = version + 1, updated_at = now()
             WHERE player_id = $1 AND mode = $2
             RETURNING version, state`,
            [player.id, mode, JSON.stringify(nextState)],
          );
          personal = playerStateResult(mode, updated.rows[0]);
          await client.query("UPDATE anonymous_players SET last_seen_at = now() WHERE id = $1", [player.id]);
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
             vote_id, player_id, mode, winner_id, loser_id, winner_rating_before, loser_rating_before,
             winner_delta, loser_delta, zebra
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            voteId,
            player?.id || null,
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
        return { ...result, vote: { id: voteId, status: "created" }, player: personal };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async reverseVote(requestedVoteId, requestedReversalId, reason = "correção administrativa") {
      const voteId = normalizeRequiredUuid(requestedVoteId, "voteId");
      const reversalId = normalizeVoteId(requestedReversalId);
      const normalizedReason = String(reason || "").trim();
      if (!normalizedReason) {
        const error = new Error("motivo da reversão é obrigatório");
        error.status = 400;
        throw error;
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`reverse:${voteId}`]);
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`reversal:${reversalId}`]);

        const reversalCollision = await client.query(
          `SELECT reversals.vote_row_id, votes.vote_id
           FROM vote_reversals AS reversals
           JOIN votes ON votes.id = reversals.vote_row_id
           WHERE reversals.reversal_id = $1`,
          [reversalId],
        );
        if (reversalCollision.rowCount && reversalCollision.rows[0].vote_id !== voteId) {
          const error = new Error(`reversalId ${reversalId} já usado em outro voto`);
          error.status = 409;
          throw error;
        }

        const original = await client.query(
          `SELECT votes.id, votes.mode, reversals.reversal_id
           FROM votes
           LEFT JOIN vote_reversals AS reversals ON reversals.vote_row_id = votes.id
           WHERE votes.vote_id = $1`,
          [voteId],
        );
        if (!original.rowCount) {
          const error = new Error("voto não encontrado");
          error.status = 404;
          throw error;
        }

        const vote = original.rows[0];
        if (vote.reversal_id) {
          const result = await selectSnapshot(client, vote.mode);
          await client.query("COMMIT");
          return {
            ...result,
            reversal: { id: vote.reversal_id, voteId, status: "alreadyReversed" },
          };
        }

        await client.query("SELECT duels FROM ranking_pools WHERE mode = $1 FOR UPDATE", [vote.mode]);
        await client.query(
          `INSERT INTO vote_reversals (reversal_id, vote_row_id, reason)
           VALUES ($1, $2, $3)`,
          [reversalId, vote.id, normalizedReason],
        );
        await rebuildRanking(client, vote.mode);
        const result = await selectSnapshot(client, vote.mode);
        await client.query("COMMIT");
        return {
          ...result,
          reversal: { id: reversalId, voteId, status: "created" },
        };
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
