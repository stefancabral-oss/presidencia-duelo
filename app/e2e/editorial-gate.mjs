import { chromium, webkit } from "playwright";
import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import { hasCuratedPortrait } from "../../shared/curated-portraits.js";
import { approvedEditorialCandidates } from "./editorial-fixtures.mjs";
import { completedDailySession } from "./daily-fixture.mjs";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const candidates = approvedEditorialCandidates(
  CATALOG.filter(({ personId }) => hasCuratedPortrait(personId)).slice(0, 4),
  (_candidate, index) => ({ documentaryPhoto: index !== 1 }),
);
const ranking = candidates.map((candidate) => ({
  ...candidate,
  elo: 1000,
  wins: 0,
  losses: 0,
  decisions: 0,
  zebras: 0,
  winRate: 0,
  rank: null,
}));
const candidateWithPhoto = candidates.find(({ publication }) => publication.documentaryPhoto.status === "approved");
const candidateWithoutPhoto = candidates.find(({ publication }) => publication.documentaryPhoto.status === "missing");

async function longPress(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Carta editorial não ficou visível");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(520);
  await page.mouse.up();
  await page.locator("#modal[open]").waitFor();
}

const browser = await browserType.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

await page.route(/\/api(?:\/|$)/, async (route) => {
  const request = route.request();
  const pathname = new URL(request.url()).pathname;
  if (pathname === "/api/candidates") return route.fulfill({ status: 200, json: { topicId: "eleicoes-2026", candidates } });
  if (pathname === "/api/ranking") return route.fulfill({ status: 200, json: { topicId: "eleicoes-2026", duels: 0, ranking } });
  if (pathname === "/api/player" && request.method() === "POST") return route.fulfill({ status: 201, json: { recoveryKey: "editorial-gate-fixture" } });
  if (pathname === "/api/player/state") {
    return route.fulfill({ status: 200, json: { topicId: "eleicoes-2026", version: 0, duels: 0, ranking } });
  }
  if (pathname === "/api/daily-session") {
    return route.fulfill({ status: 200, json: completedDailySession(candidates) });
  }
  return route.fulfill({ status: 404, json: { error: "mock não encontrado" } });
});

try {
  await page.goto(appUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Quem representa o Brasil que você imagina?" }).waitFor();
  const homeText = await page.locator("main:visible").innerText();
  if (!homeText.includes("4 perfis disponíveis nesta edição") || /foto aprovada/i.test(homeText)) {
    throw new Error(`A home ainda transforma foto em promessa editorial: ${homeText}`);
  }
  if (process.env.POLIMATCH_E2E_EDITORIAL_HOME_SCREENSHOT) {
    await page.screenshot({ path: process.env.POLIMATCH_E2E_EDITORIAL_HOME_SCREENSHOT, fullPage: true });
  }

  await page.locator("#start-election").click();
  await page.getByRole("button", { name: "Continuar no modo livre" }).click();
  await page.getByRole("heading", { name: "Quem você prefere?" }).waitFor();
  await page.getByRole("button", { name: "Começar rodada" }).click();
  await page.locator(".candidate-card").first().waitFor();
  const cardAlts = await page.locator(".candidate-card .portrait img").evaluateAll((images) => images.map((image) => image.alt));
  if (cardAlts.length !== 4 || cardAlts.some((alt) => !alt.startsWith("Retrato de "))) {
    throw new Error(`As cartas não usam arte editorial aprovada pela fixture: ${JSON.stringify(cardAlts)}`);
  }

  await longPress(page, page.locator(`[data-vote="${candidateWithPhoto.id}"]`));
  const withPhoto = page.locator("#modal");
  await withPhoto.getByAltText(/^Foto documental de /).waitFor();
  const withPhotoText = await withPhoto.innerText();
  for (const expected of [
    "Conteúdo revisado em 16 set 2026",
    "Foto: Acervo da fixture E2E · Uso exclusivo em teste",
    "Arte da carta: ilustração editorial · fixture-v1",
  ]) {
    if (!withPhotoText.includes(expected)) throw new Error(`Perfil com foto perdeu procedência: ${expected}`);
  }
  if (/\bRevisado em\b/.test(withPhotoText)) throw new Error("A UI voltou a usar reviewedAt sem o estado de aprovação");
  if (process.env.POLIMATCH_E2E_EDITORIAL_WITH_PHOTO_SCREENSHOT) {
    await page.screenshot({ path: process.env.POLIMATCH_E2E_EDITORIAL_WITH_PHOTO_SCREENSHOT, fullPage: true });
  }
  await page.getByRole("button", { name: /^Fechar perfil de / }).click();
  await withPhoto.waitFor({ state: "hidden" });

  await longPress(page, page.locator(`[data-vote="${candidateWithoutPhoto.id}"]`));
  const withoutPhoto = page.locator("#modal");
  await withoutPhoto.getByRole("img", { name: "Foto documental ainda não disponível" }).waitFor();
  if (await withoutPhoto.locator(".profile-documentary-photo img").count()) {
    throw new Error("Perfil sem foto documental recebeu uma imagem substituta");
  }
  const withoutPhotoText = await withoutPhoto.innerText();
  for (const expected of [
    "Conteúdo revisado em 16 set 2026",
    "Foto documental ainda não disponível",
    "Arte da carta: ilustração editorial · fixture-v1",
  ]) {
    if (!withoutPhotoText.includes(expected)) throw new Error(`Perfil sem foto perdeu estado honesto: ${expected}`);
  }
  if (process.env.POLIMATCH_E2E_EDITORIAL_WITHOUT_PHOTO_SCREENSHOT) {
    await page.screenshot({ path: process.env.POLIMATCH_E2E_EDITORIAL_WITHOUT_PHOTO_SCREENSHOT, fullPage: true });
  }

  if (pageErrors.length) throw new Error(`Erros na página: ${pageErrors.join(" | ")}`);
  console.log(`${browserName}: home, procedência e perfil sem foto documental validados`);
} catch (error) {
  console.error(await page.locator("body").innerText());
  console.error(`Erros capturados: ${pageErrors.join(" | ") || "nenhum"}`);
  throw error;
} finally {
  await browser.close();
}
