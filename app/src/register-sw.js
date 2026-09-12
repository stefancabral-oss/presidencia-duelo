export function canRegisterServiceWorker({
  location = globalThis.location,
  navigator = globalThis.navigator,
} = {}) {
  return ["http:", "https:"].includes(location?.protocol)
    && Boolean(navigator && "serviceWorker" in navigator);
}

export function registerServiceWorker({
  window: win = globalThis.window,
  navigator: nav = globalThis.navigator,
  scriptUrl,
} = {}) {
  if (!canRegisterServiceWorker({ location: win?.location, navigator: nav })) return false;
  const resolvedScriptUrl = scriptUrl
    || new URL("./sw.js", win.document?.baseURI || win.location.href);
  win.addEventListener("load", () => {
    nav.serviceWorker.register(resolvedScriptUrl.href).catch((err) => {
      console.warn("SW não registrado:", err);
    });
  });
  return true;
}
