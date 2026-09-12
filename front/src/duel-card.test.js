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
    removeAttribute(name) {
      delete this.attrs[name];
    },
    set src(value) {
      this.attrs.src = value;
    },
    get src() {
      return this.attrs.src;
    },
  };
  const fields = {
    ".card-name": { textContent: "" },
    ".party-chip": { textContent: "" },
    ".vice strong": { textContent: "" },
    ".vice": { firstChild: { textContent: "Vice: " } },
    ".elo-mini": { textContent: "" },
    ".hp-fill": { style: {} },
    ".placeholder": { textContent: "", style: { display: "none" } },
    ".art-frame img": img,
    ".rarity-chip": { textContent: "", hidden: true },
  };
  let html = "";
  let writes = 0;
  return {
    img,
    fields,
    get innerHTMLWrites() {
      return writes;
    },
    get innerHTML() {
      return html;
    },
    set innerHTML(value) {
      html = value;
      writes += 1;
    },
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
};

const zema = {
  name: "Romeu Zema",
  party: "Novo",
  vice: "Eduardo Girão (Novo)",
  photo: "/candidates/zema.jpg",
  initials: "RZ",
};

test("duel card skeleton has an eager img, not loading=lazy", () => {
  assert.match(DUEL_CARD_SKELETON, /<img\b/);
  assert.doesNotMatch(DUEL_CARD_SKELETON, /loading\s*=\s*["']lazy["']/);
});

test("fillDuelCard builds the card once, then only swaps src and text", () => {
  const el = createCardEl();
  assert.equal(hasDuelPhoto(el), false);

  fillDuelCard(el, lula, { elo: 1000, wr: 0, barWidth: 55 });
  assert.equal(el.innerHTMLWrites, 1);
  assert.equal(el.innerHTML, DUEL_CARD_SKELETON);
  assert.equal(el.fields[".card-name"].textContent, lula.name);
  assert.equal(el.fields[".party-chip"].textContent, lula.party);
  assert.equal(el.fields[".vice strong"].textContent, lula.vice);
  assert.equal(el.fields[".elo-mini"].textContent, "Elo 1000 · 0% vitórias");
  assert.equal(el.fields[".hp-fill"].style.width, "55%");
  assert.equal(el.fields[".placeholder"].textContent, "LS");
  assert.equal(el.img.src, "/candidates/lula.jpg");
  assert.equal(el.img.alt, "Foto de Luiz Inácio Lula da Silva");
  assert.equal(el.img.getAttribute("loading"), undefined);

  fillDuelCard(el, zema, { elo: 1016, wr: 50, barWidth: 50 });
  assert.equal(el.innerHTMLWrites, 1);
  assert.equal(el.img.src, "/candidates/zema.jpg");
  assert.equal(el.img.alt, "Foto de Romeu Zema");
  assert.equal(el.fields[".card-name"].textContent, zema.name);
  assert.equal(el.fields[".elo-mini"].textContent, "Elo 1016 · 50% vitórias");
  assert.equal(el.fields[".placeholder"].textContent, "RZ");
  assert.equal(el.fields[".placeholder"].style.display, "none");
});

test("fillDuelCard renders vice placeholders and rarity without a broken image", () => {
  const el = createCardEl();
  fillDuelCard(el, {
    ...lula,
    name: "Geraldo Alckmin",
    party: "PSB",
    vice: "Luiz Inácio Lula da Silva (PT)",
    mateLabel: "Presidente",
    photo: null,
    initials: "GA",
  }, { elo: 1100, wr: 60, barWidth: 60, rarity: { id: "epico", label: "Épico" } });
  assert.equal(el.fields[".vice"].firstChild.textContent, "Presidente: ");
  assert.equal(el.fields[".placeholder"].style.display, "grid");
  assert.equal(el.img.getAttribute("src"), undefined);
  assert.equal(el.fields[".rarity-chip"].textContent, "Épico");
});
