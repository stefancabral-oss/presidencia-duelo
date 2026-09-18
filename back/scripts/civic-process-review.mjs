import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildCivicProcessReview } from '../src/civic-process-review.js';
import { saveDivulgaReview } from '../src/civic-divulga-review-store.js';

const [details,evidence,output] = process.argv.slice(2);
if (!details || !evidence || !output || process.argv.length !== 5) throw new Error('Usage: node back/scripts/civic-process-review.mjs detail-review.json process-evidence.json new-process-review.json');
async function json(path) {
  const content = await readFile(resolve(path));
  if (content.length > 2*1024*1024) throw new Error('Process review input exceeds 2 MiB');
  return JSON.parse(content.toString('utf8'));
}
const review = buildCivicProcessReview(await json(details),await json(evidence));
await saveDivulgaReview(resolve(output),review);
console.log(JSON.stringify({evidenceId:review.evidenceId,...review.totals,complete:review.complete,humanAcceptance:review.humanAcceptance},null,2));
