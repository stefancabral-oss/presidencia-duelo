import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { importDiff, civicRecordDigest, CivicImportError } from './civic-import.js';
import { validateCivicDataset } from '../../shared/civic-contract.js';

const batchKey = id => { if (!/^[a-f0-9]{64}$/.test(id)) throw new CivicImportError('Stored batch identity'); return id; };
async function optionalJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function validateBatch(batch) {
  batchKey(batch.batchId);
  validateCivicDataset(batch.dataset);
  if(batch.report?.transformedRecordsSha256!==civicRecordDigest(batch.dataset.records))throw new CivicImportError('Stored transformation fingerprint');
  if (batch.publication !== 'staging_only' || batch.dataset.records.candidacies.some(c => c.review !== 'pending' || c.publication !== 'draft')) throw new CivicImportError('Staging publication boundary');
}

// Snapshots are append-only. A partial/missing new batch never replaces lastReconciled.
// A lock serializes separate CLI processes; failure leaves the previous pointer intact.
export async function saveCivicImport(directory, input) {
  validateBatch(input);
  await mkdir(join(directory, 'batches'), { recursive: true });
  const lockPath = join(directory, '.import.lock');
  const lock = await open(lockPath, 'wx');
  let temporary;
  try {
    const statePath = join(directory, 'state.json');
    const state = await optionalJson(statePath);
    if (state && (state.version !== 1 || state.electionId !== input.electionId || state.pilotUf !== input.pilotUf || state.synthetic !== input.dataset.synthetic)) throw new CivicImportError('Output directory election/pilot boundary');
    const previous = state ? await optionalJson(join(directory, 'batches', batchKey(state.latestBatch) + '.json')) : null;
    if (state && !previous) throw new CivicImportError('Stored state points to missing batch');
    if (previous) validateBatch(previous);
    if (previous && input.report.sourceAt < previous.report.sourceAt) throw new CivicImportError('Older source generation cannot replace current staging');
    const archivePath = join(directory, 'batches', batchKey(input.batchId) + '.json');
    let batch = await optionalJson(archivePath);
    const repeated = batch !== null;
    if (batch) { validateBatch(batch); if (batch.batchId !== input.batchId) throw new CivicImportError('Stored archive identity mismatch'); }
    else {
      batch = { ...input, diff: importDiff(previous, input) };
      temporary = join(directory, 'batches', '.batch-' + randomUUID() + '.tmp');
      const archive = await open(temporary, 'wx');
      try { await archive.writeFile(JSON.stringify(batch, null, 2) + '\n', 'utf8'); await archive.sync(); }
      finally { await archive.close(); }
      await rename(temporary, archivePath); temporary = null;
    }
    const nextState = { version: 1, electionId: input.electionId, pilotUf: input.pilotUf, synthetic: input.dataset.synthetic, latestBatch: batch.batchId, lastReconciledBatch: batch.report.complete ? batch.batchId : state?.lastReconciledBatch ?? null, publication: 'staging_only' };
    if (repeated && state?.latestBatch === batch.batchId) return { repeated: true, state, batch };
    temporary = join(directory, '.state-' + randomUUID() + '.tmp');
    const pointer = await open(temporary, 'wx');
    try { await pointer.writeFile(JSON.stringify(nextState, null, 2) + '\n', 'utf8'); await pointer.sync(); }
    finally { await pointer.close(); }
    await rename(temporary, statePath); temporary = null;
    return { repeated, state: nextState, batch };
  } finally {
    if (temporary) await unlink(temporary).catch(() => {});
    await lock.close(); await unlink(lockPath);
  }
}
