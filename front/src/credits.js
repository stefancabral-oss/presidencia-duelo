/** Photo attribution shown in the in-app Créditos tab. */
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

export function creditsPanelHtml() {
  const items = PHOTO_CREDITS.map((row) => {
    return `
        <li class="credit-item">
          <div class="credit-name">${escapeHtml(row.name)}</div>
          <div class="credit-meta">
            ${escapeHtml(row.license)} — ${escapeHtml(row.author)}
            · <a href="${escapeHtml(row.commons)}" rel="noopener noreferrer">${escapeHtml(row.sourceLabel || "Wikimedia")}</a>
          </div>
        </li>`;
  }).join("");

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
        <ul class="credits-list">${items}
        </ul>
        <p class="credits-notes">
          Fotos reais e créditos verificados nos 360 perfis do catálogo.
          Este projeto não é afiliado a partidos, TSE, Wikimedia ou às pessoas listadas.
        </p>`;
}
