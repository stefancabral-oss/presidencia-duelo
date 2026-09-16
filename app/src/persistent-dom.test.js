import assert from "node:assert/strict";
import test from "node:test";
import { markPortraitFailed, markPortraitLoaded, patchCandidateSlot, showPersistentPanel } from "./persistent-dom.js";

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(name, force) {
    if (force) this.values.add(name);
    else this.values.delete(name);
  }
  contains(name) { return this.values.has(name); }
}

function fakeElement() {
  const attributes = new Map();
  return {
    attributes,
    classList: new FakeClassList(),
    dataset: {},
    hidden: false,
    textContent: "",
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    removeAttribute(name) { attributes.delete(name); },
  };
}

function fakeSlot() {
  return {
    root: fakeElement(),
    button: fakeElement(),
    fallback: fakeElement(),
    image: fakeElement(),
    name: fakeElement(),
    affiliation: fakeElement(),
    office: fakeElement(),
    summary: fakeElement(),
    outcome: fakeElement(),
    outcomeValue: fakeElement(),
    outcomeMessage: fakeElement(),
  };
}

const firstCandidate = {
  id: "primeira",
  accessibleName: "Primeira Pessoa, carta básica. Toque para escolher; segure para saber quem é.",
  initials: "PP",
  photo: "/portraits/001.jpg",
  photoAlt: "Foto de Primeira Pessoa",
  name: "Primeira Pessoa",
  affiliation: "Partido A",
  office: "Cargo A",
  summary: "Resumo A",
  locked: true,
  busy: true,
  classes: ["is-selected"],
  outcome: null,
};

test("candidate patches keep the four slot nodes and controls alive", () => {
  const slots = Array.from({ length: 4 }, fakeSlot);
  const originalRoots = slots.map(({ root }) => root);
  const originalButtons = slots.map(({ button }) => button);

  slots.forEach((slot, index) => patchCandidateSlot(slot, { ...firstCandidate, id: `primeira-${index}` }));
  slots.forEach((slot, index) => patchCandidateSlot(slot, {
    ...firstCandidate,
    id: `nova-${index}`,
    accessibleName: `Nova Pessoa ${index + 1}`,
    name: `Nova Pessoa ${index + 1}`,
    locked: false,
    busy: false,
    classes: [],
    outcome: { tone: "gain", value: "+45 Elo", message: "Subiu de patente" },
  }));

  assert.deepEqual(slots.map(({ root }) => root), originalRoots);
  assert.deepEqual(slots.map(({ button }) => button), originalButtons);
  assert.deepEqual(slots.map(({ button }) => button.dataset.vote), ["nova-0", "nova-1", "nova-2", "nova-3"]);
  assert.equal(slots[0].button.getAttribute("aria-disabled"), "false");
  assert.equal(slots[0].name.textContent, "Nova Pessoa 1");
  assert.equal(slots[0].outcome.hidden, false);
  assert.equal(slots[0].outcome.classList.contains("gain"), true);
});

test("busy cards remain focusable DOM controls while their vote is unavailable", () => {
  const slot = fakeSlot();
  patchCandidateSlot(slot, firstCandidate);

  assert.equal(slot.button.getAttribute("aria-disabled"), "true");
  assert.equal(slot.button.getAttribute("aria-busy"), "true");
  assert.equal(slot.button.getAttribute("disabled"), null);
  assert.equal(slot.button.classList.contains("is-selected"), true);
});

test("pending cards stay unavailable without being announced as busy", () => {
  const slot = fakeSlot();
  patchCandidateSlot(slot, { ...firstCandidate, locked: true, busy: false });

  assert.equal(slot.button.getAttribute("aria-disabled"), "true");
  assert.equal(slot.button.getAttribute("aria-busy"), null);
  assert.equal(slot.button.getAttribute("disabled"), null);
});

test("a failed portrait stays hidden until a different source loads", () => {
  const slot = fakeSlot();
  patchCandidateSlot(slot, firstCandidate);
  assert.equal(slot.image.hidden, true);

  markPortraitLoaded(slot.image);
  assert.equal(slot.image.hidden, false);
  markPortraitFailed(slot.image);
  assert.equal(slot.image.hidden, true);
  assert.equal(slot.image.dataset.failedSrc, firstCandidate.photo);

  patchCandidateSlot(slot, { ...firstCandidate, name: "Mesmo retrato, novo render" });
  assert.equal(slot.image.hidden, true);
  assert.equal(slot.image.dataset.failedSrc, firstCandidate.photo);

  patchCandidateSlot(slot, { ...firstCandidate, photo: "/portraits/002.jpg", photoAlt: "Foto nova" });
  assert.equal(slot.image.hidden, true);
  assert.equal(slot.image.dataset.failedSrc, undefined);
  markPortraitLoaded(slot.image);
  assert.equal(slot.image.hidden, false);
});

test("screen changes hide persistent panels without replacing them", () => {
  const panels = { topics: fakeElement(), duel: fakeElement(), ranking: fakeElement() };
  const identities = { ...panels };

  showPersistentPanel(panels, "duel");
  showPersistentPanel(panels, "ranking");

  assert.equal(panels.topics, identities.topics);
  assert.equal(panels.duel, identities.duel);
  assert.equal(panels.ranking, identities.ranking);
  assert.equal(panels.ranking.hidden, false);
  assert.equal(panels.duel.hidden, true);
  assert.equal(panels.duel.getAttribute("aria-hidden"), "true");
});
