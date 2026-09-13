import assert from "node:assert/strict";
import { test } from "node:test";
import { DUEL_CARD_SKELETON, fillDuelCard, hasDuelPhoto } from "./duel-card.js";

function createCardEl() {
  const img = {
    style: { display: "" },
    alt: "",
    onerror: null,
    attrs: {},
    getAttribute(name) {
      if (name === "src") return this.attrs.src;
      if (name === "loading") return this.attrs.loading;
      return undefined;
    },
    removeAttribute(name) { delete this.attrs[name]; },
    set src(value) { this.attrs.src = value; },
    get src() { return this.attrs.src; },
  };
  const fields = {
    ".card-name": { textContent: "" },
    ".party-chip": { textContent: "" },
    ".pm-card__role": { textContent: "" },
    ".pm-card__description": { textContent: "" },
    ".pm-card__rarity": { textContent: "", title: "" },
    ".vice strong": { textContent: "" },
    ".vice": { firstChild: { textContent: "Vice: " } },
    ".elo-mini": { textContent: "" },
    ".hp-fill": { style: {} },
    ".placeholder": { textContent: "", style: { display: "none" } },
    ".art-frame img": img,
  };
  let html = "";
  let writes = 0;
  return {
    img,
    fields,
    dataset: {},
    get innerHTMLWrites() { return writes; },
    get innerHTML() { return html; },
    set innerHTML(value) { html = value; writes += 1; },
    querySelector(sel) {
      if (sel === ".art-frame img" && writes === 0) return null;
      return fields[sel] ?? null;
    },
  };
}

const lula = {
  name: "Luiz Inácio Lula da Silva",
  party: "PT",
  vice: "Geraldo Alckmin (PSB)",
  photo: "/candidates/lula.jpg",
  initials: "LS",
  role: "Presidente da República",
  summary: "Político brasileiro e presidente da República.",
};

const zema = {
  name: "Romeu Zema",
  party: "Novo",
  vice: "Eduardo Girão (Novo)",
  photo: "/candidates/zema.jpg",
  initials: "RZ",
  role: "Governador de Minas Gerais",
  summary: "Empresário e político brasileiro.",
};

test("duel card skeleton follows image-first TCG anatomy", () => {
  assert.match(DUEL_CARD_SKELETON, /pm-card__media/);
  assert.match(DUEL_CARD_SKELETON, /pm-card__body/);
  assert.match(DUEL_CARD_SKELETON, /pm-card__role/);
  assert.match(DUEL_CARD_SKELETON, /pm-card__description/);
  assert.match(DUEL_CARD_SKELETON, /<img\b/);
  assert.doesNotMatch(DUEL_CARD_SKELETON, /loading\s*=\s*["']lazy["']/);
});

test("fillDuelCard builds once and fills role, description and rarity", () => {
  const el = createCardEl();
  assert.equal(hasDuelPhoto(el), false);

  fillDuelCard(el, lula, { elo: 1000, wr: 0, barWidth: 55 });
  assert.equal(el.innerHTMLWrites, 1);
  assert.equal(el.fields[".card-name"].textContent, lula.name);
  assert.equal(el.fields[".pm-card__role"].textContent, lula.role);
  assert.equal(el.fields[".pm-card__description"].textContent, lula.summary);
  assert.equal(el.dataset.rarity, "basica");
  assert.equal(el.fields[".pm-card__rarity"].textContent, "●");
  assert.equal(el.img.src, "/candidates/lula.jpg");

  fillDuelCard(el, zema, { elo: 1121, wr: 50, barWidth: 50 });
  assert.equal(el.innerHTMLWrites, 1);
  assert.equal(el.fields[".card-name"].textContent, zema.name);
  assert.equal(el.fields[".pm-card__role"].textContent, zema.role);
  assert.equal(el.fields[".pm-card__description"].textContent, zema.summary);
  assert.equal(el.dataset.rarity, "chroma-ilustrada");
  assert.equal(el.fields[".pm-card__rarity"].textContent, "★");
});

test("fillDuelCard preserves hidden legacy metrics and image fallback", () => {
  const el = createCardEl();
  fillDuelCard(el, {
    ...lula,
    name: "Geraldo Alckmin",
    party: "PSB",
    vice: "Luiz Inácio Lula da Silva (PT)",
    mateLabel: "Presidente",
    photo: null,
    initials: "GA",
    role: "Vice-presidente da República",
    summary: "Político brasileiro.",
  }, { elo: 1100, wr: 60, barWidth: 60 });
  assert.equal(el.fields[".vice"].firstChild.textContent, "Presidente: ");
  assert.equal(el.fields[".placeholder"].style.display, "grid");
  assert.equal(el.img.getAttribute("src"), undefined);
});
