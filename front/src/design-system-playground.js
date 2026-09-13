import "./design-system.css";
import "./design-system-playground.css";

const cards = [
  {
    rarity: "basica",
    label: "Regular",
    name: "Luiz Inácio Lula da Silva",
    role: "Presidente da República",
    description: "Político brasileiro, ex-metalúrgico e fundador do Partido dos Trabalhadores. Exerce a Presidência da República.",
    meta: "PT · Política em Jogo",
    photo: "/candidates/lula.jpg",
    symbol: "●",
  },
  {
    rarity: "chroma-ilustrada",
    label: "Chroma",
    name: "Romeu Zema",
    role: "Governador de Minas Gerais",
    description: "Empresário e político brasileiro. Atua no Executivo estadual e integra o debate político nacional.",
    meta: "Novo · Política em Jogo",
    photo: "/candidates/zema.jpg",
    symbol: "★",
  },
  {
    rarity: "chroma-suprema",
    label: "Chroma Suprema",
    name: "Sérgio Moro",
    role: "Senador da República",
    description: "Jurista e político brasileiro, ex-juiz federal e ex-ministro da Justiça. Atua no Senado Federal.",
    meta: "União Brasil · Justiça & Escândalos",
    photo: "/candidates/sergio-moro.jpg",
    symbol: "★★★",
  },
  {
    rarity: "chroma-comemorativa",
    label: "Chroma Comemorativa",
    name: "Jair Bolsonaro",
    role: "Ex-presidente da República",
    description: "Político brasileiro e ex-presidente da República. Segue como figura central do campo conservador nacional.",
    meta: "PL · Política em Jogo",
    photo: "/candidates/bolsonaro.jpg",
    symbol: "★",
  },
];

function cardHtml(card) {
  return `
    <article class="pm-card" data-rarity="${card.rarity}">
      <div class="pm-card__media">
        <img src="${card.photo}" alt="${card.name}" />
        <div class="pm-card__brand">◆ PoliMatch</div>
        <div class="pm-card__rarity" title="${card.label}">${card.symbol}</div>
      </div>
      <div class="pm-card__body">
        <h3 class="pm-card__name">${card.name}</h3>
        <div class="pm-card__role">${card.role}</div>
        <p class="pm-card__description">${card.description}</p>
        <div class="pm-card__meta">${card.meta}</div>
      </div>
    </article>`;
}

const root = document.querySelector("#playground");
root.innerHTML = `
  <div class="pg-shell">
    <header class="pg-header">
      <div>
        <span class="pg-kicker">ICM 02 · Playground visual</span>
        <h1>PoliMatch Design System</h1>
        <p>Base clara, malaquita estrutural, ouro restrito e Chromas como foco visual.</p>
      </div>
      <span class="pg-status">branch: icm/02-design-system</span>
    </header>

    <section class="pg-section">
      <div class="pg-section-head">
        <div>
          <span class="pg-eyebrow">Cards</span>
          <h2>Proporção e raridade</h2>
        </div>
        <p>Mesmo esqueleto. O aumento de raridade muda acabamento, não a anatomia.</p>
      </div>
      <div class="pg-card-grid">${cards.map(cardHtml).join("")}</div>
    </section>

    <section class="pg-section">
      <div class="pg-section-head">
        <div>
          <span class="pg-eyebrow">Botões</span>
          <h2>Sistema PoliMatch</h2>
        </div>
        <p>Uma linguagem única para ações, navegação e estados.</p>
      </div>
      <div class="pg-button-grid">
        <div class="pg-button-set"><span>Primary</span><button class="pm-button pm-button--primary">Continuar</button></div>
        <div class="pg-button-set"><span>Secondary</span><button class="pm-button pm-button--secondary">Ver ficha</button></div>
        <div class="pg-button-set"><span>Ghost</span><button class="pm-button pm-button--ghost">Pular</button></div>
        <div class="pg-button-set"><span>Danger</span><button class="pm-button pm-button--danger">Reiniciar</button></div>
        <div class="pg-button-set"><span>Icon</span><button class="pm-button pm-button--icon" aria-label="Compartilhar">↗</button></div>
        <div class="pg-button-set"><span>Disabled</span><button class="pm-button pm-button--secondary" disabled>Indisponível</button></div>
      </div>
      <div class="pg-chip-row">
        <button class="pm-topic-chip is-active">Política em Jogo</button>
        <button class="pm-topic-chip">Justiça & Escândalos</button>
        <button class="pm-topic-chip">Direita x Esquerda</button>
        <button class="pm-topic-chip">Corrida 2026</button>
      </div>
    </section>

    <section class="pg-section pg-section--comparison">
      <div class="pg-section-head">
        <div>
          <span class="pg-eyebrow">Duelo preview</span>
          <h2>Leitura lado a lado</h2>
        </div>
        <p>Teste de densidade antes de integrar a lógica real do jogo.</p>
      </div>
      <div class="pg-duel-preview">
        ${cardHtml(cards[1])}
        <div class="pg-vs">VS</div>
        ${cardHtml(cards[3])}
      </div>
    </section>
  </div>`;
