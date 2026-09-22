// Telas das áreas cívicas (FRONT · F01 · #217).
//
// Contrato de montagem (A01 · #223): cada fábrica recebe `ctx` e devolve
// `{ kind, root, mount(container), update(view), unmount(), focusInitial() }`.
// `view` = `{ route, state, resolved }`, onde `state` é o snapshot do store e
// `resolved` traz o recorte/disputa efetivos calculados pelo shell. As telas não
// chamam endpoints: pedem ações por `ctx.actions` e desenham o que o store tem.
// DOM estável: o esqueleto é criado uma vez; `update` só ajusta texto, atributos e
// listas reconciliadas por chave.
import {
  candidacyCardModel, claimModels, comparisonModel, contestModel, coverageSummary, editionModel, eventModel,
  freshnessModel, historyModel, JURISDICTION_OPTIONS, jurisdictionLabel, ticketModels,
} from "../view-models.js";
import { civicHref } from "../router.js";
import { el, focusElement, internalLink, reconcileList, replaceChildren, setAttr, setHidden, setText } from "./dom.js";
import { createStatePanel, notice, noticesFor } from "./states.js";
import {
  actionRow, button, candidacyCard, claimItem, compareBar, coverageCard, coverageLine, eventCard, filterBar, officialStatusBadge,
  photoFigure, screenHeader, setContestOptions, sourceChip, ticketSection, updateCandidacyCard, updateCoverageLine,
} from "./components.js";

const SYNTHETIC_NOTE = "Dados sintéticos de teste: nomes, números e fontes são fictícios e não descrevem pessoas reais.";

function baseScreen(kind, { eyebrow, title, lead }) {
  const headingId = `civic-${kind}-title`;
  const header = screenHeader({ eyebrow, title, lead, headingId });
  const root = el("section", { class: "civic-view", dataset: { civicView: kind }, "aria-labelledby": headingId }, header.root);
  let container = null;
  return {
    kind,
    root,
    header,
    mount(target) {
      container = target;
      target.replaceChildren(root);
    },
    unmount() {
      root.remove();
      container = null;
    },
    focusInitial() {
      return focusElement(header.heading);
    },
    setBusy(busy) {
      setAttr(root, "aria-busy", busy ? "true" : null);
    },
  };
}

function bundleFrom(...datasets) {
  const bundle = {};
  for (const data of datasets) {
    for (const [kind, rows] of Object.entries(data?.records ?? {})) {
      bundle[kind] = [...(bundle[kind] ?? []), ...rows.filter((row) => !(bundle[kind] ?? []).some((known) => known.id === row.id))];
    }
  }
  return bundle;
}

function syntheticNotice(bundle) {
  return (bundle.sources ?? []).some((source) => source.kind === "synthetic") ? [notice("info", SYNTHETIC_NOTE, { key: "synthetic" })] : [];
}

/* ------------------------------------------------------------------ Diretório */
export function createDirectoryScreen(ctx) {
  const screen = baseScreen("directory", {
    eyebrow: "Conheça seu candidato",
    title: "Candidatos",
    lead: "Candidaturas oficiais do recorte escolhido, com a mesma exposição para todas. Fotografia, propostas e notícias só aparecem depois de revisão.",
  });
  const filters = filterBar({
    onSubmit: () => ctx.actions.applyFilters(readFilters()),
    onReset: () => ctx.actions.applyFilters({ uf: filters.fields.jurisdiction.value, contestId: "" }),
  });
  filters.fields.jurisdiction.addEventListener("change", () => ctx.actions.applyFilters({ uf: filters.fields.jurisdiction.value, contestId: "" }));
  filters.fields.contest.addEventListener("change", () => ctx.actions.applyFilters({ ...readFilters(), contestId: filters.fields.contest.value }));
  const coverage = coverageLine(null);
  const state = createStatePanel({ area: "directory", onRetry: () => ctx.actions.retry("directory"), onBack: () => ctx.actions.back(), backLabel: "Voltar ao jogo" });
  const results = el("ul", { class: "civic-results", "aria-label": "Candidaturas" });
  const more = button("Carregar mais candidaturas", { secondary: true, action: "load-more", onClick: () => ctx.actions.loadMore(), hidden: true });
  const selection = new Set();
  const compare = compareBar({
    onCompare: () => ctx.actions.compare([...selection]),
    onClear: () => { selection.clear(); refreshSelection(); },
  });
  const footer = el("p", { class: "civic-footer-note" }, "Ranking, Elo e coleção do jogo não entram aqui: o diretório é leitura pública, sem preferência inferida.");
  screen.root.append(filters.form, coverage, state.root, results, actionRow(more), compare.root, footer);
  let lastCards = [];

  function readFilters() {
    return {
      uf: filters.fields.jurisdiction.value,
      contestId: filters.fields.contest.value,
      search: filters.fields.search.value.trim(),
      party: filters.fields.party.value.trim(),
      officialStatus: filters.fields.status.value.trim(),
    };
  }

  function refreshSelection() {
    compare.update([...selection]);
    for (const node of results.children) {
      const article = node.firstElementChild;
      const card = lastCards.find((item) => item.id === article?.dataset.candidacyId);
      if (card) updateCandidacyCard(article, card, { selectable: true, selected: selection.has(card.id) });
    }
  }

  function toggle(id, checked) {
    if (checked) {
      if (selection.size >= 3) {
        ctx.announce("Só é possível comparar até três candidaturas.");
        refreshSelection();
        return;
      }
      selection.add(id);
    } else selection.delete(id);
    refreshSelection();
  }

  screen.update = ({ route, state: snapshot, resolved, fromRoute = false }) => {
    const area = snapshot.directory;
    const contests = (snapshot.contests.data?.contests ?? []).map((contest) => contestModel(contest, snapshot.contests.data?.elections ?? []));
    if (filters.fields.jurisdiction.value !== resolved.jurisdiction) filters.fields.jurisdiction.value = resolved.jurisdiction;
    setContestOptions(filters.fields.contest, contests, resolved.contestId ?? "");
    // A URL é a fonte dos filtros. Durante atualizações do store, um campo em
    // edição não é sobrescrito; numa mudança de rota (voltar/avançar, deep link) é.
    for (const [field, key] of [["search", "search"], ["party", "party"], ["status", "officialStatus"]]) {
      const value = route.params[key] ?? "";
      if (filters.fields[field].value !== value && (fromRoute || document.activeElement !== filters.fields[field])) filters.fields[field].value = value;
    }
    const data = area.data;
    const bundle = bundleFrom(data, snapshot.contests.data ? { records: { contests: snapshot.contests.data.contests, elections: snapshot.contests.data.elections } } : null);
    const summary = data ? coverageSummary(data.coverage) : null;
    updateCoverageLine(coverage, summary);
    const items = data?.items ?? [];
    lastCards = items.map((candidacy) => candidacyCardModel(candidacy, bundle));
    for (const id of [...selection]) if (!lastCards.some((card) => card.id === id) && !area.data) selection.delete(id);
    reconcileList(results, lastCards, {
      key: (card) => card.id,
      create: (card) => el("li", {}, candidacyCard(card, { selectable: true, selected: selection.has(card.id), onToggle: toggle })),
      update: (node, card) => updateCandidacyCard(node.firstElementChild, card, { selectable: true, selected: selection.has(card.id) }),
    });
    compare.update([...selection]);
    setHidden(more, !data?.nextCursor || area.status === "loading");
    const filtersActive = Boolean(route.params.search || route.params.party || route.params.officialStatus);
    const contestsMissing = snapshot.contests.status === "empty" || (snapshot.contests.status === "ready" && contests.length === 0);
    const emptyText = contestsMissing
      ? `Nenhuma disputa publicada para ${jurisdictionLabel(resolved.jurisdiction)} até agora.`
      : filtersActive
        ? "Nenhuma candidatura publicada combina com esses filtros. Limpe um filtro para ampliar."
        : summary?.state === "partial" || summary?.state === "unreconciled"
          ? "Nenhuma candidatura publicada ainda neste recorte; o denominador oficial aparece acima."
          : "Nenhuma candidatura publicada para esta disputa.";
    const visibleStatus = snapshot.contests.status === "error" ? "error" : contestsMissing ? "empty" : area.status;
    const visibleError = snapshot.contests.status === "error" ? snapshot.contests.error : area.status === "error" ? area.error : null;
    state.update({
      status: visibleStatus,
      error: visibleError,
      emptyText,
      loadingText: "Carregando candidaturas…",
      notices: [
        ...noticesFor({ area, route, model: { coverageSummary: summary, freshness: freshnessModel(data?.freshness, { fetchedAt: area.fetchedAt, stale: area.stale, now: ctx.now }) } }),
        ...syntheticNotice(bundle),
      ],
      now: ctx.now,
    });
    screen.setBusy(area.status === "loading" || snapshot.contests.status === "loading");
  };
  const unmount = screen.unmount;
  screen.unmount = () => { state.destroy(); unmount(); };
  return screen;
}

/* ------------------------------------------------------------------ Ficha */
export function createCandidacyScreen(ctx) {
  const screen = baseScreen("candidacy", { eyebrow: "Conheça seu candidato", title: "Candidatura", lead: "" });
  const state = createStatePanel({ area: "candidacy", onRetry: () => ctx.actions.retry("candidacy"), onBack: () => ctx.actions.back(), backLabel: "Voltar" });
  const content = el("div", { class: "civic-profile" });
  const actions = actionRow(
    button("Voltar à lista", { secondary: true, action: "back-to-directory", onClick: () => ctx.actions.navigate({ kind: "directory", params: lastDirectoryParams }) }),
    button("Voltar ao jogo", { secondary: true, action: "back", onClick: () => ctx.actions.back() }),
  );
  screen.root.append(state.root, content, actions);
  let rendered = { id: null, revision: null, stale: null };
  let lastDirectoryParams = {};

  function renderProfile(data, bundle, snapshot) {
    const card = candidacyCardModel(data.candidacy, bundle);
    const tickets = ticketModels(data.candidacy, bundle, { now: ctx.now });
    const claims = claimModels(data.candidacy, bundle);
    const history = historyModel(data.history);
    lastDirectoryParams = card.contest ? { contestId: card.contest.id, uf: card.contest.jurisdiction } : {};
    setText(screen.header.lead, card.contest ? card.contest.label : "");
    setHidden(screen.header.lead, !card.contest);
    const top = el("div", { class: "civic-profile-top" },
      photoFigure(card.photo, { initials: card.initials, name: card.name, size: "profile" }),
      el("div", {},
        el("h2", {}, card.name),
        el("p", {}, `Número ${card.number} · ${card.partyLabel}`),
        card.personName && card.personName !== card.name ? el("p", {}, `Nome civil registrado: ${card.personName}`) : null,
        officialStatusBadge(card),
        el("p", { class: "civic-claim-source" }, sourceChip(card.source)),
      ),
    );
    const ticketBlock = el("section", { class: "civic-section", "aria-labelledby": "civic-ticket-heading" },
      el("h3", { id: "civic-ticket-heading" }, card.contest?.office === "senator" ? "Chapa: titular e suplentes" : "Chapa: titular e vice"),
      tickets.length ? tickets.map(ticketSection) : el("p", { class: "civic-section-note" }, "Composição da chapa não informada pela fonte oficial até agora."),
    );
    const claimBlock = el("section", { class: "civic-section", "aria-labelledby": "civic-claims-heading" },
      el("h3", { id: "civic-claims-heading" }, "Afirmações e propostas publicadas"),
      el("p", { class: "civic-section-note" }, "Cada afirmação traz fonte e localizador. Propostas são declarações de campanha; registros e fatos documentados vêm de fontes oficiais."),
      claims.items.length ? el("ul", { class: "civic-claims" }, claims.items.map(claimItem)) : el("p", { class: "civic-section-note" }, "Nenhuma afirmação publicada e revisada para esta candidatura."),
      claims.pendingCount ? el("p", { class: "civic-section-note" }, `${claims.pendingCount} ${claims.pendingCount === 1 ? "afirmação aguarda" : "afirmações aguardam"} revisão e não ${claims.pendingCount === 1 ? "é exibida" : "são exibidas"}.`) : null,
    );
    const publishing = card.publishing;
    const historyBlock = el("section", { class: "civic-section", "aria-labelledby": "civic-history-heading" },
      el("h3", { id: "civic-history-heading" }, "Publicação e revisão"),
      el("p", { class: "civic-section-note" }, `Revisão ${publishing.revision} · ${publishing.publicationLabel} · atualizado em ${publishing.updatedAtLabel}`),
      history.entries.length ? el("ul", { class: "civic-history" }, history.entries.map((entry) => el("li", {}, `${entry.actionLabel} · revisão ${entry.revision} · ${entry.atLabel} · ${entry.reason}`))) : el("p", { class: "civic-section-note" }, "Sem histórico público de correções."),
    );
    replaceChildren(content, top, ticketBlock, claimBlock, historyBlock);
    return { card, claims, history, contest: snapshot.contests.data };
  }

  screen.update = ({ route, state: snapshot }) => {
    const area = snapshot.candidacy;
    const data = area.data;
    const bundle = bundleFrom(data);
    let model = {};
    if (data?.candidacy) {
      const signature = { id: data.candidacy.id, revision: data.candidacy.revision, stale: area.stale };
      if (signature.id !== rendered.id || signature.revision !== rendered.revision) {
        rendered = signature;
        model = renderProfile(data, bundle, snapshot);
      } else {
        model = { card: candidacyCardModel(data.candidacy, bundle), claims: claimModels(data.candidacy, bundle), history: historyModel(data.history) };
      }
    } else if (area.status !== "loading") {
      rendered = { id: null, revision: null, stale: null };
      content.replaceChildren();
      setHidden(screen.header.lead, true);
    }
    setHidden(content, !data?.candidacy);
    state.update({
      status: area.status,
      error: area.error,
      emptyText: "Candidatura não encontrada neste recorte.",
      loadingText: "Carregando candidatura…",
      notices: [
        ...noticesFor({ area, route, model: { history: model.history, pendingCount: model.claims?.pendingCount ?? 0, withdrawnCount: model.claims?.withdrawnCount ?? 0, freshness: freshnessModel(data?.freshness, { fetchedAt: area.fetchedAt, stale: area.stale, now: ctx.now }) } }),
        ...syntheticNotice(bundle),
      ],
      now: ctx.now,
    });
    screen.setBusy(area.status === "loading");
  };
  const unmount = screen.unmount;
  screen.unmount = () => { state.destroy(); unmount(); };
  return screen;
}

/* ------------------------------------------------------------------ Comparação */
export function createComparisonScreen(ctx) {
  const screen = baseScreen("comparison", {
    eyebrow: "Conheça seu candidato",
    title: "Comparar candidaturas",
    lead: "Mesmos temas, na mesma ordem, para cada candidatura. Tema sem afirmação publicada aparece como lacuna, nunca preenchido.",
  });
  const state = createStatePanel({ area: "comparison", onRetry: () => ctx.actions.retry("comparison"), onBack: () => ctx.actions.navigate({ kind: "directory", params: {} }), backLabel: "Escolher candidaturas" });
  const grid = el("div", { class: "civic-compare-grid" });
  const actions = actionRow(
    button("Escolher outras", { secondary: true, action: "back-to-directory", onClick: () => ctx.actions.navigate({ kind: "directory", params: lastDirectoryParams }) }),
    button("Voltar ao jogo", { secondary: true, action: "back", onClick: () => ctx.actions.back() }),
  );
  screen.root.append(state.root, grid, actions);
  let renderedKey = null;
  let lastDirectoryParams = {};

  function renderGrid(model) {
    const columns = model.columns;
    const contest = columns[0]?.card.contest;
    lastDirectoryParams = contest ? { contestId: contest.id, uf: contest.jurisdiction } : {};
    grid.style.setProperty("--civic-columns", String(columns.length));
    const header = el("div", { class: "civic-compare-columns", dataset: { columns: String(columns.length) } }, columns.map((column) => el("div", { class: "civic-compare-cell" },
      candidacyCard(column.card, { selectable: false }),
      column.tickets.filter((ticket) => ticket.current).slice(0, 1).map(ticketSection),
    )));
    const rows = model.rows.length
      ? model.rows.map((row) => el("section", { class: "civic-compare-theme" },
        el("h3", {}, row.theme),
        el("div", { class: "civic-compare-columns", dataset: { columns: String(columns.length) } }, row.cells.map((cell) => el("div", { class: "civic-compare-cell" },
          cell.empty ? el("p", { class: "civic-compare-empty" }, cell.emptyLabel) : el("ul", { class: "civic-claims" }, cell.claims.map(claimItem)),
        ))),
      ))
      : [el("p", { class: "civic-section-note" }, "Nenhuma das candidaturas tem afirmação publicada; não há tema para comparar ainda.")];
    replaceChildren(grid, header, ...rows);
  }

  screen.update = ({ route, state: snapshot }) => {
    const area = snapshot.comparison;
    const ids = route.params.ids ?? [];
    const invalid = ids.length < 2 || ids.length > 3;
    if (invalid) {
      renderedKey = null;
      grid.replaceChildren();
      state.update({
        status: "error",
        error: { kind: "invalid", message: "Escolha entre duas e três candidaturas publicadas da mesma disputa para comparar." },
        notices: noticesFor({ route }),
        now: ctx.now,
      });
      screen.setBusy(false);
      return;
    }
    const data = area.data;
    const bundle = bundleFrom(data);
    let model = null;
    if (data) {
      model = comparisonModel(ids, bundle);
      const key = JSON.stringify([ids, area.revision]);
      if (key !== renderedKey) {
        renderedKey = key;
        renderGrid(model);
      }
    } else {
      renderedKey = null;
      grid.replaceChildren();
    }
    setHidden(grid, !data);
    state.update({
      status: area.status,
      error: area.error,
      emptyText: "Nenhuma candidatura publicada para comparar.",
      loadingText: "Carregando comparação…",
      notices: [
        ...noticesFor({ area, route, model: { freshness: freshnessModel(data?.freshness, { fetchedAt: area.fetchedAt, stale: area.stale, now: ctx.now }) } }),
        ...(model && !model.compatible ? [notice("warning", "Uma das candidaturas não está publicada neste recorte; a comparação mostra só as disponíveis.", { key: "incompatible" })] : []),
        ...syntheticNotice(bundle),
      ],
      now: ctx.now,
    });
    screen.setBusy(area.status === "loading");
  };
  const unmount = screen.unmount;
  screen.unmount = () => { state.destroy(); unmount(); };
  return screen;
}

/* ------------------------------------------------------------------ Edição (Notícias) */
export function createEditionScreen(ctx, kind = "news") {
  const screen = baseScreen(kind, {
    eyebrow: "Notícias diárias",
    title: kind === "news" ? "Notícias" : "Edição de notícias",
    lead: "Cada acontecimento mostra três espaços de cobertura: à direita, à esquerda e internacional. Espaço vazio aparece com o motivo; internacional não é selo de neutralidade.",
  });
  const jurisdiction = el("select", { id: "civic-news-uf", "aria-label": "Recorte das notícias", dataset: { civicFilter: "uf" } },
    JURISDICTION_OPTIONS.map((option) => el("option", { value: option.value }, option.label)));
  jurisdiction.addEventListener("change", () => ctx.actions.setNewsJurisdiction(jurisdiction.value));
  const toolbar = el("div", { class: "civic-toolbar" }, el("label", { for: jurisdiction.id, class: "civic-field" }, el("span", { class: "eyebrow civic-eyebrow" }, "Recorte"), jurisdiction));
  const meta = el("p", { class: "civic-lead" });
  const state = createStatePanel({ area: "edition", onRetry: () => ctx.actions.retry("edition"), onBack: () => ctx.actions.back(), backLabel: "Voltar ao jogo" });
  const list = el("ul", { class: "civic-events", "aria-label": "Acontecimentos da edição" });
  const footer = el("p", { class: "civic-footer-note" }, "Orientação editorial, país da redação e tipo de conteúdo são dimensões distintas. Republicação e tradução não confirmam um fato de forma independente.");
  screen.root.append(kind === "news" ? toolbar : null, meta, state.root, list, footer);

  screen.update = ({ route, state: snapshot, resolved }) => {
    const area = snapshot.edition;
    if (jurisdiction.value !== resolved.jurisdiction) jurisdiction.value = resolved.jurisdiction;
    const data = area.data;
    const bundle = bundleFrom(data);
    const model = data?.edition ? editionModel(data.edition, bundle) : null;
    setText(meta, model ? `${model.dateLabel} · ${model.jurisdictionLabel} · ${model.items.length} ${model.items.length === 1 ? "acontecimento" : "acontecimentos"}` : "");
    setHidden(meta, !model);
    reconcileList(list, model?.items ?? [], {
      key: (item) => item.id,
      create: (item) => el("li", {}, eventCard(item.event)),
      update: (node, item) => {
        const current = node.firstElementChild;
        if (current?.dataset.eventId !== item.event.id) node.replaceChildren(eventCard(item.event));
      },
    });
    state.update({
      status: area.status,
      error: area.error,
      emptyText: `Nenhuma edição publicada para ${jurisdictionLabel(resolved.jurisdiction)} hoje. Quando houver, os três espaços de cada acontecimento aparecem aqui, inclusive os vazios.`,
      loadingText: "Carregando edição…",
      notices: [
        ...noticesFor({ area, route, model: { history: historyModel(data?.history ?? []), freshness: freshnessModel(data?.freshness, { fetchedAt: area.fetchedAt, stale: area.stale, now: ctx.now }) } }),
        ...syntheticNotice(bundle),
      ],
      now: ctx.now,
    });
    screen.setBusy(area.status === "loading");
  };
  const unmount = screen.unmount;
  screen.unmount = () => { state.destroy(); unmount(); };
  return screen;
}

/* ------------------------------------------------------------------ Acontecimento */
export function createEventScreen(ctx) {
  const screen = baseScreen("event", { eyebrow: "Notícias diárias", title: "Acontecimento", lead: "" });
  const state = createStatePanel({ area: "event", onRetry: () => ctx.actions.retry("event"), onBack: () => ctx.actions.navigate({ kind: "news", params: {} }), backLabel: "Voltar às notícias" });
  const content = el("div", { class: "civic-profile" });
  const actions = actionRow(
    button("Voltar às notícias", { secondary: true, action: "back-to-news", onClick: () => ctx.actions.navigate({ kind: "news", params: lastNewsParams }) }),
    button("Voltar ao jogo", { secondary: true, action: "back", onClick: () => ctx.actions.back() }),
  );
  screen.root.append(state.root, content, actions);
  let renderedKey = null;
  let lastNewsParams = {};

  function render(model) {
    lastNewsParams = model.jurisdiction ? { uf: model.jurisdiction } : {};
    setText(screen.header.lead, `${model.theme} · ${model.jurisdictionLabel} · ${model.startsAtLabel}${model.endsAtLabel !== model.startsAtLabel ? ` a ${model.endsAtLabel}` : ""}`);
    setHidden(screen.header.lead, false);
    replaceChildren(content,
      el("div", { class: "civic-profile-top", style: "grid-template-columns: 1fr" }, el("div", {}, el("h2", {}, model.title), el("p", {}, model.summary), el("p", { class: "civic-claim-source" }, sourceChip(model.source)))),
      el("section", { class: "civic-section", "aria-labelledby": "civic-slots-heading" },
        el("h3", { id: "civic-slots-heading" }, "Três espaços de cobertura"),
        el("p", { class: "civic-section-note" }, "Cada espaço registra o que foi encontrado, com versão da classificação e motivo de lacuna quando não há matéria."),
        el("div", { class: "civic-slots" }, model.coverage.map(coverageCard)),
      ),
      el("section", { class: "civic-section", "aria-labelledby": "civic-event-history-heading" },
        el("h3", { id: "civic-event-history-heading" }, "Publicação e revisão"),
        el("p", { class: "civic-section-note" }, `Revisão ${model.publishing.revision} · ${model.publishing.publicationLabel} · atualizado em ${model.publishing.updatedAtLabel}`),
      ),
    );
  }

  screen.update = ({ route, state: snapshot }) => {
    const area = snapshot.event;
    const data = area.data;
    const bundle = bundleFrom(data);
    const model = data?.event ? eventModel(data.event, bundle) : null;
    const history = historyModel(data?.history ?? []);
    if (model) {
      const key = JSON.stringify([model.id, model.publishing.revision]);
      if (key !== renderedKey) {
        renderedKey = key;
        render(model);
      }
    } else if (area.status !== "loading") {
      renderedKey = null;
      content.replaceChildren();
      setHidden(screen.header.lead, true);
    }
    setHidden(content, !model);
    state.update({
      status: area.status,
      error: area.error,
      emptyText: "Acontecimento não encontrado.",
      loadingText: "Carregando acontecimento…",
      notices: [
        ...noticesFor({ area, route, model: { history, freshness: freshnessModel(data?.freshness, { fetchedAt: area.fetchedAt, stale: area.stale, now: ctx.now }) } }),
        ...(model?.coverage.some((slot) => slot.state === "pending" || slot.state === "contested") ? [notice("pending", "Pelo menos um espaço tem classificação pendente ou contestada; a matéria não é exibida até a revisão.", { key: "slot-pending" })] : []),
        ...syntheticNotice(bundle),
      ],
      now: ctx.now,
    });
    screen.setBusy(area.status === "loading");
  };
  const unmount = screen.unmount;
  screen.unmount = () => { state.destroy(); unmount(); };
  return screen;
}

/* ------------------------------------------------------------------ Destino inexistente / área desligada */
export function createNotFoundScreen(ctx) {
  const screen = baseScreen("not-found", { eyebrow: "Endereço", title: "Destino não encontrado", lead: "Este endereço não corresponde a nenhuma tela de Candidatos ou Notícias." });
  const requested = el("p", { class: "civic-section-note" });
  const links = el("p", { class: "civic-actions" });
  screen.root.append(requested, links, actionRow(button("Voltar ao jogo", { secondary: true, action: "back", onClick: () => ctx.actions.back() })));
  screen.update = ({ route }) => {
    setText(requested, route.params.requested ? `Endereço pedido: #/${route.params.requested}` : "");
    setHidden(requested, !route.params.requested);
    replaceChildren(links,
      ctx.flags().directory ? internalLink(civicHref({ kind: "directory", params: {} }), "Ir para Candidatos") : null,
      ctx.flags().news ? internalLink(civicHref({ kind: "news", params: {} }), "Ir para Notícias") : null,
    );
  };
  return screen;
}

export function createAreaDisabledScreen(ctx) {
  const screen = baseScreen("area-disabled", { eyebrow: "Área indisponível", title: "Esta área ainda não está aberta", lead: "Candidatos e Notícias serão liberados por etapas, depois da validação humana. O jogo continua disponível." });
  screen.root.append(actionRow(button("Voltar ao jogo", { secondary: true, action: "back", onClick: () => ctx.actions.back() })));
  screen.update = () => {};
  return screen;
}

export function createScreen(kind, ctx) {
  switch (kind) {
    case "directory": return createDirectoryScreen(ctx);
    case "candidacy": return createCandidacyScreen(ctx);
    case "comparison": return createComparisonScreen(ctx);
    case "news": return createEditionScreen(ctx, "news");
    case "edition": return createEditionScreen(ctx, "edition");
    case "event": return createEventScreen(ctx);
    case "area-disabled": return createAreaDisabledScreen(ctx);
    default: return createNotFoundScreen(ctx);
  }
}
