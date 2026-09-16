import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium, webkit } from "playwright";

const browserName = process.env.POLIMATCH_PILOT_BROWSER || "chromium";
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const qualityRoot = new URL("../../stages/12_quality_gate_main/", import.meta.url);
const formUrl = new URL("references/card-art-pilot-176.html", qualityRoot);
const evidenceRoot = new URL("evidence/card-art-pilot-176/", qualityRoot);
const manifest = JSON.parse(await readFile(new URL("manifest.json", evidenceRoot), "utf8"));
const canonicalCss = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const cases = [
  { scenario: "mobile-390x844", viewport: { width: 390, height: 844 } },
  { scenario: "desktop-1000x800", viewport: { width: 1000, height: 800 } }
];

function dimensions(box) {
  return { width: Math.round(box.width * 10) / 10, height: Math.round(box.height * 10) / 10 };
}

async function geometry(page, selectors) {
  const entries = await Promise.all(Object.entries(selectors).map(async ([name, selector]) => {
    const box = await page.locator(selector).first().boundingBox();
    assert.ok(box, `${name}: elemento sem geometria`);
    return [name, dimensions(box)];
  }));
  return Object.fromEntries(entries);
}

function canonicalCard() {
  return `<div class="candidate-wrap">
    <button class="candidate-card basic-card" type="button">
      <span class="card-material" aria-hidden="true"></span>
      <span class="card-facets" aria-hidden="true"></span>
      <div class="portrait"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" alt=""></div>
      <span class="candidate-copy"></span>
      <span class="card-corners" aria-hidden="true"></span>
    </button>
  </div>`;
}

async function canonicalGeometry(page, viewport) {
  await page.setViewportSize(viewport);
  await page.setContent(`<!doctype html><html><head><style>${canonicalCss}</style></head><body>
    <main class="app-shell"><section class="arena arena-four">${canonicalCard().repeat(4)}</section></main>
  </body></html>`);
  return geometry(page, {
    card: ".candidate-card",
    artWindow: ".candidate-card .portrait",
    image: ".candidate-card .portrait img",
    blindPlate: ".candidate-card .candidate-copy"
  });
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    let source;
    let contentType;
    if (pathname === "/references/card-art-pilot-176.html") {
      source = formUrl;
      contentType = "text/html; charset=utf-8";
    } else if (/^\/evidence\/card-art-pilot-176\/P0[1-8]\.png$/.test(pathname)) {
      source = new URL(pathname.replace(/^\//, ""), qualityRoot);
      contentType = "image/png";
    } else {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": contentType });
    response.end(await readFile(source));
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(error.message);
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

const browser = await browserType.launch({ headless: true });
try {
  for (const testCase of cases) {
    const page = await browser.newPage({ viewport: testCase.viewport });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const expected = await canonicalGeometry(page, testCase.viewport);
    const baseUrl = `http://127.0.0.1:${port}/references/card-art-pilot-176.html?scenario=${testCase.scenario}`;

    await page.goto(baseUrl);
    assert.equal(await page.locator("#batch-blocked").isVisible(), true);
    assert.equal(await page.locator("#image-step").isHidden(), true);
    assert.equal(await page.locator(".test-card").count(), 0);
    assert.equal(await page.locator("body").getAttribute("data-batch-status"), manifest.status);
    assert.equal(await page.locator("body").getAttribute("data-collection-allowed"), String(manifest.collectionAllowed));

    await page.goto(`${baseUrl}&technicalPreview=1`);
    await page.locator(".test-card img").waitFor({ state: "visible" });
    const observed = await geometry(page, {
      card: ".test-card",
      artWindow: ".art-window",
      image: ".test-card img",
      blindPlate: ".blind-plate"
    });
    assert.deepEqual(observed, expected, `${testCase.scenario}: formulário divergiu do CSS canônico do app`);
    assert.equal(await page.locator("#final-step").isHidden(), true);
    assert.equal(await page.locator("#image-step input:enabled, #image-step button:enabled").count(), 0);

    const html = (await page.content()).toLocaleLowerCase("pt-BR");
    for (const identityLeak of ["lula", "bolsonaro", "marina", "tabata", "guajajara", "joao-campos", "douglas-ruas"]) {
      assert.equal(html.includes(identityLeak), false, `${testCase.scenario}: identity leaked as ${identityLeak}`);
    }

    await page.locator("#image-step").evaluate((form) => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    assert.match(await page.locator("#status").textContent(), /coleta bloqueada/i);
    assert.deepEqual(pageErrors, []);
    await page.close();
    console.log(`${browserName}/${testCase.scenario}: canonical crop matched; invalid batch stayed blocked`);
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
