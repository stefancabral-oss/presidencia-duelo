import assert from "node:assert/strict";
import { chromium } from "playwright";

const formUrl = new URL("../../stages/12_quality_gate_main/references/card-art-pilot-176.html", import.meta.url);
const cases = [
  {
    scenario: "mobile-390x844",
    viewport: { width: 390, height: 844 },
    card: { width: 184.5, height: 246 },
    image: { width: 168.5, height: 230 }
  },
  {
    scenario: "desktop-1000x800",
    viewport: { width: 1000, height: 800 },
    card: { width: 226, height: 316.4 },
    image: { width: 204, height: 187.4 }
  }
];

function dimensions(box) {
  return { width: Math.round(box.width * 10) / 10, height: Math.round(box.height * 10) / 10 };
}

const browser = await chromium.launch({ headless: true });
try {
  for (const testCase of cases) {
    const page = await browser.newPage({ viewport: testCase.viewport });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const url = new URL(formUrl);
    url.searchParams.set("scenario", testCase.scenario);
    await page.goto(url.href);
    await page.locator(".test-card img").waitFor({ state: "visible" });

    assert.deepEqual(dimensions(await page.locator(".test-card").boundingBox()), testCase.card);
    assert.deepEqual(dimensions(await page.locator(".test-card img").boundingBox()), testCase.image);
    assert.equal(await page.locator("#final-step").isHidden(), true);

    const html = (await page.content()).toLocaleLowerCase("pt-BR");
    for (const identityLeak of ["lula", "bolsonaro", "marina", "tabata", "guajajara", "joao-campos", "douglas-ruas"]) {
      assert.equal(html.includes(identityLeak), false, `${testCase.scenario}: identity leaked as ${identityLeak}`);
    }

    for (let index = 0; index < 8; index += 1) {
      await page.locator("input[name=identity]").fill("não sei");
      await page.locator("input[name=tone][value=neutra]").check();
      await page.locator("#image-step button[type=submit]").click();
    }

    assert.equal(await page.locator("#final-step").isVisible(), true);
    await page.locator("input[name=familiarity][value=media]").check();
    await page.locator("select[name=region]").selectOption("sudeste");
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#final-step button[type=submit]").click();
    const download = await downloadPromise;
    const chunks = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    assert.equal(payload.protocol, "card-art-pilot-176-v2-participant");
    assert.equal(payload.displayScenario.id, testCase.scenario);
    assert.deepEqual(payload.strata, { familiarity: "media", region: "sudeste" });
    assert.equal(payload.responses.length, 8);
    assert.equal(new Set(payload.responses.map(({ code }) => code)).size, 8);
    assert.equal(payload.disclosureSeen, true);
    assert.equal(Object.hasOwn(payload, "completedAt"), false);
    await download.delete();
    assert.deepEqual(pageErrors, []);
    await page.close();
    console.log(`${testCase.scenario}: crop, blind filenames, final-stage strata and private export verified`);
  }
} finally {
  await browser.close();
}
