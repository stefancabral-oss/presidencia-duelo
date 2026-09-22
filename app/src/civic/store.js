// Estado de leitura pública das áreas cívicas (A02 · #224).
//
// Um estado por área (disputas, diretório, candidatura, comparação, edição,
// acontecimento). Cada requisição carrega uma época: respostas de épocas antigas
// são descartadas, então trocar UF, filtro ou rota durante uma leitura nunca
// mostra a resposta anterior como se fosse do novo recorte. Requisições em voo são
// canceladas por AbortController. O store não grava storage (a preferência de UF
// tem módulo próprio), não registra payloads em log e não conhece votos, tokens ou
// identidade do jogador.
import { comparisonCandidates, CivicContractError } from "../../../shared/civic-contract.js";
import { CivicReadError } from "./client.js";
import { isJurisdiction } from "./uf-preference.js";

export const AREAS = Object.freeze(["contests", "directory", "candidacy", "comparison", "edition", "event"]);
export const STATUS = Object.freeze(["idle", "loading", "ready", "empty", "error"]);

function emptyArea() {
  return {
    status: "idle",
    key: null,
    data: null,
    error: null,
    fetchedAt: null,
    revision: null,
    stale: false,
    retryAt: null,
    epoch: 0,
    controller: null,
    lastRequest: null,
  };
}

function publicArea(area) {
  const { controller, epoch, lastRequest, ...rest } = area;
  void controller; void epoch; void lastRequest;
  return rest;
}

function isPresentation(error) {
  return error instanceof CivicReadError;
}

function normalizeError(error) {
  if (isPresentation(error)) return error;
  if (error instanceof CivicContractError) return new CivicReadError("invalid", error.message, { code: error.code, cause: error });
  return new CivicReadError("unavailable", "Falha inesperada na leitura", { code: "UNEXPECTED", cause: error });
}

function errorState(error, now) {
  return {
    kind: error.kind,
    code: error.code,
    message: error.message,
    status: error.status,
    retryAfterSeconds: error.retryAfterSeconds,
    retryAt: error.retryAfterSeconds ? now + error.retryAfterSeconds * 1000 : null,
    entity: error.entity,
    detail: error.detail,
  };
}

function freshnessStale(freshness, now) {
  return Boolean(freshness?.staleAfter && Date.parse(freshness.staleAfter) < now);
}

export function createCivicStore({ client, preference, now = Date.now } = {}) {
  if (!client) throw new TypeError("createCivicStore exige um cliente");
  const areas = Object.fromEntries(AREAS.map((name) => [name, emptyArea()]));
  const listeners = new Set();
  let jurisdiction = preference?.effective?.() ?? "BR";

  function notify(area) {
    const snapshot = getState();
    for (const listener of listeners) listener(snapshot, area);
  }

  function getState() {
    return {
      jurisdiction,
      ...Object.fromEntries(AREAS.map((name) => [name, publicArea(areas[name])])),
    };
  }

  function begin(name, key) {
    const area = areas[name];
    area.controller?.abort();
    area.epoch += 1;
    area.controller = new AbortController();
    if (area.key !== key) {
      area.data = null;
      area.error = null;
      area.fetchedAt = null;
      area.revision = null;
      area.stale = false;
      area.retryAt = null;
    }
    area.key = key;
    area.status = "loading";
    notify(name);
    return { epoch: area.epoch, signal: area.controller.signal };
  }

  function current(name, epoch) {
    return areas[name].epoch === epoch;
  }

  function settle(name, epoch, { data, envelope, empty = false }) {
    if (!current(name, epoch)) return false;
    const area = areas[name];
    area.data = data;
    area.error = null;
    area.fetchedAt = now();
    area.revision = envelope?.revision ?? area.revision;
    area.stale = freshnessStale(envelope?.meta?.freshness, area.fetchedAt);
    area.retryAt = null;
    area.status = empty ? "empty" : "ready";
    area.controller = null;
    notify(name);
    return true;
  }

  function fail(name, epoch, rawError) {
    if (!current(name, epoch)) return false;
    const error = normalizeError(rawError);
    if (error.kind === "aborted") return false;
    const area = areas[name];
    const at = now();
    area.error = errorState(error, at);
    area.retryAt = area.error.retryAt;
    area.controller = null;
    if (error.kind === "withdrawn") {
      // Retirada invalida a entrada local e some das listas (contrato B01/B06).
      area.data = null;
      area.status = "error";
      invalidateEntity(error.entity);
    } else if (area.data && ["unavailable", "network", "timeout", "offline", "rate-limited"].includes(error.kind)) {
      // Última versão permitida continua visível, com data explícita e aviso.
      area.stale = true;
      area.status = "ready";
    } else {
      area.data = null;
      area.status = "error";
    }
    notify(name);
    return true;
  }

  function invalidateEntity(entity) {
    if (!entity?.kind || !entity?.id) return;
    const directory = areas.directory;
    if (entity.kind === "candidacies" && directory.data?.items) {
      directory.data = { ...directory.data, items: directory.data.items.filter((item) => item.id !== entity.id) };
    }
    if (entity.kind === "candidacies" && areas.candidacy.data?.candidacy?.id === entity.id) areas.candidacy.data = null;
    if (entity.kind === "events" && areas.event.data?.event?.id === entity.id) areas.event.data = null;
    if (entity.kind === "editions" && areas.edition.data?.edition?.id === entity.id) areas.edition.data = null;
  }

  async function run(name, key, request, { transform, emptyWhen } = {}) {
    const { epoch, signal } = begin(name, key);
    areas[name].lastRequest = () => run(name, key, request, { transform, emptyWhen });
    const emptyCheck = typeof emptyWhen === "function" ? emptyWhen : null;
    try {
      const envelope = await request(signal);
      const data = transform ? transform(envelope) : envelope;
      return settle(name, epoch, { data, envelope, empty: Boolean(emptyCheck?.(envelope, data)) });
    } catch (error) {
      if (emptyWhen === "not-found-is-empty" && error instanceof CivicReadError && error.kind === "not-found") {
        return settle(name, epoch, { data: null, envelope: null, empty: true });
      }
      return fail(name, epoch, error);
    }
  }

  function knownCandidacies() {
    const rows = new Map();
    for (const item of areas.directory.data?.items ?? []) rows.set(item.id, item);
    for (const item of areas.comparison.data?.records?.candidacies ?? []) rows.set(item.id, item);
    const single = areas.candidacy.data?.records?.candidacies?.[0];
    if (single) rows.set(single.id, single);
    return [...rows.values()];
  }

  const directoryTransform = (envelope) => ({
    records: envelope.records,
    items: envelope.records.candidacies ?? [],
    coverage: envelope.meta.coverage,
    filteredCount: envelope.meta.filteredCount,
    nextCursor: envelope.meta.nextCursor,
    freshness: envelope.meta.freshness,
  });

  const store = {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState,
    get jurisdiction() {
      return jurisdiction;
    },
    /** Escolha manual de recorte. Invalida leituras em voo dependentes do recorte. */
    setJurisdiction(value) {
      if (!isJurisdiction(value)) throw new TypeError(`Recorte inválido: ${String(value)}`);
      const result = preference?.set?.(value) ?? { jurisdiction: value, persisted: false };
      jurisdiction = value;
      for (const name of ["contests", "directory", "edition"]) {
        areas[name].controller?.abort();
        areas[name].epoch += 1;
        areas[name].controller = null;
        if (areas[name].status === "loading") areas[name].status = areas[name].data ? "ready" : "idle";
      }
      notify("jurisdiction");
      return result;
    },
    clearJurisdiction() {
      preference?.clear?.();
      jurisdiction = preference?.effective?.() ?? "BR";
      notify("jurisdiction");
    },
    loadContests(scope = jurisdiction) {
      return run("contests", JSON.stringify(["contests", scope]), (signal) => client.contests({ jurisdiction: scope }, { signal }), {
        transform: (envelope) => ({ contests: envelope.records.contests ?? [], elections: envelope.records.elections ?? [], freshness: envelope.meta.freshness }),
        emptyWhen: (envelope) => (envelope.records.contests ?? []).length === 0,
      });
    },
    loadDirectory(query) {
      const clean = Object.fromEntries(Object.entries(query ?? {}).filter(([, value]) => value !== undefined && value !== null && value !== ""));
      return run("directory", JSON.stringify(["directory", clean]), (signal) => client.directory(clean, { signal }), {
        transform: directoryTransform,
        emptyWhen: (_, data) => data.items.length === 0,
      });
    },
    /** Próxima página com o cursor atual; cursor obsoleto reinicia a lista uma vez. */
    async loadMoreDirectory(query) {
      const area = areas.directory;
      const cursor = area.data?.nextCursor;
      if (!cursor || area.status === "loading") return false;
      const previous = area.data;
      const { epoch, signal } = begin("directory", area.key);
      try {
        const envelope = await client.directory({ ...query, cursor }, { signal });
        const page = directoryTransform(envelope);
        const merged = { ...page, items: [...previous.items, ...page.items.filter((item) => !previous.items.some((known) => known.id === item.id))], records: envelope.records };
        return settle("directory", epoch, { data: merged, envelope, empty: merged.items.length === 0 });
      } catch (error) {
        if (error instanceof CivicReadError && error.kind === "stale-cursor" && current("directory", epoch)) {
          return store.loadDirectory(query);
        }
        if (current("directory", epoch)) {
          area.data = previous;
        }
        return fail("directory", epoch, error);
      }
    },
    loadCandidacy(id, { revision } = {}) {
      return run("candidacy", JSON.stringify(["candidacy", id, revision ?? null]), (signal) => client.candidacy(id, { revision, signal }), {
        transform: (envelope) => ({
          records: envelope.records,
          candidacy: envelope.records.candidacies?.find((row) => row.id === id) ?? envelope.records.candidacies?.[0] ?? null,
          history: envelope.meta.history,
          freshness: envelope.meta.freshness,
        }),
        emptyWhen: (_, data) => !data.candidacy,
      });
    },
    /** Compara 2–3 candidaturas publicadas do mesmo recorte. Incompatibilidade conhecida não gera requisição. */
    loadComparison(ids) {
      const key = JSON.stringify(["comparison", ids]);
      const known = knownCandidacies();
      const allKnown = Array.isArray(ids) && ids.every((id) => known.some((row) => row.id === id));
      if (allKnown) {
        try {
          comparisonCandidates(ids, known);
        } catch (error) {
          const { epoch } = begin("comparison", key);
          return Promise.resolve(fail("comparison", epoch, new CivicReadError("invalid", "Só é possível comparar candidaturas publicadas da mesma disputa, entre duas e três.", { code: "CIVIC_INVALID", cause: error })));
        }
      }
      return run("comparison", key, (signal) => client.comparison(ids, { signal }), {
        transform: (envelope) => ({ records: envelope.records, ids: [...ids], freshness: envelope.meta.freshness }),
      });
    },
    loadCurrentEdition(scope = jurisdiction) {
      return run("edition", JSON.stringify(["edition", "current", scope]), (signal) => client.currentEdition({ jurisdiction: scope }, { signal }), {
        transform: (envelope) => ({ records: envelope.records, edition: envelope.records.editions?.[0] ?? null, history: envelope.meta.history, freshness: envelope.meta.freshness }),
        emptyWhen: "not-found-is-empty",
      });
    },
    loadEdition(id, { revision } = {}) {
      return run("edition", JSON.stringify(["edition", id, revision ?? null]), (signal) => client.edition(id, { revision, signal }), {
        transform: (envelope) => ({ records: envelope.records, edition: envelope.records.editions?.find((row) => row.id === id) ?? null, history: envelope.meta.history, freshness: envelope.meta.freshness }),
      });
    },
    loadEvent(id, { revision } = {}) {
      return run("event", JSON.stringify(["event", id, revision ?? null]), (signal) => client.event(id, { revision, signal }), {
        transform: (envelope) => ({ records: envelope.records, event: envelope.records.events?.find((row) => row.id === id) ?? null, history: envelope.meta.history, freshness: envelope.meta.freshness }),
      });
    },
    /** Repete a última leitura da área, respeitando Retry-After. */
    retry(name) {
      const area = areas[name];
      if (!area?.lastRequest) return Promise.resolve(false);
      if (area.retryAt && area.retryAt > now()) return Promise.resolve(false);
      return area.lastRequest();
    },
    abort(name) {
      const targets = name ? [name] : AREAS;
      for (const target of targets) {
        const area = areas[target];
        area.controller?.abort();
        area.controller = null;
        area.epoch += 1;
        if (area.status === "loading") area.status = area.data ? "ready" : "idle";
      }
      notify(name ?? "all");
    },
  };
  return store;
}
