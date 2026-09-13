/** Photo attribution shown in the in-app Créditos tab. */
import CANDIDATES from "../../shared/candidates.json" with { type: "json" };
import PERSON_PROFILES from "../../shared/person-profiles.json" with { type: "json" };
import { PHOTO_CREDITS } from "./photo-credits.generated.js";

export { PHOTO_CREDITS };

export const GITHUB_REPO_URL = "https://github.com/stefancabral-oss/presidencia-duelo";
export const GITHUB_README_URL = `${GITHUB_REPO_URL}/blob/main/README.md`;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const candidateByName = new Map(CANDIDATES.map((candidate) => [candidate.name, candidate]));
const profileById = new Map(PERSON_PROFILES.map((profile) => [profile.id, profile]));

export const SEARCHABLE_PHOTO_CREDITS = PHOTO_CREDITS.map((credit) => {
  const candidate = candidateByName.get(credit.name);
  const profile = candidate ? profileById.get(candidate.id) : null;
  return { ...credit, party: profile?.party || candidate?.party || "" };
});

export function normalizeCreditSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function filterPhotoCredits(query, rows = SEARCHABLE_PHOTO_CREDITS) {
  const needle = normalizeCreditSearch(query);
  if (!needle) return rows;
  return rows.filter((row) => normalizeCreditSearch(`${row.name} ${row.party}`).includes(needle));
}

function creditItemHtml(row) {
  const party = row.party ? `<span class="credit-party">${escapeHtml(row.party)}</span>` : "";
  return `
        <li class="credit-item">
          <div class="credit-name">${escapeHtml(row.name)}${party}</div>
          <div class="credit-meta">
            <span>Licença: ${escapeHtml(row.license)}</span>
            <span>Crédito: ${escapeHtml(row.author)}</span>
            <a href="${escapeHtml(row.commons)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.sourceLabel || "Ver origem da foto")}</a>
          </div>
        </li>`;
}

export function creditsGroupsHtml(rows, { expanded = false } = {}) {
  if (!rows.length) {
    return '<p class="credits-empty" role="status">Nenhum crédito encontrado para esta busca.</p>';
  }
  const groups = new Map();
  for (const row of rows) {
    const letter = normalizeCreditSearch(row.name).charAt(0).toLocaleUpperCase("pt-BR") || "#";
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(row);
  }
  return [...groups.entries()].map(([letter, items], index) => `
      <details class="credit-group"${expanded || index === 0 ? " open" : ""}>
        <summary>${escapeHtml(letter)} <span>${items.length}</span></summary>
        <ul class="credits-list">${items.map(creditItemHtml).join("")}</ul>
      </details>
    `).join("");
}

export function updateCreditsSearch({ query, count, groups }) {
  const rows = filterPhotoCredits(query);
  count.textContent = `${rows.length} ${rows.length === 1 ? "resultado" : "resultados"}`;
  groups.innerHTML = creditsGroupsHtml(rows, { expanded: Boolean(normalizeCreditSearch(query)) });
  return rows.length;
}

export function bindCreditsSearch({ input, count, groups }) {
  const render = () => updateCreditsSearch({ query: input.value, count, groups });
  input.addEventListener("input", render);
  render();
  return render;
}

export function creditsPanelHtml() {
  return `
        <div class="ranking-toolbar">
          <div>
            <strong>Créditos das fotos</strong>
            <div class="rank-sub">Atribuição das imagens usadas nos cards. Nenhuma face foi gerada por IA.</div>
          </div>
        </div>
        <p class="credits-intro">
          Todos os perfis que já possuem foto usam fontes públicas (principalmente Wikimedia Commons).
          Licenças CC e imagens de órgãos públicos exigem atribuição; esta tela reúne os créditos dentro do app.
        </p>
        <div class="credits-search-row">
          <label for="credits-search">Buscar por nome ou partido</label>
          <div>
            <input type="search" id="credits-search" autocomplete="off" placeholder="Ex.: Lula ou PT" />
            <output id="credits-count" for="credits-search" aria-live="polite">${PHOTO_CREDITS.length} resultados</output>
          </div>
        </div>
        <div class="credits-groups" id="credits-groups">${creditsGroupsHtml(SEARCHABLE_PHOTO_CREDITS)}</div>
        <p class="credits-notes">
          Fotos reais e créditos verificados nos 360 perfis do catálogo.
          Este projeto não é afiliado a partidos, TSE, Wikimedia ou às pessoas listadas.
        </p>`;
}
