import "./styles.css";
import { createPlayer, endSession, exchangeGoogleCredential, loadCandidates, loadPlayerRanking, loadRanking, submitRoundVote } from "./api.js";
import { catalogForTopic, displayRanking, filterRanking, hapticPattern, initials, nextBalancedGroup, rankingForCatalog, rankingHighlights, roundOutcome, shortName } from "./domain.js";
import { installPressGesture } from "./press-gesture.js";
import { candidatePhoto } from "./photos.js";
import { enableDeviceTilt, installChromaMotion } from "./chroma-motion.js";
import { approvedBasicCards } from "./approved-chromas.js";
import { createSoundController } from "./sound.js";
import { googleClientId, mountGoogleButton } from "./google-login.js";
import { resetPendingVoteForIdentityChange, revokeSessionBeforeClearing } from "./logout.js";

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
  // Chave de idempotência da rodada atual. Nasce junto com as quatro cartas e
  // sobrevive às tentativas, para que repetir um voto que já chegou ao servidor
  // seja reconhecido como repetição em vez de virar uma segunda rodada.
  roundId: "",
  // Escolha que falhou e pode ser repetida pelo botão "Tentar de novo".
  pendingWinnerId: "",
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

function card(candidate) {
  const outcome = state.roundOutcome?.outcomes.find(({ id }) => id === candidate.id);
  const outcomeClass = outcome ? ` is-round-${outcome.winner ? "winner" : "loser"}` : "";
  const delta = Number(outcome?.delta);
  const outcomeStamp = outcome ? `<span class="card-outcome ${outcome.tone}" aria-live="polite"><b>${Number.isFinite(delta) ? `${delta > 0 ? "+" : ""}${delta} Elo` : outcome.winner ? "Escolhida" : "Não foi desta vez"}</b><small>${escapeHtml(outcome.shortMessage)}</small></span>` : "";
  return `<div class="candidate-wrap">
    <button class="candidate-card basic-card${state.selectedId === candidate.id ? " is-selected" : ""}${outcomeClass}" type="button" data-vote="${escapeHtml(candidate.id)}" ${state.busy ? 'disabled aria-busy="true"' : ""} aria-label="${escapeHtml(candidate.name)}, carta básica. Toque para escolher; segure para saber quem é.">
      <span class="card-material" aria-hidden="true"></span>
      <span class="card-facets" aria-hidden="true"></span>
      <span class="card-brand" aria-hidden="true">${brandSymbol("card-brand-symbol")}<b>PoliMatch</b></span>
      ${portrait(candidate)}
      <span class="candidate-copy">
        <span class="candidate-title"><strong class="candidate-name">${escapeHtml(candidate.displayName || shortName(candidate.name))}</strong><span class="card-rarity" aria-hidden="true">●</span></span>
        <span class="candidate-affiliation">${escapeHtml(candidateAffiliation(candidate))}</span>
        <span class="candidate-office">${escapeHtml(candidate.office || candidateRole(candidate))}</span>
        <small class="candidate-summary">${escapeHtml(candidateCardSummary(candidate))}</small>
        <small class="candidate-profile-hint"><span aria-hidden="true">ⓘ</span> Segure para conhecer</small>
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
  return `<main class="screen home-screen">
    <section class="home-hero">
      <div class="home-hero-copy">
        <p class="eyebrow">Sua opinião em movimento</p>
        <h1>Quem representa o Brasil que você imagina?</h1>
        <p class="lead">Escolha entre pessoas públicas, conheça cada perfil e veja seu ranking ganhar forma — uma decisão por vez.</p>
        <div class="home-actions">
          <button class="primary home-primary" type="button" id="start-election">${state.personalDuels ? "Continuar escolhendo" : "Começar agora"}<span aria-hidden="true">→</span></button>
          <button class="home-ranking-link" type="button" id="open-ranking">Ver ranking do público</button>
        </div>
        <div class="home-trust" aria-label="Informações da edição">
          <span><strong>${approvedCount}</strong> perfis com foto aprovada</span>
          <span><strong>${state.globalDuels}</strong> escolhas confirmadas</span>
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
    <p class="legal-note home-legal">Experiência lúdica de opinião. Não constitui pesquisa eleitoral.</p>
  </main>`;
}

function duelScreen() {
  return `<main class="screen duel-screen">
    <div class="duel-head"><div><p class="eyebrow">Escolha uma entre quatro</p><h1>Quem você prefere?</h1></div><span class="progress-pill">${state.personalDuels} ${state.personalDuels === 1 ? "escolha" : "escolhas"}</span></div>
    <p class="round-instruction${state.result ? " is-result" : ""}${state.resultTone === "erro" ? " is-error" : ""}" role="status">${escapeHtml(state.result || "Toque na sua preferida. Segure para conhecer o perfil.")}</p>
    ${state.pendingWinnerId ? '<button class="retry-vote" type="button" id="retry-vote">Tentar de novo</button>' : ""}
    <div class="arena arena-four">${state.round.map(card).join("")}</div>
    <button class="skip-button" type="button" id="skip-round" ${state.busy ? "disabled" : ""}>Nenhuma destas · trocar as quatro</button>
  </main>`;
}

function rankingScreen() {
  const personal = state.rankingView === "personal";
  const ranking = displayRanking(personal ? state.personalRanking : state.ranking, { personal });
  const filtered = filterRanking(ranking, state.rankingQuery);
  const visible = state.rankingExpanded || state.rankingQuery ? filtered : filtered.slice(0, 25);
  const podium = ranking.filter(({ decisions }) => decisions > 0).slice(0, 3);
  const highlights = rankingHighlights(ranking);
  const totalDuels = personal ? state.personalDuels : state.globalDuels;
  const rows = visible.map((person) => `<button class="ranking-row" type="button" data-profile="${escapeHtml(person.id)}"><strong class="rank-position">${person.displayRank ?? "—"}</strong><span class="rank-person">${escapeHtml(person.displayName || shortName(person.name))}<small>${escapeHtml(person.affiliation || person.party || candidateRole(person))}</small>${person.decisions ? `<span class="vote-counts"><b class="vote-positive">+ ${person.wins} vitória${person.wins === 1 ? "" : "s"}</b><b class="vote-negative">− ${person.losses} derrota${person.losses === 1 ? "" : "s"}</b></span>` : '<span class="not-played">Ainda sem comparações</span>'}</span><strong class="rank-score">${person.decisions ? `${person.winRate}%<small>${person.elo} Elo</small>` : "—"}</strong></button>`).join("");
  const podiumCards = podium.map((person, index) => `<button class="podium-card podium-${index + 1}" type="button" data-profile="${escapeHtml(person.id)}"><span>${index + 1}º</span><strong>${escapeHtml(person.displayName || shortName(person.name))}</strong><small>${person.winRate}%</small></button>`).join("");
  const highlightColumn = (title, type, people) => `<section class="ranking-highlight ranking-highlight-${type}"><p>${title}</p>${people.length ? people.map((person, index) => `<button type="button" data-profile="${escapeHtml(person.id)}"><span>${index + 1}</span><strong>${escapeHtml(person.displayName || shortName(person.name))}</strong><b>${type === "chosen" ? `+${person.wins}` : `−${person.losses}`}</b></button>`).join("") : '<small>Aguardando duelos</small>'}</section>`;
  const publicPulse = !personal && (highlights.chosen.length || highlights.rejected.length) ? `<section class="public-pulse" aria-label="Resumo das comparações"><div class="section-title"><span>Placar do público</span><small>cada rodada compara a escolhida com as outras três</small></div><div class="pulse-grid">${highlightColumn("Mais vitórias", "chosen", highlights.chosen)}${highlightColumn("Mais derrotas", "rejected", highlights.rejected)}</div></section>` : "";
  const empty = state.rankingQuery ? "Nenhum nome encontrado." : personal ? "Faça uma escolha para começar seu ranking pessoal." : "Ainda não há resultados confirmados.";
  const reveal = !state.rankingQuery && !state.rankingExpanded && filtered.length > visible.length ? `<button class="secondary reveal-ranking" id="reveal-ranking" type="button">Ver ranking completo (${filtered.length})</button>` : "";
  return `<main class="screen ranking-screen"><header class="ranking-heading"><p class="eyebrow">Eleições 2026</p><h1>Ranking</h1><p>${personal ? "O retrato das comparações que você fez." : "O placar vivo das escolhas do público."}</p><strong>${totalDuels} ${totalDuels === 1 ? "escolha confirmada" : "escolhas confirmadas"}</strong></header>${state.result ? `<div class="result-banner" role="status">${escapeHtml(state.result)}</div>` : ""}<div class="segmented" aria-label="Tipo de ranking"><button class="${personal ? "" : "active"}" data-ranking-view="general">Geral</button><button class="${personal ? "active" : ""}" data-ranking-view="personal">Seu ranking</button></div>${publicPulse}${podiumCards ? `<section class="podium" aria-label="Pódio">${podiumCards}</section>` : ""}<label class="ranking-search"><span>Todos os nomes</span><input id="ranking-search" type="search" value="${escapeHtml(state.rankingQuery)}" placeholder="Buscar nome ou partido" autocomplete="off"></label><section class="panel ranking-list">${rows || `<p class="empty">${empty}</p>`}</section>${reveal}<button class="primary continue-duels" id="continue-duels" type="button">Voltar às escolhas</button></main>`;
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
  return `<div class="coach-overlay" role="dialog" aria-modal="true" aria-labelledby="coach-title"><section class="coach-card"><span class="coach-icon" aria-hidden="true">${brandSymbol("coach-symbol")}</span><p class="eyebrow">Primeira rodada</p><h2 id="coach-title">Escolha uma entre quatro.</h2><p>Toque na sua preferida. Segure qualquer carta para conhecer a pessoa. Se nenhuma fizer sentido, troque as quatro.</p><button class="primary" id="dismiss-coach" type="button">Começar rodada</button></section></div>`;
}

function render() {
  if (!state.ready) {
    app.innerHTML = `<div class="app-shell">${header()}${state.error ? connectionScreen() : '<main class="connection"><p>Preparando o duelo…</p></main>'}</div>`;
  } else {
    const screen = state.screen === "duel" ? duelScreen() : state.screen === "ranking" ? rankingScreen() : state.screen === "collection" ? collectionScreen() : topicsScreen();
    app.innerHTML = `<div class="app-shell">${header()}${screen}${nav()}</div><dialog id="modal"></dialog>${coachOverlay()}${authOverlay()}`;
  }
  bindEvents();
}

function showProfile(id) {
  const person = state.candidates.find((candidate) => candidate.id === id);
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
  const canVote = state.screen === "duel" && state.round.some((candidate) => candidate.id === person.id) && !state.busy;
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
  state.previousRound = state.round.map(({ id }) => id);
  const next = nextBalancedGroup(state.candidates, state.matchQueue, state.previousRound);
  state.round = next.group;
  state.matchQueue = next.queue;
  state.roundId = crypto.randomUUID();
  state.pendingWinnerId = "";
}

function enterDuel() {
  sound.play("enter");
  state.screen = "duel";
  state.showCoach = localStorage.getItem("polimatch:v4:round-coach") !== "seen";
  render();
}

async function vote(winnerId) {
  if (state.busy) return;
  const winner = state.round.find(({ id }) => id === winnerId);
  if (!winner || state.round.length !== 4) return;
  sound.play("choose");
  state.busy = true;
  state.selectedId = winner.id;
  clearTimeout(resultTimer);
  clearTimeout(roundAdvanceTimer);
  state.roundOutcome = null;
  state.result = "Confirmando sua escolha…";
  state.resultTone = "";
  render();
  try {
    const response = await submitRoundVote(state.roundId, winner.id, state.round.map(({ id }) => id), "eleicoes-2026", {
      recoveryKey: state.recoveryKey,
      version: state.playerVersion,
    });
    state.pendingWinnerId = "";
    state.resultTone = "";
    state.ranking = rankingForCatalog(response, state.candidates);
    state.personalRanking = rankingForCatalog(response.player, state.candidates);
    state.playerVersion = response.player?.version ?? state.playerVersion;
    state.globalDuels = Number(response.duels) || state.globalDuels;
    state.personalDuels = Number(response.player?.duels) || state.personalDuels + 1;
    const feedback = response.vote?.feedback || null;
    const outcome = roundOutcome(feedback, state.round, winner.id);
    state.roundOutcome = outcome;
    state.result = outcome.outcomes.length
      ? outcome.message
      : `${winner.displayName || shortName(winner.name)} confirmado · +${Number(response.vote?.winnerDelta) || 0} Elo`;
    render();
    const feedbackEvent = outcome.primaryEvent || response.vote?.rankingEvent || (response.vote?.zebra ? "zebra" : "confirm");
    sound.play(feedbackEvent);
    try { navigator.vibrate?.(hapticPattern(feedbackEvent)); } catch {}
    roundAdvanceTimer = setTimeout(() => {
      chooseNextRound();
      state.busy = false;
      state.selectedId = "";
      state.roundOutcome = null;
      render();
      resultTimer = setTimeout(() => {
        if (state.busy) return;
        state.result = "";
        state.resultTone = "";
        render();
      }, 1800);
    }, 1050);
  } catch (error) {
    await recoverFromVoteFailure(error, winner);
  }
}

/**
 * Traduz a falha de um voto em estado honesto e recuperável.
 *
 * Três motivos distintos chegavam aqui como a mesma frase — "seu voto não foi
 * contado" — e nenhum deles oferecia saída. Pior: quando o tempo se esgota, o
 * servidor pode já ter gravado a rodada, e afirmar que não contou é falso.
 */
async function recoverFromVoteFailure(error, winner) {
  state.busy = false;
  state.selectedId = "";
  state.roundOutcome = null;
  state.resultTone = "erro";
  state.pendingWinnerId = winner.id;

  // A versão pessoal ficou para trás porque uma rodada anterior chegou ao
  // servidor sem que a resposta voltasse. Realinhar aqui é o que impede o app
  // de recusar todo voto seguinte até alguém recarregar a página.
  if (error?.status === 409 && error?.code === "PLAYER_VERSION_CONFLICT") {
    const resynced = await resyncPlayer();
    state.result = resynced
      ? "Seu ranking mudou. Toque em Tentar de novo para confirmar esta escolha."
      : "Não conseguimos alinhar seu ranking. Toque em Tentar de novo.";
    // Um 409 acontece antes da gravação desta rodada. A escolha continua
    // pendente e reutiliza o mesmo roundId depois da versão ser atualizada.
    state.pendingWinnerId = winner.id;
    render();
    sound.play("error");
    return;
  }

  state.result = error?.unreachable
    ? "Não tivemos resposta do servidor. Sua escolha pode não ter sido registrada."
    : `Não foi possível confirmar: ${error?.message || "erro inesperado"}.`;
  render();
  sound.play("error");
}

/** Relê o estado do jogador no servidor. Devolve `false` se nem isso deu. */
async function resyncPlayer() {
  try {
    const personal = await loadPlayerRanking(state.recoveryKey);
    state.playerVersion = personal.version ?? state.playerVersion;
    state.personalRanking = rankingForCatalog(personal, state.candidates);
    state.personalDuels = Number(personal.duels) || state.personalDuels;
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
  document.querySelector("#start-election")?.addEventListener("click", enterDuel);
  document.querySelector("#start-election-secondary")?.addEventListener("click", enterDuel);
  document.querySelector("#open-ranking")?.addEventListener("click", () => { sound.play("navigation"); state.screen = "ranking"; state.result = ""; state.resultTone = ""; render(); });
  document.querySelector("#continue-duels")?.addEventListener("click", () => { state.result = ""; state.resultTone = ""; enterDuel(); });
  document.querySelector("#retry-vote")?.addEventListener("click", () => {
    if (state.busy || !state.pendingWinnerId) return;
    // Mesmo `state.roundId` da tentativa anterior: se aquela chegou ao servidor,
    // esta é reconhecida como repetição e devolve o mesmo resultado.
    vote(state.pendingWinnerId);
  });
  document.querySelector("#skip-round")?.addEventListener("click", () => {
    if (state.busy) return;
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
  document.querySelectorAll("[data-profile]").forEach((button) => button.addEventListener("click", () => showProfile(button.dataset.profile)));
  document.querySelectorAll("[data-screen]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.screen === "duel") {
      enterDuel();
      return;
    }
    sound.play("navigation");
    state.screen = button.dataset.screen;
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
  try {
    const result = await exchangeGoogleCredential(response.credential, state.recoveryKey);
    localStorage.setItem("polimatch:v3:recovery-key", result.sessionToken);
    state.recoveryKey = result.sessionToken;
    state.account = result.account;
    state.personalRanking = rankingForCatalog(result.player, state.candidates);
    state.playerVersion = result.player.version;
    state.personalDuels = Number(result.player.duels) || 0;
    resetPendingVoteForIdentityChange(state);
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
    state.recoveryKey = player.recoveryKey;
    state.account = null;
    state.personalRanking = rankingForCatalog(player.personal, state.candidates);
    state.playerVersion = player.personal.version;
    state.personalDuels = Number(player.personal.duels) || 0;
    resetPendingVoteForIdentityChange(state);
    state.authBusy = false;
    state.authOpen = false;
    state.result = "Você saiu. Um jogo novo começou neste aparelho.";
    render();
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
    state.account = player.personal.account || null;
    state.personalDuels = Number(player.personal.duels) || 0;
    const firstMatch = nextBalancedGroup(state.candidates);
    state.round = firstMatch.group;
    state.matchQueue = firstMatch.queue;
    state.roundId = crypto.randomUUID();
    state.pendingWinnerId = "";
    state.ready = true;
  } catch (error) {
    state.error = error.message || "Falha desconhecida";
  }
  render();
}

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
initialize();
