import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
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

async function referencedBatch(directory, identity, reconciled = false) {
  const batch = await optionalJson(join(directory,'batches',batchKey(identity)+'.json'));
  if (!batch || batch.batchId !== identity) throw new CivicImportError('Stored state points to missing/mismatched batch');
  validateBatch(batch);
  if (reconciled && batch.report.complete !== true) throw new CivicImportError('Stored reconciled pointer is incomplete');
  return batch;
}

const alive = pid => {
  try { process.kill(pid,0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; return true; }
};

// Explicit repair only: same host, structurally valid ownership, dead PID.
// A recovery guard serializes repairs. Active/unknown/foreign owners fail closed.
export async function recoverCivicImportLock(directory) {
  const guardPath = join(directory,'.import.recovery.lock'), guard = await open(guardPath,'wx');
  try {
    const lockPath = join(directory,'.import.lock'), lock = await optionalJson(lockPath);
    if (!lock) return {recovered:false};
    if (lock.version !== 1 || lock.hostname !== hostname() || !Number.isSafeInteger(lock.pid) || lock.pid < 1 || typeof lock.owner !== 'string' || !/^[a-f0-9-]{36}$/.test(lock.owner) || !Number.isFinite(Date.parse(lock.createdAt)) || alive(lock.pid)) throw new CivicImportError('Import lock owner active/unknown/foreign; recovery refused');
    const current = await optionalJson(lockPath);
    if (JSON.stringify(current) !== JSON.stringify(lock) || alive(lock.pid)) throw new CivicImportError('Import lock changed during recovery');
    await unlink(lockPath);
    return {recovered:true, previousOwner:lock.owner, previousPid:lock.pid};
  } finally { await guard.close(); await unlink(guardPath); }
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
    await lock.writeFile(JSON.stringify({version:1,hostname:hostname(),pid:process.pid,owner:randomUUID(),createdAt:new Date().toISOString()})+'\n','utf8');
    await lock.sync();
    const statePath = join(directory, 'state.json');
    const state = await optionalJson(statePath);
    if (state && (state.version !== 1 || state.electionId !== input.electionId || state.pilotUf !== input.pilotUf || state.synthetic !== input.dataset.synthetic)) throw new CivicImportError('Output directory election/pilot boundary');
    if (state && (state.publication !== 'staging_only' || (state.lastReconciledBatch !== null && (typeof state.lastReconciledBatch !== 'string' || !/^[a-f0-9]{64}$/.test(state.lastReconciledBatch))))) throw new CivicImportError('Stored reconciled pointer profile');
    const previous = state ? await referencedBatch(directory,state.latestBatch) : null;
    if (state?.lastReconciledBatch) await referencedBatch(directory,state.lastReconciledBatch,true);
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
    // Replaying an archived batch of the current generation is a no-op. A rollback is
    // a separate reviewed operation, never an incidental retry of an old manifest.
    if (repeated && state) return {repeated:true, stateChanged:false, historicalReplay:state.latestBatch !== batch.batchId, state, batch};
    const nextState = { version: 1, electionId: input.electionId, pilotUf: input.pilotUf, synthetic: input.dataset.synthetic, latestBatch: batch.batchId, lastReconciledBatch: batch.report.complete ? batch.batchId : state?.lastReconciledBatch ?? null, publication: 'staging_only' };
    temporary = join(directory, '.state-' + randomUUID() + '.tmp');
    const pointer = await open(temporary, 'wx');
    try { await pointer.writeFile(JSON.stringify(nextState, null, 2) + '\n', 'utf8'); await pointer.sync(); }
    finally { await pointer.close(); }
    await rename(temporary, statePath); temporary = null;
    return { repeated, stateChanged:true, historicalReplay:false, state: nextState, batch };
  } finally {
    if (temporary) await unlink(temporary).catch(() => {});
    await lock.close(); await unlink(lockPath);
  }
}
