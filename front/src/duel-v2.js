export function duelPanelV2Html({ topicSelectorMarkup, initialGoal, requireApi = false }) {
  return `
    <section id="panel-duel" class="panel pm-duel-v2" aria-label="Duelo">
      <div class="pm-duel-v2__topline">
        <div class="pm-duel-v2__topics">${topicSelectorMarkup}</div>
        <div class="pm-duel-v2__counter">Duelo <strong id="duel-count">0</strong></div>
      </div>

      <div class="pm-duel-v2__controls">
        <div class="mode-switch pm-duel-v2__mode" aria-label="Categoria do duelo">
          <span class="mode-label">Disputar:</span>
          <button type="button" class="mode-btn active" id="mode-presidentes" aria-pressed="true">Pessoas</button>
          <button type="button" class="mode-btn" id="mode-vices" aria-pressed="false" hidden disabled>Vices</button>
        </div>
        <div class="combo-banner pm-duel-v2__combo" id="combo-banner" hidden>
          <span class="combo-label" id="combo-label"></span>
        </div>
      </div>

      <div class="pm-duel-v2__question-row">
        <p id="duel-prompt">Quem representa melhor sua escolha?</p>
        <span class="pm-duel-v2__goal-copy" id="duel-progress-text"></span>
      </div>

      <div
        class="duel-progress pm-duel-v2__progress"
        id="duel-progress"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="${initialGoal}"
        aria-valuenow="0"
        aria-labelledby="duel-progress-text"
      >
        <div class="duel-progress-bar pm-duel-v2__progress-track" id="duel-progress-bar">
          <div class="duel-progress-fill pm-duel-v2__progress-fill" id="duel-progress-fill"></div>
        </div>
      </div>

      <div class="goal-modal pm-duel-v2__achievement" id="goal-modal" hidden>
        <div class="goal-modal-card pm-duel-v2__achievement-card" role="status" aria-labelledby="goal-modal-title">
          <div class="pm-duel-v2__achievement-copy">
            <strong class="goal-modal-title" id="goal-modal-title">Meta atingida!</strong>
            <span class="goal-modal-lead" id="goal-modal-lead"></span>
            <span class="goal-modal-leader" id="goal-modal-leader"></span>
          </div>
          <div class="goal-modal-actions pm-duel-v2__achievement-actions">
            <button type="button" class="btn primary" id="goal-continue">Nova meta</button>
            <button type="button" class="btn" id="goal-podium">Pódio</button>
            <button type="button" class="btn" id="goal-dismiss" aria-label="Fechar conquista">×</button>
          </div>
        </div>
      </div>

      <aside class="quick-controls-hint" id="quick-controls-hint" hidden>
        <span id="quick-controls-text"></span>
        <button type="button" id="dismiss-quick-controls">Entendi</button>
      </aside>

      <div class="pm-duel-v2__arena" id="duel-cards">
        <div class="duel-card-shell pm-duel-v2__card-shell">
          <button type="button" class="poke-card pm-duel-card" id="card-a" aria-label="Escolher pessoa da esquerda"></button>
          <button type="button" class="card-info pm-duel-v2__info" id="info-card-a">Ver ficha</button>
        </div>

        <div class="duel-center pm-duel-v2__center">
          <div class="vs-badge pm-duel-v2__vs" aria-hidden="true">VS</div>
          <button type="button" class="skip-duel pm-duel-v2__skip" id="skip-duel" aria-label="Não conheço estas pessoas; pular este duelo">Pular</button>
        </div>

        <div class="duel-card-shell pm-duel-v2__card-shell">
          <button type="button" class="poke-card pm-duel-card" id="card-b" aria-label="Escolher pessoa da direita"></button>
          <button type="button" class="card-info pm-duel-v2__info" id="info-card-b">Ver ficha</button>
        </div>
      </div>

      <span class="visually-hidden" id="skip-duel-status" aria-live="polite"></span>
      <p class="pm-duel-v2__footnote">${requireApi ? "Conexão obrigatória para preservar todos os votos" : "Modo local disponível sem API"}</p>
    </section>`;
}
