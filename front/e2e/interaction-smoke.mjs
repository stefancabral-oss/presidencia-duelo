import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForSelector("#tab-duel");

  async function assertTab(button, panel) {
    await page.locator(button).click();
    await page.waitForTimeout(80);
    const active = await page.locator(panel).evaluate((el) => el.classList.contains("active"));
    assert.equal(active, true, `${button} não ativou ${panel}`);
  }

  await assertTab("#tab-duel", "#panel-duel");
  await assertTab("#tab-tournament", "#panel-tournament");
  await assertTab("#tab-rank", "#panel-rank");
  await assertTab("#tab-credits", "#panel-credits");
  await assertTab("#tab-home", "#panel-home");
  await assertTab("#tab-duel", "#panel-duel");

  const topicButtons = page.locator("#panel-duel .topic-btn");
  if (await topicButtons.count() > 1) {
    const second = topicButtons.nth(1);
    await second.click();
    await page.waitForTimeout(100);
    assert.equal(await second.getAttribute("aria-pressed"), "true");
  }

  const beforeSkip = await page.locator("#card-a").getAttribute("data-id");
  await page.locator("#skip-duel").click();
  await page.waitForTimeout(100);
  const afterSkip = await page.locator("#card-a").getAttribute("data-id");
  assert.notEqual(beforeSkip, afterSkip, "Pular não trocou o duelo");

  const beforeCount = Number(await page.locator("#duel-count").textContent());
  await page.locator("#card-a").click();
  await page.waitForTimeout(900);
  const afterCount = Number(await page.locator("#duel-count").textContent());
  assert.ok(afterCount >= beforeCount + 1, "Card não registrou duelo");

  await page.locator("#info-card-a").click();
  await page.waitForTimeout(80);
  assert.equal(await page.locator("#person-profile-dialog").evaluate((el) => el.open), true);
  await page.locator("[data-profile-close]").click();

  const hiddenBlocking = await page.locator(".podium-overlay[hidden], .reset-overlay[hidden]").evaluateAll((els) => els.some((el) => {
    const style = getComputedStyle(el);
    return style.display !== "none" && style.pointerEvents !== "none";
  }));
  assert.equal(hiddenBlocking, false, "Overlay oculto intercepta cliques");
  assert.deepEqual(errors, [], `Erros no browser: ${errors.join(" | ")}`);
} finally {
  await browser.close();
}
