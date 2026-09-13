function ensureMeta(name, content, property = false) {
  if (!globalThis.document?.head) return;
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let meta = document.head.querySelector(selector);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(property ? "property" : "name", name);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

function ensureStructuredData() {
  if (!globalThis.document?.head || document.getElementById("polimatch-app-schema")) return;
  const script = document.createElement("script");
  script.id = "polimatch-app-schema";
  script.type = "application/ld+json";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "PoliMatch",
    url: "https://polimatch.com.br/",
    applicationCategory: "GameApplication",
    operatingSystem: "Web",
    inLanguage: "pt-BR",
    description: "Jogo casual de duelos entre pessoas da vida pública brasileira. Não é pesquisa eleitoral oficial.",
    isAccessibleForFree: true,
  });
  document.head.appendChild(script);
}

function addProductHeader() {
  const header = document.querySelector("header");
  if (!header || header.querySelector(".product-identity-row")) return;
  const row = document.createElement("div");
  row.className = "product-identity-row";
  row.innerHTML = `
    <div class="product-wordmark">
      <span class="product-mark" aria-hidden="true"></span>
      <span>PoliMatch</span>
      <small>Malaquita 2026</small>
    </div>
    <button type="button" class="sso-entry" aria-label="Entrar ou sincronizar conta" data-sso-entry>
      <span aria-hidden="true">◉</span><span>Entrar</span>
    </button>`;
  header.prepend(row);
}

function addSsoDialog() {
  if (document.getElementById("sso-dialog")) return;
  const dialog = document.createElement("dialog");
  dialog.id = "sso-dialog";
  dialog.className = "sso-dialog";
  dialog.innerHTML = `
    <form method="dialog" class="sso-card">
      <button class="sso-close" value="cancel" aria-label="Fechar">×</button>
      <p class="sso-kicker">Sua coleção em qualquer tela</p>
      <h2>Entrar no PoliMatch</h2>
      <p class="sso-copy">O SSO será conectado a um provedor compatível com OpenID Connect. A interface já está preparada sem alterar seu jogo anônimo atual.</p>
      <div class="sso-options" role="group" aria-label="Opções de entrada">
        <button type="button" disabled>Continuar com Google</button>
        <button type="button" disabled>Continuar com Apple</button>
        <button type="button" disabled>Continuar com Microsoft</button>
      </div>
      <small>Disponível quando o provedor de identidade for definido.</small>
    </form>`;
  document.body.appendChild(dialog);
}

function bindSsoDialog() {
  const trigger = document.querySelector("[data-sso-entry]");
  const dialog = document.getElementById("sso-dialog");
  if (!trigger || !dialog) return;
  trigger.addEventListener("click", () => dialog.showModal?.());
}

function navIcon(name) {
  const paths = {
    home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3Z"/>',
    duel: '<path d="m5 4 5 5-6 6-2-2 6-6Zm14 0-5 5 6 6 2-2-6-6ZM8 16l-3 3m11-3 3 3"/>',
    tournament: '<path d="M7 3h10v3c0 3-2 5-5 5S7 9 7 6Zm-3 1h3v2c0 2-1 4-3 4Zm16 0h-3v2c0 2 1 4 3 4ZM10 11v4h4v-4m-6 8h8"/>',
    rank: '<path d="M5 20V11h4v9Zm5 0V4h4v16Zm5 0v-7h4v7Z"/>',
    credits: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-11v6m0-9h.01"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name] || paths.home}</svg>`;
}

function enhanceNavigation() {
  const nav = document.querySelector(".tabs");
  if (!nav) return;
  nav.classList.add("pm-nav-v2");
  nav.setAttribute("aria-label", "Navegação principal do PoliMatch");
  const icons = {
    "tab-home": "home",
    "tab-duel": "duel",
    "tab-tournament": "tournament",
    "tab-rank": "rank",
    "tab-credits": "credits",
  };
  for (const button of nav.querySelectorAll(".tab")) {
    button.classList.add("pm-nav-v2__item");
    let icon = button.querySelector(".tab-icon");
    if (!icon) {
      icon = document.createElement("span");
      icon.className = "tab-icon pm-nav-v2__icon";
      icon.setAttribute("aria-hidden", "true");
      button.prepend(icon);
    }
    icon.innerHTML = navIcon(icons[button.id] || "home");
  }
}

function enhanceDuelPrompt() {
  const prompt = document.getElementById("duel-prompt");
  if (prompt) prompt.textContent = "Quem representa melhor sua escolha?";
}

export function installFrontendEnhancements() {
  ensureMeta("theme-color", "#faf8f3");
  ensureMeta("application-name", "PoliMatch");
  ensureMeta("robots", "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");
  ensureMeta("og:site_name", "PoliMatch", true);
  ensureMeta("og:url", "https://polimatch.com.br/", true);
  ensureStructuredData();
  addProductHeader();
  addSsoDialog();
  bindSsoDialog();
  enhanceNavigation();
  enhanceDuelPrompt();
}
