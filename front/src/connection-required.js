export function connectionDiagnosticCode(phase, error) {
  const safePhase = String(phase || "app").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const detail = Number.isInteger(error?.status)
    ? String(error.status)
    : String(error?.kind || "unknown").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return `${safePhase}-${detail}`;
}

export function connectionRequiredHtml(code = "") {
  const diagnostic = /^[A-Z0-9-]+$/.test(code)
    ? `<small id="connection-diagnostic">Código: ${code}</small>`
    : "";
  return `
    <main class="app connection-required">
      <div class="logo">
        <div class="logo-badge" aria-hidden="true">PM</div>
        <h1>PoliMatch</h1>
      </div>
      <section class="connection-required-card" role="alert">
        <h2>Não foi possível sincronizar</h2>
        <p>O PoliMatch precisa acessar o servidor para preservar seus votos e estatísticas. Wi-Fi e dados móveis são compatíveis.</p>
        ${diagnostic}
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
    code = "",
  } = {},
) {
  root.innerHTML = connectionRequiredHtml(code);
  documentObject?.getElementById("retry-connection")?.addEventListener("click", reload);
}
