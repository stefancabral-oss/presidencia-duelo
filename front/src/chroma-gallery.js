import CANDIDATES from "../../shared/candidates.json";
import PERSON_PROFILES from "../../shared/person-profiles.json" with { type: "json" };
import { fetchServerRanking } from "./api.js";
import { rarityForElo } from "./rarity.js";
import { editorialSummary } from "../../shared/editorial.js";
import "./chroma-gallery.css";
import "./collection.css";

const candidateById = new Map(CANDIDATES.map((candidate) => [candidate.id, candidate]));
const profileById = new Map(PERSON_PROFILES.map((profile) => [profile.id, profile]));
const root = document.getElementById("chroma-app");

let items = [];
let filtered = [];
let activeFilter = "all";
let activeSearch = "";
let activeSort = "rating";
let activeIndex = -1;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "Data não informada";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function rarityLabel(rarity) {
  return rarity?.label || "Chroma";
}

function normalizeRanking(data) {
  const ranking = Array.isArray(data?.ranking) ? data.ranking : [];
  return ranking
    .map((row) => {
      const candidate = candidateById.get(row.id);
      if (!candidate) return null;
      const rarity = rarityForElo(row.elo);
      return {
        candidate,
        profile: profileById.get(row.id) || null,
        rating: row.elo,
        rarity,
        wins: row.wins || 0,
        losses: row.losses || 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.rating - a.rating || a.candidate.name.localeCompare(b.candidate.name, "pt-BR"));
}

function cardHtml(item, index) {
  const { candidate, profile, rarity, rating } = item;
  const role = profile?.role || "Perfil em atualização";
  const meta = [profile?.party || candidate.party, `Elo ${rating}`].filter(Boolean).join(" · ");
  return `
    <button class="chroma-card" type="button" data-index="${index}" data-rarity="${escapeHtml(rarity.id)}" data-family="${rarity.family === "Chroma" ? "chroma" : "regular"}" aria-label="Abrir histórico de ${escapeHtml(candidate.name)}">
      <div class="chroma-card-media">
        ${candidate.photo ? `<img src="${escapeHtml(candidate.photo)}" alt="Foto de ${escapeHtml(candidate.name)}" />` : ""}
        <span class="chroma-card-shine" aria-hidden="true"></span>
        <span class="chroma-card-badge">${escapeHtml(rarityLabel(rarity))}</span>
      </div>
      <div class="chroma-card-body">
        <h2 class="chroma-card-name">${escapeHtml(candidate.name)}</h2>
        <div class="chroma-card-role">${escapeHtml(role)}</div>
        <div class="chroma-card-meta">${escapeHtml(meta)}</div>
      </div>
    </button>`;
}

function timelineItems(profile) {
  const sources = [...(profile?.sources || [])]
    .filter((source) => source.publishedAt || source.accessedAt)
    .sort((a, b) => String(b.publishedAt || b.accessedAt).localeCompare(String(a.publishedAt || a.accessedAt)));
  return sources.map((source) => ({
    date: source.publishedAt || source.accessedAt,
    text: source.label,
    publisher: source.publisher,
  }));
}

function sourceHtml(source) {
  return `
    <a class="history-source" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">
      ${escapeHtml(source.label)}
      <small>${escapeHtml(source.publisher)} · ${escapeHtml(formatDate(source.publishedAt || source.accessedAt))}</small>
    </a>`;
}

function detailHtml(item) {
  const { candidate, profile, rarity, rating, wins, losses } = item;
  const timeline = timelineItems(profile);
  const summary = editorialSummary(profile);
  return `
    <div class="history-layout">
      <aside class="history-aside">
        <div class="history-art">
          ${candidate.photo ? `<img src="${escapeHtml(candidate.photo)}" alt="Foto de ${escapeHtml(candidate.name)}" />` : ""}
        </div>
        <div>
          <h2>${escapeHtml(candidate.name)}</h2>
          <p>${escapeHtml(profile?.role || "Atuação em atualização")}</p>
          <p>${escapeHtml(rarityLabel(rarity))} · Elo ${escapeHtml(rating)}</p>
        </div>
      </aside>
      <section class="history-main">
        <button type="button" class="history-close" data-history-close aria-label="Fechar histórico">×</button>
        <div class="history-section">
          <h3>Quem é</h3>
          <p class="history-summary">${escapeHtml(summary)}</p>
        </div>
        <div class="history-section">
          <h3>Momento atual</h3>
          <p class="history-summary">${escapeHtml(profile?.currentMoment || "Conteúdo em atualização.")}</p>
        </div>
        <div class="history-section">
          <h3>Atuação</h3>
          <p class="history-summary">${escapeHtml(profile?.role || "Atuação ainda não cadastrada.")}${profile?.party || candidate.party ? ` · ${escapeHtml(profile?.party || candidate.party)}` : ""}</p>
          <p class="history-summary">${wins + losses} duelos agregados nesta base · ${wins} vitórias · ${losses} derrotas.</p>
        </div>
        <div class="history-section">
          <h3>Linha do tempo</h3>
          <div class="history-timeline">
            ${timeline.length ? timeline.map((event) => `
              <div class="history-event">
                <div class="history-event-date">${escapeHtml(formatDate(event.date))}</div>
                <div class="history-event-copy"><strong>${escapeHtml(event.publisher)}</strong><br>${escapeHtml(event.text)}</div>
              </div>`).join("") : '<p class="history-summary">Conteúdo em atualização.</p>'}
          </div>
        </div>
        <div class="history-section">
          <h3>Fontes</h3>
          <div class="history-sources">${(profile?.sources || []).map(sourceHtml).join("") || '<p class="history-summary">Nenhuma fonte cadastrada.</p>'}</div>
        </div>
        <div class="history-nav">
          <button type="button" data-history-prev ${activeIndex <= 0 ? "disabled" : ""}>← Anterior</button>
          <button type="button" data-history-next ${activeIndex >= filtered.length - 1 ? "disabled" : ""}>Próxima →</button>
        </div>
      </section>
    </div>`;
}

function renderGrid() {
  const grid = document.querySelector("#chroma-grid");
  const count = document.querySelector("#chroma-count");
  const query = activeSearch.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
  filtered = items.filter((item) => {
    const isChroma = item.rarity.family === "Chroma";
    const familyMatches = activeFilter === "all"
      || (activeFilter === "chroma" && isChroma)
      || (activeFilter === "regular" && !isChroma)
      || item.rarity.id === activeFilter;
    const haystack = `${item.candidate.name} ${item.profile?.role || ""} ${item.profile?.party || item.candidate.party || ""}`
      .normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
    return familyMatches && (!query || haystack.includes(query));
  }).sort((a, b) => {
    if (activeSort === "name") return a.candidate.name.localeCompare(b.candidate.name, "pt-BR");
    if (activeSort === "rarity") return b.rarity.min - a.rarity.min || b.rating - a.rating;
    return b.rating - a.rating || a.candidate.name.localeCompare(b.candidate.name, "pt-BR");
  });
  if (count) count.textContent = `${filtered.length} ${filtered.length === 1 ? "Chroma" : "Chromas"}`;
  if (!grid) return;
  grid.innerHTML = filtered.length
    ? filtered.map(cardHtml).join("")
    : '<div class="chroma-empty">Nenhuma carta disponível com estes filtros.</div>';
  grid.querySelectorAll(".chroma-card").forEach((button) => button.addEventListener("click", () => openHistory(Number(button.dataset.index))));
}

function bindFilters() {
  document.querySelectorAll(".chroma-filter").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll(".chroma-filter").forEach((item) => item.classList.toggle("is-active", item === button));
      renderGrid();
    });
  });
  document.querySelector("#chroma-search")?.addEventListener("input", (event) => {
    activeSearch = event.currentTarget.value;
    renderGrid();
  });
  document.querySelector("#chroma-sort")?.addEventListener("change", (event) => {
    activeSort = event.currentTarget.value;
    renderGrid();
  });
}

function openHistory(index) {
  activeIndex = index;
  const item = filtered[index];
  const dialog = document.querySelector("#history-dialog");
  if (!item || !dialog) return;
  dialog.innerHTML = detailHtml(item);
  dialog.showModal();
  dialog.querySelector("[data-history-close]")?.addEventListener("click", () => dialog.close());
  dialog.querySelector("[data-history-prev]")?.addEventListener("click", () => openHistory(Math.max(0, activeIndex - 1)));
  dialog.querySelector("[data-history-next]")?.addEventListener("click", () => openHistory(Math.min(filtered.length - 1, activeIndex + 1)));
}

function shellHtml() {
  return `
    <div class="chroma-shell">
      <div class="chroma-topbar">
        <div class="chroma-brand"><span class="chroma-brand-mark" aria-hidden="true"></span><span>PoliMatch</span></div>
        <a class="chroma-back" href="/">Voltar ao jogo</a>
      </div>
      <section class="chroma-hero">
        <div>
          <span class="chroma-kicker">Coleção</span>
          <h1>Minha coleção</h1>
          <p>Explore cards regulares e Chromas definidos pelo ranking agregado. Toque em qualquer carta para abrir o histórico e as fontes daquela pessoa.</p>
        </div>
        <div class="chroma-count" id="chroma-count">Carregando…</div>
      </section>
      <nav class="chroma-toolbar" aria-label="Filtrar coleção">
        <button class="chroma-filter is-active" type="button" data-filter="all">Todas</button>
        <button class="chroma-filter" type="button" data-filter="chroma">Chromas</button>
        <button class="chroma-filter" type="button" data-filter="regular">Regulares</button>
        <button class="chroma-filter" type="button" data-filter="chroma-ilustrada">Ilustradas</button>
        <button class="chroma-filter" type="button" data-filter="chroma-especial">Especiais</button>
        <button class="chroma-filter" type="button" data-filter="chroma-suprema">Supremas</button>
        <button class="chroma-filter" type="button" data-filter="chroma-comemorativa">Comemorativas</button>
      </nav>
      <div class="chroma-discovery">
        <label>Buscar pessoa<input id="chroma-search" type="search" autocomplete="off" placeholder="Nome, atuação ou partido"></label>
        <label>Ordenar<select id="chroma-sort"><option value="rating">Maior Elo</option><option value="name">Nome</option><option value="rarity">Raridade</option></select></label>
      </div>
      <section class="chroma-grid" id="chroma-grid" aria-live="polite">
        <div class="chroma-empty">Carregando ranking…</div>
      </section>
    </div>
    <dialog class="history-dialog" id="history-dialog"></dialog>`;
}

async function init() {
  root.innerHTML = shellHtml();
  bindFilters();
  const dialog = document.querySelector("#history-dialog");
  dialog?.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  try {
    const ranking = await fetchServerRanking("presidentes");
    items = normalizeRanking(ranking);
    renderGrid();
  } catch {
    document.querySelector("#chroma-grid").innerHTML = '<div class="chroma-empty">Não foi possível carregar o ranking agora. A coleção funciona somente online para manter as cartas alinhadas ao ranking agregado.</div>';
    document.querySelector("#chroma-count").textContent = "Indisponível";
  }
}

init();
