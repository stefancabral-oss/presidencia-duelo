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

function enhanceNavigation() {
  const nav = document.querySelector(".tabs");
  if (!nav) return;
  nav.setAttribute("aria-label", "Navegação principal do PoliMatch");
  const icons = {
    "tab-home": "⌂",
    "tab-duel": "⚔",
    "tab-tournament": "♜",
    "tab-rank": "▥",
    "tab-credits": "◇",
  };
  for (const button of nav.querySelectorAll(".tab")) {
    if (button.querySelector(".tab-icon")) continue;
    const icon = document.createElement("span");
    icon.className = "tab-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = icons[button.id] || "•";
    button.prepend(icon);
  }
}

function enhanceDuelPrompt() {
  const prompt = document.getElementById("duel-prompt");
  if (prompt) prompt.textContent = "Quem representa melhor sua escolha?";
}

export function installFrontendEnhancements() {
  ensureMeta("theme-color", "#061a14");
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
