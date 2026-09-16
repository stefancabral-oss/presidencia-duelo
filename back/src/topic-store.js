import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import { eloTier, isZebra, ratingDeltas } from "../../shared/elo.js";
import { CANDIDATES, TOPICS_BY_ID, candidateBelongsToTopic, candidatesForTopic } from "./candidates.js";
import { personalRankingFromRows } from "./personal-ranking.js";

const { Pool } = pg;
const RESET_MIGRATION_ID = "20260913_eleicoes_2026_clean_start";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECOVERY_KEY_PATTERN = /^pm2_[A-Za-z0-9_-]{43}$/;
const SESSION_TOKEN_PATTERN = /^pms_[A-Za-z0-9_-]{43}$/;
const SESSION_TTL_DAYS = 90;
const NETWORK_HASH_PATTERN = /^[a-f0-9]{64}$/;
const FEEDBACK_SCOPE_PERSONAL = "personal";
const FEEDBACK_SCOPE_LEGACY_GLOBAL = "legacy-global";
const GLOBAL_RANKING_POLICY = Object.freeze({
  id: "elo-v1",
  label: "Elo do placar público",
  explanation: "A ordem pública usa Elo, vitórias e nome como critérios sucessivos.",
});

export const VOTE_ABUSE_LIMITS = Object.freeze({
  anonymousPlayersPerNetworkPerDay: 3,
  roundsPerPlayerPerMinute: 8,
  roundsPerPlayerPerDay: 30,
});

function quotaError(message, code, retryAfterSeconds) {
  const error = new Error(message);
  error.status = 429;
  error.code = code;
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

async function consumeQuota(client, { scope, subjectHash, window, limit, code, message, retryAfterSeconds }) {
  const bucket = window === "minute" ? "date_trunc('minute', now())" : "date_trunc('day', now())";
  const result = await client.query(
    `INSERT INTO abuse_quota_counters (scope, subject_hash, window_start, used)
     VALUES ($1, $2, ${bucket}, 1)
     ON CONFLICT (scope, subject_hash, window_start) DO UPDATE
     SET used = abuse_quota_counters.used + 1,
         updated_at = now()
     WHERE abuse_quota_counters.used < $3
     RETURNING used`,
    [scope, subjectHash, limit],
  );
  if (!result.rowCount) throw quotaError(message, code, retryAfterSeconds);
}

async function consumePlayerRoundQuota(client, playerId) {
  await consumeQuota(client, {
    scope: "player-round-minute",
    subjectHash: playerId,
    window: "minute",
    limit: VOTE_ABUSE_LIMITS.roundsPerPlayerPerMinute,
    code: "VOTE_RATE_LIMITED",
    message: "muitas rodadas em pouco tempo; aguarde antes de continuar",
    retryAfterSeconds: 60,
  });
  await consumeQuota(client, {
    scope: "player-round-day",
    subjectHash: playerId,
    window: "day",
    limit: VOTE_ABUSE_LIMITS.roundsPerPlayerPerDay,
    code: "VOTE_DAILY_LIMIT",
    message: "limite diário de rodadas atingido",
    retryAfterSeconds: 86400,
  });
}

export function validateTopic(topicId) {
  const topic = TOPICS_BY_ID.get(String(topicId || ""));
  if (!topic?.active) {
    const error = new Error("assunto inválido ou indisponível");
    error.status = 400;
    throw error;
  }
  return topic.id;
}

export function validateVote(topicId, winnerId, loserId) {
  const normalizedTopic = validateTopic(topicId);
  if (
    winnerId === loserId
    || !candidateBelongsToTopic(winnerId, normalizedTopic)
    || !candidateBelongsToTopic(loserId, normalizedTopic)
  ) {
    const error = new Error("voto inválido para este assunto");
    error.status = 400;
    throw error;
  }
  return normalizedTopic;
}

export function validateRoundVote(topicId, winnerId, candidateIds) {
  const normalizedTopic = validateTopic(topicId);
  const ids = Array.isArray(candidateIds) ? candidateIds.map(String) : [];
  const unique = new Set(ids);
  if (
    ids.length !== 4
    || unique.size !== 4
    || !unique.has(winnerId)
    || ids.some((candidateId) => !candidateBelongsToTopic(candidateId, normalizedTopic))
  ) {
    const error = new Error("rodada inválida para este assunto");
    error.status = 400;
    throw error;
  }
  return { topic: normalizedTopic, candidateIds: ids };
}

export function normalizeVoteId(value, createId = randomUUID) {
  const voteId = String(value || createId()).trim().toLowerCase();
  if (!UUID_PATTERN.test(voteId)) {
    const error = new Error("voteId inválido");
    error.status = 400;
    throw error;
  }
  return voteId;
}

export function createRecoveryKey(random = randomBytes) {
  return `pm2_${random(32).toString("base64url")}`;
}

export function createSessionToken(random = randomBytes) {
  return `pms_${random(32).toString("base64url")}`;
}

export function recoveryKeyHash(value) {
  const key = String(value || "").trim();
  if (!RECOVERY_KEY_PATTERN.test(key)) {
    const error = new Error("chave de recuperação inválida");
    error.status = 401;
    throw error;
  }
  return createHash("sha256").update(key).digest("hex");
}

export function accessTokenHash(value) {
  const token = String(value || "").trim();
  if (!RECOVERY_KEY_PATTERN.test(token) && !SESSION_TOKEN_PATTERN.test(token)) {
    const error = new Error("sessão inválida");
    error.status = 401;
    throw error;
  }
  return createHash("sha256").update(token).digest("hex");
}

function withRankingPositions(ranking) {
  let rank = 0;
  let previous = null;
  let played = 0;
  return ranking.map((candidate) => {
    if (candidate.decisions === 0) return { ...candidate, rank: null };
    played += 1;
    const tied = previous
      && previous.elo === candidate.elo
      && previous.wins === candidate.wins
      && previous.losses === candidate.losses;
    if (!tied) rank = played;
    previous = candidate;
    return { ...candidate, rank };
  });
}

export function rankingFromRows(topicId, duels, rows) {
  const stats = new Map(rows.map((row) => [row.candidate_id, row]));
  const ranking = candidatesForTopic(topicId).map((candidate) => {
    const row = stats.get(candidate.id) || {};
    const wins = Number(row.wins) || 0;
    const losses = Number(row.losses) || 0;
    const decisions = wins + losses;
    return {
      personId: candidate.personId,
      id: candidate.id,
      name: candidate.name,
      displayName: candidate.displayName,
      affiliation: candidate.affiliation,
      photo: candidate.photo,
      elo: Number(row.rating) || 1000,
      wins,
      losses,
      decisions,
      zebras: Number(row.zebras) || 0,
      winRate: decisions ? Math.round((wins * 100) / decisions) : 0,
    };
  }).sort((a, b) => (
    Number(b.decisions > 0) - Number(a.decisions > 0)
    || b.elo - a.elo
    || b.wins - a.wins
    || a.name.localeCompare(b.name, "pt-BR")
  ));
  return {
    topicId,
    duels: Number(duels) || 0,
    rankingPolicy: GLOBAL_RANKING_POLICY,
    ranking: withRankingPositions(ranking),
  };
}

function rankedPosition(ranking, candidateId) {
  const explicitRank = ranking.find(({ id }) => id === candidateId)?.rank;
  if (Number.isInteger(explicitRank) && explicitRank > 0) return explicitRank;
  const played = ranking.filter(({ decisions }) => decisions > 0);
  let previousScore = null;
  let position = 0;
  for (const [index, candidate] of played.entries()) {
    const score = `${candidate.elo}:${candidate.wins}:${candidate.losses}`;
    if (score !== previousScore) position = index + 1;
    previousScore = score;
    if (candidate.id === candidateId) return position;
  }
  return null;
}

export function rankingEventFromSnapshots(beforeRanking, afterRanking, winnerId, { zebra = false } = {}) {
  if (zebra) return "zebra";
  const beforeRank = rankedPosition(beforeRanking, winnerId);
  const afterRank = rankedPosition(afterRanking, winnerId);
  if (!Number.isFinite(afterRank)) return "confirm";
  if (afterRank === 1) return beforeRank === 1 ? "leaderDefense" : "leader";
  if (afterRank <= 3 && (!Number.isFinite(beforeRank) || beforeRank > 3)) return "podium";
  if (afterRank <= 10 && (!Number.isFinite(beforeRank) || beforeRank > 10)) return "top10";
  if (!Number.isFinite(beforeRank)) return "confirm";
  const previousLastRank = Math.max(
    0,
    ...beforeRanking
      .filter(({ decisions }) => decisions > 0)
      .map(({ id }) => rankedPosition(beforeRanking, id)),
  );
  if (beforeRank === previousLastRank && afterRank < beforeRank) return "recovery";
  if (afterRank < beforeRank) return "overtake";
  return "confirm";
}

export function roundFeedbackFromSnapshots(beforeRanking, afterRanking, candidateIds, winnerId, rankingEvent, { zebra = false } = {}) {
  const before = new Map(beforeRanking.map((candidate) => [candidate.id, candidate]));
  const after = new Map(afterRanking.map((candidate) => [candidate.id, candidate]));
  const outcomes = candidateIds.map((id) => {
    const previous = before.get(id);
    const current = after.get(id);
    if (!previous || !current) throw new Error("ranking incompleto para feedback da rodada");
    const previousTier = eloTier(previous.elo);
    const tier = eloTier(current.elo);
    const tierChange = tier.level > previousTier.level ? "up" : tier.level < previousTier.level ? "down" : null;
    return {
      id,
      result: id === winnerId ? "winner" : "loser",
      delta: current.elo - previous.elo,
      elo: current.elo,
      previousRank: Number.isInteger(previous.rank) ? previous.rank : null,
      rank: Number.isInteger(current.rank) ? current.rank : null,
      preferenceScore: Number.isFinite(current.preferenceScore) ? current.preferenceScore : null,
      rankBasis: current.rankBasis || null,
      previousTier,
      tier,
      tierChange,
    };
  });
  const winner = outcomes.find((outcome) => outcome.id === winnerId);
  const dropped = outcomes.filter((outcome) => outcome.tierChange === "down");
  let primaryEvent = rankingEvent || "confirm";
  if (zebra) primaryEvent = "zebra";
  else if (!["leader", "leaderDefense", "podium", "top10"].includes(primaryEvent)) {
    if (winner?.tierChange === "up") primaryEvent = "tierUp";
    else if (dropped.some(({ tier }) => tier.id === "recovery")) primaryEvent = "lowElo";
    else if (dropped.length) primaryEvent = "tierDown";
  }
  return { rankingEvent: rankingEvent || "confirm", primaryEvent, zebra: Boolean(zebra), outcomes };
}

export function globalEventFromFeedback({ rankingEvent = "confirm", winnerDelta = 0, zebra = false, feedback = null } = {}) {
  if (!feedback) return null;
  const primaryEvent = feedback.primaryEvent || rankingEvent || feedback.rankingEvent || "confirm";
  if (primaryEvent === "confirm" && !zebra && !feedback.zebra) return null;
  return {
    scope: "global",
    rankingEvent: rankingEvent || feedback.rankingEvent || "confirm",
    winnerDelta: Number(winnerDelta) || 0,
    zebra: Boolean(zebra || feedback.zebra),
    feedback,
  };
}

export function feedbackChannelsFromSnapshots({
  personalBefore,
  personalAfter,
  globalBefore,
  globalAfter,
  candidateIds,
  winnerId,
  personalZebra = false,
  globalZebra = false,
}) {
  const rankingEvent = rankingEventFromSnapshots(personalBefore, personalAfter, winnerId, { zebra: personalZebra });
  const personalFeedback = roundFeedbackFromSnapshots(personalBefore, personalAfter, candidateIds, winnerId, rankingEvent, { zebra: personalZebra });
  const globalRankingEvent = rankingEventFromSnapshots(globalBefore, globalAfter, winnerId, { zebra: globalZebra });
  const globalFeedback = roundFeedbackFromSnapshots(globalBefore, globalAfter, candidateIds, winnerId, globalRankingEvent, { zebra: globalZebra });
  const winnerDelta = Number(personalFeedback.outcomes.find(({ result }) => result === "winner")?.delta) || 0;
  const globalWinnerDelta = Number(globalFeedback.outcomes.find(({ result }) => result === "winner")?.delta) || 0;
  return {
    rankingEvent,
    personalFeedback,
    winnerDelta,
    globalRankingEvent,
    globalFeedback,
    globalEvent: globalEventFromFeedback({
      rankingEvent: globalRankingEvent,
      winnerDelta: globalWinnerDelta,
      zebra: globalZebra,
      feedback: globalFeedback,
    }),
  };
}

function neutralPersonalReplayFeedback() {
  return { rankingEvent: "confirm", primaryEvent: "confirm", zebra: false, outcomes: [] };
}

export function persistedRoundChannels(row) {
  const feedback = Array.isArray(row.feedback?.outcomes) ? row.feedback : null;
  const globalFeedback = Array.isArray(row.global_feedback?.outcomes) ? row.global_feedback : null;
  const feedbackScope = row.feedback_scope || (feedback ? FEEDBACK_SCOPE_LEGACY_GLOBAL : "none");
  const personalFeedback = feedbackScope === FEEDBACK_SCOPE_PERSONAL && feedback
    ? feedback
    : neutralPersonalReplayFeedback();
  // Rodadas anteriores à #169 armazenavam o feedback público no campo genérico.
  // Ele pode ser reapresentado como público, mas nunca renomeado como pessoal.
  const effectiveGlobalFeedback = globalFeedback
    || (feedbackScope === FEEDBACK_SCOPE_LEGACY_GLOBAL ? feedback : null);
  const globalWinnerDelta = effectiveGlobalFeedback?.outcomes.find(({ result }) => result === "winner")?.delta;
  const globalEvent = globalEventFromFeedback({
    rankingEvent: row.global_ranking_event
      || (feedbackScope === FEEDBACK_SCOPE_LEGACY_GLOBAL ? row.ranking_event : null)
      || effectiveGlobalFeedback?.rankingEvent
      || "confirm",
    winnerDelta: Number(globalWinnerDelta) || Number(row.winner_delta) || 0,
    zebra: Boolean(effectiveGlobalFeedback?.zebra || (feedbackScope === FEEDBACK_SCOPE_LEGACY_GLOBAL && row.zebra)),
    feedback: effectiveGlobalFeedback,
  });
  return {
    rankingEvent: personalFeedback.rankingEvent,
    feedback: personalFeedback,
    personalFeedback,
    feedbackScope,
    globalEvent,
  };
}

async function createCleanSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const applied = await client.query("SELECT 1 FROM schema_migrations WHERE id = $1", [RESET_MIGRATION_ID]);
  if (!applied.rowCount) {
    await client.query(`
      DROP TABLE IF EXISTS vote_reversals CASCADE;
      DROP TABLE IF EXISTS choice_rounds CASCADE;
      DROP TABLE IF EXISTS votes CASCADE;
      DROP TABLE IF EXISTS player_states CASCADE;
      DROP TABLE IF EXISTS anonymous_players CASCADE;
      DROP TABLE IF EXISTS ranking_baseline_stats CASCADE;
      DROP TABLE IF EXISTS ranking_baseline_pools CASCADE;
      DROP TABLE IF EXISTS ranking_stats CASCADE;
      DROP TABLE IF EXISTS ranking_pools CASCADE;
      DROP TABLE IF EXISTS app_metadata CASCADE;
      DROP FUNCTION IF EXISTS reject_audit_event_mutation();
    `);
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS ranking_pools (
      topic_id text PRIMARY KEY,
      duels bigint NOT NULL DEFAULT 0 CHECK (duels >= 0)
    );

    CREATE TABLE IF NOT EXISTS ranking_stats (
      topic_id text NOT NULL REFERENCES ranking_pools(topic_id) ON DELETE CASCADE,
      candidate_id text NOT NULL,
      rating integer NOT NULL DEFAULT 1000,
      wins bigint NOT NULL DEFAULT 0 CHECK (wins >= 0),
      losses bigint NOT NULL DEFAULT 0 CHECK (losses >= 0),
      zebras bigint NOT NULL DEFAULT 0 CHECK (zebras >= 0),
      PRIMARY KEY (topic_id, candidate_id)
    );

    CREATE TABLE IF NOT EXISTS anonymous_players (
      id uuid PRIMARY KEY,
      recovery_hash char(64) NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS abuse_quota_counters (
      scope text NOT NULL CHECK (scope IN ('network-player-day', 'player-round-minute', 'player-round-day')),
      subject_hash text NOT NULL,
      window_start timestamptz NOT NULL,
      used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (scope, subject_hash, window_start)
    );

    CREATE TABLE IF NOT EXISTS player_identities (
      provider text NOT NULL,
      subject text NOT NULL,
      player_id uuid NOT NULL REFERENCES anonymous_players(id) ON DELETE CASCADE,
      display_name text NOT NULL DEFAULT '',
      avatar_url text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (provider, subject),
      UNIQUE (provider, player_id)
    );

    CREATE TABLE IF NOT EXISTS player_sessions (
      session_hash char(64) PRIMARY KEY,
      player_id uuid NOT NULL REFERENCES anonymous_players(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS player_pools (
      player_id uuid NOT NULL REFERENCES anonymous_players(id) ON DELETE CASCADE,
      topic_id text NOT NULL REFERENCES ranking_pools(topic_id) ON DELETE CASCADE,
      version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
      duels bigint NOT NULL DEFAULT 0 CHECK (duels >= 0),
      PRIMARY KEY (player_id, topic_id)
    );

    CREATE TABLE IF NOT EXISTS player_stats (
      player_id uuid NOT NULL REFERENCES anonymous_players(id) ON DELETE CASCADE,
      topic_id text NOT NULL REFERENCES ranking_pools(topic_id) ON DELETE CASCADE,
      candidate_id text NOT NULL,
      rating integer NOT NULL DEFAULT 1000,
      wins bigint NOT NULL DEFAULT 0 CHECK (wins >= 0),
      losses bigint NOT NULL DEFAULT 0 CHECK (losses >= 0),
      PRIMARY KEY (player_id, topic_id, candidate_id)
    );

    CREATE TABLE IF NOT EXISTS votes (
      id bigserial PRIMARY KEY,
      vote_id uuid NOT NULL UNIQUE,
      player_id uuid REFERENCES anonymous_players(id) ON DELETE RESTRICT,
      topic_id text NOT NULL REFERENCES ranking_pools(topic_id),
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

    CREATE TABLE IF NOT EXISTS choice_rounds (
      round_id uuid PRIMARY KEY,
      player_id uuid REFERENCES anonymous_players(id) ON DELETE RESTRICT,
      topic_id text NOT NULL REFERENCES ranking_pools(topic_id),
      winner_id text NOT NULL,
      candidate_ids text[] NOT NULL,
      winner_delta integer NOT NULL,
      zebra boolean NOT NULL DEFAULT false,
      ranking_event text NOT NULL DEFAULT 'confirm',
      feedback jsonb NOT NULL DEFAULT '{}'::jsonb,
      feedback_scope text NOT NULL DEFAULT 'legacy-global',
      global_ranking_event text,
      global_feedback jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK (array_length(candidate_ids, 1) = 4)
    );

    ALTER TABLE choice_rounds
      ADD COLUMN IF NOT EXISTS ranking_event text NOT NULL DEFAULT 'confirm';

    ALTER TABLE choice_rounds
      ADD COLUMN IF NOT EXISTS feedback jsonb NOT NULL DEFAULT '{}'::jsonb;

    ALTER TABLE choice_rounds
      ADD COLUMN IF NOT EXISTS feedback_scope text NOT NULL DEFAULT 'legacy-global';

    ALTER TABLE choice_rounds
      ADD COLUMN IF NOT EXISTS global_ranking_event text;

    ALTER TABLE choice_rounds
      ADD COLUMN IF NOT EXISTS global_feedback jsonb;

    ALTER TABLE votes
      ADD COLUMN IF NOT EXISTS round_id uuid REFERENCES choice_rounds(round_id) ON DELETE RESTRICT;

    CREATE INDEX IF NOT EXISTS votes_player_topic_pair_idx
      ON votes (player_id, topic_id, (LEAST(winner_id, loser_id)), (GREATEST(winner_id, loser_id)))
      INCLUDE (winner_id, loser_id);

    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );

    DROP TRIGGER IF EXISTS votes_are_immutable ON votes;

    WITH migration AS (
      INSERT INTO schema_migrations (id)
      VALUES ('2026-09-15-link-four-card-comparisons')
      ON CONFLICT DO NOTHING
      RETURNING id
    )
    UPDATE votes AS comparison
    SET round_id = round.round_id
    FROM choice_rounds AS round, migration
    WHERE comparison.round_id IS NULL
      AND comparison.topic_id = round.topic_id
      AND comparison.winner_id = round.winner_id
      AND comparison.player_id IS NOT DISTINCT FROM round.player_id
      AND comparison.created_at = round.created_at
      AND comparison.loser_id = ANY(round.candidate_ids)
      AND comparison.loser_id <> round.winner_id;

    CREATE TABLE IF NOT EXISTS chroma_catalog (
      id text PRIMARY KEY,
      candidate_id text NOT NULL,
      topic_id text NOT NULL REFERENCES ranking_pools(topic_id) ON DELETE CASCADE,
      title text NOT NULL,
      rarity text NOT NULL,
      artwork_url text NOT NULL,
      moment_date date,
      summary text NOT NULL DEFAULT '',
      source_url text,
      status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'available', 'retired')),
      available_from timestamptz,
      available_until timestamptz,
      purchasable boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS player_chromas (
      player_id uuid NOT NULL REFERENCES anonymous_players(id) ON DELETE CASCADE,
      chroma_id text NOT NULL REFERENCES chroma_catalog(id) ON DELETE RESTRICT,
      quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
      first_acquired_at timestamptz NOT NULL DEFAULT now(),
      last_acquired_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (player_id, chroma_id)
    );

    CREATE TABLE IF NOT EXISTS equipped_chromas (
      player_id uuid NOT NULL REFERENCES anonymous_players(id) ON DELETE CASCADE,
      topic_id text NOT NULL REFERENCES ranking_pools(topic_id) ON DELETE CASCADE,
      candidate_id text NOT NULL,
      chroma_id text NOT NULL REFERENCES chroma_catalog(id) ON DELETE RESTRICT,
      equipped_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (player_id, topic_id, candidate_id)
    );

    CREATE INDEX IF NOT EXISTS votes_topic_created_idx ON votes (topic_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS votes_player_created_idx ON votes (player_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS choice_rounds_topic_created_idx ON choice_rounds (topic_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS chroma_catalog_release_idx ON chroma_catalog (topic_id, status, available_from, available_until);
    CREATE INDEX IF NOT EXISTS player_sessions_player_idx ON player_sessions (player_id, expires_at DESC);
    CREATE INDEX IF NOT EXISTS abuse_quota_window_idx ON abuse_quota_counters (window_start);

    CREATE OR REPLACE FUNCTION reject_vote_mutation()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'votos confirmados são imutáveis';
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS votes_are_immutable ON votes;
    CREATE TRIGGER votes_are_immutable
      BEFORE UPDATE OR DELETE ON votes
      FOR EACH ROW EXECUTE FUNCTION reject_vote_mutation();

    DROP TRIGGER IF EXISTS choice_rounds_are_immutable ON choice_rounds;
    CREATE TRIGGER choice_rounds_are_immutable
      BEFORE UPDATE OR DELETE ON choice_rounds
      FOR EACH ROW EXECUTE FUNCTION reject_vote_mutation();
  `);

  for (const topic of TOPICS_BY_ID.values()) {
    if (!topic.active) continue;
    const playableCandidates = candidatesForTopic(topic.id);
    await client.query("INSERT INTO ranking_pools (topic_id) VALUES ($1) ON CONFLICT DO NOTHING", [topic.id]);
    for (const candidate of playableCandidates) {
      await client.query(
        "INSERT INTO ranking_stats (topic_id, candidate_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [topic.id, candidate.id],
      );
    }
    await client.query(
      `INSERT INTO player_stats (player_id, topic_id, candidate_id)
       SELECT player_pools.player_id, player_pools.topic_id, playable.candidate_id
       FROM player_pools
       CROSS JOIN unnest($2::text[]) AS playable(candidate_id)
       WHERE player_pools.topic_id = $1
       ON CONFLICT DO NOTHING`,
      [topic.id, playableCandidates.map(({ id }) => id)],
    );
  }

  if (!applied.rowCount) {
    await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [RESET_MIGRATION_ID]);
  }
  await client.query("DELETE FROM abuse_quota_counters WHERE window_start < now() - interval '8 days'");
  return { resetApplied: !applied.rowCount, migrationId: RESET_MIGRATION_ID };
}

async function selectRanking(queryable, topicId, { playerId, pendingComparisons = [] } = {}) {
  if (!playerId) {
    const [pool, stats] = await Promise.all([
      queryable.query("SELECT duels FROM ranking_pools WHERE topic_id = $1", [topicId]),
      queryable.query("SELECT candidate_id, rating, wins, losses, zebras FROM ranking_stats WHERE topic_id = $1", [topicId]),
    ]);
    return rankingFromRows(topicId, pool.rows[0]?.duels, stats.rows);
  }

  const params = [playerId, topicId];
  const [pool, stats, pairs] = await Promise.all([
    queryable.query("SELECT duels, version FROM player_pools WHERE player_id = $1 AND topic_id = $2", params),
    queryable.query("SELECT candidate_id, rating FROM player_stats WHERE player_id = $1 AND topic_id = $2", params),
    queryable.query(
      `SELECT
         LEAST(winner_id, loser_id) AS a_id,
         GREATEST(winner_id, loser_id) AS b_id,
         COUNT(*) FILTER (WHERE winner_id = LEAST(winner_id, loser_id)) AS a_wins,
         COUNT(*) FILTER (WHERE winner_id = GREATEST(winner_id, loser_id)) AS b_wins
       FROM votes
       WHERE player_id = $1 AND topic_id = $2
       GROUP BY 1, 2
       ORDER BY 1, 2`,
      params,
    ),
  ]);
  const result = personalRankingFromRows(
    topicId,
    pool.rows[0]?.duels,
    candidatesForTopic(topicId),
    stats.rows,
    pairs.rows,
    { pendingComparisons },
  );
  result.version = Number(pool.rows[0]?.version) || 0;
  return result;
}

async function findPlayer(queryable, accessToken) {
  const token = String(accessToken || "").trim();
  const hash = accessTokenHash(token);
  const result = SESSION_TOKEN_PATTERN.test(token)
    ? await queryable.query("SELECT player_id AS id FROM player_sessions WHERE session_hash = $1 AND expires_at > now()", [hash])
    : await queryable.query("SELECT id FROM anonymous_players WHERE recovery_hash = $1", [hash]);
  if (!result.rowCount) {
    const error = new Error("sessão não encontrada ou expirada");
    error.status = 401;
    throw error;
  }
  return result.rows[0];
}

async function createPlayerRecords(client, playerId, recoveryHash) {
  await client.query("INSERT INTO anonymous_players (id, recovery_hash) VALUES ($1, $2)", [playerId, recoveryHash]);
  for (const topic of TOPICS_BY_ID.values()) {
    if (!topic.active) continue;
    await client.query("INSERT INTO player_pools (player_id, topic_id) VALUES ($1, $2)", [playerId, topic.id]);
    for (const candidate of candidatesForTopic(topic.id)) {
      await client.query(
        "INSERT INTO player_stats (player_id, topic_id, candidate_id) VALUES ($1, $2, $3)",
        [playerId, topic.id, candidate.id],
      );
    }
  }
}

async function accountForPlayer(queryable, playerId) {
  const result = await queryable.query(
    "SELECT display_name, avatar_url FROM player_identities WHERE provider = 'google' AND player_id = $1",
    [playerId],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return { displayName: row.display_name, avatarUrl: row.avatar_url };
}

function assertPlayerVersion(value, current) {
  const version = Number(value);
  if (!Number.isInteger(version) || version !== current) {
    const error = new Error("ranking pessoal mais recente disponível");
    error.status = 409;
    error.code = "PLAYER_VERSION_CONFLICT";
    // `sendError` já repassa este campo ao cliente; sem preenchê-lo aqui, o
    // conflito chegava sem a informação necessária para se resolver sozinho.
    error.current = current;
    throw error;
  }
}

export function createTopicStore(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL é obrigatória");
  const pool = new Pool({ connectionString, max: Number(process.env.PG_POOL_MAX) || 10 });

  return {
    async init() {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const migration = await createCleanSchema(client);
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

    async createPlayer({ networkHash } = {}) {
      const normalizedNetworkHash = String(networkHash || "").trim().toLowerCase();
      if (!NETWORK_HASH_PATTERN.test(normalizedNetworkHash)) {
        const error = new Error("identificador de rede inválido");
        error.status = 400;
        throw error;
      }
      const recoveryKey = createRecoveryKey();
      const playerId = randomUUID();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await consumeQuota(client, {
          scope: "network-player-day",
          subjectHash: normalizedNetworkHash,
          window: "day",
          limit: VOTE_ABUSE_LIMITS.anonymousPlayersPerNetworkPerDay,
          code: "PLAYER_ISSUANCE_LIMIT",
          message: "limite diário de novos jogadores nesta rede atingido",
          retryAfterSeconds: 86400,
        });
        await createPlayerRecords(client, playerId, recoveryKeyHash(recoveryKey));
        await client.query("COMMIT");
        return { recoveryKey };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async ranking(topicId) {
      return selectRanking(pool, validateTopic(topicId));
    },

    async playerRanking(recoveryKey, topicId) {
      const normalizedTopic = validateTopic(topicId);
      const player = await findPlayer(pool, recoveryKey);
      const ranking = await selectRanking(pool, normalizedTopic, { playerId: player.id });
      ranking.account = await accountForPlayer(pool, player.id);
      return ranking;
    },

    async signInWithGoogle({ identity, currentToken, topicId }) {
      const normalizedTopic = validateTopic(topicId);
      const subject = String(identity?.subject || "").trim();
      if (!subject) {
        const error = new Error("identidade Google inválida");
        error.status = 400;
        throw error;
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`google:${subject}`]);
        const linked = await client.query("SELECT player_id FROM player_identities WHERE provider = 'google' AND subject = $1", [subject]);
        let playerId = linked.rows[0]?.player_id;
        const firstLink = !playerId;
        if (!playerId && currentToken) playerId = (await findPlayer(client, currentToken)).id;
        if (!playerId) {
          playerId = randomUUID();
          await createPlayerRecords(client, playerId, recoveryKeyHash(createRecoveryKey()));
        }
        await client.query(
          `INSERT INTO player_identities (provider, subject, player_id, display_name, avatar_url)
           VALUES ('google', $1, $2, $3, $4)
           ON CONFLICT (provider, subject) DO UPDATE
           SET display_name = EXCLUDED.display_name, avatar_url = EXCLUDED.avatar_url, updated_at = now()`,
          [subject, playerId, String(identity.displayName || ""), String(identity.avatarUrl || "")],
        );
        if (firstLink) {
          await client.query(
            "UPDATE anonymous_players SET recovery_hash = $1 WHERE id = $2",
            [recoveryKeyHash(createRecoveryKey()), playerId],
          );
        }
        const sessionToken = createSessionToken();
        await client.query(
          `INSERT INTO player_sessions (session_hash, player_id, expires_at)
           VALUES ($1, $2, now() + ($3 * interval '1 day'))`,
          [accessTokenHash(sessionToken), playerId, SESSION_TTL_DAYS],
        );
        await client.query("DELETE FROM player_sessions WHERE expires_at <= now()");
        const personal = await selectRanking(client, normalizedTopic, { playerId });
        const account = { displayName: String(identity.displayName || "Jogador"), avatarUrl: String(identity.avatarUrl || "") };
        await client.query("COMMIT");
        return { sessionToken, account, player: { ...personal, account } };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async signOut(accessToken) {
      const token = String(accessToken || "").trim();
      if (!SESSION_TOKEN_PATTERN.test(token)) return;
      await pool.query("DELETE FROM player_sessions WHERE session_hash = $1", [accessTokenHash(token)]);
    },

    async vote({ topicId, winnerId, loserId, voteId: requestedVoteId, recoveryKey, playerVersion }) {
      const topic = validateVote(topicId, winnerId, loserId);
      const voteId = normalizeVoteId(requestedVoteId);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const player = recoveryKey ? await findPlayer(client, recoveryKey) : null;
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [voteId]);
        const previous = await client.query("SELECT topic_id, winner_id, loser_id, player_id, winner_delta, loser_delta, zebra FROM votes WHERE vote_id = $1", [voteId]);
        if (previous.rowCount) {
          const row = previous.rows[0];
          if (row.topic_id !== topic || row.winner_id !== winnerId || row.loser_id !== loserId || (row.player_id || null) !== (player?.id || null)) {
            const error = new Error("voteId já utilizado com outra escolha");
            error.status = 409;
            throw error;
          }
          const global = await selectRanking(client, topic);
          const personal = player ? await selectRanking(client, topic, { playerId: player.id }) : null;
          await client.query("COMMIT");
          return {
            ...global,
            vote: {
              id: voteId,
              status: "alreadyProcessed",
              winnerDelta: Number(row.winner_delta),
              loserDelta: Number(row.loser_delta),
              zebra: Boolean(row.zebra),
            },
            player: personal,
          };
        }

        await client.query("SELECT duels FROM ranking_pools WHERE topic_id = $1 FOR UPDATE", [topic]);
        const globalRows = await client.query(
          "SELECT candidate_id, rating FROM ranking_stats WHERE topic_id = $1 AND candidate_id = ANY($2::text[]) FOR UPDATE",
          [topic, [winnerId, loserId]],
        );
        const globalRatings = new Map(globalRows.rows.map((row) => [row.candidate_id, Number(row.rating)]));
        const winnerRating = globalRatings.get(winnerId);
        const loserRating = globalRatings.get(loserId);
        if (!Number.isFinite(winnerRating) || !Number.isFinite(loserRating)) throw new Error("ranking não inicializado");
        const deltas = ratingDeltas(winnerRating, loserRating);
        const zebra = isZebra(winnerRating, loserRating);

        await client.query("UPDATE ranking_stats SET rating = rating + $3, wins = wins + 1, zebras = zebras + $4 WHERE topic_id = $1 AND candidate_id = $2", [topic, winnerId, deltas.winnerDelta, zebra ? 1 : 0]);
        await client.query("UPDATE ranking_stats SET rating = rating + $3, losses = losses + 1 WHERE topic_id = $1 AND candidate_id = $2", [topic, loserId, deltas.loserDelta]);
        await client.query("UPDATE ranking_pools SET duels = duels + 1 WHERE topic_id = $1", [topic]);

        if (player) {
          const personalPool = await client.query("SELECT version FROM player_pools WHERE player_id = $1 AND topic_id = $2 FOR UPDATE", [player.id, topic]);
          const currentVersion = Number(personalPool.rows[0]?.version) || 0;
          assertPlayerVersion(playerVersion, currentVersion);
          const personalRows = await client.query(
            "SELECT candidate_id, rating FROM player_stats WHERE player_id = $1 AND topic_id = $2 AND candidate_id = ANY($3::text[]) FOR UPDATE",
            [player.id, topic, [winnerId, loserId]],
          );
          const personalRatings = new Map(personalRows.rows.map((row) => [row.candidate_id, Number(row.rating)]));
          const personalDelta = ratingDeltas(personalRatings.get(winnerId), personalRatings.get(loserId));
          await client.query("UPDATE player_stats SET rating = rating + $4, wins = wins + 1 WHERE player_id = $1 AND topic_id = $2 AND candidate_id = $3", [player.id, topic, winnerId, personalDelta.winnerDelta]);
          await client.query("UPDATE player_stats SET rating = rating + $4, losses = losses + 1 WHERE player_id = $1 AND topic_id = $2 AND candidate_id = $3", [player.id, topic, loserId, personalDelta.loserDelta]);
          await client.query("UPDATE player_pools SET version = version + 1, duels = duels + 1 WHERE player_id = $1 AND topic_id = $2", [player.id, topic]);
          await client.query("UPDATE anonymous_players SET last_seen_at = now() WHERE id = $1", [player.id]);
        }

        await client.query(
          `INSERT INTO votes (vote_id, player_id, topic_id, winner_id, loser_id, winner_rating_before, loser_rating_before, winner_delta, loser_delta, zebra)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [voteId, player?.id || null, topic, winnerId, loserId, winnerRating, loserRating, deltas.winnerDelta, deltas.loserDelta, zebra],
        );
        const global = await selectRanking(client, topic);
        const personal = player ? await selectRanking(client, topic, { playerId: player.id }) : null;
        await client.query("COMMIT");
        return {
          ...global,
          vote: {
            id: voteId,
            status: "created",
            winnerDelta: deltas.winnerDelta,
            loserDelta: deltas.loserDelta,
            zebra,
          },
          player: personal,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async roundVote({ topicId, winnerId, candidateIds, roundId: requestedRoundId, recoveryKey, playerVersion }) {
      const validated = validateRoundVote(topicId, winnerId, candidateIds);
      const topic = validated.topic;
      const roundCandidates = validated.candidateIds;
      const sortedCandidates = [...roundCandidates].sort();
      const loserIds = roundCandidates.filter((candidateId) => candidateId !== winnerId);
      const roundId = normalizeVoteId(requestedRoundId);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const player = recoveryKey ? await findPlayer(client, recoveryKey) : null;
        if (!player) {
          const error = new Error("sessão do jogador é obrigatória para confirmar a rodada");
          error.status = 401;
          throw error;
        }
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [roundId]);
        const previous = await client.query(
          `SELECT topic_id, winner_id, candidate_ids, player_id, winner_delta, zebra,
                  ranking_event, feedback, feedback_scope, global_ranking_event, global_feedback
           FROM choice_rounds WHERE round_id = $1`,
          [roundId],
        );
        if (previous.rowCount) {
          const row = previous.rows[0];
          const sameCandidates = JSON.stringify([...row.candidate_ids].sort()) === JSON.stringify(sortedCandidates);
          if (row.topic_id !== topic || row.winner_id !== winnerId || !sameCandidates || (row.player_id || null) !== player.id) {
            const error = new Error("roundId já utilizado com outra escolha");
            error.status = 409;
            throw error;
          }
          const global = await selectRanking(client, topic);
          const personal = await selectRanking(client, topic, { playerId: player.id });
          await client.query("COMMIT");
          const channels = persistedRoundChannels(row);
          const round = {
            id: roundId,
            status: "alreadyProcessed",
            winnerId,
            candidateIds: [...roundCandidates],
            winnerDelta: Number(row.winner_delta),
            zebra: Boolean(row.zebra),
            ...channels,
            comparisons: 3,
          };
          return { ...global, round, vote: round, player: personal };
        }

        await consumePlayerRoundQuota(client, player.id);
        await client.query("SELECT duels FROM ranking_pools WHERE topic_id = $1 FOR UPDATE", [topic]);
        const globalBeforeRound = await selectRanking(client, topic);
        const globalRows = await client.query(
          "SELECT candidate_id, rating FROM ranking_stats WHERE topic_id = $1 AND candidate_id = ANY($2::text[]) FOR UPDATE",
          [topic, roundCandidates],
        );
        const globalRatings = new Map(globalRows.rows.map((row) => [row.candidate_id, Number(row.rating)]));
        if (roundCandidates.some((candidateId) => !Number.isFinite(globalRatings.get(candidateId)))) throw new Error("ranking não inicializado");

        let zebra = false;
        const comparisons = [];
        const winnerRatingBeforeRound = globalRatings.get(winnerId);
        for (const loserId of loserIds) {
          const winnerRating = winnerRatingBeforeRound;
          const loserRating = globalRatings.get(loserId);
          const deltas = ratingDeltas(winnerRating, loserRating);
          const pairZebra = isZebra(winnerRating, loserRating);
          zebra ||= pairZebra;
          comparisons.push({ loserId, winnerRating, loserRating, ...deltas, zebra: pairZebra });
          await client.query("UPDATE ranking_stats SET rating = rating + $3, wins = wins + 1, zebras = zebras + $4 WHERE topic_id = $1 AND candidate_id = $2", [topic, winnerId, deltas.winnerDelta, pairZebra ? 1 : 0]);
          await client.query("UPDATE ranking_stats SET rating = rating + $3, losses = losses + 1 WHERE topic_id = $1 AND candidate_id = $2", [topic, loserId, deltas.loserDelta]);
        }
        await client.query("UPDATE ranking_pools SET duels = duels + 1 WHERE topic_id = $1", [topic]);

        let personalBeforeRound = null;
        let personalZebra = false;
        const personalPool = await client.query("SELECT version FROM player_pools WHERE player_id = $1 AND topic_id = $2 FOR UPDATE", [player.id, topic]);
        const currentVersion = Number(personalPool.rows[0]?.version) || 0;
        assertPlayerVersion(playerVersion, currentVersion);
        personalBeforeRound = await selectRanking(client, topic, { playerId: player.id });
        const personalRows = await client.query(
          "SELECT candidate_id, rating FROM player_stats WHERE player_id = $1 AND topic_id = $2 AND candidate_id = ANY($3::text[]) FOR UPDATE",
          [player.id, topic, roundCandidates],
        );
        const personalRatings = new Map(personalRows.rows.map((row) => [row.candidate_id, Number(row.rating)]));
        if (roundCandidates.some((candidateId) => !Number.isFinite(personalRatings.get(candidateId)))) throw new Error("ranking pessoal não inicializado");
        const personalWinnerRatingBeforeRound = personalRatings.get(winnerId);
        for (const loserId of loserIds) {
          const personalWinnerRating = personalWinnerRatingBeforeRound;
          const personalLoserRating = personalRatings.get(loserId);
          const personalDelta = ratingDeltas(personalWinnerRating, personalLoserRating);
          personalZebra ||= isZebra(personalWinnerRating, personalLoserRating);
          await client.query("UPDATE player_stats SET rating = rating + $4, wins = wins + 1 WHERE player_id = $1 AND topic_id = $2 AND candidate_id = $3", [player.id, topic, winnerId, personalDelta.winnerDelta]);
          await client.query("UPDATE player_stats SET rating = rating + $4, losses = losses + 1 WHERE player_id = $1 AND topic_id = $2 AND candidate_id = $3", [player.id, topic, loserId, personalDelta.loserDelta]);
        }
        await client.query("UPDATE player_pools SET version = version + 1, duels = duels + 1 WHERE player_id = $1 AND topic_id = $2", [player.id, topic]);
        await client.query("UPDATE anonymous_players SET last_seen_at = now() WHERE id = $1", [player.id]);

        const global = await selectRanking(client, topic);
        const pendingComparisons = loserIds.map((loserId) => ({ winnerId, loserId }));
        const personal = await selectRanking(client, topic, { playerId: player.id, pendingComparisons });
        const channels = feedbackChannelsFromSnapshots({
          personalBefore: personalBeforeRound.ranking,
          personalAfter: personal.ranking,
          globalBefore: globalBeforeRound.ranking,
          globalAfter: global.ranking,
          candidateIds: roundCandidates,
          winnerId,
          personalZebra,
          globalZebra: zebra,
        });
        const {
          rankingEvent,
          personalFeedback: feedback,
          winnerDelta: primaryWinnerDelta,
          globalRankingEvent,
          globalFeedback,
          globalEvent,
        } = channels;
        await client.query(
          `INSERT INTO choice_rounds (
             round_id, player_id, topic_id, winner_id, candidate_ids, winner_delta, zebra,
             ranking_event, feedback, feedback_scope, global_ranking_event, global_feedback
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12::jsonb)`,
          [
            roundId,
            player.id,
            topic,
            winnerId,
            sortedCandidates,
            primaryWinnerDelta,
            personalZebra,
            rankingEvent,
            JSON.stringify(feedback),
            FEEDBACK_SCOPE_PERSONAL,
            globalRankingEvent,
            JSON.stringify(globalFeedback),
          ],
        );
        for (const comparison of comparisons) {
          await client.query(
            `INSERT INTO votes (vote_id, round_id, player_id, topic_id, winner_id, loser_id, winner_rating_before, loser_rating_before, winner_delta, loser_delta, zebra)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [randomUUID(), roundId, player.id, topic, winnerId, comparison.loserId, comparison.winnerRating, comparison.loserRating, comparison.winnerDelta, comparison.loserDelta, comparison.zebra],
          );
        }
        await client.query("COMMIT");
        const round = {
          id: roundId,
          status: "created",
          winnerId,
          candidateIds: [...roundCandidates],
          winnerDelta: primaryWinnerDelta,
          zebra: personalZebra,
          rankingEvent,
          feedback,
          personalFeedback: feedback,
          feedbackScope: FEEDBACK_SCOPE_PERSONAL,
          globalEvent,
          comparisons: 3,
        };
        return { ...global, round, vote: round, player: personal };
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

export const CLEAN_START_MIGRATION = RESET_MIGRATION_ID;
export const ACTIVE_CANDIDATE_COUNT = CANDIDATES.length;
