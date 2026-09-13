import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PICK_PENDING_TEXT,
  VIBRATE_MS,
  applyPendingPickFeedback,
  applyPickFeedback,
  clearPickFeedback,
  formatEloDelta,
  formatPickResult,
  showPickResult,
  tryVibrate,
} from "./pick-feedback.js";

function mockClassList() {
  const items = new Set();
  return {
    items,
    add(...names) { names.forEach((name) => items.add(name)); },
    remove(...names) { names.forEach((name) => items.delete(name)); },
    contains(name) { return items.has(name); },
  };
}

function mockCard() {
  const children = [];
  const card = {
    classList: mockClassList(),
    children,
    ownerDocument: {
      createElement(tag) {
        const node = {
          tagName: tag,
          className: "",
          textContent: "",
          attrs: {},
          setAttribute(name, value) { this.attrs[name] = value; },
          remove() {
            const index = children.indexOf(node);
            if (index >= 0) children.splice(index, 1);
          },
        };
        return node;
      },
    },
    querySelector(selector) {
      const className = selector.startsWith(".") ? selector.slice(1) : selector;
      return children.find((child) => child.className.split(/\s+/).includes(className)) || null;
    },
    appendChild(node) { children.push(node); return node; },
  };
  return card;
}

test("formatEloDelta shows signed rounded changes", () => {
  assert.equal(formatEloDelta(16), "+16");
  assert.equal(formatEloDelta(-14), "-14");
  assert.equal(formatEloDelta(0), "0");
  assert.equal(formatEloDelta(8.4), "+8");
});

test("result priority is zebra, Elo, combo, then persistence confirmation", () => {
  assert.equal(
    formatPickResult({ winnerDelta: 20, zebra: true, combo: 3, saved: true }),
    "ZEBRA! · +20 Elo · Combo x3 · Voto salvo",
  );
  assert.equal(
    formatPickResult({ winnerDelta: 16, combo: 1, saved: false }),
    "+16 Elo · Escolha registrada",
  );
});

test("tryVibrate is safe and uses the short haptic pulse when supported", () => {
  assert.equal(tryVibrate(VIBRATE_MS, undefined), false);
  const calls = [];
  assert.equal(tryVibrate(VIBRATE_MS, { vibrate: (ms) => calls.push(ms) }), true);
  assert.deepEqual(calls, [30]);
  assert.equal(tryVibrate(VIBRATE_MS, { vibrate() { throw new Error("blocked"); } }), false);
});

test("pending feedback says chosen, never saved", () => {
  const winner = mockCard();
  const loser = mockCard();
  const node = applyPendingPickFeedback(winner, loser);
  assert.equal(winner.classList.contains("picked-pending"), true);
  assert.equal(node.textContent, PICK_PENDING_TEXT);
  assert.doesNotMatch(node.textContent, /salvo/i);
  assert.equal(node.attrs.role, "status");
  assert.equal(node.attrs["aria-live"], "polite");
});

test("confirmed feedback creates one readable moment on the winner", () => {
  const winner = mockCard();
  const loser = mockCard();
  applyPickFeedback(winner, loser, 20, -20, {
    zebra: true,
    combo: 2,
    saved: true,
    navigator: { vibrate() {} },
  });
  assert.equal(winner.classList.contains("picked-win"), true);
  assert.equal(loser.classList.contains("picked-lose"), true);
  assert.equal(winner.children.length, 1);
  assert.equal(loser.children.length, 0);
  assert.equal(winner.children[0].className, "pick-result zebra");
  assert.match(winner.children[0].textContent, /^ZEBRA! · \+20 Elo · Combo x2 · Voto salvo$/);
});

test("result replacement and cleanup never stack moments", () => {
  const card = mockCard();
  showPickResult(card, "primeiro");
  showPickResult(card, "segundo");
  assert.equal(card.children.length, 1);
  assert.equal(card.children[0].textContent, "segundo");
  card.classList.add("picked-pending", "picked-win");
  clearPickFeedback(card);
  assert.equal(card.children.length, 0);
  assert.equal(card.classList.contains("picked-pending"), false);
  assert.equal(card.classList.contains("picked-win"), false);
});
