// Rotas por hash das áreas cívicas (A01 · #223).
//
// Decisão registrada em stages/17_candidate_news/app/A01-contract.md: o build usa
// `base: "./"` (assets relativos), então um caminho aninhado como `/candidatos/x`
// quebraria o carregamento dos assets ao recarregar, mesmo com o `try_files` do
// nginx. O hash (`#/candidatos/...`) recarrega sempre `index.html`, funciona em
// qualquer host e mantém o jogo fora do histórico. Este módulo é puro: só lê e
// escreve strings; quem toca em `location`/`history` é o shell.
import { UFS } from "../../../shared/civic-contract.js";

export const CIVIC_HASH_PREFIX = "#/";
export const JURISDICTIONS = Object.freeze(["BR", ...UFS]);
export const ROUTE_KINDS = Object.freeze(["directory", "candidacy", "comparison", "news", "edition", "event", "not-found"]);

// Limites: o hash inteiro, um identificador (IDs B01 são segmentos codificados
// com encodeURIComponent unidos por ":"), um texto de filtro (contrato B01: 512).
export const ROUTE_LIMITS = Object.freeze({ hash: 4096, id: 200, text: 512, ids: 3, revision: 1_000_000_000 });
const ID_PATTERN = /^[A-Za-z0-9%:_.!~*'()-]{1,200}$/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const PATHS = Object.freeze({
  directory: ["candidatos"],
  comparison: ["candidatos", "comparar"],
  news: ["noticias"],
  editions: ["noticias", "edicoes"],
  events: ["noticias", "acontecimentos"],
});

const QUERY_KEYS = Object.freeze({
  directory: ["disputa", "uf", "partido", "situacao", "busca"],
  candidacy: ["revisao"],
  comparison: ["ids"],
  news: ["uf"],
  edition: ["revisao"],
  event: ["revisao"],
  "not-found": [],
});

const TITLES = Object.freeze({
  directory: "Candidatos",
  candidacy: "Candidatura",
  comparison: "Comparar candidaturas",
  news: "Notícias",
  edition: "Edição de notícias",
  event: "Acontecimento",
  "not-found": "Destino não encontrado",
});

const AREAS = Object.freeze({
  directory: "directory",
  candidacy: "directory",
  comparison: "directory",
  news: "news",
  edition: "news",
  event: "news",
  "not-found": null,
});

export function isCivicHash(hash) {
  return typeof hash === "string" && hash.startsWith(CIVIC_HASH_PREFIX);
}

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function validId(value) {
  return typeof value === "string" && value.length <= ROUTE_LIMITS.id && ID_PATTERN.test(value);
}

function validText(value) {
  return typeof value === "string" && value.length <= ROUTE_LIMITS.text && !CONTROL_CHARS.test(value);
}

function readQuery(queryPart, kind, problems) {
  const params = {};
  if (!queryPart) return params;
  let entries;
  try {
    entries = [...new URLSearchParams(queryPart).entries()];
  } catch {
    problems.push({ code: "query", detail: "malformed" });
    return params;
  }
  for (const [key, raw] of entries) {
    if (!QUERY_KEYS[kind].includes(key)) {
      problems.push({ code: "unknown-parameter", detail: key.slice(0, 40) });
      continue;
    }
    const value = raw.trim();
    if (!value) continue;
    if (key === "uf") {
      if (JURISDICTIONS.includes(value)) params.uf = value;
      else problems.push({ code: "uf", detail: value.slice(0, 8) });
    } else if (key === "disputa") {
      if (validId(value)) params.contestId = value;
      else problems.push({ code: "contest" });
    } else if (key === "ids") {
      const ids = value.split(",").map((id) => decodeSegment(id.trim()));
      if (ids.length > ROUTE_LIMITS.ids || ids.some((id) => !validId(id))) {
        problems.push({ code: "ids" });
        params.ids = ids.filter(validId).slice(0, ROUTE_LIMITS.ids);
      } else {
        params.ids = ids;
      }
    } else if (key === "revisao") {
      const revision = Number(value);
      if (Number.isSafeInteger(revision) && revision >= 1 && revision <= ROUTE_LIMITS.revision) params.revision = revision;
      else problems.push({ code: "revision" });
    } else if (validText(value)) {
      const name = { partido: "party", situacao: "officialStatus", busca: "search" }[key];
      params[name] = value;
    } else {
      problems.push({ code: "text", detail: key });
    }
  }
  return params;
}

function route(kind, params, problems) {
  const result = { kind, area: AREAS[kind], params, problems, title: TITLES[kind] };
  result.href = civicHref(result);
  return result;
}

function notFound(problems, requested = "") {
  return { kind: "not-found", area: null, params: { requested }, problems, title: TITLES["not-found"], href: null };
}

/**
 * Converte o hash atual numa rota cívica. Retorna `null` quando o hash não é
 * cívico (jogo). Parâmetros inválidos nunca derrubam o shell: são removidos e
 * registrados em `problems` para a tela explicar o que foi ignorado.
 */
export function parseCivicRoute(hash) {
  if (!isCivicHash(hash)) return null;
  const problems = [];
  if (hash.length > ROUTE_LIMITS.hash) return notFound([{ code: "hash-too-long" }]);
  const body = hash.slice(CIVIC_HASH_PREFIX.length);
  const queryIndex = body.indexOf("?");
  const pathPart = queryIndex === -1 ? body : body.slice(0, queryIndex);
  const queryPart = queryIndex === -1 ? "" : body.slice(queryIndex + 1);
  const rawSegments = pathPart.split("/").filter(Boolean);
  if (rawSegments.length === 0 && !queryPart) return null;
  const segments = rawSegments.map(decodeSegment);
  if (segments.some((segment) => segment === null)) return notFound([{ code: "encoding" }], pathPart.slice(0, 80));
  const [first, second, third] = segments;

  if (first === "candidatos") {
    if (segments.length === 1) return route("directory", readQuery(queryPart, "directory", problems), problems);
    if (segments.length === 2 && second === "comparar") {
      const params = readQuery(queryPart, "comparison", problems);
      params.ids = params.ids ?? [];
      return route("comparison", params, problems);
    }
    if (segments.length === 2 && validId(second)) {
      return route("candidacy", { id: second, ...readQuery(queryPart, "candidacy", problems) }, problems);
    }
  }
  if (first === "noticias") {
    if (segments.length === 1) return route("news", readQuery(queryPart, "news", problems), problems);
    if (segments.length === 3 && second === "edicoes" && validId(third)) {
      return route("edition", { id: third, ...readQuery(queryPart, "edition", problems) }, problems);
    }
    if (segments.length === 3 && second === "acontecimentos" && validId(third)) {
      return route("event", { id: third, ...readQuery(queryPart, "event", problems) }, problems);
    }
  }
  return notFound([{ code: "unknown-destination" }], pathPart.slice(0, 80));
}

function query(pairs) {
  const search = new URLSearchParams();
  for (const [key, value] of pairs) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

const encode = (value) => encodeURIComponent(String(value));

/** Serializa uma rota cívica em hash canônico; `null` para destinos inexistentes. */
export function civicHref(target) {
  const { kind, params = {} } = target ?? {};
  switch (kind) {
    case "directory":
      return `${CIVIC_HASH_PREFIX}${PATHS.directory.join("/")}${query([
        ["disputa", params.contestId],
        ["uf", params.uf],
        ["partido", params.party],
        ["situacao", params.officialStatus],
        ["busca", params.search],
      ])}`;
    case "candidacy":
      if (!validId(params.id)) return null;
      return `${CIVIC_HASH_PREFIX}${PATHS.directory[0]}/${encode(params.id)}${query([["revisao", params.revision]])}`;
    case "comparison":
      return `${CIVIC_HASH_PREFIX}${PATHS.comparison.join("/")}${query([["ids", (params.ids ?? []).map(encode).join(",")]])}`;
    case "news":
      return `${CIVIC_HASH_PREFIX}${PATHS.news.join("/")}${query([["uf", params.uf]])}`;
    case "edition":
      if (!validId(params.id)) return null;
      return `${CIVIC_HASH_PREFIX}${PATHS.editions.join("/")}/${encode(params.id)}${query([["revisao", params.revision]])}`;
    case "event":
      if (!validId(params.id)) return null;
      return `${CIVIC_HASH_PREFIX}${PATHS.events.join("/")}/${encode(params.id)}${query([["revisao", params.revision]])}`;
    default:
      return null;
  }
}

export function routeTitle(routeOrKind) {
  const kind = typeof routeOrKind === "string" ? routeOrKind : routeOrKind?.kind;
  return TITLES[kind] ?? TITLES["not-found"];
}

export function sameRoute(a, b) {
  if (!a || !b) return a === b;
  if (a.kind === "not-found" || b.kind === "not-found") return a.kind === b.kind && a.params?.requested === b.params?.requested;
  return a.href === b.href;
}

/** Duas rotas do mesmo tipo podem reaproveitar a tela montada (só `update`). */
export function sameScreen(a, b) {
  return Boolean(a && b && a.kind === b.kind);
}
