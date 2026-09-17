import assert from "node:assert/strict";
import test from "node:test";
import { formatEditorialDate, profileProvenance } from "./editorial-presentation.js";

test("editorial dates use the promised DD MMM AAAA format", () => {
  assert.equal(formatEditorialDate("2026-09-16"), "16 set 2026");
  assert.equal(formatEditorialDate("2026-02-30"), "");
  assert.equal(formatEditorialDate("16/09/2026"), "");
});

test("review is claimed only for approved content", () => {
  const pending = profileProvenance({ publication: { content: { status: "pending", reviewedAt: "2026-09-16" } } });
  const rejected = profileProvenance({ publication: { content: { status: "rejected", reviewedAt: "2026-09-16" } } });
  const approved = profileProvenance({ publication: { content: { status: "approved", reviewedAt: "2026-09-16" } } });
  assert.match(pending.content, /Perfil editorial em revisão/);
  assert.match(rejected.content, /Perfil editorial em revisão/);
  assert.equal(approved.content, "Conteúdo revisado em 16 set 2026");
});

test("photo provenance and card-art provenance reflect independent approvals", () => {
  const withPhoto = profileProvenance({
    publication: {
      documentaryPhoto: { status: "approved", source: "Agência Pública", license: "CC BY 4.0" },
      cardArt: { status: "approved", version: "v3" },
    },
  });
  const withoutPhoto = profileProvenance({
    publication: {
      documentaryPhoto: { status: "missing" },
      cardArt: { status: "approved", version: "v3" },
    },
  });
  assert.equal(withPhoto.photo, "Foto: Agência Pública · CC BY 4.0");
  assert.equal(withPhoto.cardArt, "Arte da carta: ilustração editorial · v3");
  assert.equal(withoutPhoto.photo, "Foto documental ainda não disponível");
  assert.equal(withoutPhoto.cardArt, "Arte da carta: ilustração editorial · v3");
});
