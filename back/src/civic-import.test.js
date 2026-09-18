import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { prepareCivicImport, parseTseCsv, tseGeneration, sha256, importDiff } from './civic-import.js';
import { saveCivicImport } from './civic-import-store.js';
import { acquireOfficialArchive, officialArchiveUrl } from './civic-acquisition.js';
import { collectDivulgaPilot,divulgaRelationships } from './civic-divulga.js';
import { civicImportFixture, encodeCsv, candidateHeader, vacancyHeader } from '../test-support/civic-import-fixture.js';

const withDirectory = async fn => {
  const directory = await mkdtemp(join(tmpdir(),'polimatch-civic-'));
  try { return await fn(directory); }
  finally { assert.equal(dirname(resolve(directory)),resolve(tmpdir())); assert.ok(basename(directory).startsWith('polimatch-civic-')); await rm(directory,{recursive:true,force:true}); }
};
const prepare = fixture => prepareCivicImport(fixture);
const importScript = fileURLToPath(new URL('../scripts/civic-import.mjs',import.meta.url));
const unzipScript = fileURLToPath(new URL('../scripts/civic-unzip.py',import.meta.url));
const updateCandidates = f => { f.candidates=encodeCsv(candidateHeader,f.candidateRows); f.manifest.candidates.sha256=sha256(f.candidates); };

test('B02 reconciles synthetic complete scopes, preserves status and minimizes personal data', () => {
  const batch=prepare(civicImportFixture());
  assert.equal(batch.report.complete,true); assert.equal(batch.dataset.synthetic,true);
  assert.equal(batch.dataset.records.candidacies.length,4); assert.equal(batch.dataset.records.members.length,9);
  assert.equal(batch.dataset.records.contests.find(c=>c.office==='senator').vacancies,2);
  assert.ok(batch.dataset.records.candidacies.every(c=>c.review==='pending' && c.publication==='draft' && c.officialStatus.includes('COM RECURSO')));
  assert.ok(batch.dataset.records.persons.every(p=>p.gameCandidateId===null && p.gameLinkReview==='none'));
  assert.equal(JSON.stringify(batch).includes('DO-NOT-RETAIN'),false);
  assert.equal(batch.report.omittedUfs.length,26); assert.equal(batch.report.humanAcceptance,'pending');
});
test('B02 parses Latin-1 accents, quoted semicolons, doubled quotes and UTF-8 BOM', () => {
  for(const utf8 of [false,true]) { const rows=parseTseCsv(encodeCsv(['NAME'],[{NAME:'João; "teste"'}],utf8)); assert.equal(rows[0].NAME,'João; "teste"'); }
  assert.equal(parseTseCsv(Buffer.from('NAME\nJoão\n','utf8'),{encoding:'utf8'})[0].NAME,'João');
  assert.throws(()=>parseTseCsv(Buffer.from([0x4e,0x0a,0xff,0x0a]),{encoding:'utf8'}));
});
test('B02 refuses incomplete CSV, width changes, malformed quoting and duplicate/missing headers', () => {
  for(const text of ['A;B\n1\n','A;A\n1;2\n','A\n"broken\n','A\n"x"junk\n','A\nno-final-newline','A\n1\0\n']) assert.throws(()=>parseTseCsv(Buffer.from(text)));
  assert.throws(()=>parseTseCsv(Buffer.from('A\n1\n'),{required:['B']}),/required/);
  assert.throws(()=>parseTseCsv(Buffer.from('A\n1\n'),{maxBytes:2}),/byte limit/);
  assert.throws(()=>parseTseCsv(Buffer.from('A\n1\n2\n'),{maxRows:1}),/row limit/);
});
test('B02 generation rejects impossible dates, overflow times and unreviewed historical timezone', () => {
  assert.equal(tseGeneration('01/08/2032','12:00:00'),'2032-08-01T15:00:00.000Z');
  for(const [date,time] of [['31/02/2032','12:00:00'],['01/08/2032','25:00:00'],['01/08/2022','12:00:00']]) assert.throws(()=>tseGeneration(date,time));
});
test('B02 refuses hash mismatch, nonofficial production provenance and mixed generation', () => {
  let f=civicImportFixture(); f.manifest.candidates.sha256='0'.repeat(64); assert.throws(()=>prepare(f),/hash/);
  f=civicImportFixture(); f.manifest.synthetic=false; assert.throws(()=>prepare(f),/provenance/);
  f=civicImportFixture(); f.candidateRows[0].HH_GERACAO='13:00:00';updateCandidates(f);assert.throws(()=>prepare(f),/generation/);
});
test('B02 keeps homonyms separate and excludes other elections, turns and UFs without game filtering', () => {
  const f=civicImportFixture();
  f.candidateRows.push({...f.candidateRows[0],SQ_CANDIDATO:'99',SG_UE:'RJ'},{...f.candidateRows[0],SQ_CANDIDATO:'98',NR_TURNO:'2'},{...f.candidateRows[0],SQ_CANDIDATO:'97',CD_ELEICAO:'998'});updateCandidates(f);
  const batch=prepare(f);assert.equal(batch.dataset.records.candidacies.length,4);assert.equal(new Set(batch.dataset.records.persons.map(p=>p.id)).size,9);
});
test('B02 official federal/state election codes remain distinct even when sequentials repeat', () => {
  const f=civicImportFixture();f.manifest.electionKeys.SP='888';
  for(const r of f.candidateRows)if(r.SG_UE==='SP'){r.CD_ELEICAO='888';if(r.SQ_CANDIDATO==='21')r.SQ_CANDIDATO='11';if(r.SQ_CANDIDATO==='22')r.SQ_CANDIDATO='12';}
  for(const r of f.vacancyRows)if(r.SG_UE==='SP')r.CD_ELEICAO='888';
  for(const r of f.relations)if(['21','31'].includes(r.holderKey)){r.electionKey='888';if(r.holderKey==='21'){r.holderKey='11';r.members=[{sourceKey:'12'}];}}
  updateCandidates(f);f.vacancies=encodeCsv(vacancyHeader,f.vacancyRows);f.manifest.vacancies.sha256=sha256(f.vacancies);
  const b=prepare(f);assert.equal(b.report.complete,true);assert.equal(b.dataset.records.elections.length,2);assert.equal(b.dataset.records.candidacies.filter(c=>c.sourceKey==='11').length,2);assert.equal(new Set(b.dataset.records.candidacies.map(c=>c.id)).size,4);
});
test('B02 complementary detail and replacement reference preserve source terminology without inferring ticket dates', () => {
  const f=civicImportFixture();const rows=f.candidateRows.map(r=>({...r,DS_DETALHE_SITUACAO_CAND:'#NE',DS_SITUACAO_JULGAMENTO:'DEFERIDO COM RECURSO',SQ_SUBSTITUIDO:r.SQ_CANDIDATO==='22'?'23':'-1'}));
  f.complementary=encodeCsv(['DT_GERACAO','HH_GERACAO','ANO_ELEICAO','CD_ELEICAO','SQ_CANDIDATO','DS_DETALHE_SITUACAO_CAND','DS_SITUACAO_JULGAMENTO','SQ_SUBSTITUIDO'],rows);
  f.manifest.complementary={...f.manifest.candidates,url:'https://example.test/complementary',locator:'complementary.csv',sha256:sha256(f.complementary)};
  for(const row of f.candidateRows)row.DS_SITUACAO_CANDIDATURA='#NE';updateCandidates(f);
  const b=prepare(f);assert.equal(b.report.complete,true);assert.ok(b.dataset.records.candidacies.every(c=>c.officialStatus==='DEFERIDO COM RECURSO'));assert.equal(b.report.substitutions.length,1);assert.equal(b.report.substitutions[0].legalTicketIntervalInferred,false);
  f.manifest.complementary.sourceAt='2032-08-01T14:00:00.000Z';assert.throws(()=>prepare(f),/share generation/);
});
test('B02 all conflicting sequential occurrences are quarantined, never first-row-wins', () => {
  const f=civicImportFixture();f.candidateRows.push({...f.candidateRows[0],NM_CANDIDATO:'Conflito sintético'});updateCandidates(f);
  const b=prepare(f);assert.equal(b.report.complete,false);assert.equal(b.dataset.records.candidacies.some(c=>c.sourceKey==='11'),false);
  assert.equal(b.report.counts['BR:president'].observed,2);assert.equal(b.report.counts['BR:president'].quarantined,1);assert.ok(b.report.quarantine.some(q=>q.code==='duplicate_sequential'));
});
test('B02 invalid primary fields preserve a counted exception while optional member ballot fields are not required', () => {
  const f=civicImportFixture();f.candidateRows[0].DS_SITUACAO_CANDIDATURA='#NULO#';f.candidateRows[1].NR_CANDIDATO='#NULO#';f.candidateRows[1].NM_URNA_CANDIDATO='#NULO#';updateCandidates(f);
  const b=prepare(f);assert.equal(b.report.counts['BR:president'].observed,2);assert.equal(b.report.counts['BR:president'].quarantined,1);assert.ok(b.dataset.records.persons.some(p=>p.id.endsWith(':12')));
});
test('B02 missing composition stays explicit without party matching or invented legal validity', () => {
  const f=civicImportFixture();f.relations=[];const b=prepare(f);assert.equal(b.report.complete,false);assert.equal(b.dataset.records.tickets.length,0);assert.equal(b.report.gaps.length,4);
  assert.equal(b.report.counts['SP:senator'].imported,1);assert.equal(b.report.counts['SP:senator'].reconciled,0);
});
test('B02 rejects swapped substitute order, foreign jurisdiction members and missing validity evidence', () => {
  for(const mutate of [f=>f.relations[3].members.reverse(),f=>f.candidateRows[1].SG_UE='SP',f=>delete f.relations[0].validFrom]) {
    const f=civicImportFixture();mutate(f);updateCandidates(f);const b=prepare(f);assert.equal(b.report.complete,false);assert.ok(b.report.gaps.length>0);
  }
});
test('B02 preserves adjacent ticket history, rejects overlap and keeps historical member identity', () => {
  const f=civicImportFixture(), first=f.relations[0];f.candidateRows.push({...f.candidateRows[1],SQ_CANDIDATO:'15'});updateCandidates(f);first.validTo='2032-07-15T12:00:00.000Z';f.relations.push({...first,validFrom:first.validTo,validTo:null,members:[{sourceKey:'15'}],evidence:{...first.evidence,locator:'Explicit synthetic replacement'}});
  let b=prepare(f);assert.equal(b.report.complete,true);assert.equal(b.dataset.records.tickets.length,5);
  const oldMember=b.dataset.records.members.find(m=>m.role==='vice'&&m.personId.endsWith(':12'));assert.ok(oldMember);
  f.relations.at(-1).validFrom='2032-07-14T12:00:00.000Z';b=prepare(f);assert.equal(b.report.complete,false);assert.ok(b.report.gaps.some(g=>g.code.includes('overlapping')));
});
test('B02 vacancies come from source and duplicate/missing official configurations fail the batch', () => {
  const f=civicImportFixture();f.vacancyRows[2].QT_VAGA='1';f.vacancies=encodeCsv(vacancyHeader,f.vacancyRows);f.manifest.vacancies.sha256=sha256(f.vacancies);assert.equal(prepare(f).dataset.records.contests.find(c=>c.office==='senator').vacancies,1);
  f.vacancyRows.push(f.vacancyRows[2]);f.vacancies=encodeCsv(vacancyHeader,f.vacancyRows);f.manifest.vacancies.sha256=sha256(f.vacancies);assert.throws(()=>prepare(f),/Ambiguous/);
});
test('B02 independently dated denominators are mandatory for reconciliation, never derive completeness from imported count', () => {
  let f=civicImportFixture();delete f.manifest.officialCounts;let b=prepare(f);assert.equal(b.report.complete,false);assert.equal(b.report.counts['BR:president'].official,null);
  f=civicImportFixture();f.manifest.officialCounts.totals['BR:president']=3;b=prepare(f);assert.equal(b.report.complete,false);
  f.manifest.officialCounts.sourceAt='2032-08-02T15:00:00.000Z';assert.throws(()=>prepare(f),/denominators/);
});
test('B02 a vice linked to overlapping different holders quarantines both without choosing one', () => {
  const f=civicImportFixture();f.relations[1].members=[{sourceKey:'12'}];const b=prepare(f);assert.equal(b.report.complete,false);assert.equal(b.report.gaps.filter(g=>g.code==='member_linked_to_overlapping_holders').length,2);assert.equal(b.report.counts['BR:president'].reconciled,0);
});
test('B02 malformed relation members become explicit gaps instead of crashing or linking by party', () => {
  const f=civicImportFixture();f.relations[0].members=[null];const b=prepare(f);assert.equal(b.report.complete,false);assert.equal(b.report.gaps.length,1);
});
test('B02 observed explicit links with unknown legal dates never fabricate a B01 ticket interval', () => {
  const f=civicImportFixture();for(const r of f.relations){r.validFrom=null;r.evidence.sourceAt=null;r.evidence.license=null;}
  const b=prepare(f);assert.equal(b.report.accounted,true);assert.equal(b.report.complete,false);assert.equal(b.report.observedRelationships.length,4);assert.equal(b.dataset.records.tickets.length,0);assert.equal(b.report.gaps.length,4);assert.ok(b.report.observedRelationships.every(r=>r.legalIntervalProvided===false&&r.evidence.sourceAt===null));
});
const mockDivulga = (mutate=()=>{}) => async url => {
  const parts=new URL(url).pathname.split('/'),ue=parts.at(-4),office=parts.at(-2),f=civicImportFixture();
  const candidates=f.candidateRows.filter(r=>r.SG_UE===ue&&r.CD_CARGO===office).map(row=>{
    const relation=f.relations.find(r=>r.holderKey===row.SQ_CANDIDATO);
    return {id:Number(row.SQ_CANDIDATO),cargo:{codigo:Number(office)},eleicao:{id:999},cpf:'NEVER-RETAIN-SYNTHETIC-PRIVATE',emails:['not-a-real-address'],dataDeNascimento:'not-a-real-birthday',vices:relation.members.map(member=>({sq_CANDIDATO:Number(member.sourceKey),sq_CANDIDATO_SUPERIOR:null,sq_ELEICAO:999,sg_UE:ue}))};
  });mutate(candidates);return Response.json({candidatos:candidates});
};
test('B02 Divulga adapter verifies all scopes, accepts explicit nesting with null parent field and minimizes private fields', async()=>{
  const f=civicImportFixture(),collection=await collectDivulgaPilot({year:2032,pilotUf:'SP',apiElectionKey:'999',fetchImpl:mockDivulga()});
  assert.equal(collection.projections.length,3);assert.equal(JSON.stringify(collection).includes('NEVER-RETAIN'),false);assert.equal(JSON.stringify(collection).includes('birthday'),false);assert.ok(collection.projections.every(p=>p.sourceAt===null));
  const relationships=divulgaRelationships(collection,f.candidateRows,f.manifest.electionKeys);assert.equal(relationships.length,4);assert.ok(relationships.every(r=>r.validFrom===null&&r.evidence.sourceAt===null&&r.evidence.license===null));
});
test('B02 Divulga adapter rejects conflicting parent, wrong election, wrong jurisdiction and unbounded selector', async()=>{
  for(const mutate of [cs=>cs[0].vices[0].sq_CANDIDATO_SUPERIOR=99999,cs=>cs[0].vices[0].sg_UE='RJ',cs=>cs[0].eleicao.id=998,cs=>cs.push(cs[0]),cs=>cs[0].vices.push(cs[0].vices[0])])await assert.rejects(collectDivulgaPilot({year:2032,pilotUf:'SP',apiElectionKey:'999',fetchImpl:mockDivulga(mutate)}));
  await assert.rejects(collectDivulgaPilot({year:2032,pilotUf:'ZZ',apiElectionKey:'999',fetchImpl:mockDivulga()}));
  await assert.rejects(collectDivulgaPilot({year:2032,pilotUf:'SP',apiElectionKey:'999',fetchImpl:async()=>new Response('denied',{status:403})}),/HTTP 403/);
});
test('B02 source-pinned transformation identity changes when projected records change', () => {
  const f=civicImportFixture(),first=prepare(f);f.candidateRows[0].NM_CANDIDATO='Nome público sintético corrigido';updateCandidates(f);const second=prepare(f);assert.notEqual(first.report.transformedRecordsSha256,second.report.transformedRecordsSha256);assert.notEqual(first.batchId,second.batchId);
});
test('B02 relationship recollection time does not duplicate historical identities or a batch', () => {
  const f=civicImportFixture(), b=prepare(f);f.relations[0].evidence.fetchedAt='2032-08-01T17:00:00.000Z';const next=prepare(f);assert.equal(next.batchId,b.batchId);assert.deepEqual(next.dataset.records.tickets.map(t=>t.id),b.dataset.records.tickets.map(t=>t.id));
});
test('B02 repeat acquisition time is idempotent but provenance and different election change identity', () => {
  const f=civicImportFixture(), b=prepare(f);f.manifest.candidates.fetchedAt='2032-08-01T17:00:00.000Z';assert.equal(prepare(f).batchId,b.batchId);
  f.manifest.candidates.license='Changed synthetic license';assert.notEqual(prepare(f).batchId,b.batchId);
});
test('B02 diff reports changes and missing records without automatic deletion', () => {
  const f=civicImportFixture(), b=prepare(f);f.candidateRows[0].SG_PARTIDO='ALTERADO';f.candidateRows=f.candidateRows.filter(r=>r.SQ_CANDIDATO!=='13');updateCandidates(f);
  const diff=importDiff(b,prepare(f));assert.equal(diff.changed.length,1);assert.equal(diff.missingFromNewBatch.length,1);assert.equal(diff.automaticDeletion,false);
});
test('B02 append-only snapshots retain last reconciled load across partial loads and idempotent retry', async()=>withDirectory(async dir=>{
  const f=civicImportFixture(), b=prepare(f);let r=await saveCivicImport(dir,b);assert.equal(r.state.lastReconciledBatch,b.batchId);
  r=await saveCivicImport(dir,b);assert.equal(r.repeated,true);assert.equal((await readdir(join(dir,'batches'))).length,1);
  f.relations=[];const partial=prepare(f);r=await saveCivicImport(dir,partial);assert.equal(r.state.lastReconciledBatch,b.batchId);assert.equal(r.state.latestBatch,partial.batchId);
  assert.equal((await readdir(join(dir,'batches'))).length,2);assert.equal(JSON.parse(await readFile(join(dir,'batches',b.batchId+'.json'),'utf8')).dataset.records.members.length,9);
}));
test('B02 process lock, older generation and wrong pilot refuse writes without modifying previous state', async()=>withDirectory(async dir=>{
  const f=civicImportFixture();await saveCivicImport(dir,prepare(f));const before=await readFile(join(dir,'state.json'),'utf8');
  await writeFile(join(dir,'.import.lock'),'occupied');await assert.rejects(saveCivicImport(dir,prepare(f)),{code:'EEXIST'});await unlink(join(dir,'.import.lock'));
  const older=prepare(f);older.report.sourceAt='2032-07-31T15:00:00.000Z';await assert.rejects(saveCivicImport(dir,older),/Older/);
  const wrong=prepare(f);wrong.pilotUf='RJ';await assert.rejects(saveCivicImport(dir,wrong),/boundary/);assert.equal(await readFile(join(dir,'state.json'),'utf8'),before);
}));
test('B02 bounded acquisition rejects HTTP errors, HTML, oversized/truncated response and checksum mismatch', async()=>withDirectory(async dir=>{
  const destination=join(dir,'source.zip');await writeFile(destination,'last-valid-file');
  const zip=Buffer.from([0x50,0x4b,0x03,0x04,1]);
  for(const options of [ {fetchImpl:async()=>new Response('denied',{status:403})},{fetchImpl:async()=>new Response('<html>error</html>')},{fetchImpl:async()=>new Response(zip),maxBytes:4},{fetchImpl:async()=>new Response(zip,{headers:{'content-length':'99'}})},{fetchImpl:async()=>new Response(zip),expectedSha256:'0'.repeat(64)} ]) {
    await assert.rejects(acquireOfficialArchive({kind:'candidates',year:2032,destination,...options}));assert.equal(await readFile(destination,'utf8'),'last-valid-file');
  }
  assert.deepEqual(await readdir(dir),['source.zip']);assert.throws(()=>officialArchiveUrl('injected',2032));
}));
test('B02 successful acquisition uses exact official URL, refuses redirects and pins received hash', async()=>withDirectory(async dir=>{
  const zip=Buffer.from([0x50,0x4b,0x03,0x04,1]);let seen;
  const r=await acquireOfficialArchive({kind:'vacancies',year:2032,destination:join(dir,'source.zip'),expectedSha256:sha256(zip),fetchImpl:async(url,options)=>{seen={url,options};return new Response(zip);}});
  assert.equal(seen.url,officialArchiveUrl('vacancies',2032));assert.equal(seen.options.redirect,'error');assert.equal(r.sha256,sha256(zip));
}));
test('B02 actual CLI persists synthetic staging and a repeated invocation does not duplicate it', async()=>withDirectory(async dir=>{
  const f=civicImportFixture();f.manifest.candidates.path='candidates.csv';f.manifest.vacancies.path='vacancies.csv';f.manifest.relationsPath='relations.json';
  await writeFile(join(dir,'candidates.csv'),f.candidates);await writeFile(join(dir,'vacancies.csv'),f.vacancies);await writeFile(join(dir,'relations.json'),JSON.stringify(f.relations));await writeFile(join(dir,'manifest.json'),JSON.stringify(f.manifest));
  const execute=()=>promisify(execFile)(process.execPath,[importScript,join(dir,'manifest.json'),join(dir,'staging')]);
  const first=JSON.parse((await execute()).stdout),second=JSON.parse((await execute()).stdout);assert.equal(first.complete,true);assert.equal(second.repeated,true);assert.equal(second.publication,'staging_only');assert.equal(second.synthetic,true);
  const before=await readFile(join(dir,'staging','state.json'),'utf8');await writeFile(join(dir,'candidates.csv'),'truncated');await assert.rejects(execute());assert.equal(await readFile(join(dir,'staging','state.json'),'utf8'),before);
}));
test('B02 actual Python ZIP reader validates CRC and extracts only an exact flat selected member', async()=>withDirectory(async dir=>{
  const python=process.env.CIVIC_PYTHON || (process.platform==='win32'?'python':'python3');
  const archive=join(dir,'source.zip'),target=join(dir,'selected.csv'),script=unzipScript;
  await promisify(execFile)(python,['-c','import zipfile,sys\nwith zipfile.ZipFile(sys.argv[1],"w") as z:\n z.writestr("selected.csv",b"A\\nx\\n")\n z.writestr("../unused.csv",b"ignored")',archive]);
  const result=await promisify(execFile)(python,[script,archive,'selected.csv',target]);assert.equal(JSON.parse(result.stdout).crcVerified,true);assert.equal(await readFile(target,'utf8'),'A\nx\n');
  await assert.rejects(promisify(execFile)(python,[script,archive,'../unused.csv',join(dir,'unsafe.csv')]));
  await assert.rejects(promisify(execFile)(python,[script,archive,'missing.csv',join(dir,'missing.csv')]));
  await assert.rejects(promisify(execFile)(python,[script,archive,'selected.csv',target]));
}));
test('B02 actual Python ZIP reader rejects duplicate members and compression bombs', async()=>withDirectory(async dir=>{
  const python=process.env.CIVIC_PYTHON || (process.platform==='win32'?'python':'python3'),script=unzipScript;
  for(const mode of ['duplicate','bomb']) {
    const archive=join(dir,mode+'.zip'),target=join(dir,mode+'.csv');
    await promisify(execFile)(python,['-c','import zipfile,sys\nwith zipfile.ZipFile(sys.argv[1],"w",compression=zipfile.ZIP_DEFLATED) as z:\n z.writestr("selected.csv",b"a"*1048576 if sys.argv[2]=="bomb" else b"A\\nx\\n")\n if sys.argv[2]=="duplicate": z.writestr("selected.csv",b"A\\ny\\n")',archive,mode]);
    await assert.rejects(promisify(execFile)(python,[script,archive,'selected.csv',target]));assert.equal((await readdir(dir)).includes(mode+'.csv'),false);
  }
}));
test('B02 corrupt ZIP CRC leaves no extracted partial CSV', async()=>withDirectory(async dir=>{
  const python=process.env.CIVIC_PYTHON || (process.platform==='win32'?'python':'python3'),archive=join(dir,'bad.zip'),target=join(dir,'bad.csv');
  await promisify(execFile)(python,['-c','import zipfile,sys\nwith zipfile.ZipFile(sys.argv[1],"w") as z: z.writestr("selected.csv",b"A\\nx\\n")\np=bytearray(open(sys.argv[1],"rb").read());p[30+len("selected.csv")]^=1;open(sys.argv[1],"wb").write(p)',archive]);
  await assert.rejects(promisify(execFile)(python,[unzipScript,archive,'selected.csv',target]));assert.deepEqual(await readdir(dir),['bad.zip']);
}));
