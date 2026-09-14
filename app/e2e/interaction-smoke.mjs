import { chromium, webkit } from "playwright";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const candidates = [
  {
    id: "ana-vilhena",
    name: "Ana Vilhena",
    displayName: "Ana Vilhena",
    party: "Partido Exemplo",
    role: "Pessoa pública",
    bio: "Perfil editorial de teste.",
  },
  {
    id: "henrique-tavares",
    name: "Henrique Tavares",
    displayName: "Henrique Tavares",
    party: "Aliança Exemplo",
    role: "Pessoa pública",
    bio: "Perfil editorial de teste.",
  },
];

function ranking(decisions = 0) {
  return candidates.map((candidate, index) => ({
    ...candidate,
    elo: decisions ? (index ? 1484 : 1516) : 1500,
    wins: decisions && !index ? 1 : 0,
    losses: decisions && index ? 1 : 0,
    decisions,
    winRate: decisions && !index ? 100 : 0,
  }));
}

const browser = await browserType.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  serviceWorkers: "block",
});
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

await page.route(/\/api(?:\/|$)/, async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  let body;
  if (path === "/api/candidates") body = { candidates };
  else if (path === "/api/ranking") body = { duels: 0, ranking: ranking() };
  else if (path === "/api/player" && request.method() === "POST") body = { recoveryKey: "e2e-recovery-key" };
  else if (path === "/api/player/state") body = { version: 0, duels: 0, ranking: ranking() };
  else if (path === "/api/vote") {
    body = {
      duels: 1,
      ranking: ranking(1),
      player: { version: 1, duels: 1, ranking: ranking(1) },
      vote: { winnerDelta: 16, zebra: false },
    };
  } else {
    await route.fulfill({ status: 404, json: { error: "mock não encontrado" } });
    return;
  }
  await route.fulfill({ status: 200, json: body });
});

try {
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Eleições 2026/ }).click();
  await page.getByRole("button", { name: "Bora duelar" }).click();
  if (process.env.POLIMATCH_E2E_DUEL_SCREENSHOT) {
    await page.screenshot({ path: process.env.POLIMATCH_E2E_DUEL_SCREENSHOT, fullPage: true });
  }

  const firstCard = page.locator(".candidate-card").first();
  const box = await firstCard.boundingBox();
  if (!box) throw new Error("Carta de duelo não foi renderizada");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(520);
  await page.mouse.up();
  await page.locator("dialog[open]").waitFor();
  await page.getByRole("button", { name: "Voltar ao duelo" }).click();

  await firstCard.click();
  await page.getByText(/confirmado · \+16 Elo/).waitFor();
  await page.getByRole("button", { name: "Ranking" }).click();
  await page.getByRole("heading", { name: "Ranking" }).waitFor();
  await page.getByText("1 duelo confirmado").waitFor();
  await page.getByText("Mais recusados").waitFor();
  const rejected = await page.locator(".ranking-highlight-rejected").innerText();
  if (!rejected.includes("Henrique Tavares") || !rejected.includes("−1")) {
    throw new Error("O voto negativo não apareceu no resumo do ranking");
  }

  if (process.env.POLIMATCH_E2E_SCREENSHOT) {
    await page.screenshot({ path: process.env.POLIMATCH_E2E_SCREENSHOT, fullPage: true });
  }

  if (pageErrors.length) throw new Error(`Erros na página: ${pageErrors.join(" | ")}`);
  console.log(`${browserName}: duelo, pressão longa e ranking validados`);
} catch (error) {
  console.error(await page.locator("body").innerText());
  console.error(`Erros capturados: ${pageErrors.join(" | ") || "nenhum"}`);
  throw error;
} finally {
  await browser.close();
}
