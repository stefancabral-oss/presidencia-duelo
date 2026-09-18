import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { prepareCivicImport, sha256 } from '../src/civic-import.js';
import { saveCivicImport } from '../src/civic-import-store.js';
import { acquireOfficialArchive } from '../src/civic-acquisition.js';

const [manifestArgument, outputArgument, mode] = process.argv.slice(2);
if (!manifestArgument || !outputArgument || (mode && mode !== '--download') || process.argv.length > 5) throw new Error('Usage: node back/scripts/civic-import.mjs manifest.json output-directory [--download]');
const manifestPath = resolve(manifestArgument), directory = resolve(outputArgument);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
let candidates, vacancies, complementary;
if (mode === '--download') {
  if (manifest.synthetic) throw new Error('Synthetic manifests cannot claim official downloads');
  const acquisitionDirectory = join(directory, 'acquisition', randomUUID());
  await mkdir(acquisitionDirectory, { recursive: true });
  const receipts = [];
  const resources=[['candidates','consulta_cand'], ['vacancies','consulta_vagas']];if(manifest.complementary)resources.push(['complementary','consulta_cand_complementar']);
  for (const [kind, prefix] of resources) {
    const receipt = await acquireOfficialArchive({ kind, year: manifest.year, destination: join(acquisitionDirectory, prefix + '.zip'), expectedSha256: manifest[kind]?.archiveSha256 });
    receipts.push({ kind, ...receipt });
    const csv = join(acquisitionDirectory, prefix + '.csv');
    const member = `${prefix}_${manifest.year}_BRASIL.csv`;
    await promisify(execFile)(process.env.CIVIC_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), [fileURLToPath(new URL('./civic-unzip.py', import.meta.url)), join(acquisitionDirectory, prefix + '.zip'), member, csv], { timeout: 60000, maxBuffer: 16384 });
    const bytes = await readFile(csv);
    // A reviewed manifest pins the expected CSV; download never invents its provenance.
    if (manifest[kind].url !== receipt.url || manifest[kind].locator !== member || manifest[kind].sha256 !== sha256(bytes)) throw new Error('Downloaded CSV differs from reviewed manifest');
    manifest[kind].fetchedAt = receipt.fetchedAt;
    if (kind === 'candidates') candidates = bytes; else if(kind==='vacancies') vacancies = bytes;else complementary=bytes;
    await writeFile(join(acquisitionDirectory, 'receipts.json'), JSON.stringify(receipts,null,2) + '\n');
  }
} else {
  candidates = await readFile(resolve(dirname(manifestPath), manifest.candidates.path));
  vacancies = await readFile(resolve(dirname(manifestPath), manifest.vacancies.path));
  if(manifest.complementary)complementary=await readFile(resolve(dirname(manifestPath),manifest.complementary.path));
}
const relations = manifest.relationsPath ? JSON.parse(await readFile(resolve(dirname(manifestPath), manifest.relationsPath), 'utf8')) : [];
const prepared = prepareCivicImport({ candidates, vacancies, complementary, manifest, relations });
const result = await saveCivicImport(directory, prepared);
console.log(JSON.stringify({ batchId: result.batch.batchId, repeated: result.repeated, publication: 'staging_only', synthetic: result.batch.dataset.synthetic, ...result.batch.report, diff: result.batch.diff },null,2));
