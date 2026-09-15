const GOOGLE_SCRIPT_ID = "google-identity-services";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
let scriptPromise;

export function googleClientId(environment = import.meta.env) {
  return String(environment?.VITE_GOOGLE_CLIENT_ID || "").trim();
}

export function loadGoogleIdentity(windowRef = window, documentRef = document) {
  if (windowRef.google?.accounts?.id) return Promise.resolve(windowRef.google);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = documentRef.getElementById(GOOGLE_SCRIPT_ID);
    const script = existing || documentRef.createElement("script");
    const onLoad = () => windowRef.google?.accounts?.id ? resolve(windowRef.google) : reject(new Error("Google Identity Services indisponível"));
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", () => reject(new Error("Não foi possível carregar o acesso com Google")), { once: true });
    if (!existing) {
      script.id = GOOGLE_SCRIPT_ID;
      script.src = GOOGLE_SCRIPT_SRC;
      script.async = true;
      documentRef.head.append(script);
    }
  }).catch((error) => {
    scriptPromise = undefined;
    throw error;
  });
  return scriptPromise;
}

export async function mountGoogleButton(element, options = {}) {
  const { clientId = googleClientId(), callback } = options;
  if (!element || !clientId) return false;
  const windowRef = options.windowRef || window;
  const documentRef = options.documentRef || document;
  const google = await loadGoogleIdentity(windowRef, documentRef);
  google.accounts.id.initialize({ client_id: clientId, callback, ux_mode: "popup" });
  element.replaceChildren();
  google.accounts.id.renderButton(element, {
    type: "standard",
    theme: "outline",
    size: "large",
    shape: "pill",
    text: "continue_with",
    locale: "pt_BR",
    width: Math.min(320, Math.max(240, Math.round(element.getBoundingClientRect?.().width || 280))),
  });
  return true;
}
