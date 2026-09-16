import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { completedDailySession } from "./daily-fixture.mjs";
import { capabilityFixture } from "./aggregate-fixture.mjs";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const candidates = Array.from({ length: 4 }, (_, index) => ({
  personId: index + 1,
  id: `identity-candidate-${index + 1}`,
  name: `Pessoa ${index + 1}`,
  displayName: `Pessoa ${index + 1}`,
  affiliation: "E2E",
  office: "Perfil de teste",
  summary: "Resumo editorial de teste.",
  facts: [],
  sources: [],
}));
const ranking = () => candidates.map((candidate) => ({
  ...candidate,
  elo: 1000,
  wins: 0,
  losses: 0,
  decisions: 0,
  winRate: 0,
  rank: null,
}));
const personal = () => ({
  version: 0,
  duels: 0,
  rankingPolicy: {
    id: "pairwise-majority-scc-v1",
    label: "maioria nos confrontos observados",
    explanation: "A ordem usa os confrontos diretos e mantém empates sem usar exposição.",
  },
  ranking: ranking(),
});
const emptyResults = {
  baselinePercent: 25,
  score: { correct: 0, scored: 0, attempted: 0, skipped: 0, ties: 0, noSample: 0, accuracyPercent: null },
  sessions: [],
};

const browser = await browserType.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
const page = await context.newPage();
const pageErrors = [];
let playerSequence = 0;
let resultRequests = 0;
let holdNextResults = false;
let releaseHeldResults = null;
page.on("pageerror", (error) => pageErrors.push(error.message));

await page.route("https://accounts.google.com/gsi/client", (route) => route.fulfill({
  contentType: "application/javascript",
  body: `window.google={accounts:{id:{initialize(options){window.__predictionIdentityGoogle=options.callback},renderButton(element){const button=document.createElement('button');button.type='button';button.textContent='Continuar com Google';button.addEventListener('click',()=>window.__predictionIdentityGoogle({credential:'identity-e2e-token'}));element.replaceChildren(button)}}}};`,
}));

await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
  const request = route.request();
  const { pathname } = new URL(request.url());
  if (pathname === "/api/capabilities") return route.fulfill({ status: 200, json: capabilityFixture() });
  if (pathname === "/api/candidates") return route.fulfill({ status: 200, json: { candidates } });
  if (pathname === "/api/ranking") return route.fulfill({ status: 200, json: { duels: 0, ranking: ranking() } });
  if (pathname === "/api/player" && request.method() === "POST") {
    playerSequence += 1;
    return route.fulfill({ status: 201, json: { recoveryKey: `pm2_identity_${playerSequence}` } });
  }
  if (pathname === "/api/player/state") return route.fulfill({ status: 200, json: personal() });
  if (pathname === "/api/daily-session") return route.fulfill({ status: 200, json: completedDailySession(candidates) });
  if (pathname === "/api/auth/google" && request.method() === "POST") {
    return route.fulfill({
      status: 200,
      json: {
        sessionToken: `pms_${"s".repeat(43)}`,
        account: { displayName: "Bia", avatarUrl: "" },
        player: { ...personal(), account: { displayName: "Bia", avatarUrl: "" } },
      },
    });
  }
  if (pathname === "/api/auth/logout" && request.method() === "POST") return route.fulfill({ status: 204 });
  if (pathname === "/api/daily-prediction-results") {
    resultRequests += 1;
    if (holdNextResults) {
      holdNextResults = false;
      await new Promise((resolve) => { releaseHeldResults = resolve; });
      releaseHeldResults = null;
    }
    return route.fulfill({ status: 200, json: emptyResults });
  }
  return route.fulfill({ status: 404, json: { error: "mock não encontrado" } });
});

async function waitForHeldRequest() {
  for (let attempt = 0; attempt < 50 && !releaseHeldResults; attempt += 1) await page.waitForTimeout(10);
  assert.equal(typeof releaseHeldResults, "function", "a requisição de placar não entrou no gate E2E");
}

async function waitForResultRequest(expected) {
  for (let attempt = 0; attempt < 50 && resultRequests < expected; attempt += 1) await page.waitForTimeout(10);
  assert.equal(resultRequests, expected);
}

try {
  await page.goto(appUrl, { waitUntil: "networkidle" });

  // Login enquanto a credencial anônima ainda aguarda o placar antigo.
  holdNextResults = true;
  await page.getByRole("button", { name: "Meu placar de apostas" }).click();
  await page.getByRole("heading", { name: "Apurando recortes fechados…" }).waitFor();
  await waitForHeldRequest();
  await page.getByRole("button", { name: "Salvar seu jogo com Google" }).click();
  await page.getByRole("button", { name: "Continuar com Google" }).click();
  await page.getByRole("heading", { name: "Tudo certo, Bia!" }).waitFor();
  releaseHeldResults();
  await page.getByRole("button", { name: "Voltar ao jogo" }).click();
  await page.getByRole("heading", { name: "Ainda não há recorte fechado." }).waitFor();
  await page.locator('[data-screen="topics"]').click();
  await page.getByRole("button", { name: "Meu placar de apostas" }).click();
  await waitForResultRequest(2);
  await page.getByRole("heading", { name: "Ainda não há recorte fechado." }).waitFor();

  // Logout durante novo load: a sessão anônima seguinte também precisa abrir
  // seu próprio placar, sem herdar o `loading` da conta Google revogada.
  await page.locator('[data-screen="topics"]').click();
  holdNextResults = true;
  await page.getByRole("button", { name: "Meu placar de apostas" }).click();
  await page.getByRole("heading", { name: "Apurando recortes fechados…" }).waitFor();
  await waitForHeldRequest();
  await page.getByRole("button", { name: "Abrir sua conta" }).click();
  await page.getByRole("button", { name: "Sair desta conta" }).click();
  await page.getByRole("button", { name: "Salvar seu jogo com Google" }).waitFor();
  releaseHeldResults();
  await page.getByRole("heading", { name: "Ainda não há recorte fechado." }).waitFor();
  await page.locator('[data-screen="topics"]').click();
  await page.getByRole("button", { name: "Meu placar de apostas" }).click();
  await waitForResultRequest(4);
  await page.getByRole("heading", { name: "Ainda não há recorte fechado." }).waitFor();

  assert.deepEqual(pageErrors, []);
  console.log(`${browserName}: login/logout durante load não prendem o placar da identidade seguinte`);
} finally {
  releaseHeldResults?.();
  await context.close();
  await browser.close();
}
