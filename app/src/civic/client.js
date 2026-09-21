// Cliente de leitura anônima das áreas cívicas (A02 · #224).
//
// Consome o contrato B01 (`shared/civic-contract.js`) e valida cada envelope em
// runtime: versão, revisão e todos os registros recebidos. Falha de schema vira um
// estado seguro e rastreável, nunca conteúdo parcialmente renderizado. Leitura
// pública não envia credenciais (`credentials: "omit"`) e nunca dispara login.
//
// Os caminhos HTTP abaixo são uma proposta para B06 (#215) e ficam concentrados em
// `CIVIC_PATHS` para que o alinhamento final seja uma mudança única.
import { apiUrl } from "../api.js";
import { CIVIC_RECORDS, CIVIC_VERSION, validateCivicRecord } from "../../../shared/civic-contract.js";
import { isJurisdiction } from "./uf-preference.js";

export const CIVIC_API_BASE = "/api/civic/v1";
const DEFAULT_TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 250;
const MAX_IDS = 3;
const ID_PATTERN = /^[A-Za-z0-9%:_.!~*'()-]{1,200}$/;

const encode = (value) => encodeURIComponent(String(value));

function search(pairs) {
  const params = new URLSearchParams();
  for (const [key, value] of pairs) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export const CIVIC_PATHS = Object.freeze({
  contests: ({ jurisdiction } = {}) => `${CIVIC_API_BASE}/contests${search([["jurisdiction", jurisdiction]])}`,
  directory: (query = {}) => `${CIVIC_API_BASE}/directory${search([
    ["contestId", query.contestId],
    ["party", query.party],
    ["officialStatus", query.officialStatus],
    ["search", query.search],
    ["limit", query.limit],
    ["cursor", query.cursor],
  ])}`,
  candidacy: (id, { revision } = {}) => `${CIVIC_API_BASE}/candidacies/${encode(id)}${search([["revision", revision]])}`,
  // IDs não contêm vírgula (ID_PATTERN); o valor inteiro é codificado uma única vez.
  comparison: (ids = []) => `${CIVIC_API_BASE}/comparisons${search([["ids", ids.join(",")]])}`,
  currentEdition: ({ jurisdiction } = {}) => `${CIVIC_API_BASE}/editions/current${search([["jurisdiction", jurisdiction]])}`,
  edition: (id, { revision } = {}) => `${CIVIC_API_BASE}/editions/${encode(id)}${search([["revision", revision]])}`,
  event: (id, { revision } = {}) => `${CIVIC_API_BASE}/events/${encode(id)}${search([["revision", revision]])}`,
});

/** Tipos de falha que a interface trata como estados distintos. */
export const READ_ERROR_KINDS = Object.freeze([
  "invalid", "restricted", "not-found", "stale-cursor", "withdrawn", "rate-limited",
  "unavailable", "offline", "network", "timeout", "aborted", "schema",
]);

export class CivicReadError extends Error {
  constructor(kind, message, { status = 0, code = "", retryAfterSeconds = null, entity = null, detail = null, cause } = {}) {
    super(message, { cause });
    this.name = "CivicReadError";
    this.kind = READ_ERROR_KINDS.includes(kind) ? kind : "unavailable";
    this.status = status;
    this.code = code;
    const delay = Number(retryAfterSeconds);
    this.retryAfterSeconds = Number.isFinite(delay) && delay > 0 ? Math.min(86400, Math.ceil(delay)) : null;
    this.entity = entity;
    this.detail = detail;
  }

  /** A tentativa pode ser repetida automaticamente sem efeito colateral. */
  get retryable() {
    return ["unavailable", "network", "timeout"].includes(this.kind);
  }
}

const META_KEYS = Object.freeze(["nextCursor", "filteredCount", "coverage", "subject", "history", "freshness"]);
const HISTORY_ACTIONS = Object.freeze(["publish", "correct", "withdraw"]);
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function schemaError(detail) {
  return new CivicReadError("schema", "A resposta não segue o contrato cívico", { code: "CIVIC_SCHEMA", detail });
}

function validateCoverage(coverage) {
  if (coverage === null) return null;
  if (!isObject(coverage)) throw schemaError("coverage");
  const keys = ["official", "imported", "published", "unpublished"];
  if (Object.keys(coverage).some((key) => !keys.includes(key))) throw schemaError("coverage keys");
  for (const key of keys) {
    if (!Number.isSafeInteger(coverage[key]) || coverage[key] < 0) throw schemaError(`coverage.${key}`);
  }
  if (coverage.published > coverage.imported || coverage.imported > coverage.official || coverage.unpublished !== coverage.official - coverage.published) {
    throw schemaError("coverage reconciliation");
  }
  return { ...coverage };
}

function validateHistory(history) {
  if (history === undefined) return [];
  if (!Array.isArray(history)) throw schemaError("history");
  return history.map((entry, index) => {
    if (isObject(entry) && Object.hasOwn(entry, "actor")) throw schemaError("history exposes editor identity");
    if (!isObject(entry) || Object.keys(entry).some((key) => !["revision", "action", "at", "reason"].includes(key))) throw schemaError(`history[${index}]`);
    if (!Number.isSafeInteger(entry.revision) || entry.revision < 1 || !HISTORY_ACTIONS.includes(entry.action)) throw schemaError(`history[${index}]`);
    if (typeof entry.at !== "string" || !INSTANT.test(entry.at) || typeof entry.reason !== "string") throw schemaError(`history[${index}]`);
    return { ...entry };
  });
}

function validateFreshness(freshness) {
  if (freshness === undefined || freshness === null) return null;
  if (!isObject(freshness) || Object.keys(freshness).some((key) => !["collectedAt", "staleAfter"].includes(key))) throw schemaError("freshness");
  if (typeof freshness.collectedAt !== "string" || !INSTANT.test(freshness.collectedAt)) throw schemaError("freshness.collectedAt");
  if (freshness.staleAfter !== null && (typeof freshness.staleAfter !== "string" || !INSTANT.test(freshness.staleAfter))) throw schemaError("freshness.staleAfter");
  return { ...freshness };
}

/**
 * Valida o envelope público `{ version, revision, records, ...meta }` e devolve
 * `{ version, revision, records, meta }`. Registros publicáveis fora de
 * `published/approved` são mantidos, mas marcados: a camada de apresentação decide
 * mostrá-los como pendentes, nunca como aprovados.
 */
export function validateEnvelope(payload) {
  if (!isObject(payload)) throw schemaError("envelope");
  if (payload.version !== CIVIC_VERSION) throw schemaError("version");
  if (!Number.isSafeInteger(payload.revision) || payload.revision < 1) throw schemaError("revision");
  if (!isObject(payload.records)) throw schemaError("records");
  const unknown = Object.keys(payload).filter((key) => !["version", "revision", "records", ...META_KEYS].includes(key));
  if (unknown.length) throw schemaError(`envelope keys: ${unknown.join(",")}`);
  const records = {};
  for (const [kind, rows] of Object.entries(payload.records)) {
    if (!Object.hasOwn(CIVIC_RECORDS, kind)) throw schemaError(`records.${kind}`);
    if (kind === "changes" || kind === "versions") throw schemaError(`records.${kind} is internal`);
    if (!Array.isArray(rows)) throw schemaError(`records.${kind}`);
    records[kind] = rows.map((row, index) => {
      try {
        return validateCivicRecord(kind, row);
      } catch (error) {
        throw new CivicReadError("schema", "Um registro não segue o contrato cívico", { code: "CIVIC_SCHEMA", detail: `${kind}[${index}]: ${error.message}`, cause: error });
      }
    });
  }
  const meta = {
    nextCursor: payload.nextCursor === undefined ? null : payload.nextCursor,
    filteredCount: payload.filteredCount === undefined ? null : payload.filteredCount,
    coverage: payload.coverage === undefined ? null : validateCoverage(payload.coverage),
    subject: payload.subject === undefined ? null : payload.subject,
    history: validateHistory(payload.history),
    freshness: validateFreshness(payload.freshness),
  };
  if (meta.nextCursor !== null && (typeof meta.nextCursor !== "string" || meta.nextCursor.length > 16384)) throw schemaError("nextCursor");
  if (meta.filteredCount !== null && (!Number.isSafeInteger(meta.filteredCount) || meta.filteredCount < 0)) throw schemaError("filteredCount");
  if (meta.subject !== null && (!isObject(meta.subject) || !Object.hasOwn(CIVIC_RECORDS, meta.subject.kind) || typeof meta.subject.id !== "string")) throw schemaError("subject");
  return { version: CIVIC_VERSION, revision: payload.revision, records, meta };
}

function abortError() {
  return new CivicReadError("aborted", "Leitura cancelada", { code: "ABORTED" });
}

function mapHttpError(status, body, headers) {
  const code = body?.error?.code || body?.code || "";
  const message = body?.error?.message || body?.error || `Servidor respondeu ${status}`;
  const retryAfter = body?.error?.retryAfterSeconds ?? body?.retryAfterSeconds ?? Number(headers?.get?.("retry-after"));
  const entity = isObject(body?.error?.entity) ? { ...body.error.entity } : null;
  const options = { status, code, retryAfterSeconds: retryAfter, entity };
  if (status === 400 || code === "CIVIC_INVALID") return new CivicReadError("invalid", message, options);
  if (status === 401 || status === 403) return new CivicReadError("restricted", "Este conteúdo exige autorização editorial", options);
  if (status === 404) return new CivicReadError("not-found", "Conteúdo não encontrado", options);
  if (status === 409 && code === "CIVIC_STALE_CURSOR") return new CivicReadError("stale-cursor", "A lista mudou; reinicie a paginação", options);
  if (status === 410) return new CivicReadError("withdrawn", "Conteúdo retirado pela redação", options);
  if (status === 429) return new CivicReadError("rate-limited", "Muitas consultas; aguarde para tentar de novo", options);
  return new CivicReadError("unavailable", "Consulta indisponível no momento", options);
}

export function createCivicClient({
  fetchImpl = (...args) => globalThis.fetch(...args),
  resolveUrl = apiUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = 1,
  retryDelayMs = RETRY_DELAY_MS,
  isOnline = () => globalThis.navigator?.onLine !== false,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  async function attempt(path, signal) {
    if (signal?.aborted) throw abortError();
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let timedOut = false;
    const timeoutWatch = setTimeout(() => { timedOut = true; }, timeoutMs);
    try {
      const response = await fetchImpl(resolveUrl(path), {
        method: "GET",
        credentials: "omit",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      let body = null;
      try {
        body = response.status === 204 ? null : await response.json();
      } catch (error) {
        if (signal?.aborted) throw abortError();
        if (controller.signal.aborted) throw new CivicReadError("timeout", "O servidor demorou para responder", { code: "TIMEOUT", cause: error });
        if (response.ok) throw schemaError("body");
      }
      if (!response.ok) throw mapHttpError(response.status, body, response.headers);
      return validateEnvelope(body);
    } catch (error) {
      if (error instanceof CivicReadError) throw error;
      if (signal?.aborted) throw abortError();
      if (controller.signal.aborted || timedOut) throw new CivicReadError("timeout", "O servidor demorou para responder", { code: "TIMEOUT", cause: error });
      if (!isOnline()) throw new CivicReadError("offline", "Sem conexão. A consulta volta quando a rede voltar.", { code: "OFFLINE", cause: error });
      throw new CivicReadError("network", "Sem conexão com o servidor", { code: "NETWORK", cause: error });
    } finally {
      clearTimeout(timer);
      clearTimeout(timeoutWatch);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  // Leituras são idempotentes: uma repetição automática é segura para falhas de
  // transporte. 429 e retirada nunca são repetidos automaticamente.
  async function read(path, { signal } = {}) {
    let remaining = Math.max(0, retries);
    for (;;) {
      try {
        return await attempt(path, signal);
      } catch (error) {
        if (!(error instanceof CivicReadError) || !error.retryable || remaining === 0 || signal?.aborted) throw error;
        remaining -= 1;
        await wait(retryDelayMs);
      }
    }
  }

  function requireId(id) {
    if (typeof id !== "string" || !ID_PATTERN.test(id)) throw new CivicReadError("invalid", "Identificador inválido", { code: "CIVIC_INVALID" });
    return id;
  }

  return {
    contests({ jurisdiction } = {}, options) {
      if (jurisdiction !== undefined && !isJurisdiction(jurisdiction)) throw new CivicReadError("invalid", "Recorte inválido", { code: "CIVIC_INVALID" });
      return read(CIVIC_PATHS.contests({ jurisdiction }), options);
    },
    directory(query, options) {
      if (!isObject(query) || typeof query.contestId !== "string" || !query.contestId.trim()) throw new CivicReadError("invalid", "Escolha uma disputa", { code: "CIVIC_INVALID" });
      const known = ["contestId", "party", "officialStatus", "search", "limit", "cursor"];
      if (Object.keys(query).some((key) => !known.includes(key))) throw new CivicReadError("invalid", "Filtro não permitido", { code: "CIVIC_INVALID" });
      return read(CIVIC_PATHS.directory(query), options);
    },
    candidacy(id, { revision, signal } = {}) {
      return read(CIVIC_PATHS.candidacy(requireId(id), { revision }), { signal });
    },
    comparison(ids, options) {
      if (!Array.isArray(ids) || ids.length < 2 || ids.length > MAX_IDS || new Set(ids).size !== ids.length) {
        throw new CivicReadError("invalid", "Compare entre duas e três candidaturas distintas", { code: "CIVIC_INVALID" });
      }
      ids.forEach(requireId);
      return read(CIVIC_PATHS.comparison(ids), options);
    },
    currentEdition({ jurisdiction } = {}, options) {
      if (!isJurisdiction(jurisdiction)) throw new CivicReadError("invalid", "Recorte inválido", { code: "CIVIC_INVALID" });
      return read(CIVIC_PATHS.currentEdition({ jurisdiction }), options);
    },
    edition(id, { revision, signal } = {}) {
      return read(CIVIC_PATHS.edition(requireId(id), { revision }), { signal });
    },
    event(id, { revision, signal } = {}) {
      return read(CIVIC_PATHS.event(requireId(id), { revision }), { signal });
    },
  };
}
