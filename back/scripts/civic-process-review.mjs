import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { buildCivicProcessReview } from '../src/civic-process-review.js';
import { saveDivulgaReview } from '../src/civic-divulga-review-store.js';
import { sha256 } from '../src/civic-import.js';

const [deliveryPath,details,evidence,output] = process.argv.slice(2);
if (!deliveryPath || !details || !evidence || !output || process.argv.length !== 6) throw new Error('Usage: node back/scripts/civic-process-review.mjs delivery-manifest.json detail-review.json process-evidence.json new-process-review.json');
async function json(path) {
  const content = await readFile(resolve(path));
  if (content.length > 2*1024*1024) throw new Error('Process review input exceeds 2 MiB');
  return JSON.parse(content.toString('utf8'));
}
const delivery = await json(deliveryPath);
if (delivery.version !== 1 || typeof delivery.export?.path !== 'string' || !/^[a-f0-9]{64}$/.test(delivery.export.sha256)) throw new Error('Process review delivery manifest');
const bytes = await readFile(resolve(dirname(resolve(deliveryPath)),delivery.export.path));
if (bytes.length > 16*1024*1024 || sha256(bytes) !== delivery.export.sha256) throw new Error('Process review delivery checksum/limit');
const batch = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
if (batch.batchId !== delivery.export.batchId || batch.report?.transformedRecordsSha256 !== delivery.export.transformedRecordsSha256) throw new Error('Process review delivery identity');
const review = buildCivicProcessReview(await json(details),await json(evidence),batch);
await saveDivulgaReview(resolve(output),review);
console.log(JSON.stringify({evidenceId:review.evidenceId,...review.totals,complete:review.complete,humanAcceptance:review.humanAcceptance},null,2));
