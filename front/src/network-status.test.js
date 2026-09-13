import test from "node:test";
import assert from "node:assert/strict";
import { NETWORK_STATES, setNetworkStatus } from "./network-status.js";

function statusElement() {
  const classes = new Set(["api-status"]);
  return {
    textContent: "",
    dataset: {},
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
    },
  };
}

test("setNetworkStatus distinguishes saved, failed, and unknown confirmation", () => {
  const element = statusElement();

  setNetworkStatus(element, NETWORK_STATES.SAVED);
  assert.match(element.textContent, /voto salvo/);
  assert.equal(element.classList.contains("online"), true);

  setNetworkStatus(element, NETWORK_STATES.FAILED);
  assert.match(element.textContent, /não registrado/);
  assert.equal(element.classList.contains("offline"), true);
  assert.equal(element.classList.contains("online"), false);

  setNetworkStatus(element, NETWORK_STATES.UNKNOWN);
  assert.match(element.textContent, /Não foi possível confirmar/);
  assert.equal(element.classList.contains("unknown"), true);
  assert.equal(element.dataset.networkState, NETWORK_STATES.UNKNOWN);
});
