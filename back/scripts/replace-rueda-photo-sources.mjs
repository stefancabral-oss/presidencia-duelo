import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const [destination] = process.argv.slice(2);
if (!destination) throw new Error("uso: node replace-rueda-photo-sources.mjs pasta-destino");

const replacements = {
  retrato_neutro: {
    url: "https://static.congressoemfoco.com.br/2024/02/52-3.jpg",
    page: "https://www.congressoemfoco.com.br/noticia/7477/em-derrota-para-bivar-antonio-rueda-vence-eleicao-no-uniao-brasil",
    credit: "Congresso em Foco — fotógrafo não informado no resultado",
    date: "2024-02",
  },
  retrato_expressivo_discurso: {
    url: "https://s2-oglobo.glbimg.com/2ub9vVlK9zpNYY1bgywjx_exJNQ=/0x0:4918x3279/924x0/smart/filters:strip_icc()/i.s3.glbimg.com/v1/AUTH_da025474c0c44edd99332dddb09cabe8/internal_photos/bs/2024/H/Q/tuSS7wQiuIpEDCbkpJ0Q/107558876-pa-brasilia-df-02-07-2024-antonio-de-rueda-assume-presidencia-do-uniao-brasil-fotografia.jpg",
    page: "https://oglobo.globo.com/politica/noticia/2025/05/22/entrevista-governo-lula-nao-consegue-fazer-entregas-e-se-enfraquece-dia-a-dia-diz-presidente-do-uniao-brasil.ghtml",
    credit: "O Globo",
    date: "2024-07-02",
  },
  iconica_contextual: {
    url: "https://www.diariodepernambuco.com.br/_midias/jpg/2025/12/02/67269133_bede_4e7d_91ab_97ed19ffdce7-810657.jpeg",
    page: "https://www.diariodepernambuco.com.br/blogs/blog-dantas-barreto/2025/12/11701999-uniao-brasil-e-pp-pedirao-registro-de-federacao-ao-tse-nesta-quarta-feira-3.html",
    credit: "Diario de Pernambuco — fotógrafo não informado no resultado",
    date: "2025-12-02",
  },
};

const manifestPath = join(destination, "catalogo-download.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

for (const [type, replacement] of Object.entries(replacements)) {
  const { stdout } = await execFileAsync("curl", ["-4", "-fsSL", "--max-time", "90", replacement.url], {
    encoding: "buffer",
    maxBuffer: 30 * 1024 * 1024,
    timeout: 95_000,
  });
  if (!(stdout[0] === 0xff && stdout[1] === 0xd8)) throw new Error(`${type}: resposta não é JPEG`);
  const relativePath = join("068-antonio-rueda", `${type}.jpg`);
  await writeFile(join(destination, relativePath), stdout);
  const record = manifest.records.find(({ pessoa, tipo_foto }) => pessoa === "Antonio Rueda" && tipo_foto === type);
  Object.assign(record, {
    status: "baixada_substituta_restrita",
    arquivo: relativePath,
    bytes: stdout.length,
    sha256: createHash("sha256").update(stdout).digest("hex"),
    url_catalogada_original: record.url_direta,
    url_direta: replacement.url,
    pagina_origem: replacement.page,
    url_final: replacement.url,
    fotografo: replacement.credit,
    data_fotografia: replacement.date,
    licenca_ou_condicao: "USO EDITORIAL / DIREITOS RESERVADOS — obter autorização antes de publicar",
    nota_substituicao: "A referência original não expunha arquivo público; substituída por retrato identificável para o kit de tratamento.",
  });
  delete record.erro;
}

manifest.summary.downloaded = manifest.records.filter(({ status }) => status.startsWith("baixada")).length;
manifest.summary.failed = manifest.records.filter(({ status }) => status === "falhou").length;
manifest.summary.total_bytes = manifest.records.reduce((sum, record) => sum + (record.bytes || 0), 0);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest.summary));
