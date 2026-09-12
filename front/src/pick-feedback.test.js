import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyPickFeedback,
  clearPickFeedback,
  formatEloDelta,
  showEloFloat,
  showZebraBadge,
  tryVibrate,
  VIBRATE_MS,
  ZEBRA_BADGE_TEXT,
} from "./pick-feedback.js";

function mockClassList() {
  const items = new Set();
  return {
    items,
    add(...names) {
      for (const name of names) items.add(name);
    },
    remove(...names) {
      for (const name of names) items.delete(name);
    },
    contains(name) {
      return items.has(name);
    },
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
          setAttribute(name, value) {
            this.attrs[name] = value;
          },
          remove() {
            const i = children.indexOf(node);
            if (i >= 0) children.splice(i, 1);
          },
        };
        return node;
      },
    },
    querySelector(sel) {
      const cls = sel.startsWith(".") ? sel.slice(1) : sel;
      return children.find((child) => String(child.className).split(/\s+/).includes(cls)) ?? null;
    },
    appendChild(node) {
      children.push(node);
      return node;
    },
  };
  return card;
}

test("formatEloDelta shows a signed plus on gains and keeps the minus on losses", () => {
  assert.equal(formatEloDelta(14), "+14");
  assert.equal(formatEloDelta(16), "+16");
  assert.equal(formatEloDelta(-14), "-14");
  assert.equal(formatEloDelta(-16), "-16");
  assert.equal(formatEloDelta(0), "0");
  assert.equal(formatEloDelta(8.4), "+8");
});

test("tryVibrate no-ops when vibrate is missing and does not throw", () => {
  assert.equal(tryVibrate(VIBRATE_MS, undefined), false);
  assert.equal(tryVibrate(VIBRATE_MS, {}), false);
  assert.equal(
    tryVibrate(VIBRATE_MS, {
      vibrate() {
        throw new Error("blocked");
      },
    }),
    false,
  );
});

test("tryVibrate calls navigator.vibrate(30) when supported", () => {
  const calls = [];
  const ok = tryVibrate(VIBRATE_MS, {
    vibrate(ms) {
      calls.push(ms);
    },
  });
  assert.equal(ok, true);
  assert.deepEqual(calls, [30]);
});

test("applyPickFeedback adds classes, floats, and a vibrate hook", () => {
  const winner = mockCard();
  const loser = mockCard();
  const vibrated = [];
  applyPickFeedback(winner, loser, 16, -16, {
    navigator: {
      vibrate(ms) {
        vibrated.push(ms);
      },
    },
  });
  assert.equal(winner.classList.contains("picked-win"), true);
  assert.equal(loser.classList.contains("picked-lose"), true);
  assert.equal(winner.children[0].textContent, "+16");
  assert.equal(winner.children[0].className, "elo-float win");
  assert.equal(winner.children[0].attrs["aria-hidden"], "true");
  assert.equal(loser.children[0].textContent, "-16");
  assert.equal(loser.children[0].className, "elo-float lose");
  assert.deepEqual(vibrated, [30]);
});

test("showEloFloat replaces a previous float instead of stacking", () => {
  const el = mockCard();
  showEloFloat(el, 16, "win");
  showEloFloat(el, 8, "win");
  assert.equal(el.children.length, 1);
  assert.equal(el.children[0].textContent, "+8");
});

test("clearPickFeedback removes hit classes and the float", () => {
  const el = mockCard();
  applyPickFeedback(el, mockCard(), 16, -16, { navigator: { vibrate() {} } });
  clearPickFeedback(el);
  assert.equal(el.classList.contains("picked-win"), false);
  assert.equal(el.children[0], undefined);
});

test("showZebraBadge stamps ZEBRA! and replaces a previous badge", () => {
  const el = mockCard();
  showZebraBadge(el);
  showZebraBadge(el);
  assert.equal(el.children.length, 1);
  assert.equal(el.children[0].textContent, ZEBRA_BADGE_TEXT);
  assert.equal(el.children[0].className, "zebra-badge");
  assert.equal(el.children[0].attrs["aria-hidden"], "true");
});

test("applyPickFeedback stamps ZEBRA! on the winner only when zebra is true", () => {
  const winner = mockCard();
  const loser = mockCard();
  applyPickFeedback(winner, loser, 20, -20, { zebra: true, navigator: { vibrate() {} } });
  const badge = winner.children.find((child) => child.className === "zebra-badge");
  assert.equal(badge.textContent, "ZEBRA!");
  assert.equal(
    loser.children.find((child) => child.className === "zebra-badge"),
    undefined,
  );

  const evenWinner = mockCard();
  applyPickFeedback(evenWinner, mockCard(), 16, -16, { zebra: false, navigator: { vibrate() {} } });
  assert.equal(
    evenWinner.children.find((child) => child.className === "zebra-badge"),
    undefined,
  );
});

test("clearPickFeedback also removes the zebra badge", () => {
  const el = mockCard();
  applyPickFeedback(el, mockCard(), 20, -20, { zebra: true, navigator: { vibrate() {} } });
  clearPickFeedback(el);
  assert.equal(el.children.length, 0);
});
