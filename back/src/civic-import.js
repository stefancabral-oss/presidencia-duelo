// B02 staging only: no game registry, database writes or publication authority.
import { createHash } from 'node:crypto';
import { CIVIC_RECORDS, UFS, candidacyId, validateCivicDataset } from '../../shared/civic-contract.js';

export class CivicImportError extends Error {
  constructor(message) { super(message); this.name = 'CivicImportError'; this.code = 'CIVIC_IMPORT_INVALID'; }
}
const fail = message => { throw new CivicImportError(message); };
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const offices = new Map([['1','president'], ['3','governor'], ['5','senator']]);
const roles = new Map([['1',['holder',0]],['3',['holder',0]],['5',['holder',0]],['2',['vice',1]],['4',['vice',1]],['9',['substitute',1]],['10',['substitute',2]]]);
const candidateFields = ['DT_GERACAO','HH_GERACAO','ANO_ELEICAO','CD_ELEICAO','NR_TURNO','SG_UE','CD_CARGO','SQ_CANDIDATO','NM_CANDIDATO','NM_URNA_CANDIDATO','NR_CANDIDATO','SG_PARTIDO'];
const vacancyFields = ['DT_GERACAO','HH_GERACAO','ANO_ELEICAO','CD_ELEICAO','SG_UE','CD_CARGO','QT_VAGA'];
const complementaryFields = ['DT_GERACAO','HH_GERACAO','ANO_ELEICAO','CD_ELEICAO','SQ_CANDIDATO','DS_SITUACAO_JULGAMENTO'];
const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const clean = value => typeof value === 'string' && value.trim() && !value.includes('\0') && value.length <= 1000;
const digits = value => typeof value === 'string' && /^\d{1,32}$/.test(value);
const scoped = (ue, cargo, uf) => (ue === 'BR' && ['1','2'].includes(cargo)) || (ue === uf && ['3','4','5','9','10'].includes(cargo));

// Delimited input is strict about quoting and width; never silently drops a row.
export function parseTseCsv(bytes, { required = [], encoding, maxBytes = 128 * 1024 * 1024, maxRows = 100000 } = {}) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > maxBytes) fail('CSV byte limit');
  // Acquisition inspection defaults to the legacy profile; real import pins encoding.
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  encoding ??= bom ? 'utf8' : 'latin1';
  if (!['utf8','latin1','windows-1252'].includes(encoding)) fail('CSV encoding profile');
  const text = encoding === 'latin1' ? Buffer.from(bytes).toString('latin1') : new TextDecoder(encoding === 'utf8' ? 'utf-8' : 'windows-1252', { fatal:true }).decode(bytes).replace(/^\uFEFF/,'');
  if (text.includes('\0') || !text.endsWith('\n')) fail('CSV must end with a complete line');
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  const field = () => { row.push(cell); cell = ''; closed = false; };
  const finish = () => { field(); if (!(row.length === 1 && row[0] === '')) rows.push(row); row = []; if (rows.length > maxRows + 1) fail('CSV row limit'); };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === '"') { if (cell || closed) fail('CSV misplaced quote'); quoted = true; }
    else if (c === ';') field();
    else if (c === '\n') finish();
    else if (c === '\r' && text[i + 1] === '\n') { /* CRLF */ }
    else { if (closed) fail('CSV characters after quote'); cell += c; }
    if (cell.length > 65536) fail('CSV field limit');
  }
  if (quoted || cell || row.length) fail('CSV truncated record');
  const header = rows.shift();
  if (!header || header.length > 200 || new Set(header).size !== header.length || header.some(x => !/^[A-Z][A-Z0-9_]*$/.test(x))) fail('CSV header');
  if (required.some(x => !header.includes(x))) fail('CSV required column missing');
  return rows.map((cells, index) => { if (cells.length !== header.length) fail(`CSV width at record ${index + 2}`); return Object.fromEntries(header.map((key, i) => [key, cells[i]])); });
}

// Export generation is a source reference, never a legal ticket validity date.
export function tseGeneration(date, time) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date) || !/^\d{2}:\d{2}:\d{2}$/.test(time)) fail('TSE generation format');
  const [day, month, year] = date.split('/');
  const local = `${year}-${month}-${day}T${time}`;
  const parsed = new Date(`${local}-03:00`);
  if (!Number.isFinite(parsed.valueOf()) || new Date(parsed.valueOf() - 10800000).toISOString().slice(0,19) !== local) fail('TSE generation calendar');
  // This profile is deliberately scoped to 2026+, when São Paulo is UTC-03.
  if (Number(year) < 2026) fail('Historical timezone needs a separate reviewed profile');
  return parsed.toISOString();
}

function officialUrl(url) {
  try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password && !u.port && (u.hostname === 'tse.jus.br' || u.hostname.endsWith('.tse.jus.br')); } catch { return false; }
}
function artifactSource(kind, bytes, meta, synthetic) {
  const acceptableUrl = synthetic ? typeof meta?.url === 'string' && /^https:\/\/example\.test\//.test(meta.url) : officialUrl(meta?.url);
  if (!meta || !acceptableUrl || !clean(meta.locator) || !clean(meta.license) || !instant(meta.sourceAt) || !instant(meta.fetchedAt) || meta.fetchedAt < meta.sourceAt || !/^[a-f0-9]{64}$/.test(meta.sha256) || meta.sha256 !== sha256(bytes)) fail(`${kind} provenance/hash`);
  return { id: `tse:${kind}:${meta.sha256}`, url: meta.url, publisher: synthetic ? 'Synthetic test fixture' : 'Tribunal Superior Eleitoral', kind: synthetic ? 'synthetic' : 'official', locator: meta.locator, sourceAt: meta.sourceAt, fetchedAt: meta.fetchedAt, generation: meta.sha256, license: meta.license, access: 'open', collectionState: 'collected', lastError: null };
}

export function prepareCivicImport({ candidates, vacancies, complementary, manifest, relations = [] }) {
  if (!manifest || manifest.version !== 1 || !Number.isSafeInteger(manifest.year) || manifest.year < 2026 || manifest.year > 2100 || !UFS.includes(manifest.pilotUf) || (manifest.synthetic !== undefined && typeof manifest.synthetic !== 'boolean')) fail('Manifest election/pilot');
  const synthetic = manifest.synthetic === true;
  const electionKeys = manifest.electionKeys ?? (synthetic && digits(manifest.electionKey) ? {BR:manifest.electionKey,[manifest.pilotUf]:manifest.electionKey} : null);
  if (!electionKeys || !digits(electionKeys.BR) || !digits(electionKeys[manifest.pilotUf]) || Object.keys(electionKeys).some(k=>!['BR',manifest.pilotUf].includes(k))) fail('Official election codes per jurisdiction');
  if (![manifest.candidates?.encoding,manifest.vacancies?.encoding].every(e=>['utf8','latin1','windows-1252'].includes(e))) fail('Pinned CSV encoding required');
  const candidateSource = artifactSource('candidates', candidates, manifest.candidates, synthetic);
  const vacancySource = artifactSource('vacancies', vacancies, manifest.vacancies, synthetic);
  if (!synthetic && (candidateSource.url !== `https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_${manifest.year}.zip` || vacancySource.url !== `https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_vagas/consulta_vagas_${manifest.year}.zip`)) fail('Artifact URL does not match official election resource');
  const electionId = `tse:${manifest.year}:${[...new Set(Object.values(electionKeys))].sort().join('+')}`;
  const recordElectionId = key => `tse:${manifest.year}:${key}`;
  const rowKey = row => `${row.CD_ELEICAO}:${row.SQ_CANDIDATO}`;
  const records = Object.fromEntries(Object.keys(CIVIC_RECORDS).map(k => [k, []]));
  records.sources.push(candidateSource, vacancySource);
  for (const key of new Set(Object.values(electionKeys))) records.elections.push({ id: recordElectionId(key), year: manifest.year, sourceId: candidateSource.id });
  const quarantine = [], gaps = [], observedRelationships = [], byKey = new Map(), contests = new Map();
  const scopeKeys = ['BR:president', `${manifest.pilotUf}:governor`, `${manifest.pilotUf}:senator`];
  const counts = Object.fromEntries(scopeKeys.map(key => [key, { official: null, observed: 0, imported: 0, reconciled: 0, quarantined: 0, compositionPending: 0 }]));
  const matchesElection = row => row.ANO_ELEICAO === String(manifest.year) && row.CD_ELEICAO === electionKeys[row.SG_UE];
  const generationMatches = (row, source) => tseGeneration(row.DT_GERACAO, row.HH_GERACAO) === source.sourceAt;
  for (const row of parseTseCsv(vacancies, { required: vacancyFields, encoding:manifest.vacancies.encoding })) {
    if (!matchesElection(row) || !offices.has(row.CD_CARGO) || !scoped(row.SG_UE, row.CD_CARGO, manifest.pilotUf)) continue;
    const key = `${row.SG_UE}:${offices.get(row.CD_CARGO)}`;
    if (!generationMatches(row, vacancySource) || !digits(row.QT_VAGA) || Number(row.QT_VAGA) < 1 || !Number.isSafeInteger(Number(row.QT_VAGA)) || contests.has(key)) fail(`Ambiguous or invalid official vacancies: ${key}`);
    const actualElectionId = recordElectionId(row.CD_ELEICAO);
    const contest = { id: `${actualElectionId}:${key}`, electionId:actualElectionId, office: offices.get(row.CD_CARGO), jurisdiction: row.SG_UE, vacancies: Number(row.QT_VAGA), sourceId: vacancySource.id };
    contests.set(key, contest); records.contests.push(contest);
  }
  if (scopeKeys.some(key => !contests.has(key))) fail('Pilot official vacancy scope incomplete');
  const detailByKey = new Map(); let complementarySource = null, statusSource = candidateSource;
  if (complementary !== undefined) {
    if (!['utf8','latin1','windows-1252'].includes(manifest.complementary?.encoding)) fail('Pinned complementary encoding required');
    complementarySource = artifactSource('complementary',complementary,manifest.complementary,synthetic);
    if (!synthetic && complementarySource.url !== `https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand_complementar/consulta_cand_complementar_${manifest.year}.zip`) fail('Complementary official election resource');
    if (complementarySource.sourceAt !== candidateSource.sourceAt) fail('Complementary and candidates must share generation');
    records.sources.push(complementarySource);
    for (const row of parseTseCsv(complementary,{required:complementaryFields,encoding:manifest.complementary.encoding})) {
      if (row.ANO_ELEICAO !== String(manifest.year) || !Object.values(electionKeys).includes(row.CD_ELEICAO)) continue;
      if (!generationMatches(row,complementarySource)) fail('Mixed complementary generation');
      if (!digits(row.SQ_CANDIDATO)) continue;
      const key=rowKey(row);if(detailByKey.has(key)) fail('Ambiguous complementary sequential');detailByKey.set(key,row);
    }
    const id=sha256(candidateSource.generation+complementarySource.generation);
    statusSource={...candidateSource,id:`tse:combined:${id}`,url:synthetic?'https://example.test/combined':`https://dadosabertos.tse.jus.br/dataset/candidatos-${manifest.year}`,locator:`${candidateSource.locator} sha256=${candidateSource.generation}; ${complementarySource.locator} sha256=${complementarySource.generation}`,generation:id,fetchedAt:candidateSource.fetchedAt>complementarySource.fetchedAt?candidateSource.fetchedAt:complementarySource.fetchedAt};records.sources.push(statusSource);
  } else if (!synthetic) fail('Official detailed registration status requires complementary artifact');
  const rows = parseTseCsv(candidates, { required: candidateFields, encoding:manifest.candidates.encoding });
  // Duplicate sequentials quarantine ALL occurrences, including conflicting rows.
  const grouped = new Map();
  for (const row of rows) {
    if (!matchesElection(row) || row.NR_TURNO !== '1' || !scoped(row.SG_UE, row.CD_CARGO, manifest.pilotUf)) continue;
    if (!generationMatches(row, candidateSource)) fail('Mixed/invalid candidate generation');
    const key = row.SQ_CANDIDATO;
    if (!digits(key)) { quarantine.push({ sourceKey: null, scope: row.SG_UE, code: 'invalid_sequential' }); if (offices.has(row.CD_CARGO)) { const c = counts[`${row.SG_UE}:${offices.get(row.CD_CARGO)}`]; c.observed++; c.quarantined++; } continue; }
    const identity=rowKey(row);if (!grouped.has(identity)) grouped.set(identity, []);
    grouped.get(identity).push(row);
  }
  for (const [identity, group] of grouped) {
    const key=group[0].SQ_CANDIDATO;
    const affected = new Set(group.filter(r => offices.has(r.CD_CARGO)).map(r => `${r.SG_UE}:${offices.get(r.CD_CARGO)}`));
    for (const scope of affected) counts[scope].observed++;
    if (group.length > 1) { quarantine.push({ sourceKey: key, scope: [...affected].join(',') || 'member', code: 'duplicate_sequential' }); for (const scope of affected) counts[scope].quarantined++; continue; }
    const row = group[0], primary = offices.has(row.CD_CARGO), scope = `${row.SG_UE}:${offices.get(row.CD_CARGO)}`;
    const detailRow=detailByKey.get(identity);
    const statusValue=complementarySource?detailRow?.DS_SITUACAO_JULGAMENTO:row.DS_SITUACAO_CANDIDATURA;
    const invalidStatus=!clean(statusValue)||statusValue.startsWith('#');
    if (!clean(row.NM_CANDIDATO) || row.NM_CANDIDATO.startsWith('#') || row.NM_CANDIDATO==='NÃO DIVULGÁVEL' || (primary && (!clean(row.NM_URNA_CANDIDATO) || row.NM_URNA_CANDIDATO.startsWith('#') || !digits(row.NR_CANDIDATO) || invalidStatus))) {
      quarantine.push({ sourceKey: key, scope: primary ? scope : 'member', code: 'invalid_public_fields' }); if (primary) counts[scope].quarantined++; continue;
    }
    const actualElectionId=recordElectionId(row.CD_ELEICAO),personId = `${actualElectionId}:person:${key}`;
    records.persons.push({ id: personId, displayName: row.NM_CANDIDATO.trim(), sourceId: candidateSource.id, gameCandidateId: null, gameLinkReview: 'none' });
    byKey.set(identity, { row, personId });
    if (primary) {
      const detailValue=complementarySource?null:row.DS_DETALHE_SITUACAO_CAND;
      const detail = clean(detailValue) && !detailValue.startsWith('#') ? ` / ${detailValue}` : '';
      records.candidacies.push({ id: candidacyId(actualElectionId, row.SG_UE, offices.get(row.CD_CARGO), key), contestId: contests.get(scope).id, sourceKey: key, personId, ballotName: row.NM_URNA_CANDIDATO.trim(), ballotNumber: row.NR_CANDIDATO, party: clean(row.SG_PARTIDO) && !row.SG_PARTIDO.startsWith('#') ? row.SG_PARTIDO : null, officialStatus: statusValue + detail, statusAt: statusSource.sourceAt, sourceId: statusSource.id, review: 'pending', publication: 'draft', revision: 1, updatedAt: statusSource.fetchedAt });
      counts[scope].imported++;
    }
  }
  if (!Array.isArray(relations) || relations.length > 100000) fail('Relations limit/type');
  const relationGroups = new Map();
  const relationKey=r=>`${r.electionKey}:${r.holderKey}`;
  for (const relation of relations) { if (!relation || !digits(relation.holderKey) || !digits(relation.electionKey)) fail('Relation election/holder');const key=relationKey(relation);if (!relationGroups.has(key)) relationGroups.set(key, []); relationGroups.get(key).push(relation); }
  const memberUses = new Map(), conflictingHolders = new Set();
  for (const relation of relations) {
    if (!instant(relation.validFrom) || !(relation.validTo === null || instant(relation.validTo)) || !Array.isArray(relation.members)) continue;
    for (const member of relation.members) {
      if (!member || !digits(member.sourceKey)) continue;
      const key=`${relation.electionKey}:${member.sourceKey}`,uses = memberUses.get(key) || [];
      uses.push(relation); memberUses.set(key,uses);
    }
  }
  for (const uses of memberUses.values()) {
    uses.sort((a,b) => a.validFrom.localeCompare(b.validFrom));
    let owners = new Set(), end;
    const finish = () => { if (owners.size > 1) for (const owner of owners) conflictingHolders.add(owner); };
    for (const use of uses) {
      if (end !== undefined && end !== null && use.validFrom >= end) { finish(); owners = new Set(); end = undefined; }
      owners.add(relationKey(use));
      if (end === undefined) end = use.validTo;
      else if (end !== null) end = use.validTo === null ? null : end > use.validTo ? end : use.validTo;
    }
    finish();
  }
  for (const candidacy of records.candidacies) {
    const contest = records.contests.find(c => c.id === candidacy.contestId),scope = `${contest.jurisdiction}:${contest.office}`,identity=`${electionKeys[contest.jurisdiction]}:${candidacy.sourceKey}`,holder = byKey.get(identity);
    const pending = code => { gaps.push({ candidacyId: candidacy.id, sourceKey: candidacy.sourceKey, scope, code }); counts[scope].compositionPending++; };
    const group = relationGroups.get(identity) || [];
    if (!group.length) { pending('explicit_relationship_and_legal_validity_missing'); continue; }
    if (conflictingHolders.has(identity)) { pending('member_linked_to_overlapping_holders'); continue; }
    const staged = []; let invalid = false, missingLegalValidity = false;
    for (const relation of group) {
      const evidence = relation.evidence;
      const evidenceUrl = synthetic ? /^https:\/\/example\.test\//.test(evidence?.url) : officialUrl(evidence?.url);
      if (!evidence || !evidenceUrl || !clean(evidence.locator) || !(evidence.license===null||clean(evidence.license)) || !(evidence.sourceAt===null||instant(evidence.sourceAt)) || !instant(evidence.fetchedAt) || (evidence.sourceAt!==null&&evidence.fetchedAt<evidence.sourceAt) || !Array.isArray(relation.members) || relation.members.some(m => !m || !digits(m.sourceKey)) || relation.members.length !== (contest.office === 'senator' ? 2 : 1)) { invalid = true; break; }
      const members = relation.members.map(member => ({ ...member, candidate: byKey.get(`${relation.electionKey}:${member.sourceKey}`) }));
      if (new Set(members.map(m => m.sourceKey)).size !== members.length || members.some((m, i) => !m.candidate || m.candidate.row.SG_UE !== holder.row.SG_UE || roles.get(m.candidate.row.CD_CARGO)?.[0] !== (contest.office === 'senator' ? 'substitute' : 'vice') || roles.get(m.candidate.row.CD_CARGO)?.[1] !== i + 1 || (contest.office === 'president' ? m.candidate.row.CD_CARGO !== '2' : contest.office === 'governor' ? m.candidate.row.CD_CARGO !== '4' : false))) { invalid = true; break; }
      observedRelationships.push({candidacyId:candidacy.id,holderSourceKey:candidacy.sourceKey,members:members.map((m,i)=>({sourceKey:m.sourceKey,role:contest.office==='senator'?'substitute':'vice',position:i+1})),evidence:{url:evidence.url,locator:evidence.locator,sourceAt:evidence.sourceAt,fetchedAt:evidence.fetchedAt,license:evidence.license},legalIntervalProvided:Boolean(instant(relation.validFrom)&&clean(evidence.license)&&instant(evidence.sourceAt))});
      if (!instant(relation.validFrom) || !clean(evidence.license) || !instant(evidence.sourceAt)) { missingLegalValidity = true; continue; }
      if (!(relation.validTo === null || (instant(relation.validTo) && relation.validTo > relation.validFrom))) { invalid=true;break; }
      const evidenceKey = { url:evidence.url,locator:evidence.locator,sourceAt:evidence.sourceAt,license:evidence.license };
      const identity = sha256(JSON.stringify({ candidacy: candidacy.id, from: relation.validFrom, to: relation.validTo, members: members.map(m => m.sourceKey), evidence:evidenceKey }));
      const sourceId = `tse:relationship:${identity}`;
      const source = { ...candidateSource, id: sourceId, url: evidence.url, locator: evidence.locator, sourceAt: evidence.sourceAt, fetchedAt:evidence.fetchedAt, license:evidence.license, generation: identity };
      const ticketId = `${candidacy.id}:ticket:${identity}`;
      staged.push({ source, ticket: { id: ticketId, candidacyId: candidacy.id, validFrom: relation.validFrom, validTo: relation.validTo, completeness: 'complete', sourceId }, members: [{ id: `${ticketId}:0`, ticketId, personId: holder.personId, role: 'holder', position: 0, sourceId }, ...members.map((m, i) => ({ id: `${ticketId}:${i+1}`, ticketId, personId: m.candidate.personId, role: contest.office === 'senator' ? 'substitute' : 'vice', position: i+1, sourceId }))] });
    }
    staged.sort((a,b) => a.ticket.validFrom.localeCompare(b.ticket.validFrom));
    if (staged.some((s,i) => i && (staged[i-1].ticket.validTo === null || staged[i-1].ticket.validTo > s.ticket.validFrom))) invalid = true;
    if (invalid) { pending('relationship_evidence_invalid_or_overlapping'); continue; }
    if (missingLegalValidity) { pending('explicit_relationship_observed_legal_validity_pending'); continue; }
    for (const s of staged) { records.sources.push(s.source); records.tickets.push(s.ticket); records.members.push(...s.members); }
    counts[scope].reconciled++;
  }
  const importedHolderKeys=new Set(records.candidacies.map(c=>`${electionKeys[records.contests.find(t=>t.id===c.contestId).jurisdiction]}:${c.sourceKey}`));
  for (const key of relationGroups.keys()) if (!importedHolderKeys.has(key)) quarantine.push({ sourceKey: key, scope: 'relationship', code: 'relationship_holder_missing' });
  const officialCounts = manifest.officialCounts;
  if (officialCounts !== undefined) {
    const countUrl = synthetic ? /^https:\/\/example\.test\//.test(officialCounts?.url) : officialUrl(officialCounts?.url);
    if (!officialCounts || !countUrl || !clean(officialCounts.locator) || !instant(officialCounts.sourceAt) || officialCounts.sourceAt !== candidateSource.sourceAt || !officialCounts.totals || scopeKeys.some(key => !Number.isSafeInteger(officialCounts.totals[key]) || officialCounts.totals[key] < 0) || Object.keys(officialCounts).some(k => !['url','locator','sourceAt','totals'].includes(k)) || Object.keys(officialCounts.totals).some(k => !scopeKeys.includes(k))) fail('Independent official denominators');
    for (const key of scopeKeys) counts[key].official = officialCounts.totals[key];
  }
  const dataset = { version: 1, synthetic, records };
  validateCivicDataset(dataset);
  const complete = quarantine.length === 0 && gaps.length === 0 && scopeKeys.every(key => counts[key].official !== null && counts[key].official > 0 && counts[key].official === counts[key].observed && counts[key].imported === counts[key].official && counts[key].reconciled === counts[key].official);
  const accounted=scopeKeys.every(key=>counts[key].official!==null&&counts[key].official===counts[key].observed&&counts[key].imported+counts[key].quarantined===counts[key].official);
  const provenanceKey = source => ({ url: source.url, locator: source.locator, sourceAt: source.sourceAt, generation: source.generation, license: source.license });
  const stableRelations = relations.map(r => ({ electionKey:r.electionKey,holderKey:r.holderKey,validFrom:r.validFrom,validTo:r.validTo,members:r.members?.map(m=>m?.sourceKey ?? null) ?? null,evidence:r.evidence ? {url:r.evidence.url,locator:r.evidence.locator,sourceAt:r.evidence.sourceAt,license:r.evidence.license}:null }));
  const encodings = {candidates:manifest.candidates.encoding,vacancies:manifest.vacancies.encoding};
  if(complementarySource)encodings.complementary=manifest.complementary.encoding;
  const transformedRecordsSha256=civicRecordDigest(records);
  const batchId = sha256(JSON.stringify({ transformVersion:1,transformedRecordsSha256,year: manifest.year, electionKeys, pilotUf: manifest.pilotUf, synthetic, candidates: provenanceKey(candidateSource), vacancies: provenanceKey(vacancySource), complementary:complementarySource?provenanceKey(complementarySource):null, encodings, relations:stableRelations, officialCounts: officialCounts ?? null }));
  const substitutions=[...detailByKey].filter(([key,r])=>byKey.has(key)&&digits(r.SQ_SUBSTITUIDO)).map(([key,r])=>({electionId:recordElectionId(r.CD_ELEICAO),sourceKey:r.SQ_CANDIDATO,substitutedSourceKey:r.SQ_SUBSTITUIDO,evidenceSourceId:complementarySource.id,legalTicketIntervalInferred:false}));
  return { version: 1, batchId, electionId, pilotUf: manifest.pilotUf, publication: 'staging_only', dataset, report: { complete, accounted, transformVersion:1,transformedRecordsSha256,counts, quarantine, gaps, observedRelationships, encodings, electionKeys, substitutions, denominators: officialCounts ?? null, sourceAt: candidateSource.sourceAt, omittedUfs: UFS.filter(uf => uf !== manifest.pilotUf), humanAcceptance: 'pending' } };
}

export function civicRecordDigest(records) {
  const semantic=Object.fromEntries(Object.entries(records).map(([kind,rows])=>[kind,rows.map(row=>Object.fromEntries(Object.entries(row).filter(([field])=>!['fetchedAt','updatedAt'].includes(field))))]));
  return sha256(JSON.stringify(semantic));
}

export function importDiff(previous, next) {
  const before = new Map((previous?.dataset.records.candidacies || []).map(c => [c.id, c]));
  const after = new Map(next.dataset.records.candidacies.map(c => [c.id, c]));
  const fields = ['ballotName','ballotNumber','party','officialStatus'];
  const oldPersons = new Map((previous?.dataset.records.persons || []).map(p=>[p.id,p.displayName]));
  const oldTickets = new Set((previous?.dataset.records.tickets || []).map(t=>t.id)), newTickets = new Set(next.dataset.records.tickets.map(t=>t.id));
  return { added: [...after.keys()].filter(id => !before.has(id)), changed: [...after].filter(([id,c]) => before.has(id) && fields.some(f => before.get(id)[f] !== c[f])).map(([id]) => id), personNamesChanged: next.dataset.records.persons.filter(p=>oldPersons.has(p.id)&&oldPersons.get(p.id)!==p.displayName).map(p=>p.id), compositionsAdded:[...newTickets].filter(id=>!oldTickets.has(id)), compositionsMissingFromNewBatch:[...oldTickets].filter(id=>!newTickets.has(id)), missingFromNewBatch: [...before.keys()].filter(id => !after.has(id)), automaticDeletion: false };
}
