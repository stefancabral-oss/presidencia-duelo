/**
 * Shareable local podium (issue #14): top 3 + Elo, canvas PNG, Web Share,
 * and a ranking-text fallback when files cannot be shared.
 *
 * Candidate photos may be Wikimedia URLs. Drawing a remote image without
 * CORS taints the canvas and `toBlob` / `toDataURL` then throw. We only
 * draw a photo when it already has crossOrigin set (or is same-origin /
 * data:), and we always keep an initials fallback so the PNG still exports.
 */

import { sortCandidatesByRank } from "./ranking.js";

export const GAME_NAME = "PoliMatch";
export const PODIUM_DISCLAIMER = "Não é pesquisa oficial";
export const SHARE_TITLE = "Meu pódio — PoliMatch";
export const PODIUM_PNG_WIDTH = 1080;
export const PODIUM_PNG_HEIGHT = 1350;
export const PODIUM_FILE_NAME = "podio-polimatch.png";

const PLACE_LABELS = ["1º", "2º", "3º"];

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function selectTopThree(candidates, getStats) {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const statsFor = typeof getStats === "function" ? getStats : () => ({});
  return sortCandidatesByRank(candidates, statsFor)
    .slice(0, 3)
    .map((candidate, index) => {
      const stats = statsFor(candidate.id) || {};
      return {
        id: candidate.id,
        name: candidate.name,
        party: candidate.party,
        vice: candidate.vice,
        photo: candidate.photo,
        initials: candidate.initials,
        elo: stats.elo ?? 1000,
        wins: stats.wins || 0,
        losses: stats.losses || 0,
        place: index + 1,
      };
    });
}

export function formatPodiumShareText(
  places,
  { gameName = GAME_NAME, disclaimer = PODIUM_DISCLAIMER } = {},
) {
  const lines = [`Meu pódio — ${gameName}`, disclaimer, ""];
  if (!places?.length) {
    lines.push("Ainda não há ranking neste aparelho.");
    return lines.join("\n");
  }
  for (const [index, place] of places.entries()) {
    const label = PLACE_LABELS[index] || `${index + 1}º`;
    const elo = Number(place.elo);
    const eloText = Number.isFinite(elo) ? `Elo ${elo}` : "Elo —";
    lines.push(`${label} ${place.name} — ${eloText}`);
  }
  return lines.join("\n");
}

export function canShareFiles(nav = globalThis.navigator) {
  return typeof nav?.share === "function";
}

export function canSharePngFile(file, nav = globalThis.navigator) {
  if (!file || typeof nav?.share !== "function") return false;
  if (typeof nav.canShare !== "function") return true;
  try {
    return Boolean(nav.canShare({ files: [file] }));
  } catch {
    return false;
  }
}

export async function copyShareText(text, { clipboard, document } = {}) {
  const clip = clipboard ?? globalThis.navigator?.clipboard;
  if (clip?.writeText) {
    try {
      await clip.writeText(text);
      return true;
    } catch {
      /* fall through to execCommand */
    }
  }
  const doc = document ?? globalThis.document;
  if (!doc?.body) return false;
  const area = doc.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  doc.body.appendChild(area);
  area.select();
  try {
    return Boolean(doc.execCommand("copy"));
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/**
 * Prefer `navigator.share({ files })`. If the browser cannot send a PNG
 * file, copy the ranking text so WhatsApp still gets something to paste.
 */
export async function shareOrCopyPodium(
  { file, text, title = SHARE_TITLE },
  { navigator: nav = globalThis.navigator, clipboard, document } = {},
) {
  if (canSharePngFile(file, nav)) {
    try {
      await nav.share({ files: [file], title, text });
      return { ok: true, method: "share" };
    } catch (error) {
      if (error?.name === "AbortError") return { ok: true, method: "share-abort" };
    }
  }
  const copied = await copyShareText(text, { clipboard: clipboard ?? nav?.clipboard, document });
  return { ok: copied, method: copied ? "copy" : "failed" };
}

export function canDrawImageOnCanvas(img) {
  if (!img) return false;
  const width = img.naturalWidth || img.width || 0;
  if (width <= 0) return false;
  const cors = String(img.crossOrigin || "");
  if (cors === "anonymous" || cors === "use-credentials") return true;
  const src = String(img.currentSrc || img.src || "");
  if (src.startsWith("data:")) return true;
  if (src.startsWith("/")) return true;
  return false;
}

export function loadExportableImage(src, createImage = () => new Image()) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    let img;
    try {
      img = createImage();
    } catch {
      resolve(null);
      return;
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    try {
      img.crossOrigin = "anonymous";
    } catch {
      resolve(null);
      return;
    }
    img.src = src;
  });
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth, maxLines = 3) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    const next = `${current} ${word}`;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (lines.length < maxLines) lines.push(current);
  return lines;
}

function drawCover(ctx, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return false;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y;
  ctx.drawImage(img, dx, dy, dw, dh);
  return true;
}

function drawAvatar(ctx, { x, y, w, h, image, initials }) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, 18);
  ctx.clip();
  const bg = ctx.createLinearGradient(x, y, x + w, y + h);
  bg.addColorStop(0, "#334155");
  bg.addColorStop(1, "#1e293b");
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  let drewPhoto = false;
  if (image && canDrawImageOnCanvas(image)) {
    try {
      drewPhoto = drawCover(ctx, image, x, y, w, h);
    } catch {
      drewPhoto = false;
    }
  }
  if (!drewPhoto) {
    ctx.fillStyle = "#c7d2fe";
    ctx.textAlign = "center";
    ctx.font = `800 ${Math.round(w * 0.34)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillText(initials || "?", x + w / 2, y + h * 0.58);
  }
  ctx.restore();

  roundRectPath(ctx, x, y, w, h, 18);
  ctx.strokeStyle = "rgba(246, 216, 96, 0.6)";
  ctx.lineWidth = 4;
  ctx.stroke();
}

function cardLayouts(count, width) {
  if (count <= 1) {
    return [{ x: (width - 520) / 2, y: 340, w: 520, h: 780 }];
  }
  if (count === 2) {
    return [
      { x: 80, y: 400, w: 440, h: 700 },
      { x: 560, y: 400, w: 440, h: 700 },
    ];
  }
  return [
    { x: 360, y: 320, w: 360, h: 820 },
    { x: 48, y: 430, w: 300, h: 700 },
    { x: 732, y: 470, w: 300, h: 660 },
  ];
}

function paintCard(ctx, place, image, box) {
  const { x, y, w, h } = box;
  roundRectPath(ctx, x, y, w, h, 28);
  const card = ctx.createLinearGradient(x, y, x, y + h);
  card.addColorStop(0, "#2b3550");
  card.addColorStop(0.55, "#151c2c");
  card.addColorStop(1, "#0f1420");
  ctx.fillStyle = card;
  ctx.fill();
  ctx.lineWidth = place.place === 1 ? 8 : 5;
  ctx.strokeStyle = place.place === 1 ? "#f6d860" : "#c9a227";
  ctx.stroke();

  ctx.fillStyle = "#f6d860";
  ctx.textAlign = "center";
  ctx.font = `900 ${place.place === 1 ? 42 : 34}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText(PLACE_LABELS[place.place - 1] || `${place.place}º`, x + w / 2, y + 52);

  const inset = 22;
  const photoH = Math.round(h * 0.48);
  drawAvatar(ctx, {
    x: x + inset,
    y: y + 68,
    w: w - inset * 2,
    h: photoH,
    image,
    initials: place.initials,
  });

  const textTop = y + 86 + photoH;
  ctx.fillStyle = "#f4f7ff";
  ctx.font = `800 ${place.place === 1 ? 30 : 24}px "Segoe UI", system-ui, sans-serif`;
  const nameLines = wrapText(ctx, place.name, w - 28, 3);
  nameLines.forEach((line, i) => {
    ctx.fillText(line, x + w / 2, textTop + i * 34);
  });

  ctx.fillStyle = "#9aa8c7";
  ctx.font = '700 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(place.party || "", x + w / 2, textTop + nameLines.length * 34 + 8);

  ctx.fillStyle = "#4fd1c5";
  ctx.font = `800 ${place.place === 1 ? 36 : 30}px "Segoe UI", system-ui, sans-serif`;
  const elo = Number(place.elo);
  ctx.fillText(Number.isFinite(elo) ? `Elo ${elo}` : "Elo —", x + w / 2, y + h - 36);
}

export function paintPodiumScene(
  ctx,
  {
    width = PODIUM_PNG_WIDTH,
    height = PODIUM_PNG_HEIGHT,
    places = [],
    images = [],
    gameName = GAME_NAME,
    disclaimer = PODIUM_DISCLAIMER,
  } = {},
) {
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width / 2, 0, 20, width / 2, 80, width * 0.75);
  glow.addColorStop(0, "#1e3a5f");
  glow.addColorStop(1, "rgba(11,18,32,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const corner = ctx.createRadialGradient(width, height, 20, width, height, width * 0.55);
  corner.addColorStop(0, "rgba(42,24,72,0.55)");
  corner.addColorStop(1, "rgba(11,18,32,0)");
  ctx.fillStyle = corner;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#f6d860";
  ctx.font = '800 48px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(gameName, width / 2, 92);

  ctx.fillStyle = "#f4f7ff";
  ctx.font = '800 70px "Segoe UI", system-ui, sans-serif';
  ctx.fillText("Seu pódio", width / 2, 176);

  ctx.font = '700 28px "Segoe UI", system-ui, sans-serif';
  const chipW = Math.min(width - 96, (ctx.measureText(disclaimer).width || 280) + 56);
  const chipX = (width - chipW) / 2;
  roundRectPath(ctx, chipX, 204, chipW, 56, 28);
  ctx.fillStyle = "rgba(255, 193, 7, 0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(246, 216, 96, 0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#ffe9a8";
  ctx.fillText(disclaimer, width / 2, 242);

  const layouts = cardLayouts(places.length, width);
  const paintOrder = places.length === 3 ? [1, 2, 0] : places.map((_, i) => i);
  for (const index of paintOrder) {
    const place = places[index];
    if (!place || !layouts[index]) continue;
    paintCard(ctx, place, images[index] || null, layouts[index]);
  }

  ctx.fillStyle = "#9aa8c7";
  ctx.textAlign = "center";
  ctx.font = '600 24px "Segoe UI", system-ui, sans-serif';
  ctx.fillText("Ranking Elo no seu aparelho · não é pesquisa", width / 2, height - 48);
}

export function podiumStandHtml(places) {
  if (!places?.length) {
    return `<li class="podium-empty">Jogue alguns duelos para montar o pódio.</li>`;
  }
  return places
    .map((place) => {
      const label = PLACE_LABELS[place.place - 1] || `${place.place}º`;
      const elo = Number(place.elo);
      const eloText = Number.isFinite(elo) ? `Elo ${elo}` : "Elo —";
      const photo = place.photo
        ? `<img src="${escapeHtml(place.photo)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';" />`
        : `<img alt="" style="display:none" />`;
      return `
        <li class="podium-place podium-place-${place.place}">
          <div class="podium-medal">${label}</div>
          <div class="podium-art">
            ${photo}
            <div class="podium-ph"${place.photo ? ' style="display:none"' : ""}>${escapeHtml(place.initials || "?")}</div>
          </div>
          <div class="podium-name">${escapeHtml(place.name)}</div>
          <div class="podium-party">${escapeHtml(place.party || "")}</div>
          <div class="podium-elo">${eloText}</div>
        </li>`;
    })
    .join("");
}

function defaultCreateCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export async function safeCanvasToBlob(canvas, toBlob) {
  const exportBlob =
    toBlob ||
    ((target) =>
      new Promise((resolve) => {
        try {
          if (typeof target.toBlob === "function") {
            target.toBlob((blob) => resolve(blob || null), "image/png");
            return;
          }
          const dataUrl = target.toDataURL("image/png");
          const comma = dataUrl.indexOf(",");
          const binary = atob(dataUrl.slice(comma + 1));
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
          resolve(new Blob([bytes], { type: "image/png" }));
        } catch {
          resolve(null);
        }
      }));
  try {
    return await exportBlob(canvas);
  } catch {
    return null;
  }
}

function asShareFile(blob, name) {
  if (typeof File === "function") {
    try {
      return new File([blob], name, { type: "image/png" });
    } catch {
      /* some engines reject File construction */
    }
  }
  return blob;
}

export async function buildPodiumPngFile(places, deps = {}) {
  const {
    createCanvas = defaultCreateCanvas,
    loadImage = loadExportableImage,
    toBlob,
    fileName = PODIUM_FILE_NAME,
    width = PODIUM_PNG_WIDTH,
    height = PODIUM_PNG_HEIGHT,
  } = deps;

  async function render(usePhotos) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    const images = usePhotos
      ? await Promise.all((places || []).map((place) => loadImage(place.photo)))
      : (places || []).map(() => null);
    paintPodiumScene(ctx, { width, height, places, images });
    return canvas;
  }

  let canvas = await render(true);
  let blob = await safeCanvasToBlob(canvas, toBlob);
  if (!blob) {
    canvas = await render(false);
    blob = await safeCanvasToBlob(canvas, toBlob);
  }
  if (!blob) return null;
  return asShareFile(blob, fileName);
}
