import { createHash } from "node:crypto";

export const DAILY_SESSION_RULESET = Object.freeze({
  id: "daily-four-card-v1",
  timeZone: "America/Sao_Paulo",
  rounds: 10,
  cardsPerRound: 4,
  selection: "sha256-ranked-catalog-v1",
  quota: Object.freeze({
    id: "editorial-day-v2",
    totalChoices: 30,
    dailyChoices: 10,
    freeChoices: 20,
  }),
});

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function dateParts(date, timeZone = DAILY_SESSION_RULESET.timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
}

export function validateEditionDate(value) {
  const dateKey = String(value || "");
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    const error = new Error("data editorial inválida");
    error.status = 400;
    error.code = "DAILY_DATE_INVALID";
    throw error;
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    const error = new Error("data editorial inválida");
    error.status = 400;
    error.code = "DAILY_DATE_INVALID";
    throw error;
  }
  return dateKey;
}

export function editorialDateKey(value = new Date(), timeZone = DAILY_SESSION_RULESET.timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("instante inválido");
  const { year, month, day } = dateParts(date, timeZone);
  return `${year}-${month}-${day}`;
}

export function nextEditionDate(dateKey) {
  const normalized = validateEditionDate(dateKey);
  const [year, month, day] = normalized.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function zonedMidnight(dateKey, timeZone = DAILY_SESSION_RULESET.timeZone) {
  const normalized = validateEditionDate(dateKey);
  const [year, month, day] = normalized.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  let instant = target;
  // O deslocamento de um fuso é função do próprio instante. Duas iterações
  // resolvem inclusive transições de horário de verão sem fixar "-03:00".
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = dateParts(new Date(instant), timeZone);
    const representedAsUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    instant = target - (representedAsUtc - instant);
  }
  return new Date(instant).toISOString();
}

export function editionWindow(dateKey, timeZone = DAILY_SESSION_RULESET.timeZone) {
  const normalized = validateEditionDate(dateKey);
  return {
    opensAt: zonedMidnight(normalized, timeZone),
    closesAt: zonedMidnight(nextEditionDate(normalized), timeZone),
  };
}

export function dailyCutMethodology(dateKey) {
  const normalized = validateEditionDate(dateKey);
  const [, month, day] = normalized.split("-");
  return `entre quem concluiu a rodada de ${day}/${month}`;
}

export function buildDailyEdition({ topicId, candidateIds, dateKey, ruleset = DAILY_SESSION_RULESET }) {
  const normalizedDate = validateEditionDate(dateKey);
  const topic = String(topicId || "").trim();
  if (!topic) throw new TypeError("assunto diário obrigatório");
  const sortedCatalog = [...new Set((candidateIds || []).map((id) => String(id).trim()).filter(Boolean))].sort();
  const requiredCards = ruleset.rounds * ruleset.cardsPerRound;
  if (sortedCatalog.length < requiredCards) {
    throw new RangeError(`catálogo diário exige ao menos ${requiredCards} pessoas`);
  }

  const catalogHash = sha256(sortedCatalog.join("\n"));
  const seed = [ruleset.id, normalizedDate, topic, catalogHash].join("\n");
  const ordered = sortedCatalog
    .map((id) => ({ id, order: sha256(`${seed}\n${id}`) }))
    .sort((left, right) => left.order.localeCompare(right.order) || left.id.localeCompare(right.id))
    .slice(0, requiredCards)
    .map(({ id }) => id);
  const rounds = Array.from({ length: ruleset.rounds }, (_, index) => {
    const slot = index + 1;
    const candidates = ordered.slice(index * ruleset.cardsPerRound, slot * ruleset.cardsPerRound);
    return Object.freeze({
      slot,
      candidateIds: Object.freeze(candidates),
      selectionHash: sha256(`${seed}\n${slot}\n${candidates.join("\n")}`),
    });
  });
  const { opensAt, closesAt } = editionWindow(normalizedDate, ruleset.timeZone);

  return Object.freeze({
    id: `${ruleset.id}:${topic}:${normalizedDate}:${catalogHash.slice(0, 16)}`,
    date: normalizedDate,
    topicId: topic,
    rulesetId: ruleset.id,
    catalogHash,
    candidateCount: sortedCatalog.length,
    totalRounds: ruleset.rounds,
    cardsPerRound: ruleset.cardsPerRound,
    opensAt,
    closesAt,
    rounds: Object.freeze(rounds),
  });
}

export function publicDailyRuleset(ruleset = DAILY_SESSION_RULESET) {
  return {
    id: ruleset.id,
    timeZone: ruleset.timeZone,
    rounds: ruleset.rounds,
    cardsPerRound: ruleset.cardsPerRound,
    selection: ruleset.selection,
    quota: { ...ruleset.quota },
  };
}
