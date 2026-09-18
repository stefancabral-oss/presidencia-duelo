import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildCivicProcessReview } from './civic-process-review.js';

const detailsPath = new URL('../../stages/17_candidate_news/output/B02-case-review.json',import.meta.url);
const evidencePath = new URL('../../stages/17_candidate_news/output/B02-process-evidence.json',import.meta.url);
const details = JSON.parse(await readFile(detailsPath,'utf8'));
const evidence = JSON.parse(await readFile(evidencePath,'utf8'));
const clone = value => structuredClone(value);

test('real documentary review accounts for the entire pilot without promoting legal intervals',()=>{
  const output = buildCivicProcessReview(details,evidence);
  assert.equal(output.totals.candidacies,37);
  assert.equal(output.totals.individualDetails,95);
  assert.deepEqual(output.cases.map(c=>c.candidacyId),details.review.cases.map(c=>c.candidacyId));
  assert.ok(output.cases.find(c=>c.sourceKey==='250002554075').documentIds.includes('guto-collective-decision'));
  assert.ok(output.cases.find(c=>c.sourceKey==='250002544912').documentIds.includes('vivian-substitute-vice-decision'));
  assert.equal(output.complete,false);
  assert.equal(output.legalIntervalsProven,0);
  assert.equal(output.humanAcceptance,'pending');
  assert.ok(output.cases.every(c=>c.legalValidity.validFrom===null && c.legalValidity.inferred===false));
  assert.equal(Object.hasOwn(output,'dataset'),false);
  assert.equal(Object.hasOwn(output,'tickets'),false);
});

test('document evidence cannot be rebound to another batch or modified detail collection',()=>{
  const other = clone(evidence); other.batchId='a'.repeat(64);
  assert.throws(()=>buildCivicProcessReview(details,other),/identity/);
  const changed = clone(details); changed.collection.projections[0].registrationProcess='06030244720266260000';
  assert.throws(()=>buildCivicProcessReview(changed,evidence),/fingerprint/);
});

test('an official document needs a process belonging to at least one named source identity',()=>{
  const bad = clone(evidence); bad.documents[0].sourceKeys=['250002544516'];
  assert.throws(()=>buildCivicProcessReview(details,bad),/process binding/);
  bad.documents[0].sourceKeys=['999999999999'];
  assert.throws(()=>buildCivicProcessReview(details,bad),/source coverage/);
});

test('foreign jurisdictions and duplicate or absent source IDs fail closed',()=>{
  const bad=clone(evidence); bad.documents[0].sourceKeys.push('280002548139');
  assert.throws(()=>buildCivicProcessReview(details,bad),/process binding/);
  bad.documents[0].sourceKeys=['250002553928','250002553928'];
  assert.throws(()=>buildCivicProcessReview(details,bad),/source coverage/);
});

test('day-only facts stay day-only; impossible and future dates are rejected',()=>{
  const good=clone(evidence); good.documents[0].datedFacts=[{event:'regional_judgment',date:'2026-09-08',precision:'day'}];
  const output=buildCivicProcessReview(details,good);
  assert.deepEqual(output.documents[0].datedFacts,good.documents[0].datedFacts);
  for(const date of ['2026-02-30','2099-09-08']) {
    good.documents[0].datedFacts[0].date=date;
    assert.throws(()=>buildCivicProcessReview(details,good),/dated fact/);
  }
});

test('personal identifiers, arbitrary DTO fields and extra data cannot enter the projection',()=>{
  for(const summary of ['CPF 123.456.789-00','Contato pessoa@example.org','12345678901']) {
    const bad=clone(evidence); bad.documents[0].summary=summary;
    assert.throws(()=>buildCivicProcessReview(details,bad),/document facts/);
  }
  const bad=clone(evidence); bad.documents[0].cpf='12345678901';
  assert.throws(()=>buildCivicProcessReview(details,bad),/fields/);
});

test('human acceptance, assumed timezone and invented legal intervals are refused',()=>{
  const accepted=clone(evidence); accepted.humanAcceptance='approved';
  assert.throws(()=>buildCivicProcessReview(details,accepted),/boundary/);
  const interval=clone(evidence); interval.documents[0].legalInterval={validFrom:'2026-09-08T18:00:46Z'};
  assert.throws(()=>buildCivicProcessReview(details,interval),/unverified legal/);
  interval.documents[0].legalInterval=null; interval.documents[0].signedAt.timezone='UTC';
  assert.throws(()=>buildCivicProcessReview(details,interval),/document facts/);
});

test('only the observed official HTML document endpoint is accepted',()=>{
  for(const url of ['https://example.org/documento','https://consultaunificadapje.tse.jus.br.evil.test/consulta-publica-unificada/documento','http://consultaunificadapje.tse.jus.br/consulta-publica-unificada/documento',evidence.documents[0].url+'&token=unnecessary']) {
    const bad=clone(evidence); bad.documents[0].url=url;
    assert.throws(()=>buildCivicProcessReview(details,bad),/URL/);
  }
});

test('identity ignores collection time but changes when a documented fact changes',()=>{
  const later=clone(evidence); later.recordedAt='2026-09-19T00:00:00Z';
  later.documents.forEach(d=>d.consultedAt='2026-09-19T00:00:00Z');
  assert.equal(buildCivicProcessReview(details,later).evidenceId,buildCivicProcessReview(details,evidence).evidenceId);
  later.documents[0].summary+=' Revisão factual posterior.';
  assert.notEqual(buildCivicProcessReview(details,later).evidenceId,buildCivicProcessReview(details,evidence).evidenceId);
});

test('real CLI exports immutable review and refuses overwriting an earlier evidence pack',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'civic-process-review-'));
  const output=join(folder,'review.json');
  const args=[fileURLToPath(new URL('../scripts/civic-process-review.mjs',import.meta.url)),fileURLToPath(detailsPath),fileURLToPath(evidencePath),output];
  try {
    const first=spawnSync(process.execPath,args,{encoding:'utf8'});
    assert.equal(first.status,0,first.stderr);
    const original=await readFile(output,'utf8');
    assert.equal(JSON.parse(original).complete,false);
    const repeat=spawnSync(process.execPath,args,{encoding:'utf8'});
    assert.notEqual(repeat.status,0);
    assert.equal(await readFile(output,'utf8'),original);
  } finally {
    assert.ok(resolve(folder).startsWith(resolve(tmpdir())+sep+'civic-process-review-'));
    await rm(folder,{recursive:true,force:true});
  }
});
