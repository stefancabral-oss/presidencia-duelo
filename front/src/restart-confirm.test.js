import assert from "node:assert/strict";
import { test } from "node:test";
import { installTournamentRestartGuard } from "./restart-confirm.js";

function fixture(roundText = "Primeira rodada · duelo 2 de 11") {
  const listeners = new Map();
  const restart = { id: "restart-tournament", dataset: {}, textContent: "Novo torneio" };
  restart.closest = (selector) => selector === "#restart-tournament" ? restart : null;
  let restarts = 0;
  const again = { click: () => { restarts += 1; } };
  const status = { hidden: true, textContent: "" };
  const round = { textContent: roundText };
  const winner = { hidden: true };
  const documentRef = {
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: () => {},
    getElementById: (id) => ({
      "restart-tournament": restart,
      "tournament-again": again,
      "tournament-recovery-status": status,
      "tournament-round": round,
      "tournament-winner": winner,
    })[id] || null,
  };
  const windowRef = {
    setTimeout: () => 1,
    clearTimeout: () => {},
  };
  installTournamentRestartGuard({ documentRef, windowRef });
  return { handler: listeners.get("click"), restart, status, restarts: () => restarts };
}

function event(target) {
  return {
    target,
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; },
  };
}

test("first restart click arms inline confirmation and second click restarts", () => {
  const ui = fixture();
  const first = event(ui.restart);
  ui.handler(first);
  assert.equal(first.prevented, true);
  assert.equal(ui.restart.textContent, "Confirmar novo torneio");
  assert.match(ui.status.textContent, /Clique novamente/);
  assert.equal(ui.restarts(), 0);

  const second = event(ui.restart);
  ui.handler(second);
  assert.equal(second.prevented, true);
  assert.equal(ui.restarts(), 1);
  assert.equal(ui.restart.textContent, "Novo torneio");
});

test("fresh tournament keeps the original one-click behavior", () => {
  const ui = fixture("Primeira rodada · duelo 1 de 11");
  const click = event(ui.restart);
  ui.handler(click);
  assert.equal(click.prevented, false);
  assert.equal(ui.restarts(), 0);
});
