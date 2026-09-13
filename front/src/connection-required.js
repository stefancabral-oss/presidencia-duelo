export function connectionRequiredHtml() {
  return `
    <main class="app connection-required">
      <div class="logo">
        <div class="logo-badge" aria-hidden="true">PM</div>
        <h1>PoliMatch</h1>
      </div>
      <section class="connection-required-card" role="alert">
        <h2>Não foi possível sincronizar</h2>
        <p>O PoliMatch precisa acessar o servidor para preservar seus votos e estatísticas. Wi-Fi e dados móveis são compatíveis.</p>
        <button type="button" class="btn primary" id="retry-connection">Tentar novamente</button>
      </section>
    </main>
  `;
}

export function renderConnectionRequired(
  root,
  {
    documentObject = globalThis.document,
    reload = () => globalThis.location?.reload(),
  } = {},
) {
  root.innerHTML = connectionRequiredHtml();
  documentObject?.getElementById("retry-connection")?.addEventListener("click", reload);
}
