export const NETWORK_STATES = {
  CONNECTING: "connecting",
  ONLINE: "online",
  LOCAL: "local",
  REGISTERING: "registering",
  SAVED: "saved",
  FAILED: "failed",
  UNKNOWN: "unknown",
};

const STATUS = {
  [NETWORK_STATES.CONNECTING]: { text: "Conectando à API…", tone: "pending" },
  [NETWORK_STATES.ONLINE]: { text: "API online — votos locais + ranking agregado", tone: "online" },
  [NETWORK_STATES.LOCAL]: { text: "Modo local — API indisponível; ranking só neste aparelho (localStorage)", tone: "offline" },
  [NETWORK_STATES.REGISTERING]: { text: "Registrando voto…", tone: "pending" },
  [NETWORK_STATES.SAVED]: { text: "API online — voto salvo no aparelho e no ranking agregado", tone: "online" },
  [NETWORK_STATES.FAILED]: { text: "Voto não registrado. Tente novamente.", tone: "offline" },
  [NETWORK_STATES.UNKNOWN]: { text: "Não foi possível confirmar o voto. Atualize a página antes de continuar.", tone: "unknown" },
};

export function setNetworkStatus(element, state) {
  const status = STATUS[state] || STATUS[NETWORK_STATES.CONNECTING];
  element.textContent = status.text;
  element.dataset.networkState = state;
  element.classList.remove("online", "offline", "pending", "unknown");
  element.classList.add(status.tone);
}
