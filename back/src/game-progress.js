import { randomUUID } from "node:crypto";
import { FINISHES, nextFinish, uncertainPair, WARMUP_ROUNDS } from "./game-rules.js";

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status, code: "GAME_CONTRACT_INVALID" }); };
const validRoundId = value => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export async function installGameSchema(client) {
  // Additive migration: historic rows remain immutable. The invariant is now
  // mode-specific, including after a subsequent restart of createCleanSchema.
  await client.query(`
    ALTER TABLE choice_rounds DROP CONSTRAINT IF EXISTS choice_rounds_candidate_ids_check;
    ALTER TABLE choice_rounds DROP CONSTRAINT IF EXISTS choice_rounds_mode_check;
    ALTER TABLE choice_rounds ADD CONSTRAINT choice_rounds_mode_check CHECK (
      (choice_mode = 'free' AND cardinality(candidate_ids) = 4 AND daily_edition_id IS NULL AND daily_slot IS NULL)
      OR (choice_mode = 'daily' AND cardinality(candidate_ids) = 4 AND daily_edition_id IS NOT NULL AND daily_slot BETWEEN 1 AND 10)
      OR (choice_mode IN ('warmup', 'tiebreak') AND cardinality(candidate_ids) = 2 AND daily_edition_id IS NULL AND daily_slot IS NULL)
    );
    CREATE TABLE IF NOT EXISTS issued_pair_rounds (
      id uuid PRIMARY KEY, player_id uuid NOT NULL REFERENCES anonymous_players(id),
      topic_id text NOT NULL REFERENCES ranking_pools(topic_id), mode text NOT NULL CHECK(mode IN ('warmup','tiebreak')),
      candidate_ids text[] NOT NULL CHECK(cardinality(candidate_ids)=2), created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS round_discards (
      round_id uuid PRIMARY KEY REFERENCES choice_rounds(round_id), player_id uuid NOT NULL REFERENCES anonymous_players(id),
      candidate_id text, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS finish_rewards (
      player_id uuid NOT NULL REFERENCES anonymous_players(id), edition_id text NOT NULL REFERENCES daily_editions(id),
      finish_id text, acquired_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(player_id, edition_id),
      UNIQUE(player_id, finish_id)
    );
    INSERT INTO schema_migrations(id) VALUES ('2026-09-17-game-progress-v1') ON CONFLICT DO NOTHING;
  `);
}

export function gameProgressStore({ pool, findPlayer, candidateCatalog, ranking, applyRound, quotaWindow, collectionEnabled = false }) {
  async function transaction(recoveryKey, fn) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const player = await findPlayer(client, recoveryKey);
      // Serialize issuance/reward/discard across tabs of one identity.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`game:${player.id}`]);
      const result = await fn(client, player);
      await client.query("COMMIT");
      return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  return {
    async pairRound(recoveryKey, topic, mode) {
      if (!["warmup", "tiebreak"].includes(mode)) fail("modo de duas cartas inválido");
      const catalog = candidateCatalog(topic);
      if (catalog.length < 2) fail("elenco insuficiente", 409);
      return transaction(recoveryKey, async (client, player) => {
        const pending = await client.query(`SELECT i.* FROM issued_pair_rounds i LEFT JOIN choice_rounds r ON r.round_id=i.id
          WHERE i.player_id=$1 AND i.topic_id=$2 AND i.mode=$3 AND r.round_id IS NULL ORDER BY i.created_at LIMIT 1`, [player.id, topic, mode]);
        const completed = await client.query("SELECT count(*) AS count FROM choice_rounds WHERE player_id=$1 AND topic_id=$2 AND choice_mode=$3", [player.id, topic, mode]);
        const count = Number(completed.rows[0].count);
        const personal = await ranking(client, topic, { playerId: player.id });
        let candidateIds, remaining;
        if (mode === "warmup") {
          remaining = Math.max(0, WARMUP_ROUNDS - count);
          candidateIds = [catalog[(count * 2) % catalog.length].id, catalog[(count * 2 + 1) % catalog.length].id];
        } else {
          const topIds = personal.ranking.filter(person => person.decisions > 0).slice(0, 5).map(person => person.id);
          const comparisons = await client.query("SELECT winner_id, loser_id FROM votes WHERE player_id=$1 AND topic_id=$2 AND winner_id=ANY($3::text[]) AND loser_id=ANY($3::text[])", [player.id, topic, topIds]);
          const selected = uncertainPair(topIds, comparisons.rows.map(row => ({ winnerId: row.winner_id, loserId: row.loser_id })));
          remaining = selected.remaining; candidateIds = selected.pair?.candidateIds;
        }
        if (!remaining) return { status: "completed", mode, remaining: 0, round: null };
        if (pending.rowCount && pending.rows[0].candidate_ids.every(id => catalog.some(person => person.id === id))) {
          return { status: "active", mode, remaining, round: { id: pending.rows[0].id, candidateIds: pending.rows[0].candidate_ids } };
        }
        const id = randomUUID();
        await client.query("INSERT INTO issued_pair_rounds(id,player_id,topic_id,mode,candidate_ids) VALUES($1,$2,$3,$4,$5)", [id, player.id, topic, mode, candidateIds]);
        return { status: "active", mode, remaining, round: { id, candidateIds } };
      });
    },
    async pairVote({ recoveryKey, roundId, winnerId, playerVersion }) {
      if (!validRoundId(roundId)) fail("ID de rodada inválido");
      return transaction(recoveryKey, async (client, player) => {
        const issued = await client.query("SELECT * FROM issued_pair_rounds WHERE id=$1 AND player_id=$2", [roundId, player.id]);
        const row = issued.rows[0];
        if (!row || !row.candidate_ids.includes(winnerId)) fail("rodada não emitida para esta escolha", 409);
        const catalog = candidateCatalog(row.topic_id);
        const prior = await client.query("SELECT 1 FROM choice_rounds WHERE round_id=$1", [roundId]);
        // Confirmed receipts survive subsequent editorial withdrawal. applyRound
        // still checks winner, identity and mode before returning the receipt.
        if (!prior.rowCount && row.candidate_ids.some(id => !catalog.some(person => person.id === id))) fail("perfil indisponível", 409);
        const result = await applyRound(client, { topic: row.topic_id, winnerId, roundCandidates: row.candidate_ids,
          roundId, player, playerVersion, choiceMode: row.mode, quotaWindow: quotaWindow(), publicCatalog: catalog });
        return result.payload;
      });
    },
    async discard({ recoveryKey, roundId, candidateId }) {
      if (!validRoundId(roundId) || (candidateId !== null && typeof candidateId !== "string")) fail("descarte inválido");
      return transaction(recoveryKey, async (client, player) => {
        const result = await client.query("SELECT winner_id,candidate_ids FROM choice_rounds WHERE round_id=$1 AND player_id=$2", [roundId, player.id]);
        const round = result.rows[0];
        if (!round || (candidateId !== null && (!round.candidate_ids.includes(candidateId) || round.winner_id === candidateId))) fail("descarte fora da rodada", 409);
        const prior = await client.query("SELECT candidate_id FROM round_discards WHERE round_id=$1", [roundId]);
        if (prior.rowCount && prior.rows[0].candidate_id !== candidateId) fail("descarte já confirmado com outra decisão", 409);
        await client.query("INSERT INTO round_discards(round_id,player_id,candidate_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [roundId, player.id, candidateId]);
        return { roundId, candidateId, status: prior.rowCount ? "alreadyProcessed" : "created", rankingEffect: "none" };
      });
    },
    async discardMetrics(recoveryKey, editionId = null) {
      return transaction(recoveryKey, async (client, player) => {
        const result = await client.query(`SELECT count(*)::int AS rounds,
          count(d.round_id) FILTER (WHERE d.candidate_id IS NOT NULL)::int AS completed,
          count(d.round_id) FILTER (WHERE d.candidate_id IS NULL)::int AS skipped,
          count(*) FILTER (WHERE d.round_id IS NULL)::int AS pending
          FROM choice_rounds r LEFT JOIN round_discards d ON d.round_id=r.round_id
          WHERE r.player_id=$1 AND ($2::text IS NULL OR r.daily_edition_id=$2)`, [player.id, editionId]);
        const counts = result.rows[0];
        return { editionId, ...counts, completionRate: counts.rounds ? counts.completed / counts.rounds : null };
      });
    },
    async collection(recoveryKey) {
      return transaction(recoveryKey, async (client, player) => {
        if (collectionEnabled) {
          const completed = await client.query(`SELECT c.edition_id FROM daily_completions c
            LEFT JOIN finish_rewards r ON r.player_id=c.player_id AND r.edition_id=c.edition_id
            WHERE c.player_id=$1 AND r.edition_id IS NULL ORDER BY c.completed_at,c.edition_id`, [player.id]);
          const existing = await client.query("SELECT finish_id FROM finish_rewards WHERE player_id=$1", [player.id]);
          const owned = existing.rows.map(row => row.finish_id);
          for (const { edition_id } of completed.rows) {
            const finish = nextFinish(owned, `${player.id}:${edition_id}`);
            await client.query("INSERT INTO finish_rewards(player_id,edition_id,finish_id) VALUES($1,$2,$3)", [player.id, edition_id, finish?.id || null]);
            if (finish) owned.push(finish.id);
          }
        }
        const owned = await client.query("SELECT finish_id,acquired_at FROM finish_rewards WHERE player_id=$1 AND finish_id IS NOT NULL ORDER BY acquired_at,finish_id", [player.id]);
        return { enabled: collectionEnabled, purchasable: false, total: FINISHES.length,
          items: owned.rows.map(row => ({ ...FINISHES.find(item => item.id === row.finish_id), acquiredAt: new Date(row.acquired_at).toISOString() })) };
      });
    },
  };
}
