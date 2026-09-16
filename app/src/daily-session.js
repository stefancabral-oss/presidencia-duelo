import { confirmedVoteData } from "./vote-response.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function fail(field) {
  throw new TypeError(`sessão diária inválida: ${field}`);
}

function integer(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) fail(field);
  return value;
}

export function dailyMethodologyForDate(date) {
  if (!DATE_PATTERN.test(String(date || ""))) fail("edition.date");
  const [, month, day] = date.split("-");
  return `entre quem concluiu a rodada de ${day}/${month}`;
}

export function validateDailySession(payload) {
  if (!payload || !payload.ruleset || !payload.edition || !payload.progress || !payload.cut
    || !Array.isArray(payload.catalog)) fail("estrutura");
  const catalogIds = payload.catalog.map(({ id }) => String(id || ""));
  const catalog = new Set(catalogIds);
  const { ruleset, edition, progress } = payload;
  if (ruleset.id !== "daily-four-card-v1" || ruleset.version !== 1
    || ruleset.timeZone !== "America/Sao_Paulo" || ruleset.rounds !== 10
    || ruleset.cardsPerRound !== 4 || ruleset.selection !== "sha256-ranked-catalog-v1"
    || ruleset.catalogSchema !== "candidate-public-v1"
    || ruleset.quota?.id !== "editorial-day-v2" || ruleset.quota.totalChoices !== 30
    || ruleset.quota.dailyChoices !== 10 || ruleset.quota.freeChoices !== 20) fail("ruleset");
  if (!String(edition.id || "").trim() || !DATE_PATTERN.test(String(edition.date || ""))
    || !String(edition.topicId || "").trim() || edition.rulesetId !== ruleset.id
    || edition.rulesetVersion !== ruleset.version || edition.catalogSchema !== ruleset.catalogSchema
    || !/^[a-f0-9]{64}$/.test(edition.catalogHash)
    || !/^[a-f0-9]{64}$/.test(edition.snapshotHash)
    || !Number.isSafeInteger(edition.candidateCount) || edition.candidateCount < 40
    || edition.totalRounds !== ruleset.rounds || edition.cardsPerRound !== ruleset.cardsPerRound
    || !Number.isFinite(Date.parse(edition.opensAt)) || !Number.isFinite(Date.parse(edition.closesAt))
    || Date.parse(edition.opensAt) >= Date.parse(edition.closesAt)) fail("edition");
  if (payload.catalog.length !== ruleset.rounds * ruleset.cardsPerRound
    || catalog.size !== payload.catalog.length
    || payload.catalog.some((candidate) => !String(candidate?.id || "").trim() || !String(candidate?.name || "").trim())) fail("catalog");

  const answered = integer(progress.answered, "progress.answered");
  const total = integer(progress.total, "progress.total");
  if (total !== ruleset.rounds || answered > total || !Array.isArray(payload.answers) || payload.answers.length !== answered) fail("progress");
  for (const [index, answer] of payload.answers.entries()) {
    if (answer?.slot !== index + 1 || !UUID_PATTERN.test(String(answer.answerId || ""))
      || !catalog.has(answer.winnerId) || !Number.isFinite(Date.parse(answer.answeredAt))) fail("answers");
  }

  if (payload.status === "active") {
    const round = payload.round;
    if (answered >= total || payload.completion !== null || !round || round.slot !== answered + 1
      || !Array.isArray(round.candidateIds) || round.candidateIds.length !== ruleset.cardsPerRound
      || new Set(round.candidateIds).size !== ruleset.cardsPerRound
      || round.candidateIds.some((id) => !catalog.has(id))) fail("round");
  } else if (payload.status === "completed") {
    if (answered !== total || payload.round !== null || !payload.completion
      || !Number.isFinite(Date.parse(payload.completion.completedAt))) fail("completion");
  } else {
    fail("status");
  }

  if (payload.cut.status !== "pending" || payload.cut.availableAt !== edition.closesAt
    || payload.cut.methodology !== dailyMethodologyForDate(edition.date)) fail("cut");
  return payload;
}

export function dailyRoundCandidates(session) {
  if (!session?.round) return [];
  const byId = new Map(session.catalog.map((candidate) => [candidate.id, candidate]));
  const result = session.round.candidateIds.map((id) => byId.get(id));
  if (result.some((candidate) => !candidate)) fail("round.catalog");
  return result;
}

export function dailySessionRoundChanged(current, next) {
  return current?.edition?.id !== next?.edition?.id
    || current?.edition?.snapshotHash !== next?.edition?.snapshotHash
    || current?.round?.slot !== next?.round?.slot
    || JSON.stringify(current?.round?.candidateIds || []) !== JSON.stringify(next?.round?.candidateIds || []);
}

export function confirmedDailyVoteData(response, candidates, attempt, current = {}) {
  const dailySession = validateDailySession(response.dailySession);
  const confirmed = confirmedVoteData(response, candidates, attempt, current, {
    feedbackCandidates: dailySession.catalog,
  });
  const previous = current.dailySession;
  const acceptedAnswer = dailySession.answers.find(({ answerId }) => answerId === attempt.roundId);
  const previousAnswersRemain = previous?.answers?.every((answer, index) => {
    const currentAnswer = dailySession.answers[index];
    return currentAnswer?.slot === answer.slot
      && currentAnswer.answerId === answer.answerId
      && currentAnswer.winnerId === answer.winnerId
      && currentAnswer.answeredAt === answer.answeredAt;
  });
  if (!previous || dailySession.edition.id !== previous.edition.id
    || attempt.slot !== previous.progress.answered + 1
    || dailySession.progress.answered < previous.progress.answered + 1
    || !previousAnswersRemain
    || !acceptedAnswer || acceptedAnswer.slot !== attempt.slot || acceptedAnswer.winnerId !== attempt.winnerId) {
    fail("vote.progress");
  }
  return { ...confirmed, dailySession };
}
