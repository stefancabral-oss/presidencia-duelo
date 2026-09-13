import FALLBACK_CANDIDATES from "../../shared/candidates.json";
import { applyElo, emptyStats, mergeStats } from "../../shared/elo.js";
import {
  fetchCandidates,
  fetchHealth,
  fetchPlayerState,
  fetchServerRanking,
  isUnknownVoteConfirmation,
  postVote,
  createPlayer,
  replacePlayerState,
} from "./api.js";
import { applyCardAriaLabel } from "./card-label.js";
import { renderConnectionRequired } from "./connection-required.js";
import { GITHUB_README_URL, GITHUB_REPO_URL, creditsPanelHtml } from "./credits.js";
import { fillDuelCard } from "./duel-card.js";
import { hpFillWidth } from "./hp-bar.js";
import { applyPickFeedback, clearPickFeedback } from "./pick-feedback.js";
import { runLockedPick } from "./pick.js";
import { preloadPhotos } from "./photos.js";
import {
  hasSeenQuickControlsHint,
  keyboardPickSide,
  markQuickControlsHintSeen,
  swipePickSide,
} from "./quick-controls.js";
import {
  buildPodiumPngFile,
  formatPodiumShareText,
  podiumStandHtml,
  selectTopThree,
  shareOrCopyPodium,
  SHARE_TITLE,
} from "./podium.js";
import { RANKING_SUBTITLE, rankMetaText, sortCandidatesByRank } from "./ranking.js";
import { findLeaderId, rarityFor } from "./rarity.js";
import { commitPersonalReset } from "./ranking-reset.js";
import { normalizePairCount, takeNextPair } from "./matchmaking.js";
import { NETWORK_STATES, setNetworkStatus } from "./network-status.js";
import { commitOnlineVote } from "./online-vote.js";
import {
  applyServerPlayerState,
  initializePlayerSync,
  loadRecoveryKey,
  saveRecoveryKey,
} from "./player-sync.js";
import {
  INITIAL_GOAL,
  acceptGoal,
  celebrationLead,
  continueLabel,
  leaderLine,
  migrateProgress,
  progressPercent,
  remainingText,
  shouldCelebrate,
} from "./progress.js";
import {
  ACHIEVEMENT_IDS,
  achievementTitle,
  achievementToastText,
  applyCombo,
  comboLabel,
  liveCombo,
  migrateAchievements,
  normalizeAchievements,
  unlockDueAchievements,
  unlockTournamentCompleted,
} from "./achievements.js";
import { saveState, STORAGE_KEY, STORAGE_UNAVAILABLE_MESSAGE } from "./storage.js";
import {
  TOURNAMENT_STORAGE_KEY,
  completedTournamentDuels,
  createTournament,
  currentTournamentMatch,
  formatTournamentShareText,
  isValidTournament,
  tournamentPick,
} from "./tournament.js";
import { createTournamentPickLock } from "./tournament-pick-lock.js";
import { MODES, VICE_STORAGE_KEY, candidateForMode } from "./vice-mode.js";
import { createVoteId } from "./vote-id.js";
import { captureVoteSession, isCurrentVoteSession } from "./vote-session.js";
import {
  TOPICS,
  TOPIC_IDS,
  candidatesForTopic,
  pairAllowedForTopic,
  topicById,
} from "../../shared/topics.js";

const ELO_START = 1000;
const TOPIC_STORAGE_KEY = "presidencia-duelo-topic-v1";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function defaultState(candidates) {
  return {
    ...emptyStats(candidates.map((c) => c.id)),
    lastPair: null,
    pairCount: {},
    progressGoal: INITIAL_GOAL,
    celebratedGoal: null,
    achievements: [],
    combo: 0,
    lastVoteAt: null,
  };
}

function loadState(candidates, storageKey = STORAGE_KEY) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaultState(candidates);
    const parsed = JSON.parse(raw);
    const merged = mergeStats(defaultState(candidates), parsed);
    const pairCount = normalizePairCount(parsed.pairCount);
    return {
      ...merged,
      lastPair: parsed.lastPair || null,
      pairCount: normalizePairCount(parsed.pairCount),
      ...migrateProgress(parsed, merged.duels),
      ...migrateAchievements(parsed, {
        duels: merged.duels,
        zebras: merged.zebras,
        pairCount,
        candidateIds: candidates.map((c) => c.id),
      }),
    };
  } catch {
    return defaultState(candidates);
  }
}

function loadTopic() {
  try {
    return topicById(localStorage.getItem(TOPIC_STORAGE_KEY)).id;
  } catch {
    return TOPIC_IDS.POLITICS;
  }
}

function saveTopic(topicId) {
  try {
    localStorage.setItem(TOPIC_STORAGE_KEY, topicId);
  } catch {
    // Topic selection still works in memory when storage is unavailable.
  }
}

function winRate(state, id) {
  const w = state.wins[id] || 0;
  const l = state.losses[id] || 0;
  const t = w + l;
  if (!t) return 0;
  return Math.round((100 * w) / t);
}

function renderShell(root, { requireApi = false } = {}) {
  root.innerHTML = `
    <div class="app">
      <header>
        <div class="logo">
          <div class="logo-badge" aria-hidden="true">PD</div>
          <h1>Presidência Duelo</h1>
        </div>
        <p class="subtitle">Escolha um card. Próximo duelo aleatório. Ranking Elo no seu aparelho.</p>
        <p class="api-status pending" id="api-status" role="status" aria-live="polite">Conectando à API…</p>
        <p class="storage-notice" id="storage-notice" hidden>${STORAGE_UNAVAILABLE_MESSAGE}</p>
      </header>

      <aside class="disclaimer" role="note">
        <strong>Aviso:</strong> isto <em>não</em> é uma pesquisa eleitoral oficial, nem reflete intenção de voto real.
        É um jogo casual (estilo Facemash) com ranking salvo no seu navegador (<code>localStorage</code>).
        Se a API estiver no ar, os votos também entram num ranking agregado no servidor.
        Pessoas listadas para fins recreativos; informações complementares serão adicionadas com fontes.
      </aside>

      <nav class="tabs" aria-label="Seções">
        <button type="button" class="tab active" id="tab-duel">Duelo</button>
        <button type="button" class="tab" id="tab-tournament">Torneio</button>
        <button type="button" class="tab" id="tab-rank">Ranking</button>
        <button type="button" class="tab" id="tab-credits">Créditos</button>
      </nav>

      <section id="panel-duel" class="panel active" aria-label="Duelo">
        <section class="topic-picker" aria-labelledby="topic-picker-title">
          <div class="topic-picker-heading">
            <strong id="topic-picker-title">Escolha o assunto</strong>
            <span id="topic-count">360 pessoas</span>
          </div>
          <div class="topic-list" id="topic-list" role="group" aria-label="Tópico do duelo">
            ${TOPICS.map((topic, index) => `
              <button
                type="button"
                class="topic-btn${index === 0 ? " active" : ""}"
                data-topic="${topic.id}"
                aria-pressed="${index === 0 ? "true" : "false"}"
              ><span aria-hidden="true">${topic.icon}</span>${escapeHtml(topic.label)}</button>
            `).join("")}
          </div>
          <p class="topic-description" id="topic-description">${escapeHtml(TOPICS[0].description)}</p>
        </section>
        <div class="mode-switch" aria-label="Categoria do duelo">
          <span class="mode-label">Disputar:</span>
          <button type="button" class="mode-btn active" id="mode-presidentes" aria-pressed="true">Pessoas</button>
          <button type="button" class="mode-btn" id="mode-vices" aria-pressed="false" hidden disabled>Vices</button>
        </div>
        <div class="combo-banner" id="combo-banner" hidden>
          <span class="combo-label" id="combo-label"></span>
        </div>
        <div class="duel-stats">
          <span id="duel-prompt">Toque na pessoa preferida</span>
          <span>Duelos: <strong id="duel-count">0</strong></span>
        </div>

        <div class="duel-progress" id="duel-progress">
          <p class="duel-progress-text" id="duel-progress-text"></p>
          <div
            class="duel-progress-bar"
            id="duel-progress-bar"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="${INITIAL_GOAL}"
            aria-valuenow="0"
            aria-labelledby="duel-progress-text"
          >
            <div class="duel-progress-fill" id="duel-progress-fill"></div>
          </div>
        </div>

        <!-- Lightweight result moment. "Ver pódio" opens #14 without replacing Continue/Fechar. -->
        <div class="goal-modal" id="goal-modal" hidden>
          <div class="goal-modal-card" role="status" aria-labelledby="goal-modal-title">
            <h2 class="goal-modal-title" id="goal-modal-title">Meta atingida!</h2>
            <p class="goal-modal-lead" id="goal-modal-lead"></p>
            <p class="goal-modal-leader" id="goal-modal-leader"></p>
            <div class="goal-modal-actions">
              <button type="button" class="btn primary" id="goal-continue">Nova meta: 60 duelos</button>
              <button type="button" class="btn" id="goal-podium">Ver pódio</button>
              <button type="button" class="btn" id="goal-dismiss">Fechar</button>
            </div>
          </div>
        </div>

        <aside class="quick-controls-hint" id="quick-controls-hint" hidden>
          <span><strong>Dica:</strong> use ← → no computador ou deslize os cards no celular.</span>
          <button type="button" id="dismiss-quick-controls">Entendi</button>
        </aside>

        <div class="vs-row" id="duel-cards">
          <button type="button" class="poke-card" id="card-a"></button>
          <div class="vs-badge" aria-hidden="true">VS</div>
          <button type="button" class="poke-card" id="card-b"></button>
        </div>

        <p class="hint">Perfis básicos no duelo · chromas terão uma área separada · ${requireApi ? "conexão obrigatória para preservar todos os votos" : "modo local disponível sem API"}</p>
      </section>

      <section id="panel-tournament" class="panel" aria-label="Torneio">
        <div class="tournament-toolbar">
          <div>
            <strong>Mata-mata · <span id="tournament-topic">Política em Jogo</span></strong>
            <div class="rank-sub">12 pessoas sorteadas do tópico · 11 duelos · não altera o ranking Elo</div>
          </div>
          <button type="button" class="btn" id="restart-tournament">Novo torneio</button>
        </div>
        <div class="tournament-bracket" id="tournament-bracket" aria-label="Chave do torneio"></div>
        <div class="tournament-stage" id="tournament-stage">
          <p class="tournament-round" id="tournament-round"></p>
          <div class="vs-row" id="tournament-duel">
            <button type="button" class="poke-card" id="tournament-card-a"></button>
            <div class="vs-badge" aria-hidden="true">VS</div>
            <button type="button" class="poke-card" id="tournament-card-b"></button>
          </div>
          <div class="tournament-winner" id="tournament-winner" hidden>
            <p class="tournament-kicker">Vencedor do seu mata-mata</p>
            <h2 id="tournament-winner-title"></h2>
            <div class="tournament-winner-card" id="tournament-winner-card"></div>
            <p class="podium-share-status" id="tournament-share-status" hidden></p>
            <div class="podium-actions">
              <button type="button" class="btn primary" id="tournament-share">Compartilhar</button>
              <button type="button" class="btn" id="tournament-again">Jogar novamente</button>
            </div>
          </div>
        </div>
      </section>

      <section id="panel-rank" class="panel" aria-label="Ranking">
        <div class="ranking-toolbar">
          <div>
            <strong>Ranking Elo · <span id="rank-mode">Pessoas</span> · <span id="rank-topic">Política em Jogo</span></strong>
            <div class="rank-sub">${RANKING_SUBTITLE}</div>
          </div>
          <div class="ranking-actions">
            <button type="button" class="btn primary" id="open-podium">Ver pódio</button>
            <button type="button" class="btn danger" id="reset-ranking">Zerar meu ranking</button>
          </div>
        </div>
        <ol class="rank-list" id="rank-list"></ol>
        <section class="achievements-panel" aria-label="Conquistas">
          <h2 class="achievements-title">Conquistas</h2>
          <ul class="achievements-list" id="achievements-list"></ul>
        </section>
        <section class="player-recovery" aria-labelledby="player-recovery-title">
          <h2 id="player-recovery-title">Seu ranking em qualquer aparelho</h2>
          <p>Guarde sua chave privada. Ela recupera seu ranking pessoal após reinstalar ou trocar de navegador.</p>
          <div class="player-key-row">
            <code id="player-key">Preparando chave…</code>
            <button type="button" class="btn" id="copy-player-key">Copiar chave</button>
          </div>
          <form id="recover-player-form">
            <label for="recover-player-key">Recuperar uma chave existente</label>
            <div class="player-key-row">
              <input id="recover-player-key" name="recoveryKey" autocomplete="off" spellcheck="false" />
              <button type="submit" class="btn primary">Recuperar</button>
            </div>
          </form>
          <p id="player-recovery-status" role="status" aria-live="polite"></p>
        </section>
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

      <div class="achievement-toasts" id="achievement-toasts" aria-live="polite"></div>

      <div class="podium-overlay" id="podium-overlay" hidden>
        <div class="podium-backdrop" id="podium-backdrop"></div>
        <div class="podium-dialog" role="dialog" aria-modal="true" aria-labelledby="podium-title">
          <p class="podium-kicker">Presidência Duelo 2026</p>
          <h2 class="podium-title" id="podium-title">Seu pódio</h2>
          <p class="podium-disclaimer">Não é pesquisa oficial</p>
          <ol class="podium-stand" id="podium-stand"></ol>
          <p class="podium-share-status" id="podium-share-status" hidden></p>
          <div class="podium-actions">
            <button type="button" class="btn primary" id="podium-share">Compartilhar</button>
            <button type="button" class="btn" id="podium-close">Fechar</button>
          </div>
        </div>
      </div>

      <div class="reset-overlay" id="reset-overlay" hidden>
        <button type="button" class="reset-backdrop" id="reset-backdrop" aria-label="Cancelar"></button>
        <section class="reset-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description">
          <h2 id="reset-title">Zerar seu ranking?</h2>
          <p id="reset-description">Seu Elo, vitórias, derrotas, zebras, progresso e conquistas serão zerados neste aparelho e na sua identidade anônima.</p>
          <p><strong>O ranking geral de todos não será alterado.</strong></p>
          <p class="reset-status" id="reset-status" role="status" aria-live="polite"></p>
          <div class="podium-actions">
            <button type="button" class="btn" id="reset-cancel">Cancelar</button>
            <button type="button" class="btn danger" id="reset-confirm">Sim, zerar meu ranking</button>
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderRankItems(candidates, byId, getStats, getRarity = () => null) {
  const ranked = sortCandidatesByRank(candidates, getStats);

  return ranked
    .map((c, i) => {
      const { elo, wins, losses, wr, zebras = 0 } = getStats(c.id);
      const rarity = getRarity(c.id);
      return `
        <li class="rank-item"${rarity ? ` data-rarity="${rarity.id}"` : ""}>
          <div class="rank-pos">${i + 1}º</div>
          ${c.photo ? `<img src="${escapeHtml(c.photo)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';" />` : '<img alt="" style="display:none" />'}
          <div class="rank-ph"${c.photo ? ' style="display:none"' : ""}>${escapeHtml(c.initials)}</div>
          <div>
            <div class="rank-name">${escapeHtml(c.name)}</div>
            <div class="rank-meta">${rarity ? `<span class="rarity-tag">${escapeHtml(rarity.label)}</span>` : ""}${escapeHtml(rankMetaText({ party: c.party, vice: c.vice, wins, losses, zebras }))}</div>
          </div>
          <div class="rank-score">${elo}<small>${wr}% vitórias</small></div>
        </li>`;
    })
    .join("");
}

export async function initGame({ requireApi = false } = {}) {
  const root = document.getElementById("app");
  renderShell(root, { requireApi });

  const statusEl = document.getElementById("api-status");
  let candidates = FALLBACK_CANDIDATES;
  let apiOnline = false;

  try {
    const [list] = await Promise.all([fetchCandidates(), fetchHealth()]);
    candidates = list;
    apiOnline = true;
    setNetworkStatus(statusEl, NETWORK_STATES.ONLINE);
  } catch {
    if (requireApi) {
      renderConnectionRequired(root);
      return false;
    }
    setNetworkStatus(statusEl, NETWORK_STATES.LOCAL);
  }

  const byId = Object.fromEntries(candidates.map((c) => [c.id, c]));
  preloadPhotos(candidates);
  const els = {
    panelDuel: document.getElementById("panel-duel"),
    panelTournament: document.getElementById("panel-tournament"),
    panelRank: document.getElementById("panel-rank"),
    panelCredits: document.getElementById("panel-credits"),
    tabDuel: document.getElementById("tab-duel"),
    tabTournament: document.getElementById("tab-tournament"),
    tabRank: document.getElementById("tab-rank"),
    tabCredits: document.getElementById("tab-credits"),
    openCredits: document.getElementById("open-credits"),
    duelPrompt: document.getElementById("duel-prompt"),
    rankMode: document.getElementById("rank-mode"),
    modePresidentes: document.getElementById("mode-presidentes"),
    modeVices: document.getElementById("mode-vices"),
    topicButtons: [...document.querySelectorAll("[data-topic]")],
    topicCount: document.getElementById("topic-count"),
    topicDescription: document.getElementById("topic-description"),
    rankTopic: document.getElementById("rank-topic"),
    tournamentTopic: document.getElementById("tournament-topic"),
    duelCount: document.getElementById("duel-count"),
    comboBanner: document.getElementById("combo-banner"),
    comboLabel: document.getElementById("combo-label"),
    achievementToasts: document.getElementById("achievement-toasts"),
    achievementsList: document.getElementById("achievements-list"),
    progressText: document.getElementById("duel-progress-text"),
    progressBar: document.getElementById("duel-progress-bar"),
    progressFill: document.getElementById("duel-progress-fill"),
    goalModal: document.getElementById("goal-modal"),
    goalLead: document.getElementById("goal-modal-lead"),
    goalLeader: document.getElementById("goal-modal-leader"),
    goalContinue: document.getElementById("goal-continue"),
    goalPodium: document.getElementById("goal-podium"),
    goalDismiss: document.getElementById("goal-dismiss"),
    openPodium: document.getElementById("open-podium"),
    podiumOverlay: document.getElementById("podium-overlay"),
    podiumBackdrop: document.getElementById("podium-backdrop"),
    podiumStand: document.getElementById("podium-stand"),
    podiumShare: document.getElementById("podium-share"),
    podiumClose: document.getElementById("podium-close"),
    podiumStatus: document.getElementById("podium-share-status"),
    cardA: document.getElementById("card-a"),
    cardB: document.getElementById("card-b"),
    rankList: document.getElementById("rank-list"),
    resetBtn: document.getElementById("reset-ranking"),
    resetOverlay: document.getElementById("reset-overlay"),
    resetBackdrop: document.getElementById("reset-backdrop"),
    resetCancel: document.getElementById("reset-cancel"),
    resetConfirm: document.getElementById("reset-confirm"),
    resetStatus: document.getElementById("reset-status"),
    playerKey: document.getElementById("player-key"),
    copyPlayerKey: document.getElementById("copy-player-key"),
    recoverPlayerForm: document.getElementById("recover-player-form"),
    recoverPlayerKey: document.getElementById("recover-player-key"),
    playerRecoveryStatus: document.getElementById("player-recovery-status"),
    serverWrap: document.getElementById("server-rank-wrap"),
    serverList: document.getElementById("server-rank-list"),
    storageNotice: document.getElementById("storage-notice"),
    tournamentBracket: document.getElementById("tournament-bracket"),
    tournamentStage: document.getElementById("tournament-stage"),
    tournamentRound: document.getElementById("tournament-round"),
    tournamentDuel: document.getElementById("tournament-duel"),
    tournamentCardA: document.getElementById("tournament-card-a"),
    tournamentCardB: document.getElementById("tournament-card-b"),
    tournamentWinner: document.getElementById("tournament-winner"),
    tournamentWinnerTitle: document.getElementById("tournament-winner-title"),
    tournamentWinnerCard: document.getElementById("tournament-winner-card"),
    tournamentShare: document.getElementById("tournament-share"),
    tournamentShareStatus: document.getElementById("tournament-share-status"),
    tournamentAgain: document.getElementById("tournament-again"),
    restartTournament: document.getElementById("restart-tournament"),
    duelCards: document.getElementById("duel-cards"),
    quickControlsHint: document.getElementById("quick-controls-hint"),
    dismissQuickControls: document.getElementById("dismiss-quick-controls"),
  };

  function persist() {
    const key = mode === "vices" ? VICE_STORAGE_KEY : STORAGE_KEY;
    if (saveState(state, undefined, key)) return;
    if (els.storageNotice) els.storageNotice.hidden = false;
  }

  const states = {
    presidentes: loadState(candidates),
    vices: loadState(candidates, VICE_STORAGE_KEY),
  };
  const playerVersions = { presidentes: 0, vices: 0 };
  let recoveryKey = loadRecoveryKey();
  let playerReady = !requireApi;
  let playerSyncError = null;
  if (requireApi && apiOnline) {
    try {
      const synced = await initializePlayerSync({
        states,
        recoveryKey,
        createRemotePlayer: createPlayer,
        fetchRemoteState: fetchPlayerState,
        replaceRemoteState: replacePlayerState,
        onRecoveryKey: (createdKey) => {
          recoveryKey = createdKey;
          saveRecoveryKey(createdKey);
        },
      });
      recoveryKey = synced.recoveryKey;
      Object.assign(playerVersions, synced.versions);
      saveRecoveryKey(recoveryKey);
      playerReady = true;
      saveState(states.presidentes, undefined, STORAGE_KEY);
      saveState(states.vices, undefined, VICE_STORAGE_KEY);
    } catch (error) {
      playerSyncError = error;
      playerReady = false;
    }
  }
  let mode = "presidentes";
  let state = states[mode];
  let topicId = loadTopic();
  let currentPair = null;
  let duelGeneration = 0;
  let locked = false;
  let pickTimer = null;
  let tournament = loadTournament();
  const tournamentPickLock = createTournamentPickLock();

  function renderPlayerRecovery(message = "") {
    if (!els.playerKey) return;
    els.playerKey.textContent = recoveryKey
      ? `${recoveryKey.slice(0, 10)}…${recoveryKey.slice(-6)}`
      : "Chave não conectada";
    els.copyPlayerKey.disabled = !recoveryKey;
    els.playerRecoveryStatus.textContent = message || (playerSyncError
      ? "Não foi possível sincronizar. Informe sua chave novamente; nenhum dado remoto foi sobrescrito."
      : "Ranking pessoal sincronizado com o servidor.");
  }

  function openResetDialog() {
    els.resetStatus.textContent = "";
    els.resetOverlay.hidden = false;
    els.resetCancel.focus();
  }

  function closeResetDialog() {
    if (els.resetConfirm.disabled) return;
    els.resetOverlay.hidden = true;
    els.resetBtn.focus();
  }

  async function resetPersonalRanking() {
    cancelPickTimer();
    duelGeneration += 1;
    locked = true;
    els.cardA.disabled = true;
    els.cardB.disabled = true;
    els.resetConfirm.disabled = true;
    els.resetCancel.disabled = true;
    els.resetStatus.textContent = "Zerando seu ranking…";
    const cleared = defaultState(candidates);
    try {
      await commitPersonalReset({
        clearedState: cleared,
        resetRemote: requireApi
          ? (next) => replacePlayerState(recoveryKey, mode, playerVersions[mode], next)
          : null,
        applyLocal: (next, remote) => {
          if (remote) playerVersions[mode] = remote.version;
          states[mode] = next;
          state = next;
          persist();
        },
      });
      hideGoalMoment();
      closePodium();
      nextDuel();
      renderRanking();
      renderAchievements();
      renderCombo();
      els.resetStatus.textContent = "Seu ranking foi zerado. O ranking geral não foi alterado.";
      window.setTimeout(() => {
        els.resetOverlay.hidden = true;
        els.resetBtn.focus();
      }, 1100);
    } catch (error) {
      locked = false;
      els.cardA.disabled = false;
      els.cardB.disabled = false;
      els.resetStatus.textContent = error.status === 409
        ? "Há um voto mais recente no servidor. Sincronize sua chave e tente novamente."
        : "Não foi possível zerar agora. Nenhum dado foi apagado.";
    } finally {
      els.resetConfirm.disabled = false;
      els.resetCancel.disabled = false;
    }
  }

  async function recoverPlayer(recoveredKey) {
    const synced = await initializePlayerSync({
      states,
      recoveryKey: recoveredKey,
      createRemotePlayer: createPlayer,
      fetchRemoteState: fetchPlayerState,
      replaceRemoteState: replacePlayerState,
    });
    recoveryKey = synced.recoveryKey;
    Object.assign(playerVersions, synced.versions);
    saveRecoveryKey(recoveryKey);
    saveState(states.presidentes, undefined, STORAGE_KEY);
    saveState(states.vices, undefined, VICE_STORAGE_KEY);
    state = states[mode];
    playerSyncError = null;
    playerReady = true;
    cancelPickTimer();
    nextDuel();
    renderRanking();
    renderAchievements();
    renderCombo();
    renderPlayerRecovery("Ranking pessoal recuperado neste aparelho.");
  }

  function loadTournament() {
    const ids = topicCandidates().map((candidate) => candidate.id);
    try {
      const parsed = JSON.parse(localStorage.getItem(tournamentStorageKey()));
      if (isValidTournament(parsed, ids)) return parsed;
    } catch {
      // Start a fresh bracket when storage is unavailable or stale.
    }
    return createTournament(ids);
  }

  function saveTournament() {
    try {
      localStorage.setItem(tournamentStorageKey(), JSON.stringify(tournament));
    } catch {
      // The tournament remains playable in memory.
    }
  }
  let swipeStartX = null;
  let swipePointerId = null;

  function tournamentStorageKey() {
    return `${TOURNAMENT_STORAGE_KEY}-${topicId}`;
  }

  function topicCandidates() {
    return candidatesForTopic(candidates, topicId);
  }

  function displayCandidates() {
    return topicCandidates().map((candidate) => candidateForMode(candidate, mode));
  }

  function displayCandidate(id) {
    return candidateForMode(byId[id], mode);
  }

  function renderModeUi() {
    const config = MODES[mode];
    const isPresidentes = mode === "presidentes";
    els.modePresidentes.classList.toggle("active", isPresidentes);
    els.modePresidentes.setAttribute("aria-pressed", String(isPresidentes));
    els.modeVices.classList.toggle("active", !isPresidentes);
    els.modeVices.setAttribute("aria-pressed", String(!isPresidentes));
    els.duelPrompt.textContent = config.prompt;
    els.rankMode.textContent = config.label;
  }

  function renderTopicUi() {
    const topic = topicById(topicId);
    const count = topicCandidates().length;
    for (const button of els.topicButtons) {
      const active = button.dataset.topic === topicId;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    els.topicCount.textContent = `${count} ${count === 1 ? "pessoa" : "pessoas"}`;
    els.topicDescription.textContent = topic.description;
    els.rankTopic.textContent = topic.label;
    els.tournamentTopic.textContent = topic.label;
  }

  function setTopic(nextTopicId) {
    const nextTopic = topicById(nextTopicId);
    if (nextTopic.id === topicId) return;
    cancelPickTimer();
    locked = false;
    topicId = nextTopic.id;
    saveTopic(topicId);
    currentPair = null;
    tournament = loadTournament();
    hideGoalMoment();
    closePodium();
    renderTopicUi();
    nextDuel();
    if (requireApi && apiOnline) setNetworkStatus(statusEl, NETWORK_STATES.ONLINE);
    renderRanking();
    renderServerRanking();
  }

  function setMode(nextMode) {
    if (!MODES[nextMode] || nextMode === mode) return;
    cancelPickTimer();
    locked = false;
    mode = nextMode;
    state = states[mode];
    currentPair = null;
    hideGoalMoment();
    closePodium();
    renderModeUi();
    nextDuel();
    if (requireApi && apiOnline) setNetworkStatus(statusEl, NETWORK_STATES.ONLINE);
    renderRanking();
    renderServerRanking();
  }

  function cancelPickTimer() {
    if (pickTimer == null) return;
    clearTimeout(pickTimer);
    pickTimer = null;
  }

  function currentLeaderName() {
    const ranked = sortCandidatesByRank(topicCandidates(), (id) => ({
      elo: state.ratings[id],
      wins: state.wins[id] || 0,
    }));
    return ranked[0] ? displayCandidate(ranked[0].id).name : "";
  }

  function localPodiumPlaces() {
    return selectTopThree(displayCandidates(), (id) => ({
      elo: state.ratings[id],
      wins: state.wins[id] || 0,
      losses: state.losses[id] || 0,
    }));
  }

  function setPodiumStatus(message) {
    if (!els.podiumStatus) return;
    if (!message) {
      els.podiumStatus.hidden = true;
      els.podiumStatus.textContent = "";
      return;
    }
    els.podiumStatus.hidden = false;
    els.podiumStatus.textContent = message;
  }

  function openPodium() {
    if (els.podiumStand) els.podiumStand.innerHTML = podiumStandHtml(localPodiumPlaces());
    setPodiumStatus("");
    if (els.podiumOverlay) els.podiumOverlay.hidden = false;
    els.podiumShare?.focus();
  }

  function closePodium() {
    if (els.podiumOverlay) els.podiumOverlay.hidden = true;
  }

  async function sharePodium() {
    const places = localPodiumPlaces();
    const text = formatPodiumShareText(places);
    setPodiumStatus("Gerando imagem…");
    if (els.podiumShare) els.podiumShare.disabled = true;
    try {
      const file = await buildPodiumPngFile(places);
      const result = await shareOrCopyPodium({ file, text, title: SHARE_TITLE });
      if (result.method === "share" || result.method === "share-abort") {
        setPodiumStatus("");
      } else if (result.method === "copy") {
        setPodiumStatus("Ranking copiado. Cole no WhatsApp.");
      } else {
        setPodiumStatus("Não deu para compartilhar agora.");
      }
    } catch {
      setPodiumStatus("Não deu para compartilhar agora.");
    } finally {
      if (els.podiumShare) els.podiumShare.disabled = false;
    }
  }

  function renderProgress() {
    const played = state.duels;
    const goal = state.progressGoal;
    const shown = Math.min(played, goal);
    if (els.progressText) els.progressText.textContent = remainingText(state.duels, goal);
    if (els.progressFill) els.progressFill.style.width = `${progressPercent(state.duels, goal)}%`;
    if (els.progressBar) {
      els.progressBar.setAttribute("aria-valuenow", String(shown));
      els.progressBar.setAttribute("aria-valuemax", String(goal));
    }
  }

  function candidateIds() {
    return candidates.map((c) => c.id);
  }

  function renderCombo(now = Date.now()) {
    const n = liveCombo(state.combo, state.lastVoteAt, now);
    const label = comboLabel(n);
    if (!els.comboBanner || !els.comboLabel) return;
    els.comboBanner.hidden = !label;
    if (!label) {
      els.comboLabel.textContent = "";
      return;
    }
    if (els.comboLabel.textContent !== label) {
      els.comboLabel.textContent = label;
      els.comboLabel.classList.remove("combo-pop");
      void els.comboLabel.offsetWidth;
      els.comboLabel.classList.add("combo-pop");
    }
  }

  function renderAchievements() {
    if (!els.achievementsList) return;
    const unlocked = new Set(normalizeAchievements(state.achievements));
    els.achievementsList.innerHTML = ACHIEVEMENT_IDS.map((id) => {
      const on = unlocked.has(id);
      return `<li class="achievement-chip${on ? " unlocked" : ""}">${escapeHtml(achievementTitle(id))}</li>`;
    }).join("");
  }

  function showAchievementToasts(ids) {
    if (!els.achievementToasts || !ids?.length) return;
    for (const id of ids) {
      const text = achievementToastText(id);
      if (!text) continue;
      const toast = document.createElement("div");
      toast.className = "achievement-toast";
      toast.setAttribute("role", "status");
      toast.textContent = text;
      els.achievementToasts.appendChild(toast);
      window.setTimeout(() => toast.remove(), 3200);
    }
  }

  function applyUnlocks() {
    const newly = unlockDueAchievements(state, { candidateIds: candidateIds() });
    if (newly.length) {
      renderAchievements();
      showAchievementToasts(newly);
    }
    return newly;
  }

  function hideGoalMoment() {
    if (els.goalModal) els.goalModal.hidden = true;
  }

  function closeGoalMoment() {
    if (!els.goalModal || els.goalModal.hidden) return;
    acceptGoal(state);
    hideGoalMoment();
    persist();
    renderProgress();
  }

  function maybeShowGoalMoment() {
    if (!els.goalModal || !shouldCelebrate(state.duels, state.progressGoal, state.celebratedGoal)) {
      return;
    }
    if (els.goalLead) els.goalLead.textContent = celebrationLead(state.progressGoal);
    if (els.goalLeader) els.goalLeader.textContent = leaderLine(currentLeaderName());
    if (els.goalContinue) els.goalContinue.textContent = continueLabel(state.progressGoal);
    els.goalModal.hidden = false;
    els.goalContinue?.focus();
  }

  function setTab(name) {
    if (name !== "duel" && locked) {
      cancelPickTimer();
      nextDuel();
      if (requireApi && apiOnline) setNetworkStatus(statusEl, NETWORK_STATES.ONLINE);
    }
    const tabs = [
      ["duel", els.panelDuel, els.tabDuel],
      ["tournament", els.panelTournament, els.tabTournament],
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
      renderAchievements();
      renderServerRanking();
    }
    if (name === "tournament") renderTournament();
  }

  function tournamentCandidateName(id) {
    return byId[id]?.name || "A definir";
  }

  function renderTournamentBracket() {
    const columns = tournament.rounds.map((round, roundIndex) => {
      const matches = round.matches.map((match, matchIndex) => {
        const names = match.candidates.map((id) => {
          const winner = match.winner === id ? " winner" : "";
          return `<span class="bracket-candidate${winner}">${escapeHtml(tournamentCandidateName(id))}</span>`;
        }).join("");
        const active = roundIndex === tournament.roundIndex && !match.winner
          && match === currentTournamentMatch(tournament) ? " active" : "";
        return `<div class="bracket-match${active}" aria-label="Confronto ${matchIndex + 1}">${names}</div>`;
      }).join("");
      const byes = roundIndex === 0
        ? `<div class="bracket-byes"><strong>Classificados direto</strong>${tournament.byes.map((id) => `<span>${escapeHtml(tournamentCandidateName(id))}</span>`).join("")}</div>`
        : "";
      return `<section class="bracket-round"><h3>${escapeHtml(round.name)}</h3>${matches}${byes}</section>`;
    }).join("");
    els.tournamentBracket.innerHTML = columns;
  }

  function renderTournamentCard(el, id) {
    const candidate = byId[id];
    el.dataset.id = id;
    applyCardAriaLabel(el, candidate);
    fillDuelCard(el, candidate, { elo: ELO_START, wr: 0, barWidth: 50 });
  }

  function renderTournament() {
    renderTournamentBracket();
    const match = currentTournamentMatch(tournament);
    const played = completedTournamentDuels(tournament);
    if (tournament.champion) {
      const champion = byId[tournament.champion];
      els.tournamentDuel.hidden = true;
      els.tournamentRound.hidden = true;
      els.tournamentWinner.hidden = false;
      els.tournamentWinnerTitle.textContent = `Seu vencedor é ${champion.name}`;
      const winnerArt = champion.photo
        ? `<img src="${escapeHtml(champion.photo)}" alt="Foto de ${escapeHtml(champion.name)}">`
        : `<div class="tournament-winner-placeholder" aria-hidden="true">${escapeHtml(champion.initials)}</div>`;
      const winnerParty = champion.party ? `<span>${escapeHtml(champion.party)}</span>` : "";
      els.tournamentWinnerCard.innerHTML = `${winnerArt}<strong>${escapeHtml(champion.name)}</strong>${winnerParty}`;
      return;
    }
    els.tournamentWinner.hidden = true;
    els.tournamentDuel.hidden = false;
    els.tournamentRound.hidden = false;
    els.tournamentCardA.disabled = false;
    els.tournamentCardB.disabled = false;
    const round = tournament.rounds[tournament.roundIndex];
    els.tournamentRound.textContent = `${round.name} · duelo ${played + 1} de 11`;
    renderTournamentCard(els.tournamentCardA, match.candidates[0]);
    renderTournamentCard(els.tournamentCardB, match.candidates[1]);
  }

  function pickTournamentCard(card) {
    const cards = [els.tournamentCardA, els.tournamentCardB];
    const loser = card === els.tournamentCardA ? els.tournamentCardB : els.tournamentCardA;
    tournamentPickLock.run({
      cards,
      commit: () => {
        if (!tournamentPick(tournament, card.dataset.id)) return false;
        saveTournament();
        if (tournament.champion && unlockTournamentCompleted(state)) {
          persist();
          renderAchievements();
          showAchievementToasts(["completou-torneio"]);
        }
        return true;
      },
      feedback: () => {
        card.classList.add("picked-win");
        loser.classList.add("picked-lose");
      },
      render: () => {
        card.classList.remove("picked-win");
        loser.classList.remove("picked-lose");
        renderTournament();
      },
    });
  }

  function restartTournament() {
    tournamentPickLock.reset([els.tournamentCardA, els.tournamentCardB]);
    tournament = createTournament(topicCandidates().map((candidate) => candidate.id));
    saveTournament();
    if (els.tournamentShareStatus) els.tournamentShareStatus.hidden = true;
    renderTournament();
  }

  async function shareTournamentWinner() {
    const champion = byId[tournament.champion];
    if (!champion) return;
    const text = formatTournamentShareText(champion);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Meu presidente — Presidência Duelo 2026", text });
        return;
      }
      await navigator.clipboard.writeText(text);
      els.tournamentShareStatus.textContent = "Resultado copiado. Cole no WhatsApp.";
    } catch (error) {
      if (error?.name === "AbortError") return;
      els.tournamentShareStatus.textContent = "Não deu para compartilhar agora.";
    }
    els.tournamentShareStatus.hidden = false;
  }

  function renderCard(el, id) {
    const c = displayCandidate(id);
    const elo = state.ratings[id];
    const wins = state.wins[id] || 0;
    const losses = state.losses[id] || 0;
    const wr = winRate(state, id);
    const barWidth = hpFillWidth(wins, losses, wr);
    el.dataset.id = id;
    el.removeAttribute("data-rarity");
    clearPickFeedback(el);
    applyCardAriaLabel(el, c);
    fillDuelCard(el, c, { elo, wr, barWidth });
  }

  function nextDuel() {
    duelGeneration += 1;
    locked = false;
    pickTimer = null;
    els.duelCards.classList.remove("swipe-commit-left", "swipe-commit-right", "is-dragging");
    els.duelCards.style.removeProperty("--swipe-x");
    els.cardA.disabled = false;
    els.cardB.disabled = false;
    const active = topicCandidates();
    currentPair = takeNextPair(active, state, Math.random, pairAllowedForTopic(topicId, byId));
    applyUnlocks();
    persist();
    renderCard(els.cardA, currentPair[0]);
    renderCard(els.cardB, currentPair[1]);
    els.duelCount.textContent = String(state.duels);
    renderProgress();
    renderCombo();
  }

  function commitLocalPick(session, serverPlayer = null) {
    const { state: targetState, pair, winnerEl, winnerId, loserId } = session;
    const loserEl = winnerEl === els.cardA ? els.cardB : els.cardA;
    let result;
    if (serverPlayer) {
      const winnerBefore = targetState.ratings[winnerId];
      const loserBefore = targetState.ratings[loserId];
      const zebrasBefore = targetState.zebras?.[winnerId] || 0;
      applyServerPlayerState(targetState, serverPlayer.state);
      playerVersions[session.mode] = serverPlayer.version;
      result = {
        winnerDelta: targetState.ratings[winnerId] - winnerBefore,
        loserDelta: targetState.ratings[loserId] - loserBefore,
        zebra: (targetState.zebras?.[winnerId] || 0) > zebrasBefore,
      };
    } else {
      result = applyElo(targetState, winnerId, loserId);
    }
    const { winnerDelta, loserDelta, zebra } = result;
    applyCombo(targetState);
    applyUnlocks();
    persist();
    applyPickFeedback(winnerEl, loserEl, winnerDelta, loserDelta, { zebra });
    els.duelCount.textContent = String(state.duels);
    renderProgress();
    renderCombo();
    maybeShowGoalMoment();
  }

  async function pick(winnerEl) {
    if (locked || !currentPair) return;
    if (requireApi && !playerReady) {
      renderPlayerRecovery("Informe uma chave válida para preservar seu ranking pessoal.");
      setTab("rank");
      return;
    }
    locked = true;
    const session = captureVoteSession({
      generation: duelGeneration,
      pair: currentPair,
      mode,
      topicId,
      state,
      winnerEl,
    });
    const sessionIsCurrent = () => isCurrentVoteSession(session, {
      generation: duelGeneration,
      pair: currentPair,
      mode,
      topicId,
      state,
    });

    if (requireApi) {
      const voteId = createVoteId();
      els.cardA.disabled = true;
      els.cardB.disabled = true;
      setNetworkStatus(statusEl, NETWORK_STATES.REGISTERING);
      try {
        const result = await commitOnlineVote(
          () => postVote(session.winnerId, session.loserId, session.mode, {
            voteId,
            recoveryKey,
            playerVersion: playerVersions[session.mode],
          }),
          (response) => commitLocalPick(session, response.player),
          sessionIsCurrent,
        );
        if (!result.applied) return;
        setNetworkStatus(statusEl, NETWORK_STATES.SAVED);
        pickTimer = setTimeout(nextDuel, 420);
      } catch (error) {
        if (!sessionIsCurrent()) return;
        if (error.status === 409 && error.body?.code === "PLAYER_VERSION_CONFLICT") {
          playerReady = false;
          renderPlayerRecovery("Há dados mais recentes no servidor. Recupere sua chave para sincronizar antes de continuar.");
        }
        if (isUnknownVoteConfirmation(error)) {
          setNetworkStatus(statusEl, NETWORK_STATES.UNKNOWN);
          return;
        }
        locked = false;
        els.cardA.disabled = false;
        els.cardB.disabled = false;
        setNetworkStatus(statusEl, NETWORK_STATES.FAILED);
      }
      return;
    }

    pickTimer = runLockedPick(() => {
      commitLocalPick(session);

      if (apiOnline) {
        postVote(session.winnerId, session.loserId, session.mode, { voteId: createVoteId() }).catch(() => {
          if (!sessionIsCurrent()) return;
          apiOnline = false;
          setNetworkStatus(statusEl, NETWORK_STATES.LOCAL);
        });
      }

    }, nextDuel);
  }

  function canUseQuickControls() {
    return els.panelDuel.classList.contains("active")
      && els.goalModal.hidden
      && els.podiumOverlay.hidden;
  }

  function pickSide(side) {
    if (!canUseQuickControls()) return;
    pick(side === "left" ? els.cardA : els.cardB);
  }

  function handleQuickControlKey(event) {
    const side = keyboardPickSide(event);
    if (!side || !canUseQuickControls()) return;
    event.preventDefault();
    pickSide(side);
  }

  function beginSwipe(event) {
    if (event.pointerType === "mouse" || !canUseQuickControls() || locked) return;
    swipeStartX = event.clientX;
    swipePointerId = event.pointerId;
    els.duelCards.classList.add("is-dragging");
    els.duelCards.setPointerCapture?.(event.pointerId);
  }

  function moveSwipe(event) {
    if (event.pointerId !== swipePointerId || swipeStartX == null) return;
    const delta = Math.max(-110, Math.min(110, event.clientX - swipeStartX));
    els.duelCards.style.setProperty("--swipe-x", `${delta}px`);
    if (Math.abs(delta) > 8) event.preventDefault();
  }

  function finishSwipe(event) {
    if (event.pointerId !== swipePointerId || swipeStartX == null) return;
    const side = swipePickSide(swipeStartX, event.clientX);
    swipeStartX = null;
    swipePointerId = null;
    els.duelCards.classList.remove("is-dragging");
    els.duelCards.style.removeProperty("--swipe-x");
    if (!side) return;
    els.duelCards.classList.add(`swipe-commit-${side}`);
    pickSide(side);
  }

  function cancelSwipe() {
    swipeStartX = null;
    swipePointerId = null;
    els.duelCards.classList.remove("is-dragging");
    els.duelCards.style.removeProperty("--swipe-x");
  }

  function renderRanking() {
    const visible = displayCandidates();
    const visibleById = Object.fromEntries(visible.map((candidate) => [candidate.id, candidate]));
    const leaderId = findLeaderId(topicCandidates().map((candidate) => candidate.id), state);
    els.rankList.innerHTML = renderRankItems(visible, visibleById, (id) => ({
      elo: state.ratings[id],
      wins: state.wins[id] || 0,
      losses: state.losses[id] || 0,
      wr: winRate(state, id),
      zebras: state.zebras?.[id] || 0,
    }), (id) => rarityFor(state, id, leaderId));
  }

  async function renderServerRanking() {
    if (!apiOnline) {
      els.serverWrap.hidden = true;
      return;
    }
    try {
      const data = await fetchServerRanking(mode);
      const rows = data.ranking || [];
      if (!rows.length) {
        els.serverWrap.hidden = true;
        return;
      }
      const stats = Object.fromEntries(rows.map((r) => [r.id, r]));
      const visible = topicCandidates();
      els.serverList.innerHTML = renderRankItems(visible, byId, (id) => {
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
  els.tabTournament.addEventListener("click", () => setTab("tournament"));
  els.tabRank.addEventListener("click", () => setTab("rank"));
  els.tabCredits.addEventListener("click", () => setTab("credits"));
  els.openCredits.addEventListener("click", () => setTab("credits"));
  els.cardA.addEventListener("click", () => pick(els.cardA));
  els.cardB.addEventListener("click", () => pick(els.cardB));
  els.modePresidentes.addEventListener("click", () => setMode("presidentes"));
  els.modeVices.addEventListener("click", () => setMode("vices"));
  for (const button of els.topicButtons) {
    button.addEventListener("click", () => setTopic(button.dataset.topic));
  }
  document.addEventListener("keydown", handleQuickControlKey);
  els.duelCards.addEventListener("pointerdown", beginSwipe);
  els.duelCards.addEventListener("pointermove", moveSwipe);
  els.duelCards.addEventListener("pointerup", finishSwipe);
  els.duelCards.addEventListener("pointercancel", cancelSwipe);
  els.goalContinue.addEventListener("click", () => closeGoalMoment());
  els.goalDismiss.addEventListener("click", () => closeGoalMoment());
  els.goalPodium.addEventListener("click", () => openPodium());
  els.openPodium.addEventListener("click", () => openPodium());
  els.podiumShare.addEventListener("click", () => sharePodium());
  els.podiumClose.addEventListener("click", () => closePodium());
  els.podiumBackdrop.addEventListener("click", () => closePodium());
  els.tournamentCardA.addEventListener("click", () => pickTournamentCard(els.tournamentCardA));
  els.tournamentCardB.addEventListener("click", () => pickTournamentCard(els.tournamentCardB));
  els.tournamentShare.addEventListener("click", () => shareTournamentWinner());
  els.tournamentAgain.addEventListener("click", () => restartTournament());
  els.restartTournament.addEventListener("click", () => {
    if (completedTournamentDuels(tournament) > 0 && !confirm("Começar um novo torneio e apagar esta chave?")) return;
    restartTournament();
  });
  if (!hasSeenQuickControlsHint()) els.quickControlsHint.hidden = false;
  els.dismissQuickControls.addEventListener("click", () => {
    els.quickControlsHint.hidden = true;
    markQuickControlsHintSeen();
  });
  els.copyPlayerKey.addEventListener("click", async () => {
    if (!recoveryKey) return;
    try {
      await navigator.clipboard.writeText(recoveryKey);
      renderPlayerRecovery("Chave copiada. Guarde-a como uma senha.");
    } catch {
      renderPlayerRecovery("Não foi possível copiar automaticamente. Tente novamente.");
    }
  });
  els.recoverPlayerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const recoveredKey = els.recoverPlayerKey.value.trim();
    if (!recoveredKey) return;
    const submit = els.recoverPlayerForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    renderPlayerRecovery("Recuperando ranking…");
    try {
      await recoverPlayer(recoveredKey);
      els.recoverPlayerKey.value = "";
    } catch (error) {
      renderPlayerRecovery(error.status === 401
        ? "Chave não encontrada. Confira e tente novamente."
        : "Não foi possível recuperar agora; seus dados atuais não foram sobrescritos.");
    } finally {
      submit.disabled = false;
    }
  });

  els.resetBtn.addEventListener("click", openResetDialog);
  els.resetCancel.addEventListener("click", closeResetDialog);
  els.resetBackdrop.addEventListener("click", closeResetDialog);
  els.resetConfirm.addEventListener("click", resetPersonalRanking);

  renderModeUi();
  renderTopicUi();
  renderAchievements();
  renderCombo();
  renderPlayerRecovery();
  nextDuel();
  maybeShowGoalMoment();
  return true;
}
