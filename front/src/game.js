import FALLBACK_CANDIDATES from "../../shared/candidates.json";
import { applyElo, emptyStats, mergeStats } from "../../shared/elo.js";
import { fetchCandidates, fetchHealth, fetchServerRanking, postVote } from "./api.js";
import { applyCardAriaLabel } from "./card-label.js";
import { GITHUB_README_URL, GITHUB_REPO_URL, creditsPanelHtml } from "./credits.js";
import { fillDuelCard } from "./duel-card.js";
import { hpFillWidth } from "./hp-bar.js";
import { applyPickFeedback, clearPickFeedback } from "./pick-feedback.js";
import { runLockedPick } from "./pick.js";
import { preloadPhotos } from "./photos.js";
import { RANKING_SUBTITLE, rankMetaText, sortCandidatesByRank } from "./ranking.js";
import { normalizePairCount, takeNextPair } from "./matchmaking.js";
import { saveState, STORAGE_KEY, STORAGE_UNAVAILABLE_MESSAGE } from "./storage.js";
import { lastDuelFromParsed, restoreDuel, snapshotDuel, undoPair } from "./undo.js";

const ELO_START = 1000;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function defaultState(candidates) {
  return { ...emptyStats(candidates.map((c) => c.id)), lastPair: null, lastDuel: null, pairCount: {} };
}

function loadState(candidates) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState(candidates);
    const parsed = JSON.parse(raw);
    return {
      ...mergeStats(defaultState(candidates), parsed),
      lastPair: parsed.lastPair || null,
      lastDuel: lastDuelFromParsed(parsed),
      pairCount: normalizePairCount(parsed.pairCount),
    };
  } catch {
    return defaultState(candidates);
  }
}

function winRate(state, id) {
  const w = state.wins[id] || 0;
  const l = state.losses[id] || 0;
  const t = w + l;
  if (!t) return 0;
  return Math.round((100 * w) / t);
}

function renderShell(root) {
  root.innerHTML = `
    <div class="app">
      <header>
        <div class="logo">
          <div class="logo-badge" aria-hidden="true">PD</div>
          <h1>Presidência Duelo</h1>
        </div>
        <p class="subtitle">Escolha um card. Próximo duelo aleatório. Ranking Elo no seu aparelho.</p>
        <p class="api-status" id="api-status">Conectando à API…</p>
        <p class="storage-notice" id="storage-notice" hidden>${STORAGE_UNAVAILABLE_MESSAGE}</p>
      </header>

      <aside class="disclaimer" role="note">
        <strong>Aviso:</strong> isto <em>não</em> é uma pesquisa eleitoral oficial, nem reflete intenção de voto real.
        É um jogo casual (estilo Facemash) com ranking salvo no seu navegador (<code>localStorage</code>).
        Se a API estiver no ar, os votos também entram num ranking agregado no servidor.
        Candidaturas e vices listados para fins recreativos; verifique fontes oficiais do TSE.
      </aside>

      <nav class="tabs" aria-label="Seções">
        <button type="button" class="tab active" id="tab-duel">Duelo</button>
        <button type="button" class="tab" id="tab-rank">Ranking</button>
        <button type="button" class="tab" id="tab-credits">Créditos</button>
      </nav>

      <section id="panel-duel" class="panel active" aria-label="Duelo">
        <div class="duel-stats">
          <span>Toque no candidato preferido</span>
          <span>Duelos: <strong id="duel-count">0</strong></span>
        </div>

        <div class="vs-row">
          <button type="button" class="poke-card" id="card-a"></button>
          <div class="vs-badge" aria-hidden="true">VS</div>
          <button type="button" class="poke-card" id="card-b"></button>
        </div>

        <div class="duel-actions">
          <button type="button" class="btn" id="undo-duel" disabled>Desfazer</button>
        </div>

        <p class="hint">Cards inspirados em cromos/Pokémon · fotos reais (Wikimedia) · funciona offline após o cache</p>
      </section>

      <section id="panel-rank" class="panel" aria-label="Ranking">
        <div class="ranking-toolbar">
          <div>
            <strong>Ranking Elo local</strong>
            <div class="rank-sub">${RANKING_SUBTITLE}</div>
          </div>
          <button type="button" class="btn danger" id="reset-ranking">Zerar ranking</button>
        </div>
        <ol class="rank-list" id="rank-list"></ol>
        <div id="server-rank-wrap" hidden>
          <h2 class="server-rank-title">Ranking agregado do servidor</h2>
          <p class="rank-sub">Soma dos votos enviados à API (compartilhado). O jogo local continua independente.</p>
          <ol class="rank-list" id="server-rank-list"></ol>
        </div>
      </section>

      <section id="panel-credits" class="panel" aria-label="Créditos">
        ${creditsPanelHtml()}
      </section>

      <footer>
        Fotos de fontes públicas (Wikimedia Commons e similares) —
        <button type="button" class="footer-link" id="open-credits">Créditos</button>.
        · <a href="${GITHUB_README_URL}">README</a>
        · <a href="${GITHUB_REPO_URL}">Repositório</a>
      </footer>
    </div>
  `;
}

function renderRankItems(candidates, byId, getStats) {
  const ranked = sortCandidatesByRank(candidates, getStats);

  return ranked
    .map((c, i) => {
      const { elo, wins, losses, wr, zebras = 0 } = getStats(c.id);
      return `
        <li class="rank-item">
          <div class="rank-pos">${i + 1}º</div>
          <img src="${escapeHtml(c.photo)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';" />
          <div class="rank-ph" style="display:none">${escapeHtml(c.initials)}</div>
          <div>
            <div class="rank-name">${escapeHtml(c.name)}</div>
            <div class="rank-meta">${escapeHtml(rankMetaText({ party: c.party, vice: c.vice, wins, losses, zebras }))}</div>
          </div>
          <div class="rank-score">${elo}<small>${wr}% vitórias</small></div>
        </li>`;
    })
    .join("");
}

export async function initGame() {
  const root = document.getElementById("app");
  renderShell(root);

  const statusEl = document.getElementById("api-status");
  let candidates = FALLBACK_CANDIDATES;
  let apiOnline = false;

  try {
    const [list] = await Promise.all([fetchCandidates(), fetchHealth()]);
    candidates = list;
    apiOnline = true;
    statusEl.textContent = "API online — votos locais + ranking agregado";
    statusEl.classList.add("online");
  } catch {
    statusEl.textContent = "Modo local — API indisponível; ranking só neste aparelho (localStorage)";
    statusEl.classList.add("offline");
  }

  const byId = Object.fromEntries(candidates.map((c) => [c.id, c]));
  preloadPhotos(candidates);
  const els = {
    panelDuel: document.getElementById("panel-duel"),
    panelRank: document.getElementById("panel-rank"),
    panelCredits: document.getElementById("panel-credits"),
    tabDuel: document.getElementById("tab-duel"),
    tabRank: document.getElementById("tab-rank"),
    tabCredits: document.getElementById("tab-credits"),
    openCredits: document.getElementById("open-credits"),
    duelCount: document.getElementById("duel-count"),
    cardA: document.getElementById("card-a"),
    cardB: document.getElementById("card-b"),
    undoBtn: document.getElementById("undo-duel"),
    rankList: document.getElementById("rank-list"),
    resetBtn: document.getElementById("reset-ranking"),
    serverWrap: document.getElementById("server-rank-wrap"),
    serverList: document.getElementById("server-rank-list"),
    storageNotice: document.getElementById("storage-notice"),
  };

  function persist() {
    if (saveState(state)) return;
    if (els.storageNotice) els.storageNotice.hidden = false;
  }

  let state = loadState(candidates);
  let currentPair = null;
  let locked = false;
  let pickTimer = null;

  function cancelPickTimer() {
    if (pickTimer == null) return;
    clearTimeout(pickTimer);
    pickTimer = null;
  }

  function syncUndoButton() {
    if (!els.undoBtn) return;
    els.undoBtn.disabled = !state.lastDuel;
  }

  function setTab(name) {
    const tabs = [
      ["duel", els.panelDuel, els.tabDuel],
      ["rank", els.panelRank, els.tabRank],
      ["credits", els.panelCredits, els.tabCredits],
    ];
    for (const [id, panel, tab] of tabs) {
      const on = id === name;
      panel.classList.toggle("active", on);
      tab.classList.toggle("active", on);
    }
    if (name === "rank") {
      renderRanking();
      renderServerRanking();
    }
  }

  function renderCard(el, id) {
    const c = byId[id];
    const elo = state.ratings[id];
    const wins = state.wins[id] || 0;
    const losses = state.losses[id] || 0;
    const wr = winRate(state, id);
    const barWidth = hpFillWidth(wins, losses, wr);
    el.dataset.id = id;
    clearPickFeedback(el);
    applyCardAriaLabel(el, c);
    fillDuelCard(el, c, { elo, wr, barWidth });
  }

  function nextDuel() {
    locked = false;
    pickTimer = null;
    currentPair = takeNextPair(candidates, state);
    persist();
    renderCard(els.cardA, currentPair[0]);
    renderCard(els.cardB, currentPair[1]);
    els.duelCount.textContent = String(state.duels);
    syncUndoButton();
  }

  function pick(winnerEl) {
    if (locked || !currentPair) return;
    locked = true;
    pickTimer = runLockedPick(() => {
      const winnerId = winnerEl.dataset.id;
      const loserId = currentPair[0] === winnerId ? currentPair[1] : currentPair[0];
      const loserEl = winnerEl === els.cardA ? els.cardB : els.cardA;

      state.lastDuel = snapshotDuel(state, winnerId, loserId, currentPair);
      const { winnerDelta, loserDelta, zebra } = applyElo(state, winnerId, loserId);
      persist();
      syncUndoButton();

      if (apiOnline) {
        postVote(winnerId, loserId).catch(() => {
          apiOnline = false;
          statusEl.textContent = "Modo local — falha ao enviar voto; o ranking deste aparelho segue intacto";
          statusEl.classList.remove("online");
          statusEl.classList.add("offline");
        });
      }

      applyPickFeedback(winnerEl, loserEl, winnerDelta, loserDelta, { zebra });
      els.duelCount.textContent = String(state.duels);
    }, nextDuel);
  }

  function undoLastDuel() {
    const snap = state.lastDuel;
    if (!restoreDuel(state, snap)) return;
    cancelPickTimer();
    const pair = undoPair(snap);
    state.lastDuel = null;
    if (pair && byId[pair[0]] && byId[pair[1]]) {
      currentPair = pair;
      state.lastPair = pair;
    }
    persist();
    locked = false;
    clearPickFeedback(els.cardA);
    clearPickFeedback(els.cardB);
    if (currentPair) {
      renderCard(els.cardA, currentPair[0]);
      renderCard(els.cardB, currentPair[1]);
    }
    els.duelCount.textContent = String(state.duels);
    syncUndoButton();
  }

  function renderRanking() {
    els.rankList.innerHTML = renderRankItems(candidates, byId, (id) => ({
      elo: state.ratings[id],
      wins: state.wins[id] || 0,
      losses: state.losses[id] || 0,
      wr: winRate(state, id),
      zebras: state.zebras?.[id] || 0,
    }));
  }

  async function renderServerRanking() {
    if (!apiOnline) {
      els.serverWrap.hidden = true;
      return;
    }
    try {
      const data = await fetchServerRanking();
      const rows = data.ranking || [];
      if (!rows.length) {
        els.serverWrap.hidden = true;
        return;
      }
      const stats = Object.fromEntries(rows.map((r) => [r.id, r]));
      els.serverList.innerHTML = renderRankItems(candidates, byId, (id) => {
        const row = stats[id] || { elo: ELO_START, wins: 0, losses: 0, winRate: 0, zebras: 0 };
        return {
          elo: row.elo,
          wins: row.wins || 0,
          losses: row.losses || 0,
          wr: row.winRate ?? 0,
          zebras: row.zebras || 0,
        };
      });
      els.serverWrap.hidden = false;
    } catch {
      els.serverWrap.hidden = true;
    }
  }

  els.tabDuel.addEventListener("click", () => setTab("duel"));
  els.tabRank.addEventListener("click", () => setTab("rank"));
  els.tabCredits.addEventListener("click", () => setTab("credits"));
  els.openCredits.addEventListener("click", () => setTab("credits"));
  els.cardA.addEventListener("click", () => pick(els.cardA));
  els.cardB.addEventListener("click", () => pick(els.cardB));
  els.undoBtn.addEventListener("click", () => undoLastDuel());

  els.resetBtn.addEventListener("click", () => {
    if (!confirm("Zerar ranking e duelos salvos neste aparelho?")) return;
    cancelPickTimer();
    state = defaultState(candidates);
    persist();
    nextDuel();
    renderRanking();
  });

  nextDuel();
}
