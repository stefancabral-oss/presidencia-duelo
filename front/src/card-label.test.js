import assert from "node:assert/strict";
import { test } from "node:test";
import { applyCardAriaLabel, cardAriaLabel } from "./card-label.js";

test("cardAriaLabel announces name and party", () => {
  assert.equal(
    cardAriaLabel({ name: "Luiz Inácio Lula da Silva", party: "PT" }),
    "Votar em Luiz Inácio Lula da Silva (PT)",
  );
  assert.equal(cardAriaLabel({ name: "Romeu Zema", party: "Novo" }), "Votar em Romeu Zema (Novo)");
});

test("applyCardAriaLabel updates when the candidate on the card changes", () => {
  const el = {
    attrs: { "aria-label": "Candidato A" },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    getAttribute(name) {
      return this.attrs[name];
    },
  };

  applyCardAriaLabel(el, { name: "Luiz Inácio Lula da Silva", party: "PT" });
  assert.equal(el.getAttribute("aria-label"), "Votar em Luiz Inácio Lula da Silva (PT)");

  applyCardAriaLabel(el, { name: "Romeu Zema", party: "Novo" });
  assert.equal(el.getAttribute("aria-label"), "Votar em Romeu Zema (Novo)");
  assert.notEqual(el.getAttribute("aria-label"), "Candidato A");
});
