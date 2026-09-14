import { readFile, writeFile } from "node:fs/promises";

const [selectionPath, outputPath] = process.argv.slice(2);
if (!selectionPath || !outputPath) {
  throw new Error("uso: node verify-wikimedia-sources.mjs selecao.json saida.json");
}

const selection = JSON.parse(await readFile(selectionPath, "utf8"));

function fileTitle(photo) {
  for (const raw of [photo.pagina_origem, photo.url_direta]) {
    try {
      const url = new URL(raw);
      const decoded = decodeURIComponent(url.pathname);
      const special = decoded.match(/\/wiki\/Special:FilePath\/(.+)$/);
      if (special) return `File:${special[1]}`;
      const file = decoded.match(/\/wiki\/(File:.+)$/);
      if (file) return file[1];
      if (url.hostname === "upload.wikimedia.org") {
        const name = decoded.split("/").at(-1);
        if (name) return `File:${name.replace(/_/g, " ")}`;
      }
    } catch {
      // A source outside Wikimedia is intentionally left unresolved.
    }
  }
  return null;
}

const requested = [...new Set(selection.selections.flatMap(({ selected, alternatives }) =>
  [selected, ...alternatives].map(fileTitle).filter(Boolean),
))];
const verified = new Map();

function titleKey(value = "") {
  return value.replace(/_/g, " ").normalize("NFC").toLowerCase();
}

for (let index = 0; index < requested.length; index += 40) {
  const titles = requested.slice(index, index + 40);
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "1800",
    redirects: "1",
    titles: titles.join("|"),
  });
  const response = await fetch(url, { headers: { "user-agent": "PoliMatch photo curator/1.0" } });
  if (!response.ok) throw new Error(`Commons API respondeu ${response.status}`);
  const payload = await response.json();
  for (const page of payload.query?.pages || []) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const metadata = info.extmetadata || {};
    verified.set(titleKey(page.title), {
      page_title: page.title,
      canonical_url: info.url,
      thumb_url: info.thumburl || info.url,
      thumb_width: info.thumbwidth || info.width,
      thumb_height: info.thumbheight || info.height,
      description_url: info.descriptionurl,
      width: info.width,
      height: info.height,
      mime: info.mime,
      license_short_name: metadata.LicenseShortName?.value || "",
      license_url: metadata.LicenseUrl?.value || "",
      artist_html: metadata.Artist?.value || "",
      credit_html: metadata.Credit?.value || "",
      date_time_original: metadata.DateTimeOriginal?.value || "",
      usage_terms: metadata.UsageTerms?.value || "",
    });
  }
  for (const redirect of payload.query?.redirects || []) {
    const target = verified.get(titleKey(redirect.to));
    if (target) verified.set(titleKey(redirect.from), target);
  }
}

const records = selection.selections.map(({ pessoa, slug, selected, alternatives }) => {
  const candidates = [selected, ...alternatives].map((photo) => {
    const title = fileTitle(photo);
    return { photo, file_title: title, verification: title ? verified.get(titleKey(title)) || null : null };
  });
  return { pessoa, slug, candidates };
});

await writeFile(outputPath, `${JSON.stringify({ generated_at: new Date().toISOString(), records }, null, 2)}\n`);
const total = records.flatMap(({ candidates }) => candidates).length;
const resolved = records.flatMap(({ candidates }) => candidates).filter(({ verification }) => verification).length;
console.log(JSON.stringify({ requested: total, resolved, unresolved: total - resolved }));
