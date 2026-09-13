export function homePanelHtml() {
  return `
    <section id="panel-home" class="panel active pm-home-v2" aria-label="Início">
      <header class="pm-home-v2__hero">
        <div class="pm-home-v2__eyebrow">POLIMATCH</div>
        <h2>Escolha. Compare. Descubra seu ranking.</h2>
        <p class="pm-home-v2__lead">Duelos rápidos entre pessoas da vida pública, com ranking, torneio e coleção.</p>
        <button type="button" class="home-play pm-home-v2__primary" id="home-play">
          <span>Jogar agora</span>
          <span aria-hidden="true">→</span>
        </button>
        <p class="pm-home-v2__note" role="note">Jogo casual · não é pesquisa eleitoral</p>
      </header>

      <section class="pm-home-v2__section" aria-labelledby="pm-home-v2-explore-title">
        <div class="pm-home-v2__section-head">
          <div>
            <span class="pm-home-v2__section-kicker">Explorar</span>
            <h3 id="pm-home-v2-explore-title">Continue por onde quiser</h3>
          </div>
        </div>

        <div class="home-shortcuts pm-home-v2__grid" aria-label="Atalhos">
          <button type="button" class="home-shortcut pm-home-v2__tile pm-home-v2__tile--featured" id="home-tournament">
            <span class="pm-home-v2__tile-icon" aria-hidden="true">T</span>
            <span class="pm-home-v2__tile-copy"><strong>Torneio</strong><small>12 pessoas. Um vencedor.</small></span>
            <span class="pm-home-v2__tile-arrow" aria-hidden="true">→</span>
          </button>

          <button type="button" class="home-shortcut pm-home-v2__tile" id="home-ranking">
            <span class="pm-home-v2__tile-icon" aria-hidden="true">R</span>
            <span class="pm-home-v2__tile-copy"><strong>Ranking</strong><small>Veja quem está subindo.</small></span>
            <span class="pm-home-v2__tile-arrow" aria-hidden="true">→</span>
          </button>

          <button type="button" class="home-shortcut pm-home-v2__tile" id="home-podium">
            <span class="pm-home-v2__tile-icon" aria-hidden="true">P</span>
            <span class="pm-home-v2__tile-copy"><strong>Pódio</strong><small>Seu top 3 para compartilhar.</small></span>
            <span class="pm-home-v2__tile-arrow" aria-hidden="true">→</span>
          </button>

          <button type="button" class="home-shortcut pm-home-v2__tile" id="home-achievements">
            <span class="pm-home-v2__tile-icon" aria-hidden="true">C</span>
            <span class="pm-home-v2__tile-copy"><strong>Conquistas</strong><small>Metas, combos e progresso.</small></span>
            <span class="pm-home-v2__tile-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <button type="button" class="home-shortcut pm-home-v2__credits" id="home-credits">
        <span>Fotos, fontes e créditos</span><span aria-hidden="true">→</span>
      </button>
    </section>`;
}
