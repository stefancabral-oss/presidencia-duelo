import "./styles.css";
import { createPlayer, endSession, exchangeGoogleCredential, loadCandidates, loadPlayerRanking, loadRanking, submitRoundVote } from "./api.js";
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
import { markPortraitFailed, markPortraitLoaded, patchCandidateSlot, showPersistentPanel } from "./persistent-dom.js";

const app = document.querySelector("#app");
const sound = createSoundController();
const state = {
  screen: "topics",
  candidates: [],
  round: [],
  matchQueue: [],
  previousRound: [],
  ranking: [],
  personalRanking: [],
  personalRankingPolicy: null,
  globalDuels: 0,
  personalDuels: 0,
  rankingView: "general",
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
let refs;
let modalSilentClose = false;

function clearVoteTimers() {
  clearTimeout(resultTimer);
  clearTimeout(roundAdvanceTimer);
  clearTimeout(retryEnableTimer);
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

function candidateSlot(index) {
  return `<div class="candidate-wrap" data-candidate-slot="${index}" hidden>
    <button class="candidate-card basic-card" type="button" data-vote="" aria-disabled="true">
      <span class="card-material" aria-hidden="true"></span>
      <span class="card-facets" aria-hidden="true"></span>
      <span class="card-brand" aria-hidden="true">${brandSymbol("card-brand-symbol")}<b>PoliMatch</b></span>
      <span class="portrait"><span class="portrait-fallback"></span><img alt="" hidden></span>
      <span class="candidate-copy">
        <span class="candidate-title"><strong class="candidate-name"></strong><span class="card-rarity" aria-hidden="true">●</span></span>
        <span class="candidate-affiliation"></span>
        <span class="candidate-office"></span>
        <small class="candidate-summary"></small>
        <small class="candidate-profile-hint"><span aria-hidden="true">ⓘ</span> Segure para conhecer</small>
        <span class="card-outcome" hidden><b></b><small></small></span>
      </span>
      <span class="card-corners" aria-hidden="true"></span>
    </button>
  </div>`;
}

function headerMarkup() {
  return `<header class="topbar"><p class="brand">${brandSymbol()}<span>PoliMatch</span></p><div class="topbar-actions"><span class="edition">Malaquita 2026</span><button class="account-button" id="account-button" type="button" aria-label="Salvar seu jogo com Google"><span class="account-avatar"><img class="account-photo" alt="" referrerpolicy="no-referrer" hidden>${brandSymbol("account-symbol")}</span><span data-account-label>Salvar jogo</span></button><button class="sound-toggle" id="sound-toggle" type="button"><span aria-hidden="true"></span></button></div></header>`;
}

function candidateSlotModel(candidate) {
  const outcome = state.roundOutcome?.outcomes.find(({ id }) => id === candidate.id);
  const delta = Number(outcome?.delta);
  return {
    id: candidate.id,
    accessibleName: `${candidate.name}, carta básica. Toque para escolher; segure para saber quem é.`,
    initials: initials(candidate.name),
    photo: candidatePhoto(candidate),
    photoAlt: `Foto de ${candidate.name}`,
    name: candidate.displayName || shortName(candidate.name),
    affiliation: candidateAffiliation(candidate),
    office: candidate.office || candidateRole(candidate),
    summary: candidateCardSummary(candidate),
    busy: state.busy,
    classes: [
      state.selectedId === candidate.id ? "is-selected" : "",
      outcome ? `is-round-${outcome.winner ? "winner" : "loser"}` : "",
    ].filter(Boolean),
    outcome: outcome ? {
      tone: outcome.tone,
      value: Number.isFinite(delta) ? `${delta > 0 ? "+" : ""}${delta} Elo` : outcome.winner ? "Escolhida" : "Não foi desta vez",
      message: outcome.shortMessage,
    } : null,
  };
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

function topicsContent() {
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
  return `<section class="home-hero">
      <div class="home-hero-copy">
        <p class="eyebrow">Sua opinião em movimento</p>
        <h1>Quem representa o Brasil que você imagina?</h1>
        <p class="lead">Escolha entre pessoas públicas, conheça cada perfil e veja seu ranking ganhar forma — uma decisão por vez.</p>
        <div class="home-actions">
          <button class="primary home-primary" type="button" id="start-election"><span data-home-start-label>${state.personalDuels ? "Continuar escolhendo" : "Começar agora"}</span><span class="home-primary-arrow" aria-hidden="true">→</span></button>
          <button class="home-ranking-link" type="button" id="open-ranking">Ver ranking do público</button>
        </div>
        <div class="home-trust" aria-label="Informações da edição">
          <span><strong data-approved-count>${approvedCount}</strong> perfis com foto aprovada</span>
          <span><strong data-global-duels>${state.globalDuels}</strong> escolhas confirmadas</span>
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
      <p>Compare políticos e influenciadores que já passaram pelo gate de fotografia. Segure qualquer carta para conhecer o perfil completo antes de escolher.</p>
      <button class="home-topic-cta" type="button" id="start-election-secondary"><span>Entrar na rodada</span><b aria-hidden="true">→</b></button>
    </section>

    <section class="home-how" aria-labelledby="home-how-title">
      <div><p class="eyebrow">Como funciona</p><h2 id="home-how-title">Rápido de jogar. Fácil de entender.</h2></div>
      <ol>
        <li><span>01</span><strong>Observe as cartas</strong><small>As opções mudam a cada rodada.</small></li>
        <li><span>02</span><strong>Escolha sua preferida</strong><small>Um toque confirma a sua decisão.</small></li>
        <li><span>03</span><strong>Acompanhe o ranking</strong><small>Veja seu retrato pessoal e o placar do público.</small></li>
      </ol>
    </section>

    <section class="home-next" aria-label="Perfis disponíveis nesta edição">
      <p class="eyebrow">Todos no ar</p>
      <div><strong>Políticos + influenciadores</strong><span>54 perfis com foto aprovada</span><small>Disponível</small></div>
    </section>
    <p class="legal-note home-legal">Experiência lúdica de opinião. Não constitui pesquisa eleitoral.</p>`;
}

function rankingPresentation() {
  const personal = state.rankingView === "personal";
  const ranking = displayRanking(personal ? state.personalRanking : state.ranking, { personal });
  const filtered = filterRanking(ranking, state.rankingQuery);
  const visible = state.rankingExpanded || state.rankingQuery ? filtered : filtered.slice(0, 25);
  const podium = rankingPodium(ranking);
  const highlights = rankingHighlights(ranking);
  const totalDuels = personal ? state.personalDuels : state.globalDuels;
  const rows = visible.map((person) => `<button class="ranking-row" type="button" data-profile="${escapeHtml(person.id)}"><strong class="rank-position">${person.displayRank ?? "—"}</strong><span class="rank-person">${escapeHtml(person.displayName || shortName(person.name))}<small>${escapeHtml(person.affiliation || person.party || candidateRole(person))}</small>${person.decisions ? `<span class="vote-counts"><b class="vote-positive">+ ${person.wins} vitória${person.wins === 1 ? "" : "s"}</b><b class="vote-negative">− ${person.losses} derrota${person.losses === 1 ? "" : "s"}</b></span>` : '<span class="not-played">Ainda sem comparações</span>'}</span><strong class="rank-score">${person.decisions ? `${person.winRate}%<small>${person.elo} Elo</small>` : "—"}</strong></button>`).join("");
  const podiumCards = podium.map((person) => `<button class="podium-card podium-${Math.min(person.displayRank, 3)}" type="button" data-profile="${escapeHtml(person.id)}"><span>${person.displayRank}º</span><strong>${escapeHtml(person.displayName || shortName(person.name))}</strong><small>${person.winRate}%</small></button>`).join("");
  const highlightColumn = (title, type, people) => `<section class="ranking-highlight ranking-highlight-${type}"><p>${title}</p>${people.length ? people.map((person, index) => `<button type="button" data-profile="${escapeHtml(person.id)}"><span>${index + 1}</span><strong>${escapeHtml(person.displayName || shortName(person.name))}</strong><b>${type === "chosen" ? `+${person.wins}` : `−${person.losses}`}</b></button>`).join("") : '<small>Aguardando duelos</small>'}</section>`;
  const publicPulse = !personal && (highlights.chosen.length || highlights.rejected.length) ? `<section class="public-pulse" aria-label="Resumo das comparações"><div class="section-title"><span>Placar do público</span><small>cada rodada compara a escolhida com as outras três</small></div><div class="pulse-grid">${highlightColumn("Mais vitórias", "chosen", highlights.chosen)}${highlightColumn("Mais derrotas", "rejected", highlights.rejected)}</div></section>` : "";
  const empty = state.rankingQuery ? "Nenhum nome encontrado." : personal ? "Faça uma escolha para começar seu ranking pessoal." : "Ainda não há resultados confirmados.";
  return { personal, totalDuels, rows, podiumCards, publicPulse, empty, revealCount: !state.rankingQuery && !state.rankingExpanded && filtered.length > visible.length ? filtered.length : 0 };
}

function rankingMarkup() {
  return `<header class="ranking-heading"><p class="eyebrow">Eleições 2026</p><h1>Ranking</h1><p data-ranking-description></p><strong data-ranking-total></strong></header>
    <div class="result-banner" data-ranking-result hidden></div>
    <div class="segmented" aria-label="Tipo de ranking"><button type="button" data-ranking-view="general">Geral</button><button type="button" data-ranking-view="personal">Seu ranking</button></div>
    <p class="ranking-trust" data-ranking-integrity>Escolhas confirmadas pelo servidor. <a href="/integridade.html">Como o placar é protegido</a></p>
    <p class="ranking-policy" data-ranking-policy hidden><strong></strong><span></span></p>
    <div data-ranking-pulse></div>
    <section class="podium" data-ranking-podium aria-label="Pódio" hidden></section>
    <label class="ranking-search"><span>Todos os nomes</span><input id="ranking-search" type="search" placeholder="Buscar nome ou partido" autocomplete="off"></label>
    <section class="panel ranking-list" data-ranking-list></section>
    <button class="secondary reveal-ranking" id="reveal-ranking" type="button" hidden></button>
    <button class="primary continue-duels" id="continue-duels" type="button">Voltar às escolhas</button>`;
}

function collectionContent() {
  const unique = [...new Map(state.collection.map((person) => [person.id, person])).values()];
  const cards = unique.map((person) => `<div class="ranking-row">${brandSymbol("collection-symbol")}<span>${escapeHtml(shortName(person.name))}<br><small>Chroma possuída</small></span><strong>×${state.collection.filter(({ id }) => id === person.id).length}</strong></div>`).join("");
  const previewCard = ({ person, role, image, variant }) => `<article class="chroma-card featured-chroma-card ${variant}" data-hologram tabindex="0" aria-label="${escapeHtml(person)}, ${escapeHtml(role)}. Mova o dedo ou incline o celular para ver o holograma.">
    <img class="chroma-art" src="${escapeHtml(image)}" alt="${escapeHtml(role)} de ${escapeHtml(person)}" width="530" height="742">
    <span class="holo-foil" aria-hidden="true"></span><span class="holo-pattern" aria-hidden="true"></span><span class="holo-glint" aria-hidden="true"></span>
  </article>`;
  const batchCard = ({ personId, person, look, lookName, image }, index) => `<article class="chroma-card approved-chroma-card look-${look.toLowerCase()}" data-hologram data-batch-card="${index}" tabindex="0" aria-label="${escapeHtml(person)}, carta básica com acabamento ${escapeHtml(lookName)}.">
    <img class="chroma-art approved-chroma-art" src="${escapeHtml(image)}" alt="Carta básica de ${escapeHtml(person)}" width="600" height="750" loading="lazy" decoding="async">
    <span class="approved-chroma-brand" aria-hidden="true">${brandSymbol("approved-brand-symbol")}<b>PoliMatch</b></span>
    <span class="approved-chroma-frame" aria-hidden="true"></span>
    <span class="approved-chroma-copy"><strong>${escapeHtml(person)}</strong><small>${escapeHtml(lookName)}</small><em>#${escapeHtml(personId)} · ARTE EDITADA POR IA</em></span>
    <span class="holo-foil" aria-hidden="true"></span><span class="holo-pattern" aria-hidden="true"></span><span class="holo-glint" aria-hidden="true"></span>
  </article>`;
  const supreme = chromaPreviews.filter(({ variant }) => variant.startsWith("supreme")).map(previewCard).join("");
  const commemorative = chromaPreviews.filter(({ variant }) => variant.startsWith("commemorative")).map(previewCard).join("");
  const approved = approvedBasicCards.map(batchCard).join("");
  return `<div><p class="eyebrow">Laboratório de Chromas</p><h1>Coleção</h1><p class="lead">Mova o dedo sobre cada carta. No celular, ative a inclinação para o reflexo acompanhar o aparelho.</p><button class="motion-button" id="enable-chroma-motion" type="button">Ativar efeito ao inclinar</button><p class="motion-status" id="motion-status"></p></div>
    <section class="chroma-tier"><div class="chroma-tier-heading"><div><p class="eyebrow">Chroma Suprema</p><h2>Três estrelas douradas</h2></div><span class="tier-symbol gold-stars">★★★</span></div><p>Ouro em relevo, feixes direcionais e dois desenhos holográficos exclusivos.</p><div class="chroma-gallery">${supreme}</div></section>
    <section class="chroma-tier"><div class="chroma-tier-heading"><div><p class="eyebrow">Chroma Comemorativa</p><h2>Estrela prismática</h2></div><span class="tier-symbol prism-star">★</span></div><p>Cristal óptico, espectro colorido e refração diferente em cada pessoa.</p><div class="chroma-gallery">${commemorative}</div></section>
    <section class="chroma-tier approved-batch"><div class="chroma-tier-heading"><div><p class="eyebrow">Cartas básicas</p><h2>35 acabamentos aprovados</h2></div><span class="tier-symbol batch-count">35</span></div><p>São as cartas básicas atuais. As futuras Chromas serão colecionáveis e sempre usarão outra fotografia da pessoa.</p><div class="chroma-gallery approved-chroma-gallery">${approved}</div><button class="primary batch-toggle" id="expand-chroma-batch" type="button">Ver as 35 cartas básicas</button><button class="secondary batch-toggle" id="collapse-chroma-batch" type="button" hidden>Mostrar apenas os primeiros</button><p class="batch-disclosure">Imagens tratadas para compor a edição básica do PoliMatch.</p></section>
    <section><p class="eyebrow">Sua coleção</p><section class="panel ranking-list">${cards || '<p class="empty">Demonstração visual: estas Chromas ainda não foram adicionadas ao seu inventário.</p>'}</section></section>`;
}

function navMarkup() {
  return `<nav class="bottom-nav" aria-label="Navegação principal" hidden>
    <button class="nav-button" type="button" data-screen="topics">Início</button>
    <button class="nav-button" type="button" data-screen="duel">Duelo</button>
    <button class="nav-button" type="button" data-screen="ranking">Ranking</button>
  </nav>`;
}

function connectionContent() {
  if (!state.error) return "<p>Preparando o duelo…</p>";
  return `<section class="panel"><p class="eyebrow">Conexão necessária</p><h1>Não conseguimos falar com o servidor.</h1><p>${escapeHtml(state.error)}. Nenhuma escolha será registrada enquanto a conexão não voltar.</p><button class="primary" id="retry" type="button">Tentar novamente</button></section>`;
}

function duelMarkup() {
  return `<div class="duel-head"><div><p class="eyebrow">Escolha uma entre quatro</p><h1>Quem você prefere?</h1></div><span class="progress-pill"></span></div>
    <p class="round-instruction">Toque na sua preferida. Segure para conhecer o perfil.</p>
    <section class="round-feedback" data-feedback-channels aria-label="Resultado da escolha" hidden>
      <p class="feedback-channel feedback-personal"><strong>No seu ranking</strong><span data-personal-feedback></span></p>
      <p class="feedback-channel feedback-global" data-global-feedback-band hidden><strong>No placar do público</strong><span data-global-feedback></span></p>
    </section>
    <button class="retry-vote" type="button" id="retry-vote" hidden>Tentar de novo</button>
    <div class="arena arena-four">${Array.from({ length: 4 }, (_, index) => candidateSlot(index)).join("")}</div>
    <button class="skip-button" type="button" id="skip-round">Nenhuma destas · trocar as quatro</button>`;
}

function appMarkup() {
  return `<div class="app-shell" data-screen="connection">
      ${headerMarkup()}
      <main class="connection" data-panel="connection"><p>Preparando o duelo…</p></main>
      <main class="screen home-screen" data-panel="topics" hidden></main>
      <main class="screen duel-screen" data-panel="duel" hidden>${duelMarkup()}</main>
      <main class="screen ranking-screen" data-panel="ranking" hidden>${rankingMarkup()}</main>
      <main class="screen collection-screen" data-panel="collection" hidden>${collectionContent()}</main>
      ${navMarkup()}
    </div>
    <dialog id="modal"></dialog>
    <div data-overlay-root></div>
    <p class="app-live-region visually-hidden" role="status" aria-live="polite" aria-atomic="true"></p>`;
}

function coachOverlay() {
  if (!state.showCoach) return "";
  return `<div class="coach-overlay" role="dialog" aria-modal="true" aria-labelledby="coach-title"><section class="coach-card"><span class="coach-icon" aria-hidden="true">${brandSymbol("coach-symbol")}</span><p class="eyebrow">Primeira rodada</p><h2 id="coach-title">Escolha uma entre quatro.</h2><p>Toque na sua preferida. Segure qualquer carta para conhecer a pessoa. Se nenhuma fizer sentido, troque as quatro.</p><button class="primary" id="dismiss-coach" type="button">Começar rodada</button></section></div>`;
}

function captureCandidateSlot(root) {
  const button = root.querySelector(".candidate-card");
  const outcome = root.querySelector(".card-outcome");
  return {
    root,
    button,
    fallback: root.querySelector(".portrait-fallback"),
    image: root.querySelector(".portrait img"),
    name: root.querySelector(".candidate-name"),
    affiliation: root.querySelector(".candidate-affiliation"),
    office: root.querySelector(".candidate-office"),
    summary: root.querySelector(".candidate-summary"),
    outcome,
    outcomeValue: outcome.querySelector("b"),
    outcomeMessage: outcome.querySelector("small"),
  };
}

function captureRefs() {
  const panels = Object.fromEntries([...app.querySelectorAll("[data-panel]")].map((panel) => [panel.dataset.panel, panel]));
  return {
    shell: app.querySelector(".app-shell"),
    panels,
    topbar: app.querySelector(".topbar"),
    accountButton: app.querySelector("#account-button"),
    accountLabel: app.querySelector("[data-account-label]"),
    accountPhoto: app.querySelector(".account-photo"),
    accountFallback: app.querySelector(".account-symbol"),
    soundToggle: app.querySelector("#sound-toggle"),
    nav: app.querySelector(".bottom-nav"),
    navButtons: [...app.querySelectorAll("[data-screen]")],
    instruction: app.querySelector(".round-instruction"),
    feedbackChannels: app.querySelector("[data-feedback-channels]"),
    personalFeedback: app.querySelector("[data-personal-feedback]"),
    globalFeedbackBand: app.querySelector("[data-global-feedback-band]"),
    globalFeedback: app.querySelector("[data-global-feedback]"),
    retryVote: app.querySelector("#retry-vote"),
    progress: app.querySelector(".progress-pill"),
    skip: app.querySelector("#skip-round"),
    slots: [...app.querySelectorAll("[data-candidate-slot]")].map(captureCandidateSlot),
    rankingDescription: app.querySelector("[data-ranking-description]"),
    rankingTotal: app.querySelector("[data-ranking-total]"),
    rankingResult: app.querySelector("[data-ranking-result]"),
    rankingIntegrity: app.querySelector("[data-ranking-integrity]"),
    rankingPolicy: app.querySelector("[data-ranking-policy]"),
    rankingPulse: app.querySelector("[data-ranking-pulse]"),
    rankingPodium: app.querySelector("[data-ranking-podium]"),
    rankingList: app.querySelector("[data-ranking-list]"),
    rankingSearch: app.querySelector("#ranking-search"),
    revealRanking: app.querySelector("#reveal-ranking"),
    modal: app.querySelector("#modal"),
    overlays: app.querySelector("[data-overlay-root]"),
    liveRegion: app.querySelector(".app-live-region"),
    connectionMarkup: "<p>Preparando o duelo…</p>",
    overlayMarkup: "",
    topicsMounted: false,
  };
}

function renderHeader() {
  const accountName = state.account?.displayName?.split(" ")[0];
  const avatarUrl = safeUrl(state.account?.avatarUrl);
  refs.accountButton.classList.toggle("is-signed-in", Boolean(state.account));
  refs.accountButton.setAttribute("aria-label", state.account ? "Abrir sua conta" : "Salvar seu jogo com Google");
  refs.accountLabel.textContent = accountName ? `Olá, ${accountName}` : "Salvar jogo";
  refs.accountPhoto.hidden = !avatarUrl;
  refs.accountFallback.hidden = Boolean(avatarUrl);
  if (avatarUrl) refs.accountPhoto.setAttribute("src", avatarUrl);
  else refs.accountPhoto.removeAttribute("src");

  const soundLabel = state.soundEnabled ? "Desativar efeitos sonoros" : "Ativar efeitos sonoros";
  refs.soundToggle.classList.toggle("is-on", state.soundEnabled);
  refs.soundToggle.setAttribute("aria-label", soundLabel);
  refs.soundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
  refs.soundToggle.querySelector("span").textContent = state.soundEnabled ? "♪" : "♪̸";
}

function renderConnection() {
  const markup = connectionContent();
  if (markup === refs.connectionMarkup) return;
  refs.panels.connection.innerHTML = markup;
  refs.connectionMarkup = markup;
}

function renderTopics() {
  if (!refs.topicsMounted) {
    refs.panels.topics.innerHTML = topicsContent();
    refs.topicsMounted = true;
  }
  refs.panels.topics.querySelector("[data-home-start-label]").textContent = state.personalDuels ? "Continuar escolhendo" : "Começar agora";
  refs.panels.topics.querySelector("[data-approved-count]").textContent = state.candidates.filter((candidate) => candidatePhoto(candidate)).length;
  refs.panels.topics.querySelector("[data-global-duels]").textContent = state.globalDuels;
}

function renderDuel() {
  refs.progress.textContent = `${state.personalDuels} ${state.personalDuels === 1 ? "escolha" : "escolhas"}`;
  refs.instruction.textContent = state.result || "Toque na sua preferida. Segure para conhecer o perfil.";
  refs.instruction.classList.toggle("is-result", Boolean(state.result));
  refs.instruction.classList.toggle("is-error", state.resultTone === "erro");
  refs.instruction.hidden = Boolean(state.personalFeedbackMessage);
  refs.feedbackChannels.hidden = !state.personalFeedbackMessage;
  refs.personalFeedback.textContent = state.personalFeedbackMessage;
  refs.globalFeedbackBand.hidden = !state.globalFeedbackMessage;
  refs.globalFeedback.textContent = state.globalFeedbackMessage;
  refs.retryVote.hidden = !state.pendingWinnerId || state.busy;
  refs.retryVote.disabled = state.busy;
  refs.slots.forEach((slot, index) => patchCandidateSlot(slot, state.round[index] ? candidateSlotModel(state.round[index]) : null));
  refs.skip.disabled = state.busy;
}

function renderRanking() {
  const presentation = rankingPresentation();
  refs.rankingDescription.textContent = presentation.personal ? "O retrato das comparações que você fez." : "O placar vivo das escolhas do público.";
  refs.rankingTotal.textContent = `${presentation.totalDuels} ${presentation.totalDuels === 1 ? "escolha confirmada" : "escolhas confirmadas"}`;
  refs.rankingResult.hidden = !state.result;
  refs.rankingResult.textContent = state.result;
  refs.rankingIntegrity.hidden = presentation.personal;
  const policy = state.personalRankingPolicy;
  refs.rankingPolicy.hidden = !presentation.personal || !policy?.label;
  refs.rankingPolicy.querySelector("strong").textContent = policy?.label ? `Ordenado por ${policy.label}` : "";
  refs.rankingPolicy.querySelector("span").textContent = policy?.explanation || "";
  app.querySelectorAll("[data-ranking-view]").forEach((button) => button.classList.toggle("active", button.dataset.rankingView === state.rankingView));
  refs.rankingPulse.innerHTML = presentation.publicPulse;
  refs.rankingPodium.hidden = !presentation.podiumCards;
  refs.rankingPodium.innerHTML = presentation.podiumCards;
  if (refs.rankingSearch.value !== state.rankingQuery) refs.rankingSearch.value = state.rankingQuery;
  refs.rankingList.innerHTML = presentation.rows || `<p class="empty">${presentation.empty}</p>`;
  refs.revealRanking.hidden = !presentation.revealCount;
  refs.revealRanking.textContent = presentation.revealCount ? `Ver ranking completo (${presentation.revealCount})` : "";
}

function renderCollection() {
  refs.panels.collection.querySelectorAll("[data-batch-card]").forEach((cardElement) => {
    cardElement.hidden = !state.chromaBatchExpanded && Number(cardElement.dataset.batchCard) >= 6;
  });
  refs.panels.collection.querySelector("#expand-chroma-batch").hidden = state.chromaBatchExpanded;
  refs.panels.collection.querySelector("#collapse-chroma-batch").hidden = !state.chromaBatchExpanded;
}

function renderNavigation() {
  refs.nav.hidden = !state.ready;
  refs.navButtons.forEach((button) => {
    const active = button.dataset.screen === state.screen;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

function renderOverlays() {
  const markup = `${coachOverlay()}${authOverlay()}`;
  if (markup === refs.overlayMarkup) return;
  const coachOpening = state.showCoach && !refs.overlays.querySelector(".coach-overlay");
  const authOpening = state.authOpen && !refs.overlays.querySelector(".auth-overlay");
  refs.overlays.innerHTML = markup;
  refs.overlayMarkup = markup;
  if (coachOpening) queueMicrotask(() => refs.overlays.querySelector("#dismiss-coach")?.focus());
  if (authOpening) queueMicrotask(() => refs.overlays.querySelector("#close-auth")?.focus());
  if (state.authOpen && !state.account && !state.authBusy && !state.authError) queueMicrotask(mountAuthButton);
}

function render() {
  renderHeader();
  const activePanel = state.ready ? state.screen : "connection";
  showPersistentPanel(refs.panels, activePanel);
  refs.shell.dataset.screen = activePanel;
  if (!state.ready) renderConnection();
  else {
    renderDuel();
    if (state.screen === "topics") renderTopics();
    if (state.screen === "ranking") renderRanking();
    if (state.screen === "collection") renderCollection();
  }
  renderNavigation();
  renderOverlays();
}

function announceStatus(message) {
  refs.liveRegion.textContent = message;
}

function showProfile(id) {
  const person = state.candidates.find((candidate) => candidate.id === id);
  if (!person) return;
  sound.play("profile");
  const modal = refs.modal;
  const metadata = [person.office, person.party, person.location].filter(Boolean);
  const facts = (person.facts || []).map((fact) => `<li>${escapeHtml(fact)}</li>`).join("");
  const sources = (person.sources || []).map((source) => {
    const href = safeUrl(typeof source === "string" ? source : source.url);
    const label = typeof source === "string" ? "Fonte" : source.label || source.publisher || "Fonte";
    return href ? `<li><a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a></li>` : "";
  }).join("");
  const canVote = state.screen === "duel" && state.round.some((candidate) => candidate.id === person.id) && !state.busy && !state.pendingWinnerId;
  modal.innerHTML = `<button class="dialog-close" id="close-modal-top" type="button" aria-label="Fechar resumo">×</button><div class="profile-scroll"><div class="profile-preview">${portrait(person)}</div><div class="dialog-body profile-copy"><p class="eyebrow">Quem é?</p><h2>${escapeHtml(person.name)}</h2><p class="profile-role"><strong>${escapeHtml(candidateRole(person))}</strong></p>${metadata.length ? `<p class="profile-meta">${metadata.map(escapeHtml).join(" · ")}</p>` : ""}${profileSection("Sobre", candidateSummary(person))}${profileSection("Por que está nesta curadoria", person.relevance2026)}${facts ? `<section><h3>Três fatos</h3><ul>${facts}</ul></section>` : ""}${profileSection("Realização ou destaque", person.highlight)}${profileSection("Pontos de atenção", person.controversy, "profile-caution")}<section><h3>Fontes</h3>${sources ? `<ul class="source-list">${sources}</ul>${person.reviewedAt ? `<p class="review-note">Revisado em ${escapeHtml(person.reviewedAt)}.</p>` : ""}` : '<p class="review-note">Fontes em revisão editorial. O perfil só será publicado depois da checagem.</p>'}</section></div></div><div class="dialog-actions">${canVote ? `<button class="primary" id="vote-from-profile" data-candidate="${escapeHtml(person.id)}" type="button">Escolher esta pessoa</button>` : ""}<button class="secondary" id="close-modal" type="button">Voltar ao duelo</button></div>`;
  modalSilentClose = false;
  modal.showModal();
  modal.querySelector("#close-modal-top").focus();
}

function chooseNextRound() {
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

function enterDuel() {
  sound.play("enter");
  state.screen = "duel";
  state.showCoach = localStorage.getItem("polimatch:v4:round-coach") !== "seen";
  render();
}

async function vote(winnerId, { retry = false } = {}) {
  if (state.busy || (state.pendingWinnerId && !retry)) return;
  const winner = state.round.find(({ id }) => id === winnerId);
  if (!winner || state.round.length !== 4) return;
  const attempt = {
    roundId: state.roundId,
    winnerId: winner.id,
    candidateIds: state.round.map(({ id }) => id),
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
  if (!state.roundId) state.roundId = crypto.randomUUID();
  render();
  announceStatus(state.result);
  try {
    const response = await submitRoundVote(attempt.roundId, attempt.winnerId, attempt.candidateIds, "eleicoes-2026", {
      recoveryKey: attemptIdentity.recoveryKey,
      version: attemptPlayerVersion,
    });
    if (!isCurrentVoteIdentity(state, attemptIdentity)) return;
    const confirmed = confirmedVoteData(response, state.candidates, attempt, state);
    state.pendingWinnerId = "";
    state.votePhase = VOTE_PHASES.CONFIRMED;
    state.resultTone = "";
    state.ranking = confirmed.ranking;
    state.personalRanking = confirmed.personalRanking;
    state.personalRankingPolicy = confirmed.personalRankingPolicy;
    state.playerVersion = confirmed.playerVersion;
    state.globalDuels = confirmed.globalDuels;
    state.personalDuels = confirmed.personalDuels;
    const { channels } = confirmed;
    state.roundOutcome = channels.personal;
    state.personalFeedbackMessage = channels.personal.message;
    state.globalFeedbackMessage = channels.global?.message || "";
    state.result = "";
    render();
    announceStatus([state.personalFeedbackMessage, state.globalFeedbackMessage].filter(Boolean).join(" "));
    const feedbackEvent = channels.personal.primaryEvent || response.vote?.rankingEvent || (response.vote?.zebra ? "zebra" : "confirm");
    sound.play(feedbackEvent);
    try { navigator.vibrate?.(hapticPattern(feedbackEvent)); } catch {}
    roundAdvanceTimer = setTimeout(() => {
      chooseNextRound();
      state.busy = false;
      state.selectedId = "";
      state.roundOutcome = null;
      state.result = "Nova rodada disponível";
      state.resultTone = "";
      render();
      announceStatus(state.result);
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
    await recoverFromVoteFailure(error, winner, attemptIdentity);
  }
}

/**
 * Traduz a falha de um voto em estado honesto e recuperável.
 *
 * Três motivos distintos chegavam aqui como a mesma frase — "seu voto não foi
 * contado" — e nenhum deles oferecia saída. Pior: quando o tempo se esgota, o
 * servidor pode já ter gravado a rodada, e afirmar que não contou é falso.
 */
async function recoverFromVoteFailure(error, winner, attemptIdentity) {
  state.busy = false;
  state.selectedId = "";
  state.roundOutcome = null;
  state.personalFeedbackMessage = "";
  state.globalFeedbackMessage = "";
  state.resultTone = "erro";
  state.pendingWinnerId = winner.id;
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
    announceStatus(state.result);
    sound.play("error");
    return;
  }

  state.result = failure.message;
  render();
  scheduleRetryUnlock();
  announceStatus(state.result);
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
    const personal = await loadPlayerRanking(recoveryKey);
    if (Number(state.identityEpoch || 0) !== recoveryEpoch || state.recoveryKey !== recoveryKey) return;
    state.playerVersion = personal.version ?? 0;
    state.personalRanking = rankingForCatalog(personal, state.candidates);
    state.personalRankingPolicy = personal.rankingPolicy || null;
    state.personalDuels = Number(personal.duels) || 0;
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

function closeAuth() {
  state.authOpen = false;
  state.authError = "";
  render();
}

async function enableTilt(button) {
  const status = refs.panels.collection.querySelector("#motion-status");
  try {
    const enabled = await enableDeviceTilt();
    button.textContent = enabled ? "Inclinação ativada" : "Use o dedo para mover o brilho";
    status.textContent = enabled ? "Mova o celular para testar os hologramas." : "Este aparelho não liberou o sensor; o efeito pelo toque continua ativo.";
  } catch {
    status.textContent = "A inclinação não foi autorizada; o efeito pelo toque continua ativo.";
  }
  announceStatus(status.textContent);
}

function handleAppClick(event) {
  if (event.target === refs.modal && refs.modal.open) {
    refs.modal.close();
    return;
  }
  if (event.target.matches?.(".auth-overlay")) {
    closeAuth();
    return;
  }

  const button = event.target.closest?.("button");
  if (!button || !app.contains(button)) return;

  if (["close-modal", "close-modal-top"].includes(button.id)) {
    refs.modal.close();
    return;
  }
  if (button.id === "vote-from-profile") {
    const candidateId = button.dataset.candidate;
    modalSilentClose = true;
    refs.modal.close();
    vote(candidateId);
    return;
  }
  if (button.id === "account-button") {
    sound.play("navigation");
    state.authOpen = true;
    state.authError = "";
    render();
    return;
  }
  if (["close-auth", "continue-anonymous"].includes(button.id)) {
    closeAuth();
    return;
  }
  if (button.id === "logout") {
    signOut();
    return;
  }
  if (button.id === "sound-toggle") {
    if (state.soundEnabled) {
      sound.play("soundOff");
      state.soundEnabled = sound.setEnabled(false);
    } else {
      state.soundEnabled = sound.setEnabled(true);
      sound.play("soundOn");
    }
    renderHeader();
    // WebKit does not focus buttons on pointer activation; this preserves the
    // existing control contract without repairing focus after a DOM remount.
    button.focus();
    return;
  }
  if (button.id === "retry") {
    sound.play("navigation");
    initialize();
    return;
  }
  if (["start-election", "start-election-secondary"].includes(button.id)) {
    enterDuel();
    return;
  }
  if (button.id === "open-ranking") {
    sound.play("navigation");
    state.screen = "ranking";
    state.result = "";
    state.resultTone = "";
    render();
    return;
  }
  if (button.id === "continue-duels") {
    state.result = "";
    state.resultTone = "";
    enterDuel();
    return;
  }
  if (["retry-vote", "restore-session"].includes(button.id)) {
    const recovery = voteRecoveryControl(state);
    if (!recovery.visible || recovery.disabled || recovery.id !== button.id) return;
    if (state.voteAction === VOTE_ACTIONS.RESTORE_SESSION) restoreVoteSession();
    else vote(state.pendingWinnerId, { retry: true });
    return;
  }
  if (button.id === "skip-round") {
    if (state.busy || state.pendingWinnerId) return;
    sound.play("shuffle");
    state.result = "";
    state.resultTone = "";
    chooseNextRound();
    render();
    announceStatus("Nova rodada disponível");
    return;
  }
  if (button.id === "dismiss-coach") {
    sound.play("navigation");
    localStorage.setItem("polimatch:v4:round-coach", "seen");
    state.showCoach = false;
    render();
    return;
  }
  if (button.id === "reveal-ranking") {
    state.rankingExpanded = true;
    renderRanking();
    return;
  }
  if (button.id === "expand-chroma-batch") {
    state.chromaBatchExpanded = true;
    renderCollection();
    return;
  }
  if (button.id === "collapse-chroma-batch") {
    state.chromaBatchExpanded = false;
    renderCollection();
    refs.panels.collection.querySelector(".approved-batch")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (button.id === "enable-chroma-motion") {
    enableTilt(button);
    return;
  }
  if (button.dataset.profile) {
    showProfile(button.dataset.profile);
    return;
  }
  if (button.dataset.screen) {
    if (button.dataset.screen === "duel") enterDuel();
    else {
      sound.play("navigation");
      state.screen = button.dataset.screen;
      state.result = "";
      state.resultTone = "";
      render();
    }
    return;
  }
  if (button.dataset.rankingView) {
    sound.play("navigation");
    state.rankingView = button.dataset.rankingView;
    state.rankingQuery = "";
    state.rankingExpanded = false;
    renderRanking();
  }
}

function installEvents() {
  app.addEventListener("click", handleAppClick);
  app.addEventListener("input", (event) => {
    if (event.target.id !== "ranking-search") return;
    state.rankingQuery = event.target.value;
    renderRanking();
  });
  app.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.authOpen) closeAuth();
  });
  app.addEventListener("error", (event) => {
    if (event.target.matches?.(".candidate-card .portrait img")) markPortraitFailed(event.target);
  }, true);
  app.addEventListener("load", (event) => {
    if (event.target.matches?.(".candidate-card .portrait img")) markPortraitLoaded(event.target);
  }, true);
  refs.modal.addEventListener("close", () => {
    if (!modalSilentClose) sound.play("dismiss");
    modalSilentClose = false;
    refs.slots.forEach(({ button }) => button.classList.remove("is-peeking"));
  });
  refs.slots.forEach(({ button }) => installPressGesture(button, {
    onTap: () => vote(button.dataset.vote),
    onHold: () => {
      button.classList.add("is-peeking");
      try { navigator.vibrate?.(18); } catch {}
      showProfile(button.dataset.vote);
    },
  }));
}

function mountApp() {
  const template = document.createElement("template");
  template.innerHTML = appMarkup();
  app.replaceChildren(template.content.cloneNode(true));
  refs = captureRefs();
  renderCollection();
  installChromaMotion(refs.panels.collection);
  installEvents();
}

async function mountAuthButton() {
  const element = refs.overlays.querySelector("#google-button");
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
  try {
    const result = await exchangeGoogleCredential(response.credential, state.recoveryKey);
    clearVoteTimers();
    resetPendingVoteForIdentityChange(state);
    localStorage.setItem("polimatch:v3:recovery-key", result.sessionToken);
    state.recoveryKey = result.sessionToken;
    state.account = result.account;
    state.personalRanking = rankingForCatalog(result.player, state.candidates);
    state.personalRankingPolicy = result.player.rankingPolicy || state.personalRankingPolicy;
    state.playerVersion = result.player.version;
    state.personalDuels = Number(result.player.duels) || 0;
    state.authBusy = false;
    sound.play("confirm");
    render();
  } catch (error) {
    state.authBusy = false;
    state.authError = error.message || "Não foi possível salvar seu jogo agora.";
    sound.play("error");
    render();
  }
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
    state.personalRanking = rankingForCatalog(player.personal, state.candidates);
    state.personalRankingPolicy = player.personal.rankingPolicy || state.personalRankingPolicy;
    state.playerVersion = player.personal.version;
    state.personalDuels = Number(player.personal.duels) || 0;
    state.authBusy = false;
    state.authOpen = false;
    state.result = "Você saiu. Um jogo novo começou neste aparelho.";
    state.resultTone = "";
    state.pendingWinnerId = "";
    state.roundId = crypto.randomUUID();
    render();
    announceStatus(state.result);
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
  try {
    const [candidates, snapshot, player] = await Promise.all([loadCandidates(), loadRanking(), ensurePlayer()]);
    state.candidates = catalogForTopic(candidates);
    if (state.candidates.length < 4) throw new Error("O elenco ainda não está disponível");
    state.ranking = rankingForCatalog(snapshot, state.candidates);
    state.globalDuels = Number(snapshot.duels) || 0;
    state.recoveryKey = player.recoveryKey;
    state.playerVersion = player.personal.version;
    state.personalRanking = rankingForCatalog(player.personal, state.candidates);
    state.personalRankingPolicy = player.personal.rankingPolicy || null;
    state.account = player.personal.account || null;
    state.personalDuels = Number(player.personal.duels) || 0;
    const firstMatch = nextBalancedGroup(state.candidates);
    state.round = firstMatch.group;
    state.matchQueue = firstMatch.queue;
    state.roundId = crypto.randomUUID();
    state.pendingWinnerId = "";
    state.resultTone = "";
    state.ready = true;
  } catch (error) {
    state.error = error.message || "Falha desconhecida";
  }
  render();
}

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
mountApp();
initialize();
