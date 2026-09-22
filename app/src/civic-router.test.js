import assert from "node:assert/strict";
import test from "node:test";
import { civicHref, isCivicHash, parseCivicRoute, ROUTE_LIMITS, routeTitle, sameRoute, sameScreen } from "./civic/router.js";
import { candidacyId } from "../../shared/civic-contract.js";

test("hashes do jogo não são rotas cívicas", () => {
  for (const hash of ["", "#", "#topo", "#/"]) assert.equal(parseCivicRoute(hash), null, hash);
  assert.equal(isCivicHash("#/candidatos"), true);
  assert.equal(isCivicHash("#candidatos"), false);
});

test("diretório aceita filtros conhecidos e descarta sinais desconhecidos", () => {
  const route = parseCivicRoute("#/candidatos?disputa=governor&uf=SP&partido=ABC&busca=maria&voto=1&situacao=Deferido");
  assert.equal(route.kind, "directory");
  assert.equal(route.area, "directory");
  assert.deepEqual(route.params, { contestId: "governor", uf: "SP", party: "ABC", officialStatus: "Deferido", search: "maria" });
  assert.deepEqual(route.problems, [{ code: "unknown-parameter", detail: "voto" }]);
  assert.equal(route.href, "#/candidatos?disputa=governor&uf=SP&partido=ABC&situacao=Deferido&busca=maria");
});

test("UF inválida é removida e registrada sem quebrar a rota", () => {
  const route = parseCivicRoute("#/candidatos?uf=XX");
  assert.equal(route.kind, "directory");
  assert.equal(route.params.uf, undefined);
  assert.deepEqual(route.problems, [{ code: "uf", detail: "XX" }]);
});

test("ficha usa o ID B01 codificado e volta ao mesmo ID", () => {
  const id = candidacyId("test-2032", "BR", "president", "1");
  const href = civicHref({ kind: "candidacy", params: { id, revision: 3 } });
  assert.equal(href, `#/candidatos/${encodeURIComponent(id)}?revisao=3`);
  const route = parseCivicRoute(href);
  assert.equal(route.kind, "candidacy");
  assert.equal(route.params.id, id);
  assert.equal(route.params.revision, 3);
  assert.equal(route.href, href);
});

test("comparação preserva de duas a três candidaturas distintas e marca excesso", () => {
  const ids = ["a-1", "b-2", "c-3", "d-4"];
  const route = parseCivicRoute(civicHref({ kind: "comparison", params: { ids } }));
  assert.equal(route.kind, "comparison");
  assert.equal(route.params.ids.length, ROUTE_LIMITS.ids);
  assert.deepEqual(route.problems, [{ code: "ids" }]);
  const valid = parseCivicRoute("#/candidatos/comparar?ids=a-1,b-2");
  assert.deepEqual(valid.params.ids, ["a-1", "b-2"]);
  assert.deepEqual(valid.problems, []);
  const empty = parseCivicRoute("#/candidatos/comparar");
  assert.deepEqual(empty.params.ids, []);
});

test("notícias, edições e acontecimentos têm rotas próprias", () => {
  assert.equal(parseCivicRoute("#/noticias?uf=RJ").params.uf, "RJ");
  assert.equal(parseCivicRoute("#/noticias/edicoes/edition-a").kind, "edition");
  assert.equal(parseCivicRoute("#/noticias/edicoes/edition-a").params.id, "edition-a");
  const event = parseCivicRoute("#/noticias/acontecimentos/event-a?revisao=2");
  assert.equal(event.kind, "event");
  assert.equal(event.area, "news");
  assert.deepEqual(event.params, { id: "event-a", revision: 2 });
  assert.equal(routeTitle(event), "Acontecimento");
});

test("destinos desconhecidos e codificação quebrada produzem estado legível", () => {
  const unknown = parseCivicRoute("#/ranking-secreto/123");
  assert.equal(unknown.kind, "not-found");
  assert.equal(unknown.href, null);
  assert.equal(unknown.params.requested, "ranking-secreto/123");
  assert.deepEqual(unknown.problems, [{ code: "unknown-destination" }]);
  assert.equal(parseCivicRoute("#/candidatos/%E0%A4%A").kind, "not-found");
  assert.equal(parseCivicRoute("#/candidatos/<script>alert(1)</script>").kind, "not-found");
  assert.equal(parseCivicRoute(`#/candidatos?busca=${"x".repeat(ROUTE_LIMITS.hash)}`).kind, "not-found");
  assert.equal(routeTitle("qualquer"), "Destino não encontrado");
});

test("textos de filtro acima do limite ou com caracteres de controle são ignorados", () => {
  const long = parseCivicRoute(`#/candidatos?busca=${"a".repeat(ROUTE_LIMITS.text + 1)}`);
  assert.equal(long.params.search, undefined);
  assert.deepEqual(long.problems, [{ code: "text", detail: "busca" }]);
  const control = parseCivicRoute("#/candidatos?partido=a%00b");
  assert.equal(control.params.party, undefined);
});

test("comparadores de rota distinguem destino e tipo de tela", () => {
  const a = parseCivicRoute("#/candidatos?uf=SP");
  const b = parseCivicRoute("#/candidatos?uf=RJ");
  assert.equal(sameRoute(a, parseCivicRoute("#/candidatos?uf=SP")), true);
  assert.equal(sameRoute(a, b), false);
  assert.equal(sameScreen(a, b), true);
  assert.equal(sameScreen(a, parseCivicRoute("#/noticias")), false);
  assert.equal(sameRoute(null, null), true);
  assert.equal(civicHref({ kind: "candidacy", params: { id: "" } }), null);
  assert.equal(civicHref({ kind: "not-found" }), null);
});
