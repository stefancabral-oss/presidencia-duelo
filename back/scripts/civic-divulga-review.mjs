import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { prepareCivicImport, parseTseCsv } from '../src/civic-import.js';
import { collectDivulgaDetails, divulgaDetailSelectors, buildDivulgaReview } from '../src/civic-divulga-detail.js';
import { saveDivulgaReview } from '../src/civic-divulga-review-store.js';

const [manifestArgument, outputArgument] = process.argv.slice(2);
if (!manifestArgument || !outputArgument || process.argv.length !== 4) throw new Error('Usage: node back/scripts/civic-divulga-review.mjs manifest.json new-review.json');
const manifestPath = resolve(manifestArgument), base = dirname(manifestPath), manifest = JSON.parse(await readFile(manifestPath,'utf8'));
if (manifest.synthetic) throw new Error('Official detail review cannot use synthetic manifests');
const output = resolve(outputArgument);
try { await access(output); throw new Error('Review output already exists; select a new path'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const candidates = await readFile(resolve(base,manifest.candidates.path));
const batch = prepareCivicImport({manifest, candidates, vacancies:await readFile(resolve(base,manifest.vacancies.path)), complementary:manifest.complementary ? await readFile(resolve(base,manifest.complementary.path)) : undefined, relations:manifest.relationsPath ? JSON.parse(await readFile(resolve(base,manifest.relationsPath),'utf8')) : []});
const selectors = divulgaDetailSelectors(batch,parseTseCsv(candidates,{encoding:manifest.candidates.encoding}));
const collection = await collectDivulgaDetails({year:manifest.year, pilotUf:manifest.pilotUf, apiElectionKey:manifest.divulgaElectionKey, selectors});
const review = buildDivulgaReview(batch,collection);
await saveDivulgaReview(output,{collection,review});
console.log(JSON.stringify({reviewId:review.reviewId, batchId:review.batchId, publication:review.publication, humanAcceptance:review.humanAcceptance, ...review.totals},null,2));
