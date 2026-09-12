/**
 * Photo attribution shown in the in-app Créditos tab.
 * Kept here (not as a .md href) so file:// and offline still work.
 */
export const GITHUB_REPO_URL = "https://github.com/stefancabral-oss/presidencia-duelo";
export const GITHUB_README_URL = `${GITHUB_REPO_URL}/blob/main/README.md`;

export const PHOTO_CREDITS = [
  {
    name: "Luiz Inácio Lula da Silva",
    license: "CC BY 2.0",
    author: "Palácio do Planalto (Ricardo Stuckert / Flickr)",
    commons:
      "https://commons.wikimedia.org/wiki/File:Foto_oficial_de_Luiz_In%C3%A1cio_Lula_da_Silva_(2023%E2%80%932027).jpg",
  },
  {
    name: "Flávio Bolsonaro",
    license: "Attribution (Agência Senado)",
    author: "Agência Senado",
    commons:
      "https://commons.wikimedia.org/wiki/File:Foto_oficial_do_senador_Fl%C3%A1vio_Bolsonaro_(v._AgSen)_(3x4).jpg",
  },
  {
    name: "Ronaldo Caiado",
    license: "CC BY 2.0",
    author: "Bianca Kida",
    commons:
      "https://commons.wikimedia.org/wiki/File:Foto_oficial_do_governador_de_Goi%C3%A1s,_Ronaldo_Caiado_em_2023_(cropped).jpg",
  },
  {
    name: "Romeu Zema",
    license: "CC BY 2.0",
    author: "Andressa Anholete / Agência Senado",
    commons: "https://commons.wikimedia.org/wiki/File:Romeu_Zema,_December_2024_(cropped).jpg",
  },
  {
    name: "Renan Santos",
    license: "CC BY 4.0",
    author: "Leonardo Carraro",
    commons:
      "https://commons.wikimedia.org/wiki/File:Renan_Santos_-_Congresso_do_Partido_Miss%C3%A3o,_2026_(cropped_2).jpg",
  },
  {
    name: "Augusto Cury",
    license: "CC BY-SA 2.0",
    author: "Lima Andruška",
    commons: "https://commons.wikimedia.org/wiki/File:Augusto_Cury,_escritor_(28339139296)_(cropped).jpg",
  },
  {
    name: "Rui Costa Pimenta",
    license: "CC BY 3.0 BR",
    author: "Valter Campanato / Agência Brasil",
    commons: "https://commons.wikimedia.org/wiki/File:Rui_Costa_Pimenta_PCO_ABr_(cropped).jpg",
  },
  {
    name: "Samara Martins",
    license: "Attribution",
    author: "Reprodução / Jornal A Verdade (via Commons)",
    commons: "https://commons.wikimedia.org/wiki/File:Samara_Martins_UP.jpg",
  },
  {
    name: "Hertz Dias",
    license: "CC BY 2.0",
    author: "Romerito Pontes",
    commons: "https://commons.wikimedia.org/wiki/File:Hertz_Dias_PSTU_(cropped).jpg",
  },
  {
    name: "Edmilson Costa",
    license: "CC BY 3.0",
    author: "Diário Liberdade",
    commons: "https://commons.wikimedia.org/wiki/File:Edmilson_Costa_-_PCB.jpg",
  },
  {
    name: "Wilson Grassi",
    license: "CC BY 4.0",
    author: "Portal de Dados Abertos do TSE",
    commons: "https://commons.wikimedia.org/wiki/File:Wilson_Grassi_J%C3%BAnior_2024.jpg",
  },
  {
    name: "Clariana Barão",
    license: "CC BY-SA 4.0",
    author: "LFLN",
    commons: "https://commons.wikimedia.org/wiki/File:Clariana_Zacarkim_Bar%C3%A3o.jpg",
  },
];

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
            · <a href="${escapeHtml(row.commons)}" rel="noopener noreferrer">Wikimedia</a>
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
          Todas as fotos vêm de fontes públicas (principalmente Wikimedia Commons).
          Licenças CC exigem atribuição; esta tela cumpre esse papel mesmo offline.
        </p>
        <ul class="credits-list">${items}
        </ul>
        <p class="credits-notes">
          Fotos reais em 12/12 candidatos. Iniciais só aparecem se alguma imagem falhar ao carregar.
          Pablo Marçal não está na lista. Este projeto não é afiliado a partidos, TSE, Wikimedia ou candidatos.
        </p>`;
}
