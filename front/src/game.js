import FALLBACK_CANDIDATES from "../../shared/candidates.json";
import { applyElo } from "../../shared/elo.js";
import { fetchCandidates, fetchHealth, fetchServerRanking, postVote } from "./api.js";
import { applyCardAriaLabel } from "./card-label.js";
import { fillDuelCard } from "./duel-card.js";
import { hpFillWidth } from "./hp-bar.js";
import { runLockedPick } from "./pick.js";
import { preloadPhotos } from "./photos.js";
import { RANKING_SUBTITLE, sortCandidatesByRank } from "./ranking.js";
import { saveState, STORAGE_KEY, STORAGE_UNAVAILABLE_MESSAGE } from "./storage.js";

const ELO_START = 1000;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function defaultState(candidates) {
  const ratings = {};
  const wins = {};
  const losses = {};
  candidates.forEach((c) => {
    ratings[c.id] = ELO_START;
    wins[c.id] = 0;
    losses[c.id] = 0;
  });
  return { ratings, wins, losses, duels: 0, lastPair: null };
}

function loadState(candidates) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState(candidates);
    const parsed = JSON.parse(raw);
    const base = defaultState(candidates);
    return {
      ratings: { ...base.ratings, ...(parsed.ratings || {}) },
      wins: { ...base.wins, ...(parsed.wins || {}) },
      losses: { ...base.losses, ...(parsed.losses || {}) },
      duels: parsed.duels || 0,
      lastPair: parsed.lastPair || null,
    };
  } catch {
    return defaultState(candidates);
  }
}

function randomPair(candidates, state) {
  const ids = candidates.map((c) => c.id);
  let a;
  let b;
  let tries = 0;
  do {
    a = ids[Math.floor(Math.random() * ids.length)];
    b = ids[Math.floor(Math.random() * ids.length)];
    tries += 1;
  } while (
    (a === b ||
      (state.lastPair &&
        ((state.lastPair[0] === a && state.lastPair[1] === b) ||
          (state.lastPair[0] === b && state.lastPair[1] === a)))) &&
    tries < 40
  );
  if (a === b) {
    b = ids[(ids.indexOf(a) + 1) % ids.length];
  }
  return [a, b];
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

      <footer>
        Fotos de fontes públicas (Wikimedia Commons e similares) — veja <a href="/CREDITS.md">CREDITS.md</a>.
        · <a href="https://github.com/stefancabral-oss/presidencia-duelo">Repositório</a>
      </footer>
    </div>
  `;
}

function renderRankItems(candidates, byId, getStats) {
  const ranked = sortCandidatesByRank(candidates, getStats);

  return ranked
    .map((c, i) => {
      const { elo, wins, losses, wr } = getStats(c.id);
      return `
        <li class="rank-item">
          <div class="rank-pos">${i + 1}º</div>
          <img src="${escapeHtml(c.photo)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';" />
          <div class="rank-ph" style="display:none">${escapeHtml(c.initials)}</div>
          <div>
            <div class="rank-name">${escapeHtml(c.name)}</div>
            <div class="rank-meta">${escapeHtml(c.party)} · vice ${escapeHtml(c.vice)} · ${wins}V / ${losses}D</div>
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
    tabDuel: document.getElementById("tab-duel"),
    tabRank: document.getElementById("tab-rank"),
    duelCount: document.getElementById("duel-count"),
    cardA: document.getElementById("card-a"),
    cardB: document.getElementById("card-b"),
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

  function setTab(name) {
    const duel = name === "duel";
    els.panelDuel.classList.toggle("active", duel);
    els.panelRank.classList.toggle("active", !duel);
    els.tabDuel.classList.toggle("active", duel);
    els.tabRank.classList.toggle("active", !duel);
    if (!duel) {
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
    el.classList.remove("picked-win", "picked-lose");
    applyCardAriaLabel(el, c);
    fillDuelCard(el, c, { elo, wr, barWidth });
  }

  function nextDuel() {
    locked = false;
    currentPair = randomPair(candidates, state);
    state.lastPair = currentPair;
    persist();
    renderCard(els.cardA, currentPair[0]);
    renderCard(els.cardB, currentPair[1]);
    els.duelCount.textContent = String(state.duels);
  }

  function pick(winnerEl) {
    if (locked || !currentPair) return;
    locked = true;
    runLockedPick(() => {
      const winnerId = winnerEl.dataset.id;
      const loserId = currentPair[0] === winnerId ? currentPair[1] : currentPair[0];
      const loserEl = winnerEl === els.cardA ? els.cardB : els.cardA;

      applyElo(state, winnerId, loserId);
      persist();

      if (apiOnline) {
        postVote(winnerId, loserId).catch(() => {
          apiOnline = false;
          statusEl.textContent = "Modo local — falha ao enviar voto; o ranking deste aparelho segue intacto";
          statusEl.classList.remove("online");
          statusEl.classList.add("offline");
        });
      }

      winnerEl.classList.add("picked-win");
      loserEl.classList.add("picked-lose");
      els.duelCount.textContent = String(state.duels);
    }, nextDuel);
  }

  function renderRanking() {
    els.rankList.innerHTML = renderRankItems(candidates, byId, (id) => ({
      elo: state.ratings[id],
      wins: state.wins[id] || 0,
      losses: state.losses[id] || 0,
      wr: winRate(state, id),
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
        const row = stats[id] || { elo: ELO_START, wins: 0, losses: 0, winRate: 0 };
        return {
          elo: row.elo,
          wins: row.wins || 0,
          losses: row.losses || 0,
          wr: row.winRate ?? 0,
        };
      });
      els.serverWrap.hidden = false;
    } catch {
      els.serverWrap.hidden = true;
    }
  }

  els.tabDuel.addEventListener("click", () => setTab("duel"));
  els.tabRank.addEventListener("click", () => setTab("rank"));
  els.cardA.addEventListener("click", () => pick(els.cardA));
  els.cardB.addEventListener("click", () => pick(els.cardB));
  els.cardA.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(els.cardA);
    }
  });
  els.cardB.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(els.cardB);
    }
  });

  els.resetBtn.addEventListener("click", () => {
    if (!confirm("Zerar ranking e duelos salvos neste aparelho?")) return;
    state = defaultState(candidates);
    persist();
    nextDuel();
    renderRanking();
  });

  nextDuel();
}
