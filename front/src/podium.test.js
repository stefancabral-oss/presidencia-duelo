import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  GAME_NAME,
  PODIUM_DISCLAIMER,
  SHARE_TITLE,
  canDrawImageOnCanvas,
  canShareFiles,
  canSharePngFile,
  copyShareText,
  formatPodiumShareText,
  loadExportableImage,
  paintPodiumScene,
  podiumStandHtml,
  safeCanvasToBlob,
  selectTopThree,
  shareOrCopyPodium,
} from "./podium.js";

const here = dirname(fileURLToPath(import.meta.url));
const gameSrc = readFileSync(join(here, "game.js"), "utf8");
const frontHtml = readFileSync(join(here, "../index.html"), "utf8");
const appHtml = readFileSync(join(here, "../../app/index.html"), "utf8");
const ogCover = join(here, "../public/og-cover.png");

const candidates = [
  { id: "a", name: "Ana", party: "AA", initials: "AN", photo: "/candidates/a.jpg" },
  { id: "b", name: "Bruno", party: "BB", initials: "BR", photo: "/candidates/b.jpg" },
  { id: "c", name: "Carla", party: "CC", initials: "CA", photo: "/candidates/c.jpg" },
  { id: "d", name: "Davi", party: "DD", initials: "DV", photo: "/candidates/d.jpg" },
];

function statsMap(rows) {
  return (id) => rows[id];
}

test("selectTopThree keeps Elo first and wins as the tiebreak", () => {
  const top = selectTopThree(
    candidates,
    statsMap({
      a: { elo: 1000, wins: 9 },
      b: { elo: 1180, wins: 2 },
      c: { elo: 1180, wins: 6 },
      d: { elo: 1040, wins: 4 },
    }),
  );
  assert.deepEqual(
    top.map((row) => row.id),
    ["c", "b", "d"],
  );
  assert.deepEqual(
    top.map((row) => row.place),
    [1, 2, 3],
  );
  assert.equal(top[0].elo, 1180);
  assert.equal(top[0].name, "Carla");
  assert.equal(top.length, 3);
});

test("selectTopThree returns fewer than three when the field is short", () => {
  const top = selectTopThree(
    [candidates[0], candidates[1]],
    statsMap({
      a: { elo: 1100, wins: 1 },
      b: { elo: 1000, wins: 0 },
    }),
  );
  assert.equal(top.length, 2);
  assert.equal(top[0].id, "a");
  assert.deepEqual(selectTopThree([], () => ({ elo: 1000, wins: 0 })), []);
});

test("formatPodiumShareText is the ranking-text fallback for WhatsApp", () => {
  const text = formatPodiumShareText([
    { name: "Luiz Inácio Lula da Silva", elo: 1180 },
    { name: "Romeu Zema", elo: 1090 },
    { name: "Ronaldo Caiado", elo: 1040 },
  ]);
  assert.equal(
    text,
    [
      "Meu pódio — PoliMatch",
      "Não é pesquisa oficial",
      "",
      "1º Luiz Inácio Lula da Silva — Elo 1180",
      "2º Romeu Zema — Elo 1090",
      "3º Ronaldo Caiado — Elo 1040",
    ].join("\n"),
  );
  assert.match(text, /não é pesquisa/i);
  assert.equal(GAME_NAME, "PoliMatch");
  assert.equal(PODIUM_DISCLAIMER, "Não é pesquisa oficial");
  assert.equal(SHARE_TITLE, "Meu pódio — PoliMatch");
});

test("formatPodiumShareText handles an empty podium", () => {
  assert.match(formatPodiumShareText([]), /ainda não há ranking/i);
});

test("canShareFiles and canSharePngFile mock navigator.share availability", () => {
  assert.equal(canShareFiles({}), false);
  assert.equal(canShareFiles(undefined), false);
  assert.equal(canShareFiles({ share: async () => {} }), true);

  const file = { name: "podio.png", type: "image/png" };
  assert.equal(canSharePngFile(null, { share: async () => {} }), false);
  assert.equal(canSharePngFile(file, { share: async () => {} }), true);
  assert.equal(
    canSharePngFile(file, {
      share: async () => {},
      canShare: () => false,
    }),
    false,
  );
  assert.equal(
    canSharePngFile(file, {
      share: async () => {},
      canShare: () => true,
    }),
    true,
  );
  assert.equal(
    canSharePngFile(file, {
      share: async () => {},
      canShare: () => {
        throw new Error("no files");
      },
    }),
    false,
  );
});

test("copyShareText prefers clipboard.writeText and falls back to execCommand", async () => {
  const written = [];
  assert.equal(
    await copyShareText("abc", {
      clipboard: {
        async writeText(value) {
          written.push(value);
        },
      },
    }),
    true,
  );
  assert.deepEqual(written, ["abc"]);

  let copied = "";
  const doc = {
    body: {
      appendChild() {},
    },
    createElement() {
      return {
        value: "",
        style: {},
        setAttribute() {},
        select() {
          copied = this.value;
        },
        remove() {},
      };
    },
    execCommand(name) {
      return name === "copy" && copied === "xyz";
    },
  };
  assert.equal(
    await copyShareText("xyz", {
      clipboard: {
        async writeText() {
          throw new Error("denied");
        },
      },
      document: doc,
    }),
    true,
  );
});

test("shareOrCopyPodium uses files when canShare allows them, else copies text", async () => {
  const file = { name: "podio.png", type: "image/png" };
  const shared = [];
  const result = await shareOrCopyPodium(
    { file, text: "ranking", title: SHARE_TITLE },
    {
      navigator: {
        share: async (payload) => {
          shared.push(payload);
        },
        canShare: () => true,
      },
    },
  );
  assert.equal(result.method, "share");
  assert.equal(shared[0].files[0], file);
  assert.equal(shared[0].text, "ranking");

  const copied = [];
  const fallback = await shareOrCopyPodium(
    { file, text: "cole isto", title: SHARE_TITLE },
    {
      navigator: {
        share: async () => {},
        canShare: () => false,
        clipboard: {
          async writeText(value) {
            copied.push(value);
          },
        },
      },
    },
  );
  assert.equal(fallback.method, "copy");
  assert.deepEqual(copied, ["cole isto"]);

  const aborted = await shareOrCopyPodium(
    { file, text: "x", title: SHARE_TITLE },
    {
      navigator: {
        share: async () => {
          const err = new Error("cancel");
          err.name = "AbortError";
          throw err;
        },
        canShare: () => true,
      },
    },
  );
  assert.equal(aborted.method, "share-abort");
});

test("loadExportableImage sets crossOrigin and resolves null on error", async () => {
  const created = [];
  const ok = await loadExportableImage("/candidates/lula.jpg", () => {
    const img = {
      src: "",
      crossOrigin: "",
      onload: null,
      onerror: null,
    };
    created.push(img);
    queueMicrotask(() => img.onload());
    return img;
  });
  assert.equal(ok.crossOrigin, "anonymous");
  assert.equal(created[0].src, "/candidates/lula.jpg");

  const failed = await loadExportableImage("https://upload.wikimedia.org/photo.jpg", () => {
    const img = { src: "", crossOrigin: "", onload: null, onerror: null };
    queueMicrotask(() => img.onerror());
    return img;
  });
  assert.equal(failed, null);
  assert.equal(await loadExportableImage(""), null);
});

test("canDrawImageOnCanvas only accepts CORS-clean or same-origin photos", () => {
  assert.equal(canDrawImageOnCanvas(null), false);
  assert.equal(canDrawImageOnCanvas({ naturalWidth: 0, src: "/x.jpg" }), false);
  assert.equal(
    canDrawImageOnCanvas({
      naturalWidth: 80,
      crossOrigin: "anonymous",
      src: "https://upload.wikimedia.org/x.jpg",
    }),
    true,
  );
  assert.equal(
    canDrawImageOnCanvas({
      naturalWidth: 80,
      src: "/candidates/lula.jpg",
    }),
    true,
  );
  assert.equal(
    canDrawImageOnCanvas({
      naturalWidth: 80,
      src: "https://upload.wikimedia.org/x.jpg",
    }),
    false,
  );
});

test("paintPodiumScene writes game name, disclaimer, and top names", () => {
  const texts = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textAlign: "",
    lineWidth: 1,
    fillRect() {},
    fill() {},
    stroke() {},
    beginPath() {},
    moveTo() {},
    arcTo() {},
    closePath() {},
    clip() {},
    save() {},
    restore() {},
    drawImage() {},
    fillText(text) {
      texts.push(String(text));
    },
    measureText(text) {
      return { width: String(text).length * 8 };
    },
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
  };
  paintPodiumScene(ctx, {
    width: 1080,
    height: 1350,
    places: [
      { name: "Lula", party: "PT", elo: 1180, initials: "LS", place: 1 },
      { name: "Zema", party: "Novo", elo: 1090, initials: "RZ", place: 2 },
    ],
    images: [null, null],
  });
  const joined = texts.join("\n");
  assert.match(joined, /PoliMatch/);
  assert.match(joined, /Seu pódio/);
  assert.match(joined, /não é pesquisa/i);
  assert.match(joined, /Lula/);
  assert.match(joined, /Zema/);
  assert.match(joined, /1180/);
  assert.match(joined, /1090/);
});

test("safeCanvasToBlob returns null when export throws (tainted canvas)", async () => {
  assert.equal(
    await safeCanvasToBlob(
      {},
      () => {
        throw new Error("Tainted canvases may not be exported");
      },
    ),
    null,
  );
  const blob = { type: "image/png" };
  assert.equal(await safeCanvasToBlob({}, async () => blob), blob);
});

test("podiumStandHtml lists top 3 with Elo and initials fallback", () => {
  const html = podiumStandHtml([
    {
      place: 1,
      name: "Lula",
      party: "PT",
      elo: 1180,
      initials: "LS",
      photo: "/candidates/lula.jpg",
    },
  ]);
  assert.match(html, /podium-place-1/);
  assert.match(html, /1º/);
  assert.match(html, /Lula/);
  assert.match(html, /Elo 1180/);
  assert.match(html, /LS/);
  assert.match(podiumStandHtml([]), /Jogue alguns duelos/);
});

test("game wires podium from Ranking and the goal banner without dropping Continue/Fechar", () => {
  assert.match(gameSrc, /id="open-podium"/);
  assert.match(gameSrc, /id="goal-podium"/);
  assert.match(gameSrc, /id="podium-overlay"/);
  assert.match(gameSrc, /id="podium-share"/);
  assert.match(gameSrc, /id="goal-continue"/);
  assert.match(gameSrc, /id="goal-dismiss"/);
  assert.match(gameSrc, /selectTopThree/);
  assert.match(gameSrc, /formatPodiumShareText/);
  assert.match(gameSrc, /shareOrCopyPodium/);
  assert.match(gameSrc, /buildPodiumPngFile/);
  assert.match(gameSrc, /els\.goalPodium\.addEventListener\("click", \(\) => openPodium\(\)\)/);
  assert.match(gameSrc, /els\.openPodium\.addEventListener\("click", \(\) => openPodium\(\)\)/);
});

test("front and app index.html expose Open Graph and Twitter Card cover", () => {
  for (const html of [frontHtml, appHtml]) {
    assert.match(html, /property="og:title"/);
    assert.match(html, /property="og:description"/);
    assert.match(html, /property="og:image"/);
    assert.match(html, /content="\/og-cover\.png"/);
    assert.match(html, /name="twitter:card"/);
    assert.match(html, /content="summary_large_image"/);
    assert.match(html, /name="twitter:image"/);
    assert.match(html, /não é pesquisa/i);
  }
  assert.equal(existsSync(ogCover), true);
  const png = readFileSync(ogCover);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});
