// Shell das áreas cívicas dentro do Vite/PWA existente (APP · A01 · #223).
//
// Integra rotas por hash, histórico do navegador, título, foco e a proposta de
// navegação Início · Jogar · Candidatos · Notícias · Mais (atrás de flags) sem
// tocar no motor de votação: entrar e sair das áreas só troca `state.screen`; o
// painel do duelo permanece montado e nenhuma navegação envia ou cancela voto.
// Contrato completo em stages/17_candidate_news/app/A01-contract.md.
import "./ui/civic.css";
import { civicFlags, anyCivicArea, areaEnabled } from "./flags.js";
import { createCivicClient } from "./client.js";
import { createCivicStore } from "./store.js";
import { createUfPreference } from "./uf-preference.js";
import { civicHref, isCivicHash, parseCivicRoute, routeTitle, sameRoute, sameScreen } from "./router.js";
import { createScreen } from "./ui/screens.js";
import { focusElement } from "./ui/dom.js";

export const CIVIC_SCREEN = "civic";
const AREA_ROUTES = Object.freeze({ directory: { kind: "directory", params: {} }, news: { kind: "news", params: {} } });

function preferredContest(contests, jurisdiction) {
  const rows = contests.filter((contest) => contest.jurisdiction === jurisdiction);
  const order = jurisdiction === "BR" ? ["president"] : ["governor", "senator"];
  for (const office of order) {
    const found = rows.find((contest) => contest.office === office);
    if (found) return found;
  }
  return rows[0] ?? null;
}

export function createCivicShell({
  app,
  panel,
  nav,
  sheet,
  getScreen,
  setScreen,
  getGameFeatures,
  isReady,
  announce = () => {},
  sound = null,
  env = import.meta.env ?? {},
  win = window,
  doc = document,
  now = Date.now,
  client: providedClient = null,
  storage,
} = {}) {
  if (!app || !panel || !nav || !sheet) throw new TypeError("createCivicShell exige app, panel, nav e sheet");
  const originalTitle = doc.title;
  const preference = createUfPreference({ storage });
  const client = providedClient ?? createDefaultClient(env);
  const store = createCivicStore({ client, preference, now });
  const shell = { store, preference, client };

  let currentRoute = null;
  let currentScreen = null;
  let returnScreen = null;
  let returnFocus = null;
  let expectedHref = null;
  let pendingInitial = false;
  const scrollPositions = new Map();
  const screens = new Map();

  const flags = () => civicFlags(getGameFeatures?.() ?? {}, env);

  // --- navegação proposta -------------------------------------------------
  const civicButtons = [...nav.querySelectorAll("[data-civic-area]")];
  const moreButton = nav.querySelector("[data-nav-more]");
  const duelButton = nav.querySelector('[data-screen="duel"]');
  const rankingButton = nav.querySelector('[data-screen="ranking"]');
  const collectionButton = nav.querySelector('[data-screen="collection"]');
  const duelLabel = duelButton?.textContent ?? "Duelo";
  let proposalApplied = false;

  function applyNavigationLayout() {
    const active = anyCivicArea(flags());
    if (active && !proposalApplied) {
      if (duelButton) duelButton.textContent = "Jogar";
      for (const button of [rankingButton, collectionButton]) if (button) sheet.append(button);
      proposalApplied = true;
    } else if (!active && proposalApplied) {
      if (duelButton) duelButton.textContent = duelLabel;
      for (const button of [collectionButton, rankingButton]) if (button) duelButton?.after(button);
      proposalApplied = false;
      closeSheet();
    }
    for (const button of civicButtons) button.hidden = !active || !areaEnabled(flags(), button.dataset.civicArea);
    if (moreButton) moreButton.hidden = !active;
    if (!active) sheet.hidden = true;
  }

  function closeSheet({ focusTrigger = false } = {}) {
    if (sheet.hidden) return;
    sheet.hidden = true;
    moreButton?.setAttribute("aria-expanded", "false");
    if (focusTrigger) moreButton?.focus();
  }

  function toggleSheet() {
    const open = sheet.hidden;
    sheet.hidden = !open;
    moreButton?.setAttribute("aria-expanded", String(open));
    if (open) sheet.querySelector("button:not([hidden])")?.focus();
  }

  function renderNavigationState() {
    applyNavigationLayout();
    const inCivic = getScreen() === CIVIC_SCREEN;
    for (const button of civicButtons) {
      const active = inCivic && currentRoute?.area === button.dataset.civicArea;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    if (moreButton) {
      const active = !inCivic && ["ranking", "collection"].includes(getScreen()) && proposalApplied;
      moreButton.classList.toggle("active", active);
    }
  }

  nav.addEventListener("click", (event) => {
    const button = event.target.closest?.("button");
    if (!button) return;
    if (button.dataset.civicArea) {
      event.preventDefault();
      enterArea(button.dataset.civicArea, button);
    } else if (button.hasAttribute("data-nav-more")) {
      event.preventDefault();
      toggleSheet();
    }
  });
  sheet.addEventListener("click", (event) => {
    if (event.target.closest?.("button")) queueMicrotask(() => closeSheet());
  });
  doc.addEventListener("click", (event) => {
    if (sheet.hidden) return;
    if (!sheet.contains(event.target) && !moreButton?.contains(event.target)) closeSheet();
  });
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !sheet.hidden) closeSheet({ focusTrigger: true });
  });

  // --- histórico -----------------------------------------------------------
  function currentHash() {
    return win.location.hash || "";
  }

  function pathWithoutHash() {
    return `${win.location.pathname}${win.location.search}`;
  }

  function navigate(target, { replace = false } = {}) {
    const href = typeof target === "string" ? target : civicHref(target);
    if (!href) return false;
    if (currentRoute && getScreen() === CIVIC_SCREEN) scrollPositions.set(currentRoute.href ?? currentHash(), win.scrollY);
    expectedHref = href;
    if (replace || currentHash() === href) {
      win.history.replaceState(null, "", `${pathWithoutHash()}${href}`);
      handleRoute({ pushed: true });
    } else {
      win.location.hash = href;
    }
    return true;
  }

  function enterArea(area, trigger = doc.activeElement) {
    if (!areaEnabled(flags(), area)) return false;
    rememberReturn(trigger);
    sound?.play?.("navigation");
    return navigate(AREA_ROUTES[area]);
  }

  function rememberReturn(trigger) {
    if (getScreen() !== CIVIC_SCREEN) {
      returnScreen = getScreen();
      returnFocus = trigger instanceof win.HTMLElement ? trigger : null;
    }
  }

  /** "Voltar ao jogo": limpa o hash sem empilhar histórico e devolve o foco. */
  function back() {
    if (isCivicHash(currentHash())) win.history.replaceState(null, "", pathWithoutHash());
    leaveToGame();
  }

  function leaveToGame() {
    const target = returnScreen && returnScreen !== CIVIC_SCREEN ? returnScreen : "topics";
    deactivate();
    setScreen(target);
    const focusTarget = returnFocus?.isConnected && !returnFocus.hidden ? returnFocus : nav.querySelector(".nav-button.active:not([hidden])") ?? duelButton;
    queueMicrotask(() => focusElement(focusTarget, { preventScroll: true }));
    returnFocus = null;
  }

  function deactivate() {
    if (currentScreen) {
      currentScreen.unmount();
      currentScreen = null;
    }
    currentRoute = null;
    store.abort();
    doc.title = originalTitle;
    panel.replaceChildren();
    renderNavigationState();
  }

  // --- rotas ---------------------------------------------------------------
  function resolvedFor(route, state) {
    if (!route) return {};
    const contests = state.contests.data?.contests ?? [];
    if (route.kind === "directory") {
      const jurisdiction = route.params.uf ?? state.jurisdiction;
      const contestsHere = contests.filter((contest) => contest.jurisdiction === jurisdiction);
      const requested = route.params.contestId && contestsHere.some((contest) => contest.id === route.params.contestId) ? route.params.contestId : null;
      const fallback = preferredContest(contests, jurisdiction)?.id ?? null;
      const contestId = requested ?? (state.contests.status === "ready" || state.contests.status === "empty" ? fallback : route.params.contestId ?? null);
      return { jurisdiction, contestId, contestsLoaded: state.contests.status === "ready" || state.contests.status === "empty" };
    }
    if (route.kind === "news") return { jurisdiction: route.params.uf ?? state.jurisdiction };
    return { jurisdiction: state.jurisdiction };
  }

  function directoryQuery(route, resolved) {
    return { contestId: resolved.contestId, party: route.params.party, officialStatus: route.params.officialStatus, search: route.params.search };
  }

  // Entrar numa rota (`force`) sempre revalida o assunto com o servidor, mesmo com
  // dados em cache: conteúdo retirado não pode reaparecer ao voltar no histórico
  // (contrato B01). Atualizações do store só disparam leituras cuja chave mudou.
  function loadFor(route, state, { force = false } = {}) {
    const resolved = resolvedFor(route, state);
    const stale = (area, key) => force ? state[area].status !== "loading" || state[area].key !== key : state[area].key !== key;
    switch (route.kind) {
      case "directory": {
        const contestsKey = JSON.stringify(["contests", resolved.jurisdiction]);
        if (state.contests.key !== contestsKey) store.loadContests(resolved.jurisdiction);
        if (resolved.contestId && resolved.contestsLoaded) {
          const query = directoryQuery(route, resolved);
          const clean = Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ""));
          if (stale("directory", JSON.stringify(["directory", clean]))) store.loadDirectory(clean);
        }
        break;
      }
      case "candidacy": {
        if (stale("candidacy", JSON.stringify(["candidacy", route.params.id, route.params.revision ?? null]))) store.loadCandidacy(route.params.id, { revision: route.params.revision });
        break;
      }
      case "comparison": {
        const ids = route.params.ids ?? [];
        if (ids.length >= 2 && ids.length <= 3 && stale("comparison", JSON.stringify(["comparison", ids]))) store.loadComparison(ids);
        break;
      }
      case "news": {
        if (stale("edition", JSON.stringify(["edition", "current", resolved.jurisdiction]))) store.loadCurrentEdition(resolved.jurisdiction);
        break;
      }
      case "edition": {
        if (stale("edition", JSON.stringify(["edition", route.params.id, route.params.revision ?? null]))) store.loadEdition(route.params.id, { revision: route.params.revision });
        break;
      }
      case "event": {
        if (stale("event", JSON.stringify(["event", route.params.id, route.params.revision ?? null]))) store.loadEvent(route.params.id, { revision: route.params.revision });
        break;
      }
      default:
        break;
    }
    return resolved;
  }

  const actions = {
    navigate,
    back,
    retry: (area) => store.retry(area),
    applyFilters(params) {
      const jurisdiction = params.uf && params.uf !== store.jurisdiction ? params.uf : null;
      if (jurisdiction) store.setJurisdiction(jurisdiction);
      navigate({ kind: "directory", params: { uf: params.uf || undefined, contestId: params.contestId || undefined, party: params.party || undefined, officialStatus: params.officialStatus || undefined, search: params.search || undefined } });
    },
    loadMore() {
      if (!currentRoute || currentRoute.kind !== "directory") return;
      const resolved = resolvedFor(currentRoute, store.getState());
      store.loadMoreDirectory(Object.fromEntries(Object.entries(directoryQuery(currentRoute, resolved)).filter(([, value]) => value)));
    },
    compare(ids) {
      if (ids.length < 2 || ids.length > 3) {
        announce("Escolha entre duas e três candidaturas para comparar.");
        return;
      }
      navigate({ kind: "comparison", params: { ids } });
    },
    setNewsJurisdiction(uf) {
      store.setJurisdiction(uf);
      navigate({ kind: "news", params: { uf } });
    },
  };

  const ctx = { store, flags, actions, announce, now };

  function screenKindFor(route) {
    if (!route) return null;
    if (route.area && !areaEnabled(flags(), route.area)) return "area-disabled";
    return route.kind;
  }

  function ensureScreen(kind) {
    if (currentScreen?.kind === kind) return currentScreen;
    currentScreen?.unmount();
    if (!screens.has(kind)) screens.set(kind, createScreen(kind, ctx));
    currentScreen = screens.get(kind);
    currentScreen.mount(panel);
    return currentScreen;
  }

  function updateScreen({ fromRoute = false } = {}) {
    if (!currentRoute || !currentScreen) return;
    const state = store.getState();
    const resolved = loadFor(currentRoute, state, { force: fromRoute });
    // `fromRoute` marca atualização causada por mudança de URL: a tela sincroniza
    // filtros com o endereço mesmo que um campo esteja focado.
    currentScreen.update({ route: currentRoute, state: store.getState(), resolved, fromRoute });
  }

  function handleRoute({ pushed = false } = {}) {
    const hash = currentHash();
    const route = parseCivicRoute(hash);
    if (!route) {
      if (hash === "#/") win.history.replaceState(null, "", pathWithoutHash());
      if (getScreen() === CIVIC_SCREEN) leaveToGame();
      expectedHref = null;
      return;
    }
    if (!isReady()) {
      pendingInitial = true;
      return;
    }
    const wasPush = pushed || (expectedHref !== null && hash === expectedHref);
    expectedHref = null;
    const previousRoute = currentRoute;
    if (getScreen() !== CIVIC_SCREEN) rememberReturn(doc.activeElement);
    currentRoute = route;
    const kind = screenKindFor(route);
    const reused = currentScreen && currentScreen.kind === kind && sameScreen(previousRoute, route) && previousRoute && screenKindFor(previousRoute) === kind;
    ensureScreen(kind);
    if (getScreen() !== CIVIC_SCREEN) setScreen(CIVIC_SCREEN);
    else renderNavigationState();
    updateScreen({ fromRoute: true });
    doc.title = `${routeTitle(kind === "area-disabled" ? "not-found" : route)} · PoliMatch`;
    if (kind === "area-disabled") doc.title = "Área indisponível · PoliMatch";
    if (!previousRoute || !sameRoute(previousRoute, route)) {
      const saved = !wasPush ? scrollPositions.get(route.href ?? hash) : undefined;
      win.scrollTo({ top: saved ?? 0, behavior: "instant" in win ? "instant" : "auto" });
      if (!reused || !doc.activeElement || doc.activeElement === doc.body || !panel.contains(doc.activeElement)) currentScreen.focusInitial();
    }
  }

  store.subscribe(() => {
    if (getScreen() === CIVIC_SCREEN && currentRoute) updateScreen();
  });

  win.addEventListener("hashchange", () => handleRoute());

  return Object.assign(shell, {
    flags,
    navigate,
    back,
    enterArea,
    /** Chamado pelo `render()` de main.js a cada ciclo: mantém nav e painel coerentes com `state.screen`. */
    sync() {
      renderNavigationState();
      if (getScreen() !== CIVIC_SCREEN && currentRoute) {
        if (isCivicHash(currentHash())) win.history.replaceState(null, "", pathWithoutHash());
        deactivate();
      }
      if (getScreen() !== CIVIC_SCREEN) closeSheet();
    },
    /** Chamado quando o jogo fica pronto: resolve um deep link aberto antes da inicialização. */
    start() {
      if (pendingInitial || isCivicHash(currentHash())) {
        pendingInitial = false;
        handleRoute();
      }
      renderNavigationState();
    },
    get route() {
      return currentRoute;
    },
    get active() {
      return getScreen() === CIVIC_SCREEN && Boolean(currentRoute);
    },
  });
}

function createDefaultClient(env) {
  if (env?.VITE_CIVIC_MOCK === "1" || env?.VITE_CIVIC_MOCK === "true") {
    // Protótipo local com fixtures sintéticas de B01; nunca ativo sem a variável de build.
    const mockPromise = import("./mock-transport.js").then(({ createCivicMock }) => createCivicMock({ delayMs: 250 }));
    return createCivicClient({ fetchImpl: async (...args) => (await mockPromise).fetch(...args), resolveUrl: (path) => path });
  }
  return createCivicClient();
}
