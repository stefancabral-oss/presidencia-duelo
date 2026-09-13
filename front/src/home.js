export function homePanelHtml() {
  return `
    <section id="panel-home" class="panel active home-hub" aria-label="Início">
      <div class="home-hero">
        <p class="home-kicker">POLIMATCH</p>
        <h2>Quem vence o debate?</h2>
        <p class="home-lead">Escolha entre duas pessoas, monte seu ranking e descubra seu pódio político.</p>
        <p class="home-disclaimer" role="note">Entretenimento · não é pesquisa oficial</p>
        <button type="button" class="home-play" id="home-play">Começar duelo</button>
      </div>

      <div class="home-shortcuts" aria-label="Atalhos">
        <button type="button" class="home-shortcut home-shortcut-wide" id="home-tournament">
          <span aria-hidden="true">🏆</span><strong>Torneio</strong><small>Jogue um mata-mata</small>
        </button>
        <button type="button" class="home-shortcut" id="home-ranking">
          <span aria-hidden="true">📊</span><strong>Ranking</strong><small>Veja suas escolhas</small>
        </button>
        <button type="button" class="home-shortcut" id="home-podium">
          <span aria-hidden="true">🥇</span><strong>Pódio</strong><small>Compartilhe seu top 3</small>
        </button>
        <button type="button" class="home-shortcut" id="home-achievements">
          <span aria-hidden="true">🎯</span><strong>Conquistas</strong><small>Acompanhe seu progresso</small>
        </button>
        <button type="button" class="home-shortcut" id="home-credits">
          <span aria-hidden="true">ℹ️</span><strong>Créditos</strong><small>Fotos e fontes</small>
        </button>
      </div>
    </section>`;
}
