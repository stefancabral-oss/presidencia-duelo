import test from 'node:test';
import assert from 'node:assert/strict';
import { civicImportFixture } from '../test-support/civic-import-fixture.js';
import { prepareCivicImport } from './civic-import.js';
import { collectDivulgaDetails, readDivulgaJson, publicProcessUrl, divulgaDetailSelectors, buildDivulgaReview } from './civic-divulga-detail.js';
import { saveDivulgaReview } from './civic-divulga-review-store.js';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function fixture() {
  const inputs = civicImportFixture(), batch = prepareCivicImport(inputs);
  const selectors = divulgaDetailSelectors(batch,inputs.candidateRows);
  const fetchImpl = (mutate = () => {}) => async (url, options) => {
    assert.equal(options.redirect,'error');
    assert.ok(options.signal instanceof AbortSignal);
    const id = new URL(url).pathname.split('/').at(-1), selector = selectors.find(s => s.sourceKey === id);
    const relationship = inputs.relations.find(r => r.holderKey === id);
    const data = {id:Number(id), eleicao:{id:999,ano:2032}, cargo:{codigo:Number(selector.officeCode)}, ufCandidatura:selector.jurisdiction, idCandidatoSuperior:0, descricaoSituacao:'Deferido com recurso', descricaoSituacaoCandidato:'Consta da urna', dataUltimaAtualizacao:'2032-08-01 11:37', numeroProcesso:'06012345620326260000', numeroProcessoDrap:'06012345720326260000', substituto:null, cpf:'DO-NOT-RETAIN-SYNTHETIC-PRIVATE', emails:['not-a-real-address'], dataDeNascimento:'not-a-real-birthday', bens:[{private:'not-retained'}], arquivos:[{private:'not-retained'}], vices:(relationship?.members ?? []).map(m => ({sq_CANDIDATO:Number(m.sourceKey), sq_ELEICAO:999, sg_UE:selector.jurisdiction, ds_CARGO:'Synthetic role', sq_CANDIDATO_SUPERIOR:null}))};
    mutate(data); return Response.json(data);
  };
  const collect = (mutate, overrides = {}) => collectDivulgaDetails({year:2032,pilotUf:'SP',apiElectionKey:'999',selectors,synthetic:true,fetchImpl:fetchImpl(mutate),...overrides});
  return {inputs,batch,selectors,collect};
}

test('B02 individual detail collects every pinned identity, minimizes DTO and preserves origin-local precision', async () => {
  const f = fixture(), collection = await f.collect(), review = buildDivulgaReview(f.batch,collection);
  assert.equal(collection.projections.length,9);
  const serialized = JSON.stringify(collection);
  for (const privateField of ['DO-NOT-RETAIN','birthday','emails','cpf','bens','arquivos']) assert.equal(serialized.includes(privateField),false);
  assert.deepEqual(collection.projections[0].originUpdate,{value:'2032-08-01 11:37',precision:'minute',timezone:null,meaning:'record_updated_at',legalValidityInferred:false});
  assert.equal(review.totals.roleCompleteObservations,4);
  assert.equal(review.totals.legalIntervalsProven,0);
  assert.equal(review.synthetic,true);
  assert.equal(review.humanAcceptance,'pending');
  assert.ok(review.cases.every(c => c.legalValidity.validFrom === null && c.review === 'pending'));
  assert.ok(collection.projections.every(p => p.evidence.sourceAt === null && p.evidence.license === null));
});

test('B02 individual detail rejects wrong response ID, election, year, UE, role and invalid source dates', async () => {
  const f = fixture();
  for (const mutate of [d=>d.id=99,d=>d.eleicao.id=998,d=>d.eleicao.ano=2033,d=>d.ufCandidatura='RJ',d=>d.cargo.codigo=6,d=>d.dataUltimaAtualizacao='2032-02-30 10:10',d=>d.dataUltimaAtualizacao='2032-08-01T10:00:00Z',d=>d.numeroProcesso='javascript:alert(1)']) await assert.rejects(f.collect(mutate));
});

test('B02 selector cannot request arbitrary IDs, duplicate persons, outside pilot or unsupported offices', async () => {
  const f = fixture();
  for (const selectors of [[],[...f.selectors,f.selectors[0]],[{...f.selectors[0],sourceKey:'11/../../x'}],[{...f.selectors[0],jurisdiction:'RJ'}],[{...f.selectors[0],officeCode:'6'}],[{...f.selectors[0],officeCode:'9'}]]) await assert.rejects(f.collect(undefined,{selectors}));
  assert.throws(() => divulgaDetailSelectors(f.batch,f.inputs.candidateRows.filter(r=>r.SQ_CANDIDATO!=='12')),/pinned person/);
  assert.throws(() => divulgaDetailSelectors(f.batch,[...f.inputs.candidateRows,f.inputs.candidateRows[0]]),/pinned person/);
});

test('B02 response limits reject wire/decompressed overflow, truncation, HTML and invalid UTF-8', async () => {
  const utf8 = new Uint8Array([0xff]);
  for (const response of [new Response('denied',{status:403}),new Response('<html>error</html>'),new Response(utf8),new Response('{}',{headers:{'content-length':'99'}}),new Response('{}',{headers:{'content-length':'not-a-length'}}),new Response('{}',{headers:{'content-length':'99999999'}})]) await assert.rejects(readDivulgaJson(response));
  await assert.rejects(readDivulgaJson(new Response('12345'),4),/byte limit/);
  await assert.rejects(readDivulgaJson(new Response('12345',{headers:{'content-encoding':'gzip','content-length':'2'}}),4),/byte limit/);
  const gzipDecoded = await readDivulgaJson(new Response('{}',{headers:{'content-encoding':'gzip','content-length':'20'}}));
  assert.deepEqual(gzipDecoded.data,{});
});

test('B02 old/new vice references and explicit replacement are historical observations without inferred interval', async () => {
  const f = fixture(), collection = await f.collect(d => {
    if (d.id === 21) d.vices.push({sq_CANDIDATO:12,sq_ELEICAO:999,sg_UE:'SP',ds_CARGO:'Historical vice',sq_CANDIDATO_SUPERIOR:null});
    if (d.id === 22) d.substituto={sqEleicao:999,sqCandidato:44,sgUe:'SP',nrAno:2032};
  });
  const before = JSON.stringify(f.batch), review = buildDivulgaReview(f.batch,collection), governor = review.cases.find(c=>c.sourceKey==='21');
  assert.equal(governor.observedComposition,'ambiguous_history');
  assert.equal(governor.legalValidity.validFrom,null);
  assert.ok(governor.exceptionReasons.includes('explicit_substitution_requires_dated_registration_evidence'));
  assert.equal(JSON.stringify(f.batch),before);
  assert.equal(f.batch.dataset.records.candidacies.find(c=>c.sourceKey==='21').officialStatus,'APTO / DEFERIDO COM RECURSO');
});

test('B02 senator arrays containing another holder or duplicate positions remain ambiguous despite same party', async () => {
  const f = fixture(), collection = await f.collect(d => {
    if (d.id === 31) d.vices.push({...d.vices[0]});
  });
  assert.equal(collection.projections.find(p=>p.sourceKey==='31').duplicateReferences,1);
  const senator = buildDivulgaReview(f.batch,collection).cases.find(c=>c.sourceKey==='31');
  assert.equal(senator.references.length,3);
  assert.equal(senator.observedComposition,'ambiguous_history');
  assert.equal(senator.agreesWithPinnedList,false);
});

test('B02 forward or reverse parent conflict cannot produce a role-complete observation', async () => {
  const f = fixture();
  for (const mutate of [d=>{if(d.id===21)d.vices[0].sq_CANDIDATO_SUPERIOR=11;},d=>{if(d.id===22)d.idCandidatoSuperior=11;}]) {
    const review = buildDivulgaReview(f.batch,await f.collect(mutate));
    assert.equal(review.cases.find(c=>c.sourceKey==='21').observedComposition,'ambiguous_history');
  }
});

test('B02 cross-election/reference/substitution profiles reject without choosing a replacement', async () => {
  const f = fixture();
  for (const mutate of [d=>{if(d.vices.length)d.vices[0].sq_ELEICAO=998;},d=>{if(d.vices.length)d.vices[0].sg_UE='RJ';},d=>d.substituto={sqEleicao:998,sqCandidato:99,sgUe:d.ufCandidatura,nrAno:2032},d=>d.substituto={sqEleicao:999,sqCandidato:d.id,sgUe:d.ufCandidatura,nrAno:2032}]) await assert.rejects(f.collect(mutate));
});

test('B02 review requires every holder, matching pilot/year and a truthful synthetic marker', async () => {
  const f = fixture(), collection = await f.collect();
  for (const mutation of [c=>c.projections=c.projections.filter(p=>p.sourceKey!=='11'),c=>c.projections=c.projections.filter(p=>p.sourceKey!=='12'),c=>c.pilotUf='RJ',c=>c.year=2033,c=>c.synthetic=false,c=>c.projections.push(c.projections[0])]) {
    const modified = structuredClone(collection); mutation(modified); assert.throws(()=>buildDivulgaReview(f.batch,modified));
  }
});

test('B02 review identity ignores recollection time but changes with official status or history', async () => {
  const f = fixture(), collection = await f.collect(), first = buildDivulgaReview(f.batch,collection);
  for (const projection of collection.projections) projection.evidence.fetchedAt='2032-08-02T12:00:00.000Z';
  assert.equal(buildDivulgaReview(f.batch,collection).reviewId,first.reviewId);
  collection.projections[0].officialStatus='Renúncia';
  assert.notEqual(buildDivulgaReview(f.batch,collection).reviewId,first.reviewId);
  assert.match(publicProcessUrl('06012345620326260000'),/0601234-56\.2032\.6\.26\.0000$/);
  assert.equal(publicProcessUrl(null),null);
  assert.throws(()=>publicProcessUrl('https://untrusted.test'));
});

test('B02 identical sequentials in different API jurisdictions do not collapse into one identity', async () => {
  const selectors = [{sourceKey:'11',jurisdiction:'BR',officeCode:'1'},{sourceKey:'11',jurisdiction:'SP',officeCode:'3'}];
  const collection = await collectDivulgaDetails({year:2032,pilotUf:'SP',apiElectionKey:'999',selectors,synthetic:true,fetchImpl:async url => {
    const ue = new URL(url).pathname.split('/').at(-4);
    return Response.json({id:11,eleicao:{id:999,ano:2032},ufCandidatura:ue,cargo:{codigo:ue==='BR'?1:3},idCandidatoSuperior:0,descricaoSituacao:'Deferido',descricaoSituacaoCandidato:'Consta da urna',dataUltimaAtualizacao:null,vices:[]});
  }});
  assert.equal(collection.projections.length,2);
  assert.deepEqual(collection.projections.map(p=>p.jurisdiction),['BR','SP']);
});

test('B02 immutable review output survives duplicate writes and failed serialization with no partial files', async () => {
  const dir = await mkdtemp(join(tmpdir(),'civic-review-'));
  try {
    const f = fixture(), collection = await f.collect(), output = join(dir,'review.json'), body = {collection,review:buildDivulgaReview(f.batch,collection)};
    await saveDivulgaReview(output,body); const before = await readFile(output,'utf8');
    await assert.rejects(saveDivulgaReview(output,{unexpected:'replacement'}),{code:'EEXIST'});
    const circular = {}; circular.self = circular;
    await assert.rejects(saveDivulgaReview(join(dir,'failed.json'),circular));
    assert.equal(await readFile(output,'utf8'),before);
    assert.deepEqual(await readdir(dir),['review.json']);
    assert.equal(JSON.parse(before).review.humanAcceptance,'pending');
  } finally { await rm(dir,{recursive:true,force:true}); }
});
