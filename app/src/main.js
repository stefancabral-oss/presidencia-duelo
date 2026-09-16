import "./styles.css";
import { createPlayer, endSession, exchangeGoogleCredential, loadCandidates, loadCapabilities, loadDailyPredictionResults, loadDailySession, loadPlayerRanking, loadRanking, submitDailyPrediction, submitDailyVote, submitRoundVote } from "./api.js";
import { aggregateScopeAvailable, nextAggregateCapabilityExpiry, PERSONAL_ONLY_CAPABILITIES, validateCapabilities, withAggregateScopeWithheld } from "./capabilities.js";
import { confirmedDailyVoteData, dailyPendingPredictionCandidates, dailyRoundCandidates, dailySessionRoundChanged, validateDailySession } from "./daily-session.js";
import { confirmedDailyPredictionData, validateDailyPredictionResults } from "./daily-prediction.js";
import { catalogForTopic, displayRanking, filterRanking, hapticPattern, initials, nextBalancedGroup, rankingForCatalog, rankingHighlights, rankingPodium, shortName } from "./domain.js";
import { installPressGesture } from "./press-gesture.js";
import { candidatePhoto } from "./photos.js";
import { enableDeviceTilt, installChromaMotion } from "./chroma-motion.js";
import { approvedBasicCards } from "./approved-chromas.js";
import { createSoundController } from "./sound.js";
import { googleClientId, mountGoogleButton } from "./google-login.js";
import { isCurrentVoteIdentity, resetPendingVoteForIdentityChange, revokeSessionBeforeClearing } from "./logout.js";
import { VOTE_ACTIONS, VOTE_PHASES, voteFailureState, voteRecoveryControl } from "./vote-flow.js";
import { confirmedVoteData } from "./vote-response.js";
import { formatAggregateCopy, PREDICTION_REVEAL_COPY, PUBLIC_RANKING_COPY, WITHHELD_COPY } from "./aggregate-copy.js";

const app = document.querySelector("#app");
const sound = createSoundController();
const state = {
  screen: "topics",
  gameMode: "daily",
  dailySession: null,
  dailyCandidates: [],
  pendingDailySession: null,
  pendingDailyRefresh: false,
  dailyLoadEpoch: 0,
  dailyLoading: false,
  dailyLoadError: "",
  predictionId: "",
  predictionBusy: false,
  predictionError: "",
  pendingPredictionAction: null,
  predictionResults: null,
  predictionResultsLoading: false,
  predictionResultsError: "",
  capabilities: PERSONAL_ONLY_CAPABILITIES,
  candidates: [],
  round: [],
  matchQueue: [],
  previousRound: [],
  ranking: [],
  personalRanking: [],
  personalRankingPolicy: null,
  globalDuels: 0,
  personalDuels: 0,
  rankingView: "personal",
  rankingQuery: "",
  rankingExpanded: false,
  chromaBatchExpanded: false,
  recoveryKey: "",
  playerVersion: 0,
  account: null,
  authOpen: false,
  authBusy: false,
  authError: "",
  collection: [],
  result: "",
  // "erro" faz a mensagem ser grafada como falha. Sem isso, "seu voto não foi
  // contado" sai no mesmo dourado de "invadiu o Top 10".
  resultTone: "",
  personalFeedbackMessage: "",
  globalFeedbackMessage: "",
  // Chave de idempotência da rodada atual. Nasce junto com as quatro cartas e
  // sobrevive às tentativas, para que repetir um voto que já chegou ao servidor
  // seja reconhecido como repetição em vez de virar uma segunda rodada.
  roundId: "",
  // Escolha que falhou e pode ser repetida pelo botão "Tentar de novo".
  pendingWinnerId: "",
  votePhase: VOTE_PHASES.READY,
  voteAction: "",
  retryAfterSeconds: null,
  retryAt: 0,
  sessionRecoveryMode: "",
  identityEpoch: 0,
  roundOutcome: null,
  selectedId: "",
  showCoach: false,
  busy: false,
  ready: false,
  error: "",
  soundEnabled: sound.enabled,
};
let resultTimer;
let roundAdvanceTimer;
let retryEnableTimer;
let aggregateExpiryTimer;

function aggregateAvailable(scope) {
  return aggregateScopeAvailable(state.capabilities, scope);
}

function applyExpiredAggregateCapabilities() {
  const hadGlobalRanking = state.capabilities.scopes["global-ranking"].status === "available";
  const hadPredictionReveal = state.capabilities.scopes["prediction-reveal"].status === "available";
  state.capabilities = validateCapabilities(JSON.parse(JSON.stringify(state.capabilities)));
  const globalRankingExpired = hadGlobalRanking && !aggregateAvailable("global-ranking");
  const predictionRevealExpired = hadPredictionReveal && !aggregateAvailable("prediction-reveal");
  if (globalRankingExpired) {
    state.ranking = [];
    state.globalDuels = 0;
    state.globalFeedbackMessage = "";
    state.rankingView = "personal";
  }
  if (predictionRevealExpired) {
    state.predictionResults = null;
    state.predictionResultsLoading = false;
    state.predictionResultsError = "";
    state.predictionBusy = false;
    state.pendingPredictionAction = null;
    state.selectedId = "";
    if (state.dailySession) installDailySession(state.dailySession);
  }
  return globalRankingExpired || predictionRevealExpired;
}

function scheduleAggregateCapabilityExpiry() {
  clearTimeout(aggregateExpiryTimer);
  const expiresAt = nextAggregateCapabilityExpiry(state.capabilities);
  if (expiresAt === null) return;
  const delay = Math.min(Math.max(0, expiresAt - Date.now() + 1), 2_147_000_000);
  aggregateExpiryTimer = setTimeout(() => {
    const changed = applyExpiredAggregateCapabilities();
    scheduleAggregateCapabilityExpiry();
    if (changed) render();
  }, delay);
}

function installCapabilities(capabilities) {
  state.capabilities = validateCapabilities(JSON.parse(JSON.stringify(capabilities)));
  applyExpiredAggregateCapabilities();
  scheduleAggregateCapabilityExpiry();
}

function clearVoteTimers() {
  clearTimeout(resultTimer);
  clearTimeout(roundAdvanceTimer);
  clearTimeout(retryEnableTimer);
}

function installDailySession(session, { createAnswerId = true } = {}) {
  const previousPendingKey = state.dailySession?.pendingPrediction
    ? `${state.dailySession.edition.id}:${state.dailySession.pendingPrediction.slot}`
    : "";
  state.dailySession = validateDailySession(session);
  state.dailyCandidates = state.dailySession.catalog;
  state.dailyLoading = false;
  state.dailyLoadError = "";
  state.pendingDailyRefresh = false;
  const pendingKey = state.dailySession.pendingPrediction
    ? `${state.dailySession.edition.id}:${state.dailySession.pendingPrediction.slot}`
    : "";
  if (aggregateAvailable("prediction-reveal") && state.dailySession.pendingPrediction) {
    state.round = dailyPendingPredictionCandidates(state.dailySession);
    if (pendingKey !== previousPendingKey || !state.predictionId) state.predictionId = crypto.randomUUID();
    state.roundId = "";
  } else if (state.dailySession.status === "active") {
    state.round = dailyRoundCandidates(state.dailySession);
    state.previousRound = [];
    state.matchQueue = [];
    if (createAnswerId) state.roundId = crypto.randomUUID();
  } else {
    state.round = [];
    state.roundId = "";
  }
  if (!aggregateAvailable("prediction-reveal") || !state.dailySession.pendingPrediction) state.predictionId = "";
  state.predictionBusy = false;
  state.predictionError = "";
  state.pendingPredictionAction = null;
}

function prepareFreeRound() {
  const firstMatch = nextBalancedGroup(state.candidates);
  state.round = firstMatch.group;
  state.matchQueue = firstMatch.queue;
  state.previousRound = [];
  state.roundId = crypto.randomUUID();
}

const chromaPreviews = [
  { person: "Lula", role: "Chroma Suprema", image: "/chromas/rendered/lula-supreme-3star-v1.jpg", variant: "supreme supreme-rays" },
  { person: "Renan Santos", role: "Chroma Suprema", image: "/chromas/rendered/renan-santos-supreme-3star-v1.jpg", variant: "supreme supreme-rings" },
  { person: "Lula", role: "Chroma Comemorativa", image: "/chromas/rendered/lula-commemorative-prism-v1.jpg", variant: "commemorative prism-shards" },
  { person: "Renan Santos", role: "Chroma Comemorativa", image: "/chromas/rendered/renan-santos-commemorative-prism-v1.jpg", variant: "commemorative prism-aurora" },
];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function brandSymbol(className = "brand-symbol") {
  return `<img class="${escapeHtml(className)}" src="/brand/symbol-24.svg" alt="" width="24" height="24" aria-hidden="true">`;
}

function candidateRole(candidate) {
  return candidate.role || candidate.area || candidate.affiliation || candidate.party || "Pessoa pública";
}

function candidateSummary(candidate) {
  return candidate.bio || candidate.summary || "Conteúdo editorial em revisão antes da publicação.";
}

function candidateCardSummary(candidate) {
  return candidate.summary || candidate.relevance2026 || "Perfil em revisão editorial.";
}

function candidateAffiliation(candidate) {
  return candidate.party || candidate.affiliation || candidate.area || "Pessoa pública";
}

function safeUrl(value = "") {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function profileSection(title, content, className = "") {
  if (!String(content || "").trim()) return "";
  return `<section${className ? ` class="${className}"` : ""}><h3>${escapeHtml(title)}</h3><p>${escapeHtml(content)}</p></section>`;
}

function portrait(candidate) {
  const photo = candidatePhoto(candidate);
  return `<div class="portrait">
    <span class="portrait-fallback">${escapeHtml(initials(candidate.name))}</span>
    ${photo ? `<img src="${escapeHtml(photo)}" alt="Foto de ${escapeHtml(candidate.name)}" onerror="this.remove()">` : ""}
  </div>`;
}

function card(candidate, { mode = "vote" } = {}) {
  const prediction = mode === "prediction";
  const outcome = prediction ? null : state.roundOutcome?.outcomes.find(({ id }) => id === candidate.id);
  const outcomeClass = outcome ? ` is-round-${outcome.winner ? "winner" : "loser"}` : "";
  const delta = Number(outcome?.delta);
  const outcomeStamp = outcome ? `<span class="card-outcome ${outcome.tone}" aria-live="polite"><b>${Number.isFinite(delta) ? `${delta > 0 ? "+" : ""}${delta} Elo` : outcome.winner ? "Escolhida" : "Não foi desta vez"}</b><small>${escapeHtml(outcome.shortMessage)}</small></span>` : "";
  const locked = prediction
    ? state.predictionBusy || Boolean(state.pendingPredictionAction)
    : state.busy || Boolean(state.pendingWinnerId);
  const dataAttribute = prediction ? "data-predict" : "data-vote";
  const ariaInstruction = prediction
    ? PREDICTION_REVEAL_COPY.cardAria
    : "Toque para escolher; segure para saber quem é.";
  const interactionHint = prediction
    ? `<small class="candidate-profile-hint">${PREDICTION_REVEAL_COPY.cardHint}</small>`
    : '<small class="candidate-profile-hint"><span aria-hidden="true">ⓘ</span> Segure para conhecer</small>';
  const activelySending = prediction ? state.predictionBusy : state.busy;
  return `<div class="candidate-wrap">
    <button class="candidate-card basic-card${state.selectedId === candidate.id ? " is-selected" : ""}${outcomeClass}" type="button" ${dataAttribute}="${escapeHtml(candidate.id)}" ${locked ? `disabled${activelySending ? ' aria-busy="true"' : ""}` : ""} aria-label="${escapeHtml(candidate.name)}, carta básica. ${ariaInstruction}">
      <span class="card-material" aria-hidden="true"></span>
      <span class="card-facets" aria-hidden="true"></span>
      <span class="card-brand" aria-hidden="true">${brandSymbol("card-brand-symbol")}<b>PoliMatch</b></span>
      ${portrait(candidate)}
      <span class="candidate-copy">
        <span class="candidate-title"><strong class="candidate-name">${escapeHtml(candidate.displayName || shortName(candidate.name))}</strong><span class="card-rarity" aria-hidden="true">●</span></span>
        <span class="candidate-affiliation">${escapeHtml(candidateAffiliation(candidate))}</span>
        <span class="candidate-office">${escapeHtml(candidate.office || candidateRole(candidate))}</span>
        <small class="candidate-summary">${escapeHtml(candidateCardSummary(candidate))}</small>
        ${interactionHint}
        ${outcomeStamp}
      </span>
      <span class="card-corners" aria-hidden="true"></span>
    </button>
  </div>`;
}

function header() {
  const soundLabel = state.soundEnabled ? "Desativar efeitos sonoros" : "Ativar efeitos sonoros";
  const accountLabel = state.account?.displayName ? `Olá, ${escapeHtml(state.account.displayName.split(" ")[0])}` : "Salvar jogo";
  const avatar = safeUrl(state.account?.avatarUrl) ? `<img src="${escapeHtml(state.account.avatarUrl)}" alt="" referrerpolicy="no-referrer">` : brandSymbol("account-symbol");
  return `<header class="topbar"><p class="brand">${brandSymbol()}<span>PoliMatch</span></p><div class="topbar-actions"><span class="edition">Malaquita 2026</span><button class="account-button${state.account ? " is-signed-in" : ""}" id="account-button" type="button" aria-label="${state.account ? "Abrir sua conta" : "Salvar seu jogo com Google"}">${avatar}<span>${accountLabel}</span></button><button class="sound-toggle${state.soundEnabled ? " is-on" : ""}" id="sound-toggle" type="button" aria-label="${soundLabel}" aria-pressed="${state.soundEnabled}"><span aria-hidden="true">${state.soundEnabled ? "♪" : "♪̸"}</span></button></div></header>`;
}

function authOverlay() {
  if (!state.authOpen) return "";
  const configured = Boolean(googleClientId());
  const signedIn = Boolean(state.account);
  return `<div class="auth-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-title">
    <section class="auth-card">
      <button class="auth-close" id="close-auth" type="button" aria-label="Fechar">×</button>
      <span class="auth-mark" aria-hidden="true">${brandSymbol("auth-symbol")}</span>
      <p class="eyebrow">${signedIn ? "Seu jogo está salvo" : "Leve seu ranking com você"}</p>
      <h2 id="auth-title">${signedIn ? `Tudo certo, ${escapeHtml(state.account.displayName?.split(" ")[0] || "jogador")}!` : "Entrou, salvou, jogou."}</h2>
      <p>${signedIn ? "Suas escolhas ficam ligadas a esta conta e podem continuar em outro aparelho." : "Use o Google para guardar suas escolhas. Sem cadastro, sem senha nova e sem interromper a diversão."}</p>
      ${state.authError ? `<p class="auth-error" role="alert">${escapeHtml(state.authError)}</p>` : ""}
      ${signedIn
        ? `<button class="auth-secondary" id="logout" type="button" ${state.authBusy ? "disabled" : ""}>Sair desta conta</button>`
        : configured
          ? `<div class="google-button-wrap${state.authBusy ? " is-busy" : ""}" id="google-button"><span>${state.authBusy ? "Confirmando…" : "Carregando Google…"}</span></div>`
          : `<p class="auth-config-note">O acesso com Google está sendo preparado. Você pode continuar jogando normalmente.</p>`}
      <button class="auth-continue" id="continue-anonymous" type="button">${signedIn ? "Voltar ao jogo" : "Continuar jogando"}</button>
      <small>O Google confirma sua identidade; sua senha nunca passa pelo PoliMatch.</small>
    </section>
  </div>`;
}

function topicsScreen() {
  const approvedCandidates = state.candidates.filter((candidate) => candidatePhoto(candidate));
  const featuredSlots = [47, 28, 1, 63];
  const featuredCandidates = featuredSlots.map((personId) => approvedCandidates.find((candidate) => Number(candidate.personId) === personId)).filter(Boolean);
  const preview = featuredCandidates.map((candidate, index) => {
    const photo = candidatePhoto(candidate);
    return `<article class="home-preview-card home-preview-card-${index + 1}" aria-hidden="true">
      ${photo ? `<img src="${escapeHtml(photo)}" alt="" width="240" height="300">` : ""}
      <span><strong>${escapeHtml(candidate.displayName || shortName(candidate.name))}</strong><small>${escapeHtml(candidateAffiliation(candidate))}</small></span>
    </article>`;
  }).join("");
  const approvedCount = approvedCandidates.length;
  const dailyAnswered = Number(state.dailySession?.progress?.answered) || 0;
  const dailyTotal = Number(state.dailySession?.progress?.total) || 10;
  const dailyComplete = state.dailySession?.status === "completed";
  const dailyAction = aggregateAvailable("prediction-reveal") && state.dailySession?.pendingPrediction
    ? formatAggregateCopy(PREDICTION_REVEAL_COPY.resumeTemplate, { slot: state.dailySession.pendingPrediction.slot, total: dailyTotal })
    : dailyComplete ? "Ver fechamento de hoje" : dailyAnswered ? `Continuar · ${dailyAnswered}/${dailyTotal}` : "Jogar rodada do dia";
  const predictionReveal = aggregateAvailable("prediction-reveal");
  const aggregateTrust = aggregateAvailable("global-ranking")
    ? `<span>${formatAggregateCopy(PUBLIC_RANKING_COPY.homeCountTemplate, { count: `<strong>${state.globalDuels}</strong>` })}</span>`
    : `<span><strong>${state.personalDuels}</strong> escolhas no seu ranking</span>`;
  return `<main class="screen home-screen">
    <section class="home-hero">
      <div class="home-hero-copy">
        <p class="eyebrow">Sua opinião em movimento</p>
        <h1>Quem representa o Brasil que você imagina?</h1>
        <p class="lead">Escolha entre pessoas públicas, conheça cada perfil e veja seu ranking ganhar forma — uma decisão por vez.</p>
        <div class="home-actions">
          <button class="primary home-primary" type="button" id="start-election">${dailyAction}<span aria-hidden="true">→</span></button>
          <button class="home-ranking-link" type="button" id="open-ranking">${aggregateAvailable("global-ranking") ? PUBLIC_RANKING_COPY.homeCta : "Ver meu ranking"}</button>
          ${predictionReveal ? `<button class="home-ranking-link" type="button" id="open-prediction-results">${PREDICTION_REVEAL_COPY.homeCta}</button>` : ""}
        </div>
        <div class="home-trust" aria-label="Informações da edição">
          <span><strong>${dailyAnswered}/${dailyTotal}</strong> rodada do dia</span>
          ${aggregateTrust}
        </div>
      </div>
      <div class="home-deck" aria-label="Prévia das cartas básicas">
        <span class="home-deck-glow" aria-hidden="true"></span>
        ${preview}
        <p><span aria-hidden="true">◆</span> Cartas básicas · Edição 2026</p>
      </div>
    </section>

    <section class="home-topic" aria-labelledby="home-topic-title">
      <div class="home-topic-heading">
        <div><p class="eyebrow">Edição disponível</p><h2 id="home-topic-title">Eleições 2026</h2></div>
        <span class="home-live"><i aria-hidden="true"></i> no ar</span>
      </div>
      <p>Dez escolhas fixas, iguais para todo mundo, fechadas à meia-noite de São Paulo. Segure qualquer carta para conhecer o perfil antes de escolher.</p>
      <button class="home-topic-cta" type="button" id="start-election-secondary"><span>${dailyAction}</span><b aria-hidden="true">→</b></button>
    </section>

    <section class="home-how" aria-labelledby="home-how-title">
      <div><p class="eyebrow">Como funciona</p><h2 id="home-how-title">Rápido de jogar. Fácil de entender.</h2></div>
      <ol>
        <li><span>01</span><strong>Jogue as mesmas dez</strong><small>O baralho do dia é igual para todos.</small></li>
        <li><span>02</span><strong>Escolha sua preferida</strong><small>Um toque confirma a sua decisão.</small></li>
        <li><span>03</span><strong>Feche 10/10</strong><small>Receba o comprovante das suas dez preferências.</small></li>
      </ol>
    </section>

    <section class="home-next" aria-label="Perfis disponíveis nesta edição">
      <p class="eyebrow">Todos no ar</p>
      <div><strong>Políticos + influenciadores</strong><span>${approvedCount} perfis com foto aprovada</span><small>Disponível</small></div>
    </section>
    ${aggregateAvailable("global-ranking") || aggregateAvailable("prediction-reveal") ? "" : `<p class="legal-note home-legal">${WITHHELD_COPY.comparisonUnavailable} ${WITHHELD_COPY.homeSuffix}</p>`}
  </main>`;
}

function dailyClosingScreen() {
  const session = state.dailySession;
  const byId = new Map(state.dailyCandidates.map((candidate) => [candidate.id, candidate]));
  const choices = session.answers.map((answer) => {
    const candidate = byId.get(answer.winnerId);
    return `<li><span>${String(answer.slot).padStart(2, "0")}</span><strong>${escapeHtml(candidate?.displayName || shortName(candidate?.name || answer.winnerId))}</strong></li>`;
  }).join("");
  const predictionReveal = aggregateAvailable("prediction-reveal");
  const cutCopy = predictionReveal
    ? formatAggregateCopy(PREDICTION_REVEAL_COPY.availabilityTemplate, { time: new Date(session.cut.availableAt).toLocaleString("pt-BR", { timeZone: session.ruleset.timeZone, hour: "2-digit", minute: "2-digit" }) })
    : WITHHELD_COPY.comparisonUnavailable;
  const receiptCopy = predictionReveal
    ? formatAggregateCopy(PREDICTION_REVEAL_COPY.receiptTemplate, {
      count: session.predictionProgress.predicted,
      noun: session.predictionProgress.predicted === 1 ? PREDICTION_REVEAL_COPY.predictionNounOne : PREDICTION_REVEAL_COPY.predictionNounMany,
    })
    : "Suas dez preferências ficaram registradas.";
  return `<main class="screen daily-close-screen">
    <section class="daily-close-hero">
      <p class="eyebrow">Rodada do dia · 10/10</p>
      <span class="daily-close-mark" aria-hidden="true">✓</span>
      <h1>Você fechou a rodada.</h1>
      <p class="lead">${receiptCopy} Este é um recorte fechado — amanhã, todo mundo recebe outro baralho.</p>
      ${predictionReveal ? `<p class="daily-methodology">${escapeHtml(session.cut.methodology)}</p>` : ""}
      <small>${escapeHtml(cutCopy)}</small>
    </section>
    <section class="daily-receipt" aria-labelledby="daily-receipt-title">
      <div><p class="eyebrow">Seu comprovante</p><h2 id="daily-receipt-title">As dez escolhidas</h2></div>
      <ol>${choices}</ol>
    </section>
    <div class="daily-close-actions">
      ${predictionReveal ? `<button class="primary" id="open-prediction-results" type="button">${PREDICTION_REVEAL_COPY.closeCta}</button>` : ""}
      <button class="primary" id="start-free-mode" type="button">Continuar no modo livre</button>
      <button class="secondary" id="daily-open-ranking" type="button">Ver meu ranking</button>
    </div>
    ${predictionReveal ? "" : `<p class="legal-note">${WITHHELD_COPY.comparisonUnavailable} ${WITHHELD_COPY.receiptSuffix}</p>`}
  </main>`;
}

function dailyPredictionScreen() {
  const pending = state.dailySession.pendingPrediction;
  const failed = Boolean(state.pendingPredictionAction && state.predictionError);
  const instruction = state.predictionBusy
    ? PREDICTION_REVEAL_COPY.promptBusy
    : state.predictionError || PREDICTION_REVEAL_COPY.promptInstruction;
  return `<main class="screen duel-screen prediction-screen" data-game-mode="daily-prediction" aria-busy="${state.predictionBusy ? "true" : "false"}">
    <div class="duel-head"><div><p class="eyebrow">${formatAggregateCopy(PREDICTION_REVEAL_COPY.promptEyebrowTemplate, { slot: pending.slot })}</p><h1>${PREDICTION_REVEAL_COPY.promptHeading}</h1></div><span class="progress-pill">${pending.slot}/${state.dailySession.progress.total}</span></div>
    <section class="prediction-baseline" aria-label="${PREDICTION_REVEAL_COPY.baselineAria}"><strong>${PREDICTION_REVEAL_COPY.baselinePercent}</strong><span>${PREDICTION_REVEAL_COPY.baselineDetail}</span></section>
    <p class="round-instruction${state.predictionError ? " is-error" : ""}" role="${state.predictionError ? "alert" : "status"}">${escapeHtml(instruction)}</p>
    ${failed ? `<button class="retry-vote" id="retry-prediction" type="button">${PREDICTION_REVEAL_COPY.retrySame}</button><button class="secondary prediction-refresh" id="refresh-prediction" type="button">${PREDICTION_REVEAL_COPY.refreshState}</button>` : ""}
    <div class="arena arena-four prediction-arena">${state.round.map((candidate) => card(candidate, { mode: "prediction" })).join("")}</div>
    <button class="skip-button" type="button" id="skip-prediction" ${state.predictionBusy || state.pendingPredictionAction ? "disabled" : ""}>${PREDICTION_REVEAL_COPY.skip}</button>
    <p class="daily-fixed-note">${PREDICTION_REVEAL_COPY.fixedPreference}</p>
    <p class="prediction-sealed">${PREDICTION_REVEAL_COPY.sealed}</p>
  </main>`;
}

function predictionResultLabel(round, byId) {
  if (round.result === "correct") return PREDICTION_REVEAL_COPY.resultCorrect;
  if (round.result === "incorrect") return PREDICTION_REVEAL_COPY.resultIncorrect;
  if (round.result === "skipped") return PREDICTION_REVEAL_COPY.resultSkipped;
  if (round.result === "tie") return PREDICTION_REVEAL_COPY.resultTie;
  if (round.result === "no-sample") return PREDICTION_REVEAL_COPY.resultNoSample;
  if (!round.preference) return PREDICTION_REVEAL_COPY.resultNotAnswered;
  const predicted = byId.get(round.prediction?.candidateId);
  return predicted
    ? formatAggregateCopy(PREDICTION_REVEAL_COPY.predictedTemplate, { person: predicted.displayName || shortName(predicted.name) })
    : PREDICTION_REVEAL_COPY.noPrediction;
}

function dailyPredictionResultsScreen() {
  if (!aggregateAvailable("prediction-reveal")) {
    return `<main class="screen connection prediction-results-state"><section class="panel"><p class="eyebrow">${PREDICTION_REVEAL_COPY.scoreboardEyebrow}</p><h1>${WITHHELD_COPY.comparisonHeading}</h1><p>${WITHHELD_COPY.comparisonUnavailable}</p><button class="secondary" id="prediction-results-home" type="button">${PREDICTION_REVEAL_COPY.backHome}</button></section></main>`;
  }
  if (state.predictionResultsLoading || state.predictionResultsError) {
    return `<main class="screen connection prediction-results-state"><section class="panel"><p class="eyebrow">${PREDICTION_REVEAL_COPY.scoreboardEyebrow}</p><h1>${state.predictionResultsError ? PREDICTION_REVEAL_COPY.loadErrorHeading : PREDICTION_REVEAL_COPY.loadingHeading}</h1>${state.predictionResultsError ? `<p role="alert">${escapeHtml(state.predictionResultsError)}</p><button class="primary" id="retry-prediction-results" type="button">${PREDICTION_REVEAL_COPY.retry}</button>` : `<p role="status">${PREDICTION_REVEAL_COPY.loadingDetail}</p>`}<button class="secondary" id="prediction-results-home" type="button">${PREDICTION_REVEAL_COPY.backHome}</button></section></main>`;
  }
  const results = state.predictionResults;
  if (!results?.sessions.length) {
    return `<main class="screen prediction-results-screen"><section class="prediction-score-card"><p class="eyebrow">${PREDICTION_REVEAL_COPY.scoreboardEyebrow}</p><h1>${PREDICTION_REVEAL_COPY.noCutHeading}</h1><p>${PREDICTION_REVEAL_COPY.noCutDetail}</p><strong class="prediction-baseline-copy">${formatAggregateCopy(PREDICTION_REVEAL_COPY.baselineLabelTemplate, { percent: PREDICTION_REVEAL_COPY.baselinePercent })}</strong></section><button class="primary" id="prediction-results-home" type="button">${PREDICTION_REVEAL_COPY.backHome}</button></main>`;
  }
  const score = results.score;
  const accuracy = score.accuracyPercent === null ? "—" : `${String(score.accuracyPercent).replace(".", ",")}%`;
  const sessions = results.sessions.map((session) => {
    const byId = new Map(session.catalog.map((candidate) => [candidate.id, candidate]));
    const rounds = session.rounds.map((round) => {
      const predicted = byId.get(round.prediction?.candidateId);
      const winner = byId.get(round.winnerId);
      const distribution = round.choices.map((choice) => {
        const candidate = byId.get(choice.candidateId);
        return `<li><span><b>${escapeHtml(candidate?.displayName || shortName(candidate?.name || choice.candidateId))}</b><small>${String(choice.percent).replace(".", ",")}% · ${choice.count}</small></span><i aria-hidden="true"><em style="width:${choice.percent}%"></em></i></li>`;
      }).join("");
      const actual = round.outcome === "decided"
        ? formatAggregateCopy(PREDICTION_REVEAL_COPY.mostChosenTemplate, { person: winner?.displayName || shortName(winner?.name || round.winnerId) })
        : round.outcome === "tie" ? PREDICTION_REVEAL_COPY.actualTie : PREDICTION_REVEAL_COPY.actualNoSample;
      const predictionCopy = round.prediction?.skipped
        ? PREDICTION_REVEAL_COPY.playerSkipped
        : predicted
          ? formatAggregateCopy(PREDICTION_REVEAL_COPY.playerPredictionTemplate, { person: predicted.displayName || shortName(predicted.name) })
          : PREDICTION_REVEAL_COPY.playerDidNotAnswer;
      return `<li class="prediction-result-round is-${escapeHtml(round.result)}"><div><span>${formatAggregateCopy(PREDICTION_REVEAL_COPY.slotTemplate, { slot: round.slot })}</span><strong>${escapeHtml(predictionResultLabel(round, byId))}</strong><small>${escapeHtml(predictionCopy)} · ${escapeHtml(actual)}</small></div><ul aria-label="${formatAggregateCopy(PREDICTION_REVEAL_COPY.distributionAriaTemplate, { slot: round.slot })}">${distribution}</ul></li>`;
    }).join("");
    const date = new Date(`${session.edition.date}T12:00:00`).toLocaleDateString("pt-BR");
    const completedSessions = formatAggregateCopy(
      session.completedPlayers === 1 ? PREDICTION_REVEAL_COPY.completedSessionsOneTemplate : PREDICTION_REVEAL_COPY.completedSessionsManyTemplate,
      { count: session.completedPlayers },
    );
    return `<details class="prediction-session"${results.sessions[0] === session ? " open" : ""}><summary><span><strong>${escapeHtml(date)}</strong><small>${escapeHtml(session.methodology)}</small></span><b>${completedSessions}</b></summary>${session.sampleNotice ? `<p class="prediction-sample-note">${escapeHtml(session.sampleNotice)}</p>` : ""}<ol>${rounds}</ol></details>`;
  }).join("");
  return `<main class="screen prediction-results-screen">
    <section class="prediction-score-card"><p class="eyebrow">${PREDICTION_REVEAL_COPY.scoreboardEyebrow}</p><h1>${accuracy}</h1><p><strong>${formatAggregateCopy(PREDICTION_REVEAL_COPY.scoreTemplate, { correct: score.correct, scored: score.scored })}</strong> ${PREDICTION_REVEAL_COPY.scoreDetail}</p><span>${formatAggregateCopy(PREDICTION_REVEAL_COPY.baselineComparisonTemplate, { percent: `<b>${results.baselinePercent}</b>` })}</span><small>${PREDICTION_REVEAL_COPY.neutralResults}</small></section>
    <section class="prediction-history" aria-labelledby="prediction-history-title"><div><p class="eyebrow">${PREDICTION_REVEAL_COPY.historyEyebrow}</p><h2 id="prediction-history-title">${PREDICTION_REVEAL_COPY.historyHeading}</h2></div>${sessions}</section>
    <button class="primary" id="prediction-results-home" type="button">${PREDICTION_REVEAL_COPY.backHome}</button>
    <p class="legal-note">${PREDICTION_REVEAL_COPY.scoreLimit}</p>
  </main>`;
}

function duelScreen() {
  if (state.gameMode === "daily" && (state.dailyLoading || state.dailyLoadError)) {
    const error = state.dailyLoadError
      ? `<p>${escapeHtml(state.dailyLoadError)}</p><button class="primary" id="retry-daily" type="button">Tentar novamente</button><button class="secondary" id="daily-loading-free" type="button">Ir para o modo livre</button>`
      : '<p role="status">Atualizando o baralho do dia…</p>';
    return `<main class="screen connection"><section class="panel"><p class="eyebrow">Rodada do dia</p><h1>${state.dailyLoadError ? "Não conseguimos atualizar a rodada." : "Buscando a edição vigente…"}</h1>${error}</section></main>`;
  }
  if (state.gameMode === "daily" && aggregateAvailable("prediction-reveal") && state.dailySession?.pendingPrediction) return dailyPredictionScreen();
  if (state.gameMode === "daily" && state.dailySession?.status === "completed") return dailyClosingScreen();
  const recovery = voteRecoveryControl(state);
  const feedback = state.personalFeedbackMessage
    ? `<section class="round-feedback" aria-live="polite" aria-atomic="true"><p class="feedback-channel feedback-personal"><strong>No seu ranking</strong><span>${escapeHtml(state.personalFeedbackMessage)}</span></p>${state.globalFeedbackMessage ? `<p class="feedback-channel feedback-global"><strong>${PUBLIC_RANKING_COPY.feedbackChannel}</strong><span>${escapeHtml(state.globalFeedbackMessage)}</span></p>` : ""}</section>`
    : `<p class="round-instruction${state.result ? " is-result" : ""}${state.resultTone === "erro" ? " is-error" : ""}" role="status">${escapeHtml(state.result || "Toque na sua preferida. Segure para conhecer o perfil.")}</p>`;
  const daily = state.gameMode === "daily";
  const progress = daily
    ? `${state.dailySession.progress.answered + 1}/${state.dailySession.progress.total}`
    : `${state.personalDuels} ${state.personalDuels === 1 ? "escolha" : "escolhas"}`;
  return `<main class="screen duel-screen" data-game-mode="${daily ? "daily" : "free"}" data-vote-phase="${escapeHtml(state.votePhase)}" aria-busy="${state.busy ? "true" : "false"}">
    <div class="duel-head"><div><p class="eyebrow">${daily ? "Rodada do dia" : "Modo livre"}</p><h1>Quem você prefere?</h1></div><span class="progress-pill">${progress}</span></div>
    ${feedback}
    ${recovery.visible ? `<button class="retry-vote" type="button" id="${recovery.id}" ${recovery.disabled ? "disabled" : ""}>${escapeHtml(recovery.label)}</button>` : ""}
    <div class="arena arena-four">${state.round.map(card).join("")}</div>
    ${daily ? '<p class="daily-fixed-note">Este slot é igual para todos e não pode ser trocado.</p>' : `<button class="skip-button" type="button" id="skip-round" ${state.busy || state.pendingWinnerId ? "disabled" : ""}>Nenhuma destas · trocar as quatro</button>`}
  </main>`;
}

function rankingScreen() {
  const publicRankingAvailable = aggregateAvailable("global-ranking");
  const personal = !publicRankingAvailable || state.rankingView === "personal";
  const ranking = displayRanking(personal ? state.personalRanking : state.ranking, { personal });
  const filtered = filterRanking(ranking, state.rankingQuery);
  const visible = state.rankingExpanded || state.rankingQuery ? filtered : filtered.slice(0, 25);
  const podium = publicRankingAvailable ? rankingPodium(ranking) : [];
  const highlights = publicRankingAvailable ? rankingHighlights(ranking) : { chosen: [], rejected: [] };
  const totalDuels = personal ? state.personalDuels : state.globalDuels;
  const rows = visible.map((person) => {
    const winNoun = personal
      ? `vitória${person.wins === 1 ? "" : "s"}`
      : person.wins === 1 ? PUBLIC_RANKING_COPY.rowWinOne : PUBLIC_RANKING_COPY.rowWinMany;
    const lossNoun = personal
      ? `derrota${person.losses === 1 ? "" : "s"}`
      : person.losses === 1 ? PUBLIC_RANKING_COPY.rowLossOne : PUBLIC_RANKING_COPY.rowLossMany;
    const unplayed = personal ? "Ainda sem comparações" : PUBLIC_RANKING_COPY.rowUnplayed;
    const eloSuffix = personal ? "Elo" : PUBLIC_RANKING_COPY.eloSuffix;
    return `<button class="ranking-row" type="button" data-profile="${escapeHtml(person.id)}"><strong class="rank-position">${person.displayRank ?? "—"}</strong><span class="rank-person">${escapeHtml(person.displayName || shortName(person.name))}<small>${escapeHtml(person.affiliation || person.party || candidateRole(person))}</small>${person.decisions ? `<span class="vote-counts"><b class="vote-positive">+ ${person.wins} ${winNoun}</b><b class="vote-negative">− ${person.losses} ${lossNoun}</b></span>` : `<span class="not-played">${unplayed}</span>`}</span><strong class="rank-score">${person.decisions ? `${person.winRate}%<small>${person.elo} ${eloSuffix}</small>` : "—"}</strong></button>`;
  }).join("");
  const podiumCards = podium.map((person) => `<button class="podium-card podium-${Math.min(person.displayRank, 3)}" type="button" data-profile="${escapeHtml(person.id)}"><span>${person.displayRank}º</span><strong>${escapeHtml(person.displayName || shortName(person.name))}</strong><small>${person.winRate}%</small></button>`).join("");
  const highlightColumn = (title, type, people) => `<section class="ranking-highlight ranking-highlight-${type}"><p>${title}</p>${people.length ? people.map((person, index) => `<button type="button" data-profile="${escapeHtml(person.id)}"><span>${index + 1}</span><strong>${escapeHtml(person.displayName || shortName(person.name))}</strong><b>${type === "chosen" ? `+${person.wins}` : `−${person.losses}`}</b></button>`).join("") : `<small>${PUBLIC_RANKING_COPY.awaitingDuels}</small>`}</section>`;
  const publicPulse = !personal && (highlights.chosen.length || highlights.rejected.length) ? `<section class="public-pulse" aria-label="${PUBLIC_RANKING_COPY.pulseAria}"><div class="section-title"><span>${PUBLIC_RANKING_COPY.pulse}</span><small>${PUBLIC_RANKING_COPY.pulseDetail}</small></div><div class="pulse-grid">${highlightColumn(PUBLIC_RANKING_COPY.mostWins, "chosen", highlights.chosen)}${highlightColumn(PUBLIC_RANKING_COPY.mostLosses, "rejected", highlights.rejected)}</div></section>` : "";
  const empty = state.rankingQuery
    ? personal ? "Nenhum nome encontrado." : PUBLIC_RANKING_COPY.searchEmpty
    : personal ? "Faça uma escolha para começar seu ranking pessoal." : PUBLIC_RANKING_COPY.empty;
  const reveal = !state.rankingQuery && !state.rankingExpanded && filtered.length > visible.length
    ? `<button class="secondary reveal-ranking" id="reveal-ranking" type="button">${personal ? `Ver ranking completo (${filtered.length})` : formatAggregateCopy(PUBLIC_RANKING_COPY.revealTemplate, { count: filtered.length })}</button>`
    : "";
  const policy = personal && state.personalRankingPolicy
    ? `<p class="ranking-policy"><strong>Ordenado por ${escapeHtml(state.personalRankingPolicy.label)}</strong><span>${escapeHtml(state.personalRankingPolicy.explanation)}</span></p>`
    : "";
  const trust = personal ? "" : `<p class="ranking-trust">${PUBLIC_RANKING_COPY.trust} <a href="/integridade.html">${PUBLIC_RANKING_COPY.integrityLink}</a></p>`;
  const selector = publicRankingAvailable
    ? `<div class="segmented" aria-label="Tipo de ranking"><button class="${personal ? "" : "active"}" data-ranking-view="general">${PUBLIC_RANKING_COPY.selector}</button><button class="${personal ? "active" : ""}" data-ranking-view="personal">${PUBLIC_RANKING_COPY.personalSelector}</button></div>`
    : `<p class="ranking-trust">${WITHHELD_COPY.comparisonUnavailable} ${WITHHELD_COPY.rankingSuffix}</p>`;
  const countNoun = personal
    ? totalDuels === 1 ? "escolha confirmada" : "escolhas confirmadas"
    : totalDuels === 1 ? PUBLIC_RANKING_COPY.choiceCountOne : PUBLIC_RANKING_COPY.choiceCountMany;
  const topicEyebrow = personal ? "Eleições 2026" : PUBLIC_RANKING_COPY.topicEyebrow;
  const searchLabel = personal ? "Todos os nomes" : PUBLIC_RANKING_COPY.searchLabel;
  const searchPlaceholder = personal ? "Buscar nome ou partido" : PUBLIC_RANKING_COPY.searchPlaceholder;
  const backToChoices = personal ? "Voltar às escolhas" : PUBLIC_RANKING_COPY.backToChoices;
  return `<main class="screen ranking-screen">${state.result ? `<div class="result-banner" role="status">${escapeHtml(state.result)}</div>` : ""}<section class="ranking-overview"><header class="ranking-heading"><p class="eyebrow">${topicEyebrow}</p><h1>${publicRankingAvailable ? PUBLIC_RANKING_COPY.heading : "Seu ranking"}</h1><p>${personal ? "O retrato das comparações que você fez." : PUBLIC_RANKING_COPY.description}</p><strong>${totalDuels} ${countNoun}</strong>${trust}</header>${selector}${policy}${publicPulse}${podiumCards ? `<section class="podium" aria-label="${PUBLIC_RANKING_COPY.podiumAria}">${podiumCards}</section>` : ""}</section><section class="ranking-results"><label class="ranking-search"><span>${searchLabel}</span><input id="ranking-search" type="search" value="${escapeHtml(state.rankingQuery)}" placeholder="${searchPlaceholder}" autocomplete="off"></label><section class="panel ranking-list">${rows || `<p class="empty">${empty}</p>`}</section>${reveal}<button class="primary continue-duels" id="continue-duels" type="button">${backToChoices}</button></section></main>`;
}

function collectionScreen() {
  const unique = [...new Map(state.collection.map((person) => [person.id, person])).values()];
  const cards = unique.map((person) => `<div class="ranking-row">${brandSymbol("collection-symbol")}<span>${escapeHtml(shortName(person.name))}<br><small>Chroma possuída</small></span><strong>×${state.collection.filter(({ id }) => id === person.id).length}</strong></div>`).join("");
  const previewCard = ({ person, role, image, variant }) => `<article class="chroma-card featured-chroma-card ${variant}" data-hologram tabindex="0" aria-label="${escapeHtml(person)}, ${escapeHtml(role)}. Mova o dedo ou incline o celular para ver o holograma.">
    <img class="chroma-art" src="${escapeHtml(image)}" alt="${escapeHtml(role)} de ${escapeHtml(person)}" width="530" height="742">
    <span class="holo-foil" aria-hidden="true"></span><span class="holo-pattern" aria-hidden="true"></span><span class="holo-glint" aria-hidden="true"></span>
  </article>`;
  const batchCard = ({ personId, person, look, lookName, image }) => `<article class="chroma-card approved-chroma-card look-${look.toLowerCase()}" data-hologram tabindex="0" aria-label="${escapeHtml(person)}, carta básica com acabamento ${escapeHtml(lookName)}.">
    <img class="chroma-art approved-chroma-art" src="${escapeHtml(image)}" alt="Carta básica de ${escapeHtml(person)}" width="600" height="750" loading="lazy" decoding="async">
    <span class="approved-chroma-brand" aria-hidden="true">${brandSymbol("approved-brand-symbol")}<b>PoliMatch</b></span>
    <span class="approved-chroma-frame" aria-hidden="true"></span>
    <span class="approved-chroma-copy"><strong>${escapeHtml(person)}</strong><small>${escapeHtml(lookName)}</small><em>#${escapeHtml(personId)} · ARTE EDITADA POR IA</em></span>
    <span class="holo-foil" aria-hidden="true"></span><span class="holo-pattern" aria-hidden="true"></span><span class="holo-glint" aria-hidden="true"></span>
  </article>`;
  const supreme = chromaPreviews.filter(({ variant }) => variant.startsWith("supreme")).map(previewCard).join("");
  const commemorative = chromaPreviews.filter(({ variant }) => variant.startsWith("commemorative")).map(previewCard).join("");
  const batchLimit = state.chromaBatchExpanded ? approvedBasicCards.length : 6;
  const approved = approvedBasicCards.slice(0, batchLimit).map(batchCard).join("");
  const batchButton = state.chromaBatchExpanded
    ? `<button class="secondary batch-toggle" id="collapse-chroma-batch" type="button">Mostrar apenas os primeiros</button>`
    : `<button class="primary batch-toggle" id="expand-chroma-batch" type="button">Ver as 35 cartas básicas</button>`;
  return `<main class="screen collection-screen"><div><p class="eyebrow">Laboratório de Chromas</p><h1>Coleção</h1><p class="lead">Mova o dedo sobre cada carta. No celular, ative a inclinação para o reflexo acompanhar o aparelho.</p><button class="motion-button" id="enable-chroma-motion" type="button">Ativar efeito ao inclinar</button><p class="motion-status" id="motion-status" role="status"></p></div>
    <section class="chroma-tier"><div class="chroma-tier-heading"><div><p class="eyebrow">Chroma Suprema</p><h2>Três estrelas douradas</h2></div><span class="tier-symbol gold-stars">★★★</span></div><p>Ouro em relevo, feixes direcionais e dois desenhos holográficos exclusivos.</p><div class="chroma-gallery">${supreme}</div></section>
    <section class="chroma-tier"><div class="chroma-tier-heading"><div><p class="eyebrow">Chroma Comemorativa</p><h2>Estrela prismática</h2></div><span class="tier-symbol prism-star">★</span></div><p>Cristal óptico, espectro colorido e refração diferente em cada pessoa.</p><div class="chroma-gallery">${commemorative}</div></section>
    <section class="chroma-tier approved-batch"><div class="chroma-tier-heading"><div><p class="eyebrow">Cartas básicas</p><h2>35 acabamentos aprovados</h2></div><span class="tier-symbol batch-count">35</span></div><p>São as cartas básicas atuais. As futuras Chromas serão colecionáveis e sempre usarão outra fotografia da pessoa.</p><div class="chroma-gallery approved-chroma-gallery">${approved}</div>${batchButton}<p class="batch-disclosure">Imagens tratadas para compor a edição básica do PoliMatch.</p></section>
    <section><p class="eyebrow">Sua coleção</p><section class="panel ranking-list">${cards || '<p class="empty">Demonstração visual: estas Chromas ainda não foram adicionadas ao seu inventário.</p>'}</section></section>
  </main>`;
}

function nav() {
  return `<nav class="bottom-nav" aria-label="Navegação principal">
    <button class="nav-button ${state.screen === "topics" ? "active" : ""}" data-screen="topics">Início</button>
    <button class="nav-button ${state.screen === "duel" ? "active" : ""}" data-screen="duel">Duelo</button>
    <button class="nav-button ${state.screen === "ranking" ? "active" : ""}" data-screen="ranking">Ranking</button>
  </nav>`;
}

function connectionScreen() {
  return `<main class="connection"><section class="panel"><p class="eyebrow">Conexão necessária</p><h1>Não conseguimos falar com o servidor.</h1><p>${escapeHtml(state.error)}. Nenhuma escolha será registrada enquanto a conexão não voltar.</p><button class="primary" id="retry" type="button">Tentar novamente</button></section></main>`;
}

function coachOverlay() {
  if (!state.showCoach) return "";
  const finalInstruction = state.gameMode === "daily"
    ? "Esta combinação é fixa e igual para todos: não há troca no modo diário."
    : "Se nenhuma fizer sentido, troque as quatro.";
  return `<div class="coach-overlay" role="dialog" aria-modal="true" aria-labelledby="coach-title"><section class="coach-card"><span class="coach-icon" aria-hidden="true">${brandSymbol("coach-symbol")}</span><p class="eyebrow">Primeira rodada</p><h2 id="coach-title">Escolha uma entre quatro.</h2><p>Toque na sua preferida. Segure qualquer carta para conhecer a pessoa. ${finalInstruction}</p><button class="primary" id="dismiss-coach" type="button">Começar rodada</button></section></div>`;
}

function render() {
  if (!state.ready) {
    app.innerHTML = `<div class="app-shell">${header()}${state.error ? connectionScreen() : '<main class="connection"><p>Preparando o duelo…</p></main>'}</div>`;
  } else {
    const screen = state.screen === "duel"
      ? duelScreen()
      : state.screen === "ranking"
        ? rankingScreen()
        : state.screen === "collection"
          ? collectionScreen()
          : state.screen === "prediction-results"
            ? dailyPredictionResultsScreen()
            : topicsScreen();
    app.innerHTML = `<div class="app-shell">${header()}${screen}${nav()}</div><dialog id="modal"></dialog>${coachOverlay()}${authOverlay()}`;
  }
  bindEvents();
}

function showProfile(id) {
  const person = state.dailyCandidates.find((candidate) => candidate.id === id)
    || state.candidates.find((candidate) => candidate.id === id);
  if (!person) return;
  sound.play("profile");
  const modal = document.querySelector("#modal");
  const metadata = [person.office, person.party, person.location].filter(Boolean);
  const facts = (person.facts || []).map((fact) => `<li>${escapeHtml(fact)}</li>`).join("");
  const sources = (person.sources || []).map((source) => {
    const href = safeUrl(typeof source === "string" ? source : source.url);
    const label = typeof source === "string" ? "Fonte" : source.label || source.publisher || "Fonte";
    return href ? `<li><a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a></li>` : "";
  }).join("");
  const predictionBlocksVote = aggregateAvailable("prediction-reveal") && state.dailySession?.pendingPrediction;
  const canVote = state.screen === "duel" && !predictionBlocksVote
    && state.round.some((candidate) => candidate.id === person.id) && !state.busy && !state.pendingWinnerId;
  modal.innerHTML = `<button class="dialog-close" id="close-modal-top" type="button" aria-label="Fechar resumo">×</button><div class="profile-scroll"><div class="profile-preview">${portrait(person)}</div><div class="dialog-body profile-copy"><p class="eyebrow">Quem é?</p><h2>${escapeHtml(person.name)}</h2><p class="profile-role"><strong>${escapeHtml(candidateRole(person))}</strong></p>${metadata.length ? `<p class="profile-meta">${metadata.map(escapeHtml).join(" · ")}</p>` : ""}${profileSection("Sobre", candidateSummary(person))}${profileSection("Por que está nesta curadoria", person.relevance2026)}${facts ? `<section><h3>Três fatos</h3><ul>${facts}</ul></section>` : ""}${profileSection("Realização ou destaque", person.highlight)}${profileSection("Pontos de atenção", person.controversy, "profile-caution")}<section><h3>Fontes</h3>${sources ? `<ul class="source-list">${sources}</ul>${person.reviewedAt ? `<p class="review-note">Revisado em ${escapeHtml(person.reviewedAt)}.</p>` : ""}` : '<p class="review-note">Fontes em revisão editorial. O perfil só será publicado depois da checagem.</p>'}</section></div></div><div class="dialog-actions">${canVote ? `<button class="primary" id="vote-from-profile" data-candidate="${escapeHtml(person.id)}" type="button">Escolher esta pessoa</button>` : ""}<button class="secondary" id="close-modal" type="button">Voltar ao duelo</button></div>`;
  let silentClose = false;
  modal.showModal();
  modal.addEventListener("close", () => {
    if (!silentClose) sound.play("dismiss");
    document.querySelectorAll(".candidate-card.is-peeking").forEach((cardElement) => cardElement.classList.remove("is-peeking"));
  }, { once: true });
  const closeProfile = () => modal.close();
  modal.querySelector("#close-modal").addEventListener("click", closeProfile);
  modal.querySelector("#close-modal-top").addEventListener("click", closeProfile);
  modal.onclick = (event) => {
    if (event.target === modal) modal.close();
  };
  modal.querySelector("#close-modal-top").focus();
  modal.querySelector("#vote-from-profile")?.addEventListener("click", () => {
    silentClose = true;
    modal.close();
    vote(person.id);
  });
}

function chooseNextRound() {
  if (state.gameMode !== "free") throw new Error("rodada diária só avança pela resposta autoritativa do servidor");
  state.previousRound = state.round.map(({ id }) => id);
  const next = nextBalancedGroup(state.candidates, state.matchQueue, state.previousRound);
  state.round = next.group;
  state.matchQueue = next.queue;
  state.roundId = crypto.randomUUID();
  state.pendingWinnerId = "";
  state.votePhase = VOTE_PHASES.READY;
  state.voteAction = "";
  state.retryAfterSeconds = null;
  state.retryAt = 0;
  state.sessionRecoveryMode = "";
}

async function refreshDailySession(identity, { showCoach = false } = {}) {
  const loadEpoch = Number(state.dailyLoadEpoch || 0) + 1;
  state.dailyLoadEpoch = loadEpoch;
  state.dailyLoading = true;
  state.dailyLoadError = "";
  render();
  try {
    const session = await loadDailySession(identity.recoveryKey);
    if (state.dailyLoadEpoch !== loadEpoch || !isCurrentVoteIdentity(state, identity)) return false;
    installDailySession(session);
    state.showCoach = showCoach && state.dailySession.status === "active"
      && localStorage.getItem("polimatch:v4:round-coach") !== "seen";
    render();
    return true;
  } catch (error) {
    if (state.dailyLoadEpoch !== loadEpoch || !isCurrentVoteIdentity(state, identity)) return false;
    state.dailyLoading = false;
    state.dailyLoadError = error.message || "Falha desconhecida";
    state.showCoach = false;
    render();
    return false;
  }
}

async function enterDuel(mode = state.gameMode) {
  if (state.busy) return;
  sound.play("enter");
  const previousMode = state.gameMode;
  state.dailyLoadEpoch = Number(state.dailyLoadEpoch || 0) + 1;
  state.gameMode = mode;
  state.screen = "duel";
  state.dailyLoadError = "";
  if (mode === "free") {
    state.dailyLoading = false;
    if (previousMode !== "free" || state.round.length !== 4) prepareFreeRound();
    state.showCoach = localStorage.getItem("polimatch:v4:round-coach") !== "seen";
    render();
    return;
  }

  const identity = { epoch: state.identityEpoch, recoveryKey: state.recoveryKey };
  state.showCoach = false;
  await refreshDailySession(identity, { showCoach: true });
}

async function vote(winnerId, { retry = false } = {}) {
  if (state.busy || (state.pendingWinnerId && !retry)) return;
  const winner = state.round.find(({ id }) => id === winnerId);
  if (!winner || state.round.length !== 4) return;
  const attempt = {
    gameMode: state.gameMode,
    roundId: state.roundId,
    winnerId: winner.id,
    candidateIds: state.round.map(({ id }) => id),
    ...(state.gameMode === "daily" ? {
      editionId: state.dailySession.edition.id,
      slot: state.dailySession.round.slot,
    } : {}),
  };
  const attemptIdentity = {
    epoch: state.identityEpoch,
    recoveryKey: state.recoveryKey,
  };
  const attemptPlayerVersion = state.playerVersion;
  sound.play("choose");
  state.busy = true;
  state.votePhase = VOTE_PHASES.SENDING;
  state.voteAction = "";
  state.retryAfterSeconds = null;
  state.retryAt = 0;
  state.selectedId = winner.id;
  clearVoteTimers();
  state.roundOutcome = null;
  state.personalFeedbackMessage = "";
  state.globalFeedbackMessage = "";
  state.result = "Confirmando sua escolha…";
  state.resultTone = "";
  const aggregateResponseAllowed = aggregateAvailable("global-ranking");
  render();
  try {
    const response = attempt.gameMode === "daily"
      ? await submitDailyVote(attempt.roundId, attempt.editionId, attempt.slot, attempt.winnerId, "eleicoes-2026", {
        recoveryKey: attemptIdentity.recoveryKey,
        version: attemptPlayerVersion,
        predictionEnabled: aggregateAvailable("prediction-reveal"),
      })
      : await submitRoundVote(attempt.roundId, attempt.winnerId, attempt.candidateIds, "eleicoes-2026", {
        recoveryKey: attemptIdentity.recoveryKey,
        version: attemptPlayerVersion,
      });
    if (!isCurrentVoteIdentity(state, attemptIdentity)) return;
    const dailyMode = attempt.gameMode === "daily";
    const responseForValidation = aggregateResponseAllowed && aggregateAvailable("global-ranking")
      ? response
      : { ...response, publicAggregate: { status: "withheld", scope: "global-ranking" } };
    const confirmed = dailyMode
      ? confirmedDailyVoteData(responseForValidation, state.candidates, attempt, state)
      : confirmedVoteData(responseForValidation, state.candidates, attempt, state);
    if (!confirmed.aggregateAvailable) {
      installCapabilities(withAggregateScopeWithheld(state.capabilities, "global-ranking"));
      state.rankingView = "personal";
    }
    let landingDailySession = dailyMode ? confirmed.dailySession : null;
    let forceDailyRefresh = false;
    if (dailyMode && response.round?.status === "alreadyProcessed") {
      try {
        const currentDailySession = validateDailySession(await loadDailySession(attemptIdentity.recoveryKey));
        if (!isCurrentVoteIdentity(state, attemptIdentity)) return;
        landingDailySession = currentDailySession;
      } catch {
        // Um replay pode pertencer à edição que acabou de fechar. Sem uma
        // leitura autoritativa, nunca instalamos a sessão histórica como se
        // ainda aceitasse o próximo slot.
        forceDailyRefresh = true;
        landingDailySession = null;
      }
    }
    state.pendingWinnerId = "";
    state.votePhase = VOTE_PHASES.CONFIRMED;
    state.resultTone = "";
    state.ranking = confirmed.ranking;
    state.personalRanking = confirmed.personalRanking;
    state.personalRankingPolicy = confirmed.personalRankingPolicy;
    state.playerVersion = confirmed.playerVersion;
    state.globalDuels = confirmed.globalDuels;
    state.personalDuels = confirmed.personalDuels;
    state.pendingDailySession = landingDailySession;
    state.pendingDailyRefresh = forceDailyRefresh;
    const { channels } = confirmed;
    state.roundOutcome = channels.personal;
    state.personalFeedbackMessage = channels.personal.message;
    state.globalFeedbackMessage = channels.global?.message || "";
    state.result = "";
    render();
    const feedbackEvent = channels.personal.primaryEvent || response.vote?.rankingEvent || (response.vote?.zebra ? "zebra" : "confirm");
    sound.play(feedbackEvent);
    try { navigator.vibrate?.(hapticPattern(feedbackEvent)); } catch {}
    roundAdvanceTimer = setTimeout(() => {
      if (dailyMode) {
        if (state.pendingDailyRefresh || !state.pendingDailySession) {
          state.pendingDailySession = null;
          state.pendingDailyRefresh = false;
          state.busy = false;
          state.selectedId = "";
          state.roundOutcome = null;
          state.personalFeedbackMessage = "";
          state.globalFeedbackMessage = "";
          enterDuel("daily");
          return;
        }
        installDailySession(state.pendingDailySession);
        state.pendingDailySession = null;
      } else {
        chooseNextRound();
      }
      state.busy = false;
      state.selectedId = "";
      state.roundOutcome = null;
      render();
      resultTimer = setTimeout(() => {
        if (state.busy) return;
        state.result = "";
        state.resultTone = "";
        state.personalFeedbackMessage = "";
        state.globalFeedbackMessage = "";
        render();
      }, 1800);
    }, 1050);
  } catch (error) {
    if (!isCurrentVoteIdentity(state, attemptIdentity)) return;
    await recoverFromVoteFailure(error, winner, attemptIdentity, attempt.gameMode);
  }
}

async function answerDailyPrediction(candidateId, { retry = false } = {}) {
  if (state.predictionBusy || !state.dailySession?.pendingPrediction) return;
  const action = retry ? state.pendingPredictionAction : { candidateId };
  if (!action || (state.pendingPredictionAction && !retry)) return;
  const pending = state.dailySession.pendingPrediction;
  const attempt = {
    predictionId: state.predictionId,
    editionId: state.dailySession.edition.id,
    slot: pending.slot,
    candidateId: action.candidateId,
  };
  if (attempt.candidateId !== null && !pending.candidateIds.includes(attempt.candidateId)) return;
  const identity = { epoch: state.identityEpoch, recoveryKey: state.recoveryKey };
  state.predictionBusy = true;
  state.predictionError = "";
  state.pendingPredictionAction = action;
  state.selectedId = attempt.candidateId || "";
  render();
  try {
    const response = await submitDailyPrediction(
      attempt.predictionId,
      attempt.editionId,
      attempt.slot,
      attempt.candidateId,
      "eleicoes-2026",
      { recoveryKey: identity.recoveryKey },
    );
    if (!isCurrentVoteIdentity(state, identity)) return;
    const confirmed = confirmedDailyPredictionData(response, attempt, state.dailySession);
    if (!aggregateAvailable("prediction-reveal")) {
      installCapabilities(withAggregateScopeWithheld(state.capabilities, "prediction-reveal"));
      installDailySession(confirmed.dailySession);
      state.predictionBusy = false;
      state.pendingPredictionAction = null;
      state.selectedId = "";
      state.result = `${WITHHELD_COPY.comparisonUnavailable} ${WITHHELD_COPY.runtimeSuffix}`;
      state.resultTone = "";
      render();
      return;
    }
    const replayed = confirmed.prediction.status === "alreadyProcessed";
    installDailySession(confirmed.dailySession);
    if (replayed) {
      // A sessão antiga está confirmada, mas não pode voltar a ficar interativa
      // enquanto a edição vigente é consultada.
      state.busy = true;
      state.predictionBusy = true;
      state.dailyLoading = true;
    }
    const confirmationMessage = attempt.candidateId === null
      ? PREDICTION_REVEAL_COPY.confirmationSkipped
      : PREDICTION_REVEAL_COPY.confirmationSaved;
    state.result = confirmationMessage;
    state.resultTone = "";
    state.selectedId = "";
    sound.play("confirm");
    render();
    if (replayed) {
      // Primeiro instala a resposta antiga que acabou de ser correlacionada.
      // Só então consulta a edição vigente: atravessar a meia-noite não pode
      // transformar uma confirmação idempotente em falha nem reabrir o retry.
      const confirmedEditionId = confirmed.dailySession.edition.id;
      const resynced = await resyncDailyState(identity);
      if (!isCurrentVoteIdentity(state, identity)) return;
      state.busy = false;
      state.predictionBusy = false;
      state.dailyLoading = !resynced;
      state.dailyLoadError = resynced
        ? ""
        : PREDICTION_REVEAL_COPY.confirmedCurrentUnavailable;
      const editionChanged = resynced && state.dailySession.edition.id !== confirmedEditionId;
      if (editionChanged) {
        state.personalFeedbackMessage = "";
        state.globalFeedbackMessage = "";
        state.roundOutcome = null;
      }
      state.result = editionChanged
        ? `${confirmationMessage} ${PREDICTION_REVEAL_COPY.currentEditionOpened}`
        : resynced
          ? confirmationMessage
          : `${confirmationMessage} ${PREDICTION_REVEAL_COPY.refreshCurrentPrompt}`;
      state.resultTone = "";
      render();
    }
  } catch (error) {
    if (!isCurrentVoteIdentity(state, identity)) return;
    if (error?.status === 403 && error?.code === "AGGREGATE_PUBLICATION_WITHHELD") {
      installCapabilities(withAggregateScopeWithheld(state.capabilities, "prediction-reveal"));
      installDailySession(state.dailySession);
      state.predictionBusy = false;
      state.pendingPredictionAction = null;
      state.selectedId = "";
      state.predictionError = "";
      state.result = `${WITHHELD_COPY.comparisonUnavailable} ${WITHHELD_COPY.runtimeSuffix}`;
      state.resultTone = "";
      render();
      sound.play("navigation");
      return;
    }
    if (error?.status === 409 && [
      "DAILY_PREDICTION_ALREADY_RECORDED",
      "DAILY_PREDICTION_OUT_OF_ORDER",
      "DAILY_PREDICTION_CLOSED",
    ].includes(error.code)) {
      const resynced = await resyncDailyState(identity);
      if (!isCurrentVoteIdentity(state, identity)) return;
      state.predictionBusy = false;
      state.pendingPredictionAction = null;
      state.selectedId = "";
      state.predictionError = "";
      state.result = resynced
        ? error.code === "DAILY_PREDICTION_CLOSED"
          ? PREDICTION_REVEAL_COPY.closedResync
          : PREDICTION_REVEAL_COPY.concurrentResync
        : PREDICTION_REVEAL_COPY.resyncFailed;
      state.resultTone = resynced ? "" : "erro";
      render();
      sound.play(resynced ? "navigation" : "error");
      return;
    }
    state.predictionBusy = false;
    state.selectedId = "";
    state.predictionError = error?.unreachable
      ? PREDICTION_REVEAL_COPY.uncertain
      : PREDICTION_REVEAL_COPY.saveFailed;
    render();
    sound.play("error");
  }
}

async function openDailyPredictionResults() {
  if (state.predictionResultsLoading) return;
  if (!aggregateAvailable("prediction-reveal")) {
    state.screen = "prediction-results";
    state.predictionResultsLoading = false;
    state.predictionResultsError = "";
    render();
    return;
  }
  const identity = { epoch: state.identityEpoch, recoveryKey: state.recoveryKey };
  state.screen = "prediction-results";
  state.predictionResultsLoading = true;
  state.predictionResultsError = "";
  render();
  try {
    const results = validateDailyPredictionResults(await loadDailyPredictionResults(identity.recoveryKey));
    if (!isCurrentVoteIdentity(state, identity)) return;
    if (!aggregateAvailable("prediction-reveal")) {
      installCapabilities(withAggregateScopeWithheld(state.capabilities, "prediction-reveal"));
      state.predictionResults = null;
      state.predictionResultsLoading = false;
      state.predictionResultsError = "";
      render();
      return;
    }
    state.predictionResults = results;
    state.predictionResultsLoading = false;
    render();
  } catch (error) {
    if (!isCurrentVoteIdentity(state, identity)) return;
    if (error?.code === "AGGREGATE_PUBLICATION_WITHHELD") {
      installCapabilities(withAggregateScopeWithheld(state.capabilities, "prediction-reveal"));
      state.predictionResults = null;
      state.predictionResultsLoading = false;
      state.predictionResultsError = "";
      render();
      return;
    }
    state.predictionResultsLoading = false;
    state.predictionResultsError = PREDICTION_REVEAL_COPY.resultsLoadFailed;
    render();
  }
}

/**
 * Traduz a falha de um voto em estado honesto e recuperável.
 *
 * Três motivos distintos chegavam aqui como a mesma frase — "seu voto não foi
 * contado" — e nenhum deles oferecia saída. Pior: quando o tempo se esgota, o
 * servidor pode já ter gravado a rodada, e afirmar que não contou é falso.
 */
async function recoverFromVoteFailure(error, winner, attemptIdentity, attemptGameMode) {
  state.busy = false;
  state.selectedId = "";
  state.roundOutcome = null;
  state.personalFeedbackMessage = "";
  state.globalFeedbackMessage = "";
  state.resultTone = "erro";
  state.pendingWinnerId = winner.id;
  if (attemptGameMode === "daily" && error?.status === 409
    && ["DAILY_EDITION_CLOSED", "DAILY_SLOT_OUT_OF_ORDER", "DAILY_PREDICTION_REQUIRED"].includes(error?.code)) {
    const resynced = await resyncDailyState(attemptIdentity);
    if (!isCurrentVoteIdentity(state, attemptIdentity)) return;
    state.pendingWinnerId = "";
    state.votePhase = VOTE_PHASES.READY;
    state.voteAction = "";
    state.resultTone = resynced ? "" : "erro";
    state.result = resynced
      ? error.code === "DAILY_EDITION_CLOSED"
        ? "Virou o dia em São Paulo. O novo baralho já está na mesa."
        : error.code === "DAILY_PREDICTION_REQUIRED"
          ? PREDICTION_REVEAL_COPY.requiredResume
        : "Seu outro acesso já avançou a rodada. Retomamos do próximo slot."
      : "Não conseguimos atualizar a rodada do dia. Recarregue para continuar.";
    render();
    sound.play(resynced ? "navigation" : "error");
    return;
  }
  const failure = voteFailureState(error);
  state.votePhase = failure.phase;
  state.voteAction = failure.action;
  state.retryAfterSeconds = failure.retryAfterSeconds;
  state.retryAt = failure.retryAt;

  // A versão pessoal ficou para trás porque uma rodada anterior chegou ao
  // servidor sem que a resposta voltasse. Realinhar aqui é o que impede o app
  // de recusar todo voto seguinte até alguém recarregar a página.
  if (error?.status === 409 && error?.code === "PLAYER_VERSION_CONFLICT") {
    const resynced = await resyncPlayer(attemptIdentity);
    if (!isCurrentVoteIdentity(state, attemptIdentity)) return;
    state.result = resynced ? failure.message : "Não conseguimos alinhar seu ranking. Tente novamente.";
    // Um 409 acontece antes da gravação desta rodada. A escolha continua
    // pendente e reutiliza o mesmo roundId depois da versão ser atualizada.
    state.pendingWinnerId = winner.id;
    render();
    sound.play("error");
    return;
  }

  state.result = failure.message;
  render();
  scheduleRetryUnlock();
  sound.play("error");
}

function scheduleRetryUnlock() {
  clearTimeout(retryEnableTimer);
  const delay = state.retryAt - Date.now();
  if (delay <= 0) return;
  retryEnableTimer = setTimeout(() => render(), delay + 25);
}

async function restoreVoteSession() {
  if (state.busy || !state.pendingWinnerId || state.voteAction !== VOTE_ACTIONS.RESTORE_SESSION) return;
  const recoveryEpoch = Number(state.identityEpoch || 0);
  state.busy = true;
  state.votePhase = VOTE_PHASES.RESTORING_SESSION;
  state.voteAction = "";
  state.result = "Restabelecendo sua sessão…";
  state.resultTone = "";
  render();
  try {
    let recoveryKey = state.recoveryKey;
    if (state.sessionRecoveryMode !== "load") {
      const created = await createPlayer();
      if (Number(state.identityEpoch || 0) !== recoveryEpoch) return;
      if (!created?.recoveryKey) throw new TypeError("resposta de sessão inválida");
      recoveryKey = created.recoveryKey;
      state.recoveryKey = recoveryKey;
      state.sessionRecoveryMode = "load";
      localStorage.setItem("polimatch:v3:recovery-key", recoveryKey);
    }
    const restoringDailyVote = state.gameMode === "daily";
    const [personal, dailySession] = await Promise.all([
      loadPlayerRanking(recoveryKey),
      // O modo livre não depende da disponibilidade do serviço diário. Só uma
      // tentativa diária precisa restaurar ambos os estados em conjunto.
      restoringDailyVote ? loadDailySession(recoveryKey) : Promise.resolve(null),
    ]);
    if (Number(state.identityEpoch || 0) !== recoveryEpoch || state.recoveryKey !== recoveryKey) return;
    state.playerVersion = personal.version ?? 0;
    state.personalRanking = rankingForCatalog(personal, state.candidates);
    state.personalRankingPolicy = personal.rankingPolicy || null;
    state.personalDuels = Number(personal.duels) || 0;
    if (dailySession) {
      const validatedDaily = validateDailySession(dailySession);
      const changedRound = dailySessionRoundChanged(state.dailySession, validatedDaily);
      if (state.gameMode === "daily" && changedRound) {
        installDailySession(validatedDaily);
        state.pendingWinnerId = "";
        state.busy = false;
        state.votePhase = VOTE_PHASES.READY;
        state.voteAction = "";
        state.sessionRecoveryMode = "";
        state.result = "A rodada do dia mudou enquanto a sessão era restabelecida.";
        render();
        return;
      }
      state.dailySession = validatedDaily;
    }
    state.busy = false;
    state.votePhase = VOTE_PHASES.RETRY_READY;
    state.voteAction = VOTE_ACTIONS.RETRY;
    state.sessionRecoveryMode = "";
    state.result = "Sessão restabelecida. Confirme novamente sua escolha.";
    render();
  } catch (error) {
    if (Number(state.identityEpoch || 0) !== recoveryEpoch) return;
    state.busy = false;
    const failure = voteFailureState(error);
    state.votePhase = failure.phase;
    state.voteAction = VOTE_ACTIONS.RESTORE_SESSION;
    state.retryAfterSeconds = failure.retryAfterSeconds;
    state.retryAt = failure.retryAt;
    state.result = failure.message;
    state.resultTone = "erro";
    render();
    scheduleRetryUnlock();
    sound.play("error");
  }
}

/** Relê o estado do jogador no servidor. Devolve `false` se nem isso deu. */
async function resyncPlayer(attemptIdentity) {
  try {
    const personal = await loadPlayerRanking(attemptIdentity.recoveryKey);
    if (!isCurrentVoteIdentity(state, attemptIdentity)) return false;
    state.playerVersion = personal.version ?? state.playerVersion;
    state.personalRanking = rankingForCatalog(personal, state.candidates);
    state.personalRankingPolicy = personal.rankingPolicy || state.personalRankingPolicy;
    state.personalDuels = Number(personal.duels) || state.personalDuels;
    return true;
  } catch {
    return false;
  }
}

async function resyncDailyState(attemptIdentity) {
  try {
    const [personal, session] = await Promise.all([
      loadPlayerRanking(attemptIdentity.recoveryKey),
      loadDailySession(attemptIdentity.recoveryKey),
    ]);
    if (!isCurrentVoteIdentity(state, attemptIdentity)) return false;
    state.playerVersion = personal.version ?? state.playerVersion;
    state.personalRanking = rankingForCatalog(personal, state.candidates);
    state.personalRankingPolicy = personal.rankingPolicy || state.personalRankingPolicy;
    state.personalDuels = Number(personal.duels) || 0;
    state.pendingDailySession = null;
    installDailySession(session);
    return true;
  } catch {
    return false;
  }
}

function bindEvents() {
  document.querySelector("#account-button")?.addEventListener("click", () => {
    sound.play("navigation");
    state.authOpen = true;
    state.authError = "";
    render();
  });
  const closeAuth = () => { state.authOpen = false; state.authError = ""; render(); };
  document.querySelector("#close-auth")?.addEventListener("click", closeAuth);
  document.querySelector("#continue-anonymous")?.addEventListener("click", closeAuth);
  document.querySelector(".auth-overlay")?.addEventListener("click", (event) => { if (event.target === event.currentTarget) closeAuth(); });
  document.querySelector(".auth-overlay")?.addEventListener("keydown", (event) => { if (event.key === "Escape") closeAuth(); });
  document.querySelector("#logout")?.addEventListener("click", signOut);
  if (state.authOpen) document.querySelector("#close-auth")?.focus();
  document.querySelector("#sound-toggle")?.addEventListener("click", () => {
    if (state.soundEnabled) {
      sound.play("soundOff");
      state.soundEnabled = sound.setEnabled(false);
    } else {
      state.soundEnabled = sound.setEnabled(true);
      sound.play("soundOn");
    }
    render();
    document.querySelector("#sound-toggle")?.focus();
  });
  document.querySelector("#retry")?.addEventListener("click", () => { sound.play("navigation"); initialize(); });
  document.querySelector("#start-election")?.addEventListener("click", () => enterDuel("daily"));
  document.querySelector("#start-election-secondary")?.addEventListener("click", () => enterDuel("daily"));
  document.querySelector("#open-ranking")?.addEventListener("click", () => {
    sound.play("navigation");
    state.screen = "ranking";
    state.rankingView = aggregateAvailable("global-ranking") ? state.rankingView : "personal";
    state.result = "";
    state.resultTone = "";
    render();
  });
  document.querySelector("#open-prediction-results")?.addEventListener("click", () => { sound.play("navigation"); openDailyPredictionResults(); });
  document.querySelector("#retry-prediction-results")?.addEventListener("click", openDailyPredictionResults);
  document.querySelector("#prediction-results-home")?.addEventListener("click", () => {
    sound.play("navigation");
    state.screen = "topics";
    state.predictionResultsError = "";
    render();
  });
  document.querySelector("#continue-duels")?.addEventListener("click", () => { state.result = ""; state.resultTone = ""; enterDuel(); });
  document.querySelector("#start-free-mode")?.addEventListener("click", () => {
    state.result = "";
    state.resultTone = "";
    enterDuel("free");
  });
  document.querySelector("#retry-daily")?.addEventListener("click", () => enterDuel("daily"));
  document.querySelector("#daily-loading-free")?.addEventListener("click", () => enterDuel("free"));
  document.querySelector("#daily-open-ranking")?.addEventListener("click", () => {
    sound.play("navigation");
    state.screen = "ranking";
    state.rankingView = "personal";
    state.result = "";
    state.resultTone = "";
    render();
  });
  document.querySelector("#retry-vote")?.addEventListener("click", () => {
    if (state.busy || !state.pendingWinnerId) return;
    // Mesmo `state.roundId` da tentativa anterior: se aquela chegou ao servidor,
    // esta é reconhecida como repetição e devolve o mesmo resultado.
    vote(state.pendingWinnerId, { retry: true });
  });
  document.querySelector("#retry-prediction")?.addEventListener("click", () => answerDailyPrediction(null, { retry: true }));
  document.querySelector("#refresh-prediction")?.addEventListener("click", async () => {
    if (state.predictionBusy) return;
    state.predictionBusy = true;
    render();
    const identity = { epoch: state.identityEpoch, recoveryKey: state.recoveryKey };
    const resynced = await resyncDailyState(identity);
    if (!isCurrentVoteIdentity(state, identity)) return;
    state.predictionBusy = false;
    if (!resynced) {
      state.predictionError = PREDICTION_REVEAL_COPY.refreshFailed;
    }
    render();
  });
  document.querySelector("#skip-prediction")?.addEventListener("click", () => answerDailyPrediction(null));
  document.querySelector("#restore-session")?.addEventListener("click", restoreVoteSession);
  document.querySelector("#skip-round")?.addEventListener("click", () => {
    if (state.busy || state.pendingWinnerId) return;
    sound.play("shuffle");
    state.result = "";
    state.resultTone = "";
    chooseNextRound();
    render();
  });
  document.querySelector("#dismiss-coach")?.addEventListener("click", () => {
    sound.play("navigation");
    localStorage.setItem("polimatch:v4:round-coach", "seen");
    state.showCoach = false;
    render();
  });
  document.querySelector("#dismiss-coach")?.focus();
  document.querySelector("#reveal-ranking")?.addEventListener("click", () => { state.rankingExpanded = true; render(); });
  document.querySelector("#expand-chroma-batch")?.addEventListener("click", () => { state.chromaBatchExpanded = true; render(); });
  document.querySelector("#collapse-chroma-batch")?.addEventListener("click", () => { state.chromaBatchExpanded = false; render(); document.querySelector(".approved-batch")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  document.querySelector("#ranking-search")?.addEventListener("input", (event) => {
    const cursor = event.target.selectionStart;
    state.rankingQuery = event.target.value;
    render();
    const input = document.querySelector("#ranking-search");
    input?.focus();
    input?.setSelectionRange(cursor, cursor);
  });
  document.querySelectorAll("[data-vote]").forEach((button) => installPressGesture(button, {
    onTap: () => vote(button.dataset.vote),
    onHold: () => {
      button.classList.add("is-peeking");
      try { navigator.vibrate?.(18); } catch {}
      showProfile(button.dataset.vote);
    },
  }));
  document.querySelectorAll("[data-predict]").forEach((button) => installPressGesture(button, {
    onTap: () => answerDailyPrediction(button.dataset.predict),
  }));
  document.querySelectorAll("[data-profile]").forEach((button) => button.addEventListener("click", () => showProfile(button.dataset.profile)));
  document.querySelectorAll("[data-screen]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.screen === "duel") {
      enterDuel();
      return;
    }
    sound.play("navigation");
    state.screen = button.dataset.screen;
    if (state.screen === "ranking" && !aggregateAvailable("global-ranking")) state.rankingView = "personal";
    state.result = "";
    state.resultTone = "";
    render();
  }));
  document.querySelectorAll("[data-ranking-view]").forEach((button) => button.addEventListener("click", () => { sound.play("navigation"); state.rankingView = button.dataset.rankingView; state.rankingQuery = ""; state.rankingExpanded = false; render(); }));
  if (state.screen === "collection") installChromaMotion(document);
  document.querySelector("#enable-chroma-motion")?.addEventListener("click", async (event) => {
    const status = document.querySelector("#motion-status");
    try {
      const enabled = await enableDeviceTilt();
      event.currentTarget.textContent = enabled ? "Inclinação ativada" : "Use o dedo para mover o brilho";
      if (status) status.textContent = enabled ? "Mova o celular para testar os hologramas." : "Este aparelho não liberou o sensor; o efeito pelo toque continua ativo.";
    } catch {
      if (status) status.textContent = "A inclinação não foi autorizada; o efeito pelo toque continua ativo.";
    }
  });
  if (state.authOpen && !state.account && !state.authBusy) mountAuthButton();
}

async function mountAuthButton() {
  const element = document.querySelector("#google-button");
  if (!element || !googleClientId()) return;
  try {
    await mountGoogleButton(element, { callback: handleGoogleCredential });
  } catch (error) {
    if (!state.authOpen) return;
    state.authError = error.message || "Não foi possível abrir o Google agora.";
    render();
  }
}

async function handleGoogleCredential(response) {
  if (!response?.credential || state.authBusy) return;
  state.authBusy = true;
  state.authError = "";
  render();
  let result;
  try {
    result = await exchangeGoogleCredential(response.credential, state.recoveryKey);
  } catch (error) {
    state.authBusy = false;
    state.authError = error.message || "Não foi possível salvar seu jogo agora.";
    sound.play("error");
    render();
    return;
  }
  clearVoteTimers();
  resetPendingVoteForIdentityChange(state);
  localStorage.setItem("polimatch:v3:recovery-key", result.sessionToken);
  state.recoveryKey = result.sessionToken;
  state.account = result.account;
  state.predictionResults = null;
  state.predictionResultsError = "";
  state.personalRanking = rankingForCatalog(result.player, state.candidates);
  state.personalRankingPolicy = result.player.rankingPolicy || state.personalRankingPolicy;
  state.playerVersion = result.player.version;
  state.personalDuels = Number(result.player.duels) || 0;
  state.gameMode = "daily";
  state.dailyLoading = true;
  state.authBusy = false;
  sound.play("confirm");
  render();
  // A identidade já foi confirmada e persistida. Uma indisponibilidade só do
  // serviço diário não pode desfazer o login nem bloquear ranking/modo livre.
  await refreshDailySession({ epoch: state.identityEpoch, recoveryKey: state.recoveryKey });
}

async function signOut() {
  if (state.authBusy) return;
  state.authBusy = true;
  state.authError = "";
  render();
  try {
    await revokeSessionBeforeClearing(state.recoveryKey, {
      endSession,
      clearLocalSession: () => localStorage.removeItem("polimatch:v3:recovery-key"),
    });
    const player = await ensurePlayer();
    clearVoteTimers();
    resetPendingVoteForIdentityChange(state);
    state.recoveryKey = player.recoveryKey;
    state.account = null;
    state.predictionResults = null;
    state.predictionResultsError = "";
    state.personalRanking = rankingForCatalog(player.personal, state.candidates);
    state.personalRankingPolicy = player.personal.rankingPolicy || state.personalRankingPolicy;
    state.playerVersion = player.personal.version;
    state.personalDuels = Number(player.personal.duels) || 0;
    state.gameMode = "daily";
    state.dailyLoading = true;
    state.authBusy = false;
    state.authOpen = false;
    state.result = "Você saiu. Um jogo novo começou neste aparelho.";
    render();
    // A sessão antiga já foi revogada e a identidade anônima já está ativa.
    // O diário tem retry próprio e jamais pode restaurar visualmente a conta.
    await refreshDailySession({ epoch: state.identityEpoch, recoveryKey: state.recoveryKey });
  } catch (error) {
    state.authBusy = false;
    state.authError = error.message || "Não foi possível sair agora.";
    render();
  }
}

async function ensurePlayer() {
  const storageKey = "polimatch:v3:recovery-key";
  let recoveryKey = localStorage.getItem(storageKey) || "";
  if (!recoveryKey) {
    const created = await createPlayer();
    recoveryKey = created.recoveryKey;
    localStorage.setItem(storageKey, recoveryKey);
  }
  try {
    return { recoveryKey, personal: await loadPlayerRanking(recoveryKey) };
  } catch (error) {
    // A chave é a única credencial do jogador e não é exibida em lugar nenhum:
    // descartá-la apaga o ranking pessoal para sempre. Só um 401 prova que ela
    // não vale mais. Qualquer outra falha — 500, 503, tempo esgotado, rede fora —
    // é passageira, e nesses casos a chave precisa sobreviver.
    if (error?.status !== 401) throw error;
    localStorage.removeItem(storageKey);
    const created = await createPlayer();
    localStorage.setItem(storageKey, created.recoveryKey);
    return { recoveryKey: created.recoveryKey, personal: await loadPlayerRanking(created.recoveryKey) };
  }
}

async function initialize() {
  state.error = "";
  state.ready = false;
  render();
  let identity = null;
  try {
    const capabilitiesRequest = loadCapabilities()
      .then(validateCapabilities)
      .catch(() => PERSONAL_ONLY_CAPABILITIES);
    const [candidates, player, capabilities] = await Promise.all([loadCandidates(), ensurePlayer(), capabilitiesRequest]);
    installCapabilities(capabilities);
    let snapshot = null;
    if (aggregateAvailable("global-ranking")) {
      try {
        snapshot = await loadRanking();
      } catch {
        installCapabilities(withAggregateScopeWithheld(state.capabilities, "global-ranking"));
      }
    }
    state.candidates = catalogForTopic(candidates);
    if (state.candidates.length < 4) throw new Error("O elenco ainda não está disponível");
    state.ranking = snapshot ? rankingForCatalog(snapshot, state.candidates) : [];
    state.globalDuels = snapshot ? Number(snapshot.duels) || 0 : 0;
    state.recoveryKey = player.recoveryKey;
    state.playerVersion = player.personal.version;
    state.personalRanking = rankingForCatalog(player.personal, state.candidates);
    state.personalRankingPolicy = player.personal.rankingPolicy || null;
    state.account = player.personal.account || null;
    state.personalDuels = Number(player.personal.duels) || 0;
    state.rankingView = aggregateAvailable("global-ranking") ? "general" : "personal";
    state.gameMode = "daily";
    state.dailyLoading = true;
    state.pendingWinnerId = "";
    state.ready = true;
    identity = { epoch: state.identityEpoch, recoveryKey: state.recoveryKey };
  } catch (error) {
    state.error = error.message || "Falha desconhecida";
  }
  render();
  // Catálogo, identidade e ranking pessoal são o núcleo do app. Agregados são
  // opcionais e fail-closed; sua ausência nunca derruba o jogo pessoal.
  if (identity) await refreshDailySession(identity);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  const changed = applyExpiredAggregateCapabilities();
  scheduleAggregateCapabilityExpiry();
  if (changed) render();
});
window.addEventListener("focus", () => {
  const changed = applyExpiredAggregateCapabilities();
  scheduleAggregateCapabilityExpiry();
  if (changed) render();
});
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
initialize();
