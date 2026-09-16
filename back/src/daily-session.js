import { createHash } from "node:crypto";
import { PUBLIC_CANDIDATE_SCHEMA_V1, PUBLIC_CANDIDATE_SCHEMA_V2 } from "./candidates.js";

const DAILY_QUOTA = Object.freeze({
  id: "editorial-day-v2",
  totalChoices: 30,
  dailyChoices: 10,
  freeChoices: 20,
});

export const DAILY_SESSION_RULESET_V1 = Object.freeze({
  id: "daily-four-card-v1",
  version: 1,
  timeZone: "America/Sao_Paulo",
  rounds: 10,
  cardsPerRound: 4,
  selection: "sha256-ranked-catalog-v1",
  catalogSchema: PUBLIC_CANDIDATE_SCHEMA_V1,
  quota: DAILY_QUOTA,
});

export const DAILY_SESSION_RULESET_V2 = Object.freeze({
  id: "daily-four-card-v2",
  version: 2,
  timeZone: "America/Sao_Paulo",
  rounds: 10,
  cardsPerRound: 4,
  selection: "sha256-ranked-catalog-v1",
  catalogSchema: PUBLIC_CANDIDATE_SCHEMA_V2,
  quota: DAILY_QUOTA,
});

// O catálogo corrente já usa a taxonomia v2. Edições ainda não materializadas
// usam o ruleset v2; linhas v1 persistidas continuam resolvidas pela identidade
// gravada e nunca são reprojetadas com o catálogo corrente.
export const DAILY_SESSION_RULESET = DAILY_SESSION_RULESET_V2;

const DAILY_RULESET_REGISTRY = new Map([
  [`${DAILY_SESSION_RULESET_V1.id}@${DAILY_SESSION_RULESET_V1.version}`, DAILY_SESSION_RULESET_V1],
  [`${DAILY_SESSION_RULESET_V2.id}@${DAILY_SESSION_RULESET_V2.version}`, DAILY_SESSION_RULESET_V2],
]);

export function dailyRulesetByIdentity(id, version) {
  const ruleset = DAILY_RULESET_REGISTRY.get(`${id}@${Number(version)}`);
  if (!ruleset) throw new Error(`ruleset diário histórico não suportado: ${id}@${version}`);
  return ruleset;
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
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
  if (!String(ruleset.catalogSchema || "").trim()) throw new TypeError("schema público diário obrigatório");
  const sortedCatalog = [...new Set((candidateIds || []).map((id) => String(id).trim()).filter(Boolean))].sort();
  const requiredCards = ruleset.rounds * ruleset.cardsPerRound;
  if (sortedCatalog.length < requiredCards) {
    throw new RangeError(`catálogo diário exige ao menos ${requiredCards} pessoas`);
  }

  const catalogHash = sha256(sortedCatalog.join("\n"));
  const seed = [ruleset.id, normalizedDate, topic, catalogHash].join("\n");
  const ordered = sortedCatalog
    .map((id) => ({ id, order: sha256(`${seed}\n${id}`) }))
    .sort((left, right) => compareCodePoints(left.order, right.order) || compareCodePoints(left.id, right.id))
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
    id: `${ruleset.id}:v${ruleset.version}:${topic}:${normalizedDate}:${catalogHash.slice(0, 16)}`,
    date: normalizedDate,
    topicId: topic,
    rulesetId: ruleset.id,
    rulesetVersion: ruleset.version,
    catalogSchema: ruleset.catalogSchema,
    catalogHash,
    catalogIds: Object.freeze(sortedCatalog),
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
    version: ruleset.version,
    timeZone: ruleset.timeZone,
    rounds: ruleset.rounds,
    cardsPerRound: ruleset.cardsPerRound,
    selection: ruleset.selection,
    catalogSchema: ruleset.catalogSchema,
    quota: { ...ruleset.quota },
  };
}
