// Transporte simulado do contrato cívico (A02 · #224; protótipo F01 · #217).
//
// Serve as fixtures sintéticas de B01 (`shared/civic-fixtures.js`) na forma dos
// envelopes propostos para B06, com cenários de contraste por área: parcial,
// não reconciliado, vazio, pendente, desatualizado, corrigido, retirado,
// inexistente, restrito, limite de consultas, indisponível, tempo esgotado,
// rede, schema inválido e cursor obsoleto. Roda em Node (testes, E2E via
// `page.route`) e no navegador (`VITE_CIVIC_MOCK=1`). Nunca representa dados reais:
// toda resposta carrega `synthetic: true` nos registros de origem.
import { civicFixture } from "../../../shared/civic-fixtures.js";
import { CivicContractError, comparisonCandidates, directoryPage, validateDirectoryQuery } from "../../../shared/civic-contract.js";
import { CIVIC_API_BASE } from "./client.js";

export const MOCK_AREAS = Object.freeze(["contests", "directory", "candidacy", "comparison", "edition", "event"]);
export const MOCK_SCENARIOS = Object.freeze([
  "ok", "partial", "unreconciled", "empty", "pending", "stale", "corrected", "withdrawn",
  "not-found", "restricted", "rate-limited", "unavailable", "timeout", "network", "schema", "stale-cursor",
]);

const NOW = "2032-09-01T12:00:00.000Z";
const STALE_COLLECTED_AT = "2032-08-01T12:00:00.000Z";
const STALE_AFTER = "2032-08-15T12:00:00.000Z";

function abortRejection(signal) {
  return new Promise((_, reject) => {
    const error = () => reject(new DOMException("The operation was aborted", "AbortError"));
    if (signal?.aborted) error();
    else signal?.addEventListener("abort", error, { once: true });
  });
}

function response(status, body, headers = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => lower[String(name).toLowerCase()] ?? null },
    json: async () => body,
  };
}

function error(status, code, message, extra = {}, headers = {}) {
  return response(status, { error: { code, message, ...extra } }, headers);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createCivicMock({ fixture = civicFixture(), scenarios = {}, revision = 1, delayMs = 0, now = NOW } = {}) {
  const records = fixture.records;
  const state = { scenarios: { ...scenarios }, revision, calls: [] };
  const byId = (kind) => new Map(records[kind].map((row) => [row.id, row]));
  const index = Object.fromEntries(Object.keys(records).map((kind) => [kind, byId(kind)]));

  function scenario(area) {
    return state.scenarios[area] ?? "ok";
  }

  function sourcesFor(bundle) {
    const ids = new Set();
    for (const rows of Object.values(bundle)) for (const row of rows) {
      for (const key of ["sourceId", "methodologySourceId"]) if (row[key]) ids.add(row[key]);
    }
    return [...ids].map((id) => index.sources.get(id)).filter(Boolean);
  }

  function historyFor(kind, id) {
    return records.changes
      .filter((change) => change.entityType === kind && change.entityId === id)
      .map(({ revision: rev, action, at, reason }) => ({ revision: rev, action, at, reason }));
  }

  function envelope(bundle, meta = {}) {
    const withSources = { ...bundle, sources: sourcesFor(bundle) };
    return { version: 1, revision: state.revision, records: clone(withSources), ...meta };
  }

  function contestsFor(jurisdiction) {
    return records.contests.filter((contest) => !jurisdiction || contest.jurisdiction === jurisdiction);
  }

  function personsFor(ids) {
    return [...new Set(ids)].map((id) => index.persons.get(id)).filter(Boolean);
  }

  function photographsFor(personIds) {
    const wanted = new Set(personIds);
    return records.photographs.filter((photo) => wanted.has(photo.personId));
  }

  function candidacyBundle(candidacy, mode) {
    const tickets = records.tickets.filter((ticket) => ticket.candidacyId === candidacy.id);
    const ticketIds = new Set(tickets.map((ticket) => ticket.id));
    const members = records.members.filter((member) => ticketIds.has(member.ticketId));
    let claims = records.claims.filter((claim) => claim.candidacyId === candidacy.id);
    let subject = candidacy;
    if (mode === "pending") claims = claims.map((claim) => ({ ...claim, review: "pending", publication: "draft" }));
    if (mode === "corrected") subject = { ...candidacy, revision: 2, updatedAt: now, ballotNumber: `${candidacy.ballotNumber}0` };
    const personIds = [candidacy.personId, ...members.map((member) => member.personId)];
    return {
      candidacies: [subject],
      persons: personsFor(personIds),
      contests: [index.contests.get(candidacy.contestId)].filter(Boolean),
      elections: [index.elections.get(index.contests.get(candidacy.contestId)?.electionId)].filter(Boolean),
      tickets,
      members,
      claims,
      photographs: photographsFor(personIds),
    };
  }

  function eventBundle(event) {
    const coverage = records.coverage.filter((row) => row.eventId === event.id);
    const articleIds = coverage.map((row) => row.articleId).filter(Boolean);
    const articles = records.articles.filter((article) => articleIds.includes(article.id) || articleIds.includes(article.syndicatedFromId));
    const outletIds = new Set(articles.flatMap((article) => [article.outletId, article.originOutletId]));
    return {
      events: [event],
      coverage,
      articles,
      outlets: records.outlets.filter((outlet) => outletIds.has(outlet.id)),
    };
  }

  function editionBundle(edition) {
    const items = records.editionItems.filter((item) => item.editionId === edition.id);
    const events = items.map((item) => index.events.get(item.eventId)).filter(Boolean);
    const bundles = events.map(eventBundle);
    const merge = (kind) => [...new Map(bundles.flatMap((bundle) => bundle[kind]).map((row) => [row.id, row])).values()];
    return {
      editions: [edition],
      editionItems: items,
      events,
      coverage: merge("coverage"),
      articles: merge("articles"),
      outlets: merge("outlets"),
    };
  }

  function failure(area, mode, subjectKind, subjectId) {
    switch (mode) {
      case "not-found": return error(404, "CIVIC_NOT_FOUND", "Conteúdo não encontrado");
      case "restricted": return error(403, "CIVIC_RESTRICTED", "Conteúdo restrito à revisão editorial");
      case "rate-limited": return error(429, "CIVIC_RATE_LIMITED", "Muitas consultas", { retryAfterSeconds: 30 }, { "Retry-After": "30" });
      case "unavailable": return error(503, "CIVIC_UNAVAILABLE", "Consulta indisponível", { retryAfterSeconds: 5 }, { "Retry-After": "5" });
      case "stale-cursor": return error(409, "CIVIC_STALE_CURSOR", "Reinicie a paginação.");
      case "withdrawn": return error(410, "CIVIC_WITHDRAWN", "Conteúdo retirado", { entity: { kind: subjectKind, id: subjectId, revision: state.revision + 1 } });
      case "schema": return response(200, { version: 1, revision: state.revision, records: { [subjectKind]: [{ id: subjectId, unexpected: true }] } });
      default: return null;
    }
  }

  function freshnessFor(mode) {
    return mode === "stale" ? { collectedAt: STALE_COLLECTED_AT, staleAfter: STALE_AFTER } : { collectedAt: now, staleAfter: null };
  }

  function respondTo(url) {
    const parsed = new URL(url, "https://mock.test");
    if (!parsed.pathname.startsWith(`${CIVIC_API_BASE}/`)) return error(404, "NOT_FOUND", "Rota fora do contrato cívico");
    const segments = parsed.pathname.slice(CIVIC_API_BASE.length + 1).split("/").filter(Boolean).map(decodeURIComponent);
    const query = Object.fromEntries(parsed.searchParams.entries());
    const [head, second, third] = segments;

    if (head === "contests" && segments.length === 1) {
      const mode = scenario("contests");
      const fail = failure("contests", mode, "contests", "");
      if (fail) return fail;
      const contests = mode === "empty" ? [] : contestsFor(query.jurisdiction);
      const elections = [...new Set(contests.map((contest) => contest.electionId))].map((id) => index.elections.get(id));
      return response(200, envelope({ contests, elections }, { freshness: freshnessFor(mode) }));
    }

    if (head === "directory" && segments.length === 1) {
      const mode = scenario("directory");
      const fail = failure("directory", mode, "candidacies", "");
      if (fail) return fail;
      let candidacies = records.candidacies;
      if (mode === "empty") candidacies = candidacies.map((row) => ({ ...row, review: "pending", publication: "draft" }));
      const input = { ...query, limit: query.limit === undefined ? undefined : Number(query.limit) };
      let page;
      try {
        const contestRows = candidacies.filter((row) => row.contestId === validateDirectoryQuery(input).contestId);
        const officialTotal = contestRows.length + (mode === "partial" ? 1 : 0);
        page = directoryPage(input, candidacies, { revision: state.revision, officialTotal });
      } catch (contractError) {
        if (contractError instanceof CivicContractError) {
          return error(contractError.code === "CIVIC_STALE_CURSOR" ? 409 : 400, contractError.code, contractError.message);
        }
        throw contractError;
      }
      const personIds = page.items.map((item) => item.personId);
      const bundle = {
        candidacies: page.items,
        persons: personsFor(personIds),
        contests: [index.contests.get(input.contestId)].filter(Boolean),
        photographs: photographsFor(personIds),
      };
      return response(200, envelope(bundle, {
        nextCursor: page.nextCursor,
        filteredCount: page.filteredCount,
        coverage: mode === "unreconciled" ? null : page.coverage,
        freshness: freshnessFor(mode),
      }));
    }

    if (head === "candidacies" && segments.length === 2) {
      const mode = scenario("candidacy");
      const fail = failure("candidacy", mode, "candidacies", second);
      if (fail) return fail;
      const candidacy = index.candidacies.get(second);
      if (!candidacy) return error(404, "CIVIC_NOT_FOUND", "Candidatura não encontrada");
      const history = historyFor("candidacies", second);
      if (mode === "corrected") history.push({ revision: 2, action: "correct", at: now, reason: "Correção sintética do número de urna" });
      return response(200, envelope(candidacyBundle(candidacy, mode), {
        subject: { kind: "candidacies", id: second },
        history,
        freshness: freshnessFor(mode),
      }));
    }

    if (head === "comparisons" && segments.length === 1) {
      const mode = scenario("comparison");
      const fail = failure("comparison", mode, "candidacies", "");
      if (fail) return fail;
      const ids = String(query.ids ?? "").split(",").filter(Boolean);
      let selected;
      try {
        selected = comparisonCandidates(ids, records.candidacies);
      } catch (contractError) {
        if (contractError instanceof CivicContractError) return error(400, contractError.code, contractError.message);
        throw contractError;
      }
      const bundles = selected.map((candidacy) => candidacyBundle(candidacy, mode === "pending" ? "pending" : "ok"));
      const merge = (kind) => [...new Map(bundles.flatMap((bundle) => bundle[kind] ?? []).map((row) => [row.id, row])).values()];
      const bundle = Object.fromEntries(["candidacies", "persons", "contests", "elections", "tickets", "members", "claims", "photographs"].map((kind) => [kind, merge(kind)]));
      return response(200, envelope(bundle, { freshness: freshnessFor(mode) }));
    }

    if (head === "editions" && segments.length === 2) {
      const mode = scenario("edition");
      const fail = failure("edition", mode, "editions", second === "current" ? "" : second);
      if (fail) return fail;
      const edition = second === "current"
        ? records.editions.find((row) => row.jurisdiction === (query.jurisdiction ?? "BR") && row.publication === "published")
        : index.editions.get(second);
      if (!edition || mode === "empty") return error(404, "CIVIC_NO_EDITION", "Nenhuma edição publicada para este recorte");
      const bundle = editionBundle(edition);
      if (mode === "pending") bundle.coverage = bundle.coverage.map((row) => (row.state === "present" ? { ...row, state: "pending", articleId: null, classificationVersion: null, relevance: null, reason: "Classificação sintética aguardando revisão" } : row));
      return response(200, envelope(bundle, { subject: { kind: "editions", id: edition.id }, history: historyFor("editions", edition.id), freshness: freshnessFor(mode) }));
    }

    if (head === "events" && segments.length === 2) {
      const mode = scenario("event");
      const fail = failure("event", mode, "events", second);
      if (fail) return fail;
      const event = index.events.get(second);
      if (!event) return error(404, "CIVIC_NOT_FOUND", "Acontecimento não encontrado");
      const bundle = eventBundle(event);
      if (mode === "pending") bundle.coverage = bundle.coverage.map((row) => (row.state === "present" ? { ...row, state: "pending", articleId: null, classificationVersion: null, relevance: null, reason: "Classificação sintética aguardando revisão" } : row));
      const history = historyFor("events", second);
      if (mode === "corrected") history.push({ revision: 2, action: "correct", at: now, reason: "Resumo sintético corrigido" });
      const subject = mode === "corrected" ? { ...event, revision: 2, updatedAt: now } : event;
      return response(200, envelope({ ...bundle, events: [subject] }, { subject: { kind: "events", id: second }, history, freshness: freshnessFor(mode) }));
    }

    void third;
    return error(404, "NOT_FOUND", "Rota desconhecida");
  }

  async function fetch(url, init = {}) {
    const target = typeof url === "string" ? url : url?.url ?? String(url);
    state.calls.push({ url: target, at: state.calls.length });
    const area = MOCK_AREAS.find((name) => target.includes(`${CIVIC_API_BASE}/${{ contests: "contests", directory: "directory", candidacy: "candidacies", comparison: "comparisons", edition: "editions", event: "events" }[name]}`));
    const mode = area ? scenario(area) : "ok";
    if (mode === "timeout") return abortRejection(init.signal);
    if (mode === "network") throw new TypeError("Failed to fetch");
    const delay = typeof delayMs === "function" ? await delayMs(target) : delayMs;
    if (delay) {
      await Promise.race([new Promise((resolve) => setTimeout(resolve, delay)), abortRejection(init.signal)]);
    }
    if (init.signal?.aborted) throw new DOMException("The operation was aborted", "AbortError");
    return respondTo(target);
  }

  return {
    fixture,
    fetch,
    respond: respondTo,
    calls: state.calls,
    setScenario(area, mode) {
      if (!MOCK_AREAS.includes(area)) throw new TypeError(`Área desconhecida: ${area}`);
      if (!MOCK_SCENARIOS.includes(mode)) throw new TypeError(`Cenário desconhecido: ${mode}`);
      state.scenarios[area] = mode;
    },
    setRevision(value) {
      state.revision = value;
    },
  };
}
