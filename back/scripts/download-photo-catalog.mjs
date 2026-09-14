import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const [catalogPath, destination] = process.argv.slice(2);
if (!catalogPath || !destination) {
  throw new Error("uso: node download-photo-catalog.mjs catalogo.json pasta-destino");
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));

function slugify(value) {
  return value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function extension(contentType, url) {
  if (/image\/jpeg/i.test(contentType)) return "jpg";
  if (/image\/png/i.test(contentType)) return "png";
  if (/image\/webp/i.test(contentType)) return "webp";
  if (/image\/gif/i.test(contentType)) return "gif";
  if (/image\/tiff/i.test(contentType)) return "tif";
  if (/image\/svg\+xml/i.test(contentType)) return "svg";
  const match = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i);
  return match?.[1].toLowerCase().replace("jpeg", "jpg") || "bin";
}

function wikimediaDeliveryUrl(source) {
  for (const raw of [source.pagina_origem, source.url_direta]) {
    try {
      const url = new URL(raw);
      if (!/wikimedia\.org$/.test(url.hostname)) continue;
      const decoded = decodeURIComponent(url.pathname);
      const special = decoded.match(/\/wiki\/Special:FilePath\/(.+)$/);
      const page = decoded.match(/\/wiki\/(?:File:|Ficheiro:)(.+)$/);
      const upload = url.hostname === "upload.wikimedia.org" ? decoded.split("/").at(-1) : null;
      const filename = special?.[1] || page?.[1] || upload;
      if (filename) {
        const normalizedFilename = filename.normalize("NFC").replace(/ /g, "_");
        const encoded = encodeURIComponent(normalizedFilename).replace(/%2F/gi, "/");
        return `https://commons.wikimedia.org/w/thumb.php?f=${encoded}&w=1024`;
      }
    } catch {
      // Fontes externas continuam usando a URL fornecida no catálogo.
    }
  }
  return source.url_direta;
}

function detectedImage(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return { contentType: "image/jpeg", ext: "jpg" };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { contentType: "image/png", ext: "png" };
  if (buffer.subarray(0, 4).toString("ascii") === "GIF8") return { contentType: "image/gif", ext: "gif" };
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return { contentType: "image/webp", ext: "webp" };
  if (["II*\u0000", "MM\u0000*"].includes(buffer.subarray(0, 4).toString("binary"))) return { contentType: "image/tiff", ext: "tif" };
  return null;
}

function pagePreviewUrl(buffer, baseUrl) {
  const html = buffer.toString("utf8");
  const patterns = [
    /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image(?::src)?)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image(?::src)?)["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    /["'](?:contentUrl|thumbnailUrl)["']\s*:\s*["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return new URL(match[1].replaceAll("&amp;", "&"), baseUrl).href;
  }
  return null;
}

async function fetchWithRetry(url, allowPagePreview = true) {
  let error;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const { stdout } = await execFileAsync("curl", ["-4", "-fsSL", "--max-time", "90", url], {
        encoding: "buffer",
        maxBuffer: 100 * 1024 * 1024,
        timeout: 95_000,
      });
      const image = detectedImage(stdout);
      if (!image && allowPagePreview) {
        const previewUrl = pagePreviewUrl(stdout, url);
        if (previewUrl && previewUrl !== url) return fetchWithRetry(previewUrl, false);
      }
      if (!image) throw new Error("conteudo baixado nao e uma imagem reconhecida");
      return { buffer: stdout, contentType: image.contentType, ext: image.ext, finalUrl: url };
    } catch (caught) {
      error = caught;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  throw error;
}

await mkdir(destination, { recursive: true });
const records = new Array(catalog.length);
try {
  const previous = JSON.parse(await readFile(join(destination, "catalogo-download.json"), "utf8"));
  previous.records.forEach((record, index) => {
    if (record.status === "baixada") records[index] = record;
  });
} catch {
  // Primeira execução: ainda não há manifesto para retomar.
}
let cursor = 0;

async function worker() {
  while (cursor < catalog.length) {
    const index = cursor;
    cursor += 1;
    if (records[index]?.status === "baixada") continue;
    const source = catalog[index];
    const personFolder = `${String(Math.floor(index / 3) + 1).padStart(3, "0")}-${slugify(source.pessoa)}`;
    try {
      const requestedUrl = wikimediaDeliveryUrl(source);
      const downloaded = await fetchWithRetry(requestedUrl);
      const ext = downloaded.ext || extension(downloaded.contentType, downloaded.finalUrl);
      const relativePath = join(personFolder, `${source.tipo_foto}.${ext}`);
      await mkdir(join(destination, personFolder), { recursive: true });
      await writeFile(join(destination, relativePath), downloaded.buffer);
      records[index] = {
        status: "baixada",
        arquivo: relativePath,
        bytes: downloaded.buffer.length,
        sha256: createHash("sha256").update(downloaded.buffer).digest("hex"),
        url_solicitada: requestedUrl,
        url_final: downloaded.finalUrl,
        content_type: downloaded.contentType,
        ...source,
      };
    } catch (error) {
      records[index] = { status: "falhou", erro: error.message, ...source };
    }
    const completed = records.filter(Boolean).length;
    if (completed % 25 === 0 || completed === catalog.length) {
      console.log(`${completed}/${catalog.length}`);
    }
  }
}

await Promise.all(Array.from({ length: 3 }, () => worker()));
const summary = {
  total: records.length,
  downloaded: records.filter(({ status }) => status === "baixada").length,
  failed: records.filter(({ status }) => status === "falhou").length,
  total_bytes: records.reduce((sum, record) => sum + (record.bytes || 0), 0),
};
await writeFile(join(destination, "catalogo-download.json"), `${JSON.stringify({ summary, records }, null, 2)}\n`);
await writeFile(join(destination, "LEIA-ME.md"), [
  "# Fotos-fonte PoliMatch — 125 pessoas",
  "",
  "Esta pasta contém as três opções catalogadas para cada pessoa, sem recorte ou tratamento.",
  "Consulte `catalogo-download.json` antes de editar: ele preserva autor, origem, licença/condição declarada e checksum.",
  "Fotos marcadas como licença a confirmar, uso editorial ou não livre não devem ser publicadas antes da liberação jurídica.",
  "",
  `- Registros: ${summary.total}`,
  `- Baixados: ${summary.downloaded}`,
  `- Falhas: ${summary.failed}`,
  `- Volume: ${(summary.total_bytes / 1024 / 1024).toFixed(1)} MiB`,
  "",
].join("\n"));
console.log(JSON.stringify(summary));
