import "./styles.css";
import { createPlayer, loadCandidates, loadPlayerRanking, loadRanking, submitVote } from "./api.js";
import { catalogForTopic, displayRanking, filterRanking, initials, nextBalancedPair, rankingForCatalog, rankingHighlights, shortName, voteFeedback } from "./domain.js";
import { installPressGesture } from "./press-gesture.js";
import { candidatePhoto } from "./photos.js";
import { enableDeviceTilt, installChromaMotion } from "./chroma-motion.js";

const app = document.querySelector("#app");
const state = {
  screen: "topics",
  candidates: [],
  pair: [],
  matchQueue: [],
  previousPair: [],
  ranking: [],
  personalRanking: [],
  globalDuels: 0,
  personalDuels: 0,
  rankingView: "general",
  rankingQuery: "",
  rankingExpanded: false,
  recoveryKey: "",
  playerVersion: 0,
  collection: [],
  result: "",
  selectedId: "",
  showCoach: false,
  busy: false,
  ready: false,
  error: "",
};
let resultTimer;

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
  return `<div class="candidate-wrap">
    <button class="candidate-card basic-card${state.selectedId === candidate.id ? " is-selected" : ""}" type="button" data-vote="${escapeHtml(candidate.id)}" ${state.busy ? 'disabled aria-busy="true"' : ""} aria-label="${escapeHtml(candidate.name)}, carta básica. Toque para escolher; segure para saber quem é.">
      <span class="card-material" aria-hidden="true"></span>
      <span class="card-facets" aria-hidden="true"></span>
      <span class="card-brand" aria-hidden="true">◆ PoliMatch</span>
      <span class="card-rarity" aria-hidden="true">●</span>
      ${portrait(candidate)}
      <span class="candidate-copy">
        <strong>${escapeHtml(candidate.displayName || shortName(candidate.name))}</strong>
        <span class="candidate-affiliation">${escapeHtml(candidateAffiliation(candidate))}</span>
        <span class="candidate-office">${escapeHtml(candidate.office || candidateRole(candidate))}</span>
        <small class="candidate-summary">${escapeHtml(candidateCardSummary(candidate))}</small>
        <small class="candidate-profile-hint"><span aria-hidden="true">ⓘ</span> Segure para conhecer</small>
      </span>
      <span class="card-corners" aria-hidden="true"></span>
    </button>
  </div>`;
}

function header() {
  return `<header class="topbar"><p class="brand"><span class="brand-mark" aria-hidden="true">◆</span>PoliMatch</p><span class="edition">Malaquita 2026</span></header>`;
}

function topicsScreen() {
  return `<main class="screen">
    <div><p class="eyebrow">Escolha um assunto</p><h1>O que está em jogo?</h1><p class="lead">Compare pessoas, entenda quem são e acompanhe a preferência do público.</p></div>
    <button class="topic-card" type="button" id="start-election">
      <strong>Eleições 2026</strong>
      <span>100 nomes políticos na curadoria inicial.</span>
      <small>${state.personalDuels ? "CONTINUAR DUELANDO" : "COMEÇAR DUELOS"} →</small>
    </button>
    <p class="eyebrow">Em breve</p>
    <div class="soon-grid"><div class="soon-card"><strong>Influenciadores</strong><span>25 perfis já catalogados para a próxima etapa.</span></div><div class="soon-card"><strong>Escândalos e acontecimentos</strong><span>Curadorias especiais por caso.</span></div></div>
    <p class="legal-note">Votação lúdica. Não constitui pesquisa eleitoral.</p>
  </main>`;
}

function duelScreen() {
  return `<main class="screen duel-screen">
    <div class="duel-head"><div><p class="eyebrow">Eleições 2026</p><h1>Quem você prefere?</h1></div><span class="progress-pill">${state.personalDuels} ${state.personalDuels === 1 ? "escolha" : "escolhas"}</span></div>
    ${state.result ? `<div class="result-banner" role="status">${escapeHtml(state.result)}</div>` : ""}
    <div class="arena">${card(state.pair[0])}<span class="versus">OU</span>${card(state.pair[1])}</div>
    <button class="skip-button" type="button" id="skip-pair">Não sei · mostrar outra dupla</button>
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
  const rows = visible.map((person) => `<button class="ranking-row" type="button" data-profile="${escapeHtml(person.id)}"><strong class="rank-position">${person.displayRank ?? "—"}</strong><span class="rank-person">${escapeHtml(person.displayName || shortName(person.name))}<small>${escapeHtml(person.affiliation || person.party || candidateRole(person))}</small>${person.decisions ? `<span class="vote-counts"><b class="vote-positive">+ ${person.wins} escolhido${person.wins === 1 ? "" : "s"}</b><b class="vote-negative">− ${person.losses} recusado${person.losses === 1 ? "" : "s"}</b></span>` : '<span class="not-played">Ainda sem duelos</span>'}</span><strong class="rank-score">${person.decisions ? `${person.winRate}%<small>${person.elo} Elo</small>` : "—"}</strong></button>`).join("");
  const podiumCards = podium.map((person, index) => `<button class="podium-card podium-${index + 1}" type="button" data-profile="${escapeHtml(person.id)}"><span>${index + 1}º</span><strong>${escapeHtml(person.displayName || shortName(person.name))}</strong><small>${person.winRate}%</small></button>`).join("");
  const highlightColumn = (title, type, people) => `<section class="ranking-highlight ranking-highlight-${type}"><p>${title}</p>${people.length ? people.map((person, index) => `<button type="button" data-profile="${escapeHtml(person.id)}"><span>${index + 1}</span><strong>${escapeHtml(person.displayName || shortName(person.name))}</strong><b>${type === "chosen" ? `+${person.wins}` : `−${person.losses}`}</b></button>`).join("") : '<small>Aguardando duelos</small>'}</section>`;
  const publicPulse = !personal && (highlights.chosen.length || highlights.rejected.length) ? `<section class="public-pulse" aria-label="Resumo dos votos"><div class="section-title"><span>Placar do público</span><small>cada duelo soma uma escolha e uma recusa</small></div><div class="pulse-grid">${highlightColumn("Mais escolhidos", "chosen", highlights.chosen)}${highlightColumn("Mais recusados", "rejected", highlights.rejected)}</div></section>` : "";
  const empty = state.rankingQuery ? "Nenhum nome encontrado." : personal ? "Faça uma escolha para começar seu ranking pessoal." : "Ainda não há resultados confirmados.";
  const reveal = !state.rankingQuery && !state.rankingExpanded && filtered.length > visible.length ? `<button class="secondary reveal-ranking" id="reveal-ranking" type="button">Ver ranking completo (${filtered.length})</button>` : "";
  return `<main class="screen ranking-screen"><header class="ranking-heading"><p class="eyebrow">Eleições 2026</p><h1>Ranking</h1><p>${personal ? "O retrato das comparações que você fez." : "O placar vivo das escolhas do público."}</p><strong>${totalDuels} ${totalDuels === 1 ? "duelo confirmado" : "duelos confirmados"}</strong></header>${state.result ? `<div class="result-banner" role="status">${escapeHtml(state.result)}</div>` : ""}<div class="segmented" aria-label="Tipo de ranking"><button class="${personal ? "" : "active"}" data-ranking-view="general">Geral</button><button class="${personal ? "active" : ""}" data-ranking-view="personal">Seu ranking</button></div>${publicPulse}${podiumCards ? `<section class="podium" aria-label="Pódio">${podiumCards}</section>` : ""}<label class="ranking-search"><span>Todos os nomes</span><input id="ranking-search" type="search" value="${escapeHtml(state.rankingQuery)}" placeholder="Buscar nome ou partido" autocomplete="off"></label><section class="panel ranking-list">${rows || `<p class="empty">${empty}</p>`}</section>${reveal}<button class="primary continue-duels" id="continue-duels" type="button">Voltar aos duelos</button></main>`;
}

function collectionScreen() {
  const unique = [...new Map(state.collection.map((person) => [person.id, person])).values()];
  const cards = unique.map((person) => `<div class="ranking-row"><span>◆</span><span>${escapeHtml(shortName(person.name))}<br><small>Chroma possuída</small></span><strong>×${state.collection.filter(({ id }) => id === person.id).length}</strong></div>`).join("");
  const previewCard = ({ person, role, image, variant }) => `<article class="chroma-card ${variant}" data-hologram tabindex="0" aria-label="${escapeHtml(person)}, ${escapeHtml(role)}. Mova o dedo ou incline o celular para ver o holograma.">
    <img class="chroma-art" src="${escapeHtml(image)}" alt="${escapeHtml(role)} de ${escapeHtml(person)}" width="530" height="742">
    <span class="holo-foil" aria-hidden="true"></span><span class="holo-pattern" aria-hidden="true"></span><span class="holo-glint" aria-hidden="true"></span>
  </article>`;
  const supreme = chromaPreviews.filter(({ variant }) => variant.startsWith("supreme")).map(previewCard).join("");
  const commemorative = chromaPreviews.filter(({ variant }) => variant.startsWith("commemorative")).map(previewCard).join("");
  return `<main class="screen collection-screen"><div><p class="eyebrow">Laboratório de Chromas</p><h1>Coleção</h1><p class="lead">Mova o dedo sobre cada carta. No celular, ative a inclinação para o reflexo acompanhar o aparelho.</p><button class="motion-button" id="enable-chroma-motion" type="button">Ativar efeito ao inclinar</button><p class="motion-status" id="motion-status" role="status"></p></div>
    <section class="chroma-tier"><div class="chroma-tier-heading"><div><p class="eyebrow">Chroma Suprema</p><h2>Três estrelas douradas</h2></div><span class="tier-symbol gold-stars">★★★</span></div><p>Ouro em relevo, feixes direcionais e dois desenhos holográficos exclusivos.</p><div class="chroma-gallery">${supreme}</div></section>
    <section class="chroma-tier"><div class="chroma-tier-heading"><div><p class="eyebrow">Chroma Comemorativa</p><h2>Estrela prismática</h2></div><span class="tier-symbol prism-star">★</span></div><p>Cristal óptico, espectro colorido e refração diferente em cada pessoa.</p><div class="chroma-gallery">${commemorative}</div></section>
    <section><p class="eyebrow">Sua coleção</p><section class="panel ranking-list">${cards || '<p class="empty">Demonstração visual: estas Chromas ainda não foram adicionadas ao seu inventário.</p>'}</section></section>
  </main>`;
}

function nav() {
  return `<nav class="bottom-nav" aria-label="Navegação principal">
    <button class="nav-button ${state.screen === "topics" || state.screen === "duel" ? "active" : ""}" data-screen="topics">Duelos</button>
    <button class="nav-button ${state.screen === "ranking" ? "active" : ""}" data-screen="ranking">Ranking</button>
    <button class="nav-button ${state.screen === "collection" ? "active" : ""}" data-screen="collection">Coleção</button>
  </nav>`;
}

function connectionScreen() {
  return `<main class="connection"><section class="panel"><p class="eyebrow">Conexão necessária</p><h1>Não conseguimos falar com o servidor.</h1><p>${escapeHtml(state.error)}. Nenhuma escolha será registrada enquanto a conexão não voltar.</p><button class="primary" id="retry" type="button">Tentar novamente</button></section></main>`;
}

function coachOverlay() {
  if (!state.showCoach) return "";
  return `<div class="coach-overlay" role="dialog" aria-modal="true" aria-labelledby="coach-title"><section class="coach-card"><span class="coach-icon" aria-hidden="true">◆</span><p class="eyebrow">Primeiro duelo</p><h2 id="coach-title">É só escolher.</h2><p>Toque em quem você prefere. Segure uma carta para conhecer melhor a pessoa. Se não souber, pode trocar a dupla.</p><button class="primary" id="dismiss-coach" type="button">Bora duelar</button></section></div>`;
}

function render() {
  if (!state.ready) {
    app.innerHTML = `<div class="app-shell">${header()}${state.error ? connectionScreen() : '<main class="connection"><p>Preparando o duelo…</p></main>'}</div>`;
  } else {
    const screen = state.screen === "duel" ? duelScreen() : state.screen === "ranking" ? rankingScreen() : state.screen === "collection" ? collectionScreen() : topicsScreen();
    app.innerHTML = `<div class="app-shell">${header()}${screen}${nav()}</div><dialog id="modal"></dialog>${coachOverlay()}`;
  }
  bindEvents();
}

function showProfile(id) {
  const person = state.candidates.find((candidate) => candidate.id === id);
  if (!person) return;
  const modal = document.querySelector("#modal");
  const metadata = [person.office, person.party, person.location].filter(Boolean);
  const facts = (person.facts || []).map((fact) => `<li>${escapeHtml(fact)}</li>`).join("");
  const sources = (person.sources || []).map((source) => {
    const href = safeUrl(typeof source === "string" ? source : source.url);
    const label = typeof source === "string" ? "Fonte" : source.label || source.publisher || "Fonte";
    return href ? `<li><a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a></li>` : "";
  }).join("");
  const canVote = state.screen === "duel" && state.pair.some((candidate) => candidate.id === person.id) && !state.busy;
  modal.innerHTML = `<button class="dialog-close" id="close-modal-top" type="button" aria-label="Fechar resumo">×</button><div class="profile-scroll"><div class="profile-preview">${portrait(person)}</div><div class="dialog-body profile-copy"><p class="eyebrow">Quem é?</p><h2>${escapeHtml(person.name)}</h2><p class="profile-role"><strong>${escapeHtml(candidateRole(person))}</strong></p>${metadata.length ? `<p class="profile-meta">${metadata.map(escapeHtml).join(" · ")}</p>` : ""}${profileSection("Sobre", candidateSummary(person))}${profileSection("Por que está nesta curadoria", person.relevance2026)}${facts ? `<section><h3>Três fatos</h3><ul>${facts}</ul></section>` : ""}${profileSection("Realização ou destaque", person.highlight)}${profileSection("Pontos de atenção", person.controversy, "profile-caution")}<section><h3>Fontes</h3>${sources ? `<ul class="source-list">${sources}</ul>${person.reviewedAt ? `<p class="review-note">Revisado em ${escapeHtml(person.reviewedAt)}.</p>` : ""}` : '<p class="review-note">Fontes em revisão editorial. O perfil só será publicado depois da checagem.</p>'}</section></div></div><div class="dialog-actions">${canVote ? `<button class="primary" id="vote-from-profile" data-candidate="${escapeHtml(person.id)}" type="button">Escolher esta pessoa</button>` : ""}<button class="secondary" id="close-modal" type="button">Voltar ao duelo</button></div>`;
  modal.showModal();
  modal.addEventListener("close", () => document.querySelectorAll(".candidate-card.is-peeking").forEach((cardElement) => cardElement.classList.remove("is-peeking")), { once: true });
  modal.querySelector("#close-modal").addEventListener("click", () => modal.close());
  modal.querySelector("#close-modal-top").addEventListener("click", () => modal.close());
  modal.onclick = (event) => {
    if (event.target === modal) modal.close();
  };
  modal.querySelector("#close-modal-top").focus();
  modal.querySelector("#vote-from-profile")?.addEventListener("click", () => {
    modal.close();
    vote(person.id);
  });
}

function chooseNextPair() {
  state.previousPair = state.pair.map(({ id }) => id);
  const next = nextBalancedPair(state.candidates, state.matchQueue, state.previousPair);
  state.pair = next.pair;
  state.matchQueue = next.queue;
}

function enterDuel() {
  state.screen = "duel";
  state.showCoach = localStorage.getItem("polimatch:v3:duel-coach") !== "seen";
  render();
}

async function vote(winnerId) {
  if (state.busy) return;
  const winner = state.pair.find(({ id }) => id === winnerId);
  const loser = state.pair.find(({ id }) => id !== winnerId);
  if (!winner || !loser) return;
  state.busy = true;
  state.selectedId = winner.id;
  clearTimeout(resultTimer);
  state.result = "Confirmando sua escolha…";
  render();
  try {
    const response = await submitVote(winner.id, loser.id, "eleicoes-2026", {
      recoveryKey: state.recoveryKey,
      version: state.playerVersion,
    });
    state.ranking = rankingForCatalog(response, state.candidates);
    state.personalRanking = rankingForCatalog(response.player, state.candidates);
    state.playerVersion = response.player?.version ?? state.playerVersion;
    state.globalDuels = Number(response.duels) || state.globalDuels;
    state.personalDuels = Number(response.player?.duels) || state.personalDuels + 1;
    const ranked = state.ranking.find(({ id }) => id === winner.id);
    state.result = voteFeedback(winner.displayName || shortName(winner.name), {
      winnerDelta: response.vote?.winnerDelta,
      zebra: response.vote?.zebra,
      winRate: ranked?.winRate,
    });
    chooseNextPair();
    state.busy = false;
    state.selectedId = "";
    render();
    try { navigator.vibrate?.(response.vote?.zebra ? [24, 35, 48] : 24); } catch {}
    resultTimer = setTimeout(() => {
      if (state.busy || !state.result.includes("confirmado")) return;
      state.result = "";
      render();
    }, 2400);
  } catch (error) {
    state.busy = false;
    state.selectedId = "";
    state.result = "Não foi possível confirmar. Seu voto não foi contado.";
    render();
  }
}

function bindEvents() {
  document.querySelector("#retry")?.addEventListener("click", initialize);
  document.querySelector("#start-election")?.addEventListener("click", enterDuel);
  document.querySelector("#continue-duels")?.addEventListener("click", () => { state.result = ""; enterDuel(); });
  document.querySelector("#skip-pair")?.addEventListener("click", () => { state.result = ""; chooseNextPair(); render(); });
  document.querySelector("#dismiss-coach")?.addEventListener("click", () => {
    localStorage.setItem("polimatch:v3:duel-coach", "seen");
    state.showCoach = false;
    render();
  });
  document.querySelector("#dismiss-coach")?.focus();
  document.querySelector("#reveal-ranking")?.addEventListener("click", () => { state.rankingExpanded = true; render(); });
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
  document.querySelectorAll("[data-screen]").forEach((button) => button.addEventListener("click", () => { state.screen = button.dataset.screen; state.result = ""; render(); }));
  document.querySelectorAll("[data-ranking-view]").forEach((button) => button.addEventListener("click", () => { state.rankingView = button.dataset.rankingView; state.rankingQuery = ""; state.rankingExpanded = false; render(); }));
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
  } catch {
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
    if (state.candidates.length < 2) throw new Error("O elenco ainda não está disponível");
    state.ranking = rankingForCatalog(snapshot, state.candidates);
    state.globalDuels = Number(snapshot.duels) || 0;
    state.recoveryKey = player.recoveryKey;
    state.playerVersion = player.personal.version;
    state.personalRanking = rankingForCatalog(player.personal, state.candidates);
    state.personalDuels = Number(player.personal.duels) || 0;
    const firstMatch = nextBalancedPair(state.candidates);
    state.pair = firstMatch.pair;
    state.matchQueue = firstMatch.queue;
    state.ready = true;
  } catch (error) {
    state.error = error.message || "Falha desconhecida";
  }
  render();
}

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
initialize();
