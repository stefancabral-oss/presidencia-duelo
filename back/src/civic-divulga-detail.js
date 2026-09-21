import { CivicImportError, sha256 } from './civic-import.js';
import { UFS, validateCivicDataset } from '../../shared/civic-contract.js';

const fail = message => { throw new CivicImportError(message); };
const identifier = value => {
  if (typeof value === 'string' && /^[1-9]\d{0,31}$/.test(value)) return value;
  if (Number.isSafeInteger(value) && value > 0) return String(value);
  fail('Divulga detail identifier');
};
const text = value => {
  if (typeof value !== 'string' || !value.trim() || value.length > 256 || /[\x00-\x1f]/.test(value)) fail('Divulga detail text');
  return value.trim();
};
const roles = new Map([['1','president'],['2','vice'],['3','governor'],['4','vice'],['5','senator'],['9','substitute'],['10','substitute']]);
const officeCodes = { president:'1', governor:'3', senator:'5' };
const processNumber = value => {
  if (value === null || value === undefined || value === '' || value === '0' || value === 0) return null;
  if (typeof value !== 'string' || !/^\d{20}$/.test(value)) fail('Divulga process number');
  return value;
};
export const publicProcessUrl = number => {
  number = processNumber(number);
  if (number === null) return null;
  const formatted = `${number.slice(0,7)}-${number.slice(7,9)}.${number.slice(9,13)}.${number.slice(13,14)}.${number.slice(14,16)}.${number.slice(16)}`;
  return `https://consultaunificadapje.tse.jus.br/#/public/resultado/${formatted}`;
};

// Dates here are origin-local strings, not legal effects or UTC instants.
// The detail DTO supplies no timezone; retaining that uncertainty prevents a
// collection/update timestamp from silently becoming a chapa validity date.
const originUpdate = value => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) fail('Divulga origin update profile');
  const iso = value.replace(' ','T') + ':00.000Z';
  if (!Number.isFinite(Date.parse(iso)) || new Date(iso).toISOString() !== iso) fail('Divulga origin update date');
  return { value, precision:'minute', timezone:null, meaning:'record_updated_at', legalValidityInferred:false };
};

export async function readDivulgaJson(response, maxBytes = 8 * 1024 * 1024) {
  if (!response.ok || !response.body) fail(`Divulga collection HTTP ${response.status}`);
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) fail('Divulga response byte limit/header');
  const parts = []; let size = 0;
  try {
    for await (const bytes of response.body) {
      size += bytes.length;
      if (size > maxBytes) fail('Divulga response byte limit');
      parts.push(Buffer.from(bytes));
    }
    // Fetch decompresses gzip/br bodies; Content-Length describes wire bytes.
    const encoding = response.headers.get('content-encoding');
    if (declared !== null && (!encoding || encoding === 'identity') && Number(declared) !== size) fail('Divulga response length mismatch');
    const raw = Buffer.concat(parts);
    return { data:JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(raw)), rawResponseSha256:sha256(raw) };
  } catch (error) {
    if (error instanceof CivicImportError) throw error;
    fail('Divulga response encoding/JSON/stream');
  }
}

export async function collectDivulgaDetails({year, pilotUf, apiElectionKey, selectors, synthetic = false, fetchImpl = fetch}) {
  if (!Number.isSafeInteger(year) || year < 2026 || year > 2100 || !UFS.includes(pilotUf) || typeof synthetic !== 'boolean') fail('Divulga detail pilot');
  apiElectionKey = identifier(apiElectionKey);
  if (!Array.isArray(selectors) || !selectors.length || selectors.length > 1000) fail('Divulga detail selector limit');
  const seen = new Set();
  const checked = selectors.map(selector => {
    const sourceKey = identifier(selector.sourceKey), {jurisdiction, officeCode} = selector;
    if (![pilotUf,'BR'].includes(jurisdiction) || !roles.has(officeCode) || (jurisdiction === 'BR' ? !['1','2'].includes(officeCode) : ['1','2'].includes(officeCode))) fail('Divulga detail selector scope');
    const identity = `${jurisdiction}:${sourceKey}`;
    if (seen.has(identity)) fail('Divulga detail duplicate selector');
    seen.add(identity); return {sourceKey, jurisdiction, officeCode};
  });
  const projections = [];
  for (const selector of checked) {
    const {sourceKey, jurisdiction, officeCode} = selector;
    const url = `https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar/${year}/${jurisdiction}/${apiElectionKey}/candidato/${sourceKey}`;
    const response = await fetchImpl(url, {redirect:'error', signal:AbortSignal.timeout(30000), headers:{'User-Agent':'PoliMatch-Staging/1.0 (public TSE data; no publication)'}});
    const {data, rawResponseSha256} = await readDivulgaJson(response, 2 * 1024 * 1024);
    if (!data || identifier(data.id) !== sourceKey || identifier(data.eleicao?.id) !== apiElectionKey || data.eleicao.ano !== year || data.ufCandidatura !== jurisdiction || String(data.cargo?.codigo) !== officeCode || !Array.isArray(data.vices) || data.vices.length > 100) fail('Divulga detail response scope/profile');
    const parentSourceKey = data.idCandidatoSuperior === 0 || data.idCandidatoSuperior === null ? null : identifier(data.idCandidatoSuperior);
    const references = data.vices.map(member => {
      if (identifier(member.sq_ELEICAO) !== apiElectionKey || member.sg_UE !== jurisdiction) fail('Divulga detail reference scope');
      return {sourceKey:identifier(member.sq_CANDIDATO), declaredRole:text(member.ds_CARGO), parentSourceKey:member.sq_CANDIDATO_SUPERIOR === null || member.sq_CANDIDATO_SUPERIOR === undefined || member.sq_CANDIDATO_SUPERIOR === 0 ? null : identifier(member.sq_CANDIDATO_SUPERIOR)};
    });
    // Some official detail DTOs repeat historical references. Preserve the
    // multiplicity for review; never deduplicate it into a supposedly valid chapa.
    const duplicateReferences = references.length - new Set(references.map(r => r.sourceKey)).size;
    let substituteSourceKey = null;
    if (data.substituto !== null && data.substituto !== undefined) {
      const replacement = data.substituto;
      if (identifier(replacement.sqEleicao) !== apiElectionKey || replacement.sgUe !== jurisdiction || replacement.nrAno !== year) fail('Divulga detail substitution scope');
      substituteSourceKey = identifier(replacement.sqCandidato);
      if (substituteSourceKey === sourceKey) fail('Divulga detail self substitution');
    }
    const registrationProcess = processNumber(data.numeroProcesso), drapProcess = processNumber(data.numeroProcessoDrap);
    projections.push({...selector, officialStatus:text(data.descricaoSituacao), ballotStatus:text(data.descricaoSituacaoCandidato), originUpdate:originUpdate(data.dataUltimaAtualizacao), parentSourceKey, references, duplicateReferences, substituteSourceKey, registrationProcess, registrationProcessUrl:publicProcessUrl(registrationProcess), drapProcess, drapProcessUrl:publicProcessUrl(drapProcess), evidence:{url, locator:`candidate.id=${sourceKey}; response sha256=${rawResponseSha256}`, rawResponseSha256, fetchedAt:new Date().toISOString(), sourceAt:null, license:null}});
  }
  // No arbitrary DTO fields (CPF, email, birth dates, assets, documents) survive.
  return {version:1, synthetic, year, pilotUf, apiElectionKey, publication:'observation_only', projections};
}

export function divulgaDetailSelectors(batch, candidateRows) {
  validateCivicDataset(batch.dataset);
  const elections = new Set(batch.dataset.records.elections.map(e => e.id));
  return batch.dataset.records.persons.map(person => {
    const matches = candidateRows.filter(row => elections.has(`tse:${row.ANO_ELEICAO}:${row.CD_ELEICAO}`) && `tse:${row.ANO_ELEICAO}:${row.CD_ELEICAO}:person:${row.SQ_CANDIDATO}` === person.id && row.CD_ELEICAO === batch.report.electionKeys[row.SG_UE] && ['BR',batch.pilotUf].includes(row.SG_UE) && row.NR_TURNO === '1' && roles.has(row.CD_CARGO));
    if (matches.length !== 1) fail('Divulga detail pinned person selector');
    const row = matches[0];
    return {sourceKey:row.SQ_CANDIDATO, jurisdiction:row.SG_UE, officeCode:row.CD_CARGO};
  });
}

export function buildDivulgaReview(batch, collection) {
  validateCivicDataset(batch.dataset);
  if (batch.dataset.synthetic !== collection.synthetic || batch.publication !== 'staging_only' || collection.version !== 1 || collection.publication !== 'observation_only' || batch.pilotUf !== collection.pilotUf || batch.dataset.records.elections.some(e => e.year !== collection.year)) fail('Divulga review boundary');
  const details = new Map(collection.projections.map(p => [`${p.jurisdiction}:${p.sourceKey}`,p]));
  if (details.size !== collection.projections.length) fail('Divulga review duplicate detail');
  const persons = new Set(batch.dataset.records.persons.map(p => p.id));
  if (details.size !== persons.size || collection.projections.some(p => !persons.has(`tse:${collection.year}:${batch.report.electionKeys[p.jurisdiction]}:person:${p.sourceKey}`))) fail('Divulga review person coverage');
  const cases = batch.dataset.records.candidacies.map(candidacy => {
    const contest = batch.dataset.records.contests.find(c => c.id === candidacy.contestId), detail = details.get(`${contest.jurisdiction}:${candidacy.sourceKey}`);
    if (!detail || detail.jurisdiction !== contest.jurisdiction || detail.officeCode !== officeCodes[contest.office]) fail('Divulga review holder coverage/scope');
    const expected = contest.office === 'senator' ? ['9','10'] : contest.office === 'president' ? ['2'] : ['4'];
    const references = detail.references.map(reference => {
      const record = details.get(`${contest.jurisdiction}:${reference.sourceKey}`);
      return {...reference, officeCode:record?.officeCode ?? null, jurisdiction:record?.jurisdiction ?? null, reverseParentSourceKey:record?.parentSourceKey ?? null, officialStatus:record?.officialStatus ?? null, substituteSourceKey:record?.substituteSourceKey ?? null, registrationProcessUrl:record?.registrationProcessUrl ?? null, originUpdate:record?.originUpdate ?? null, evidenceUrl:record?.evidence.url ?? null};
    });
    const consistent = references.length === expected.length && expected.every(code => references.filter(r => r.officeCode === code).length === 1) && references.every(r => r.jurisdiction === contest.jurisdiction && (r.parentSourceKey === null || r.parentSourceKey === candidacy.sourceKey) && (r.reverseParentSourceKey === null || r.reverseParentSourceKey === candidacy.sourceKey));
    const listObservation = batch.report.observedRelationships.find(r => r.candidacyId === candidacy.id);
    const matchesList = consistent && listObservation && references.every(r => listObservation.members.some(m => m.sourceKey === r.sourceKey));
    const reasons = ['legal_interval_not_in_detail'];
    if (!listObservation) reasons.push('absent_from_list_endpoint');
    if (!consistent) reasons.push('historical_or_ambiguous_nested_references');
    if (consistent && listObservation && !matchesList) reasons.push('list_detail_composition_divergence');
    if (detail.substituteSourceKey || references.some(r => r.substituteSourceKey)) reasons.push('explicit_substitution_requires_dated_registration_evidence');
    return {candidacyId:candidacy.id, sourceKey:candidacy.sourceKey, jurisdiction:contest.jurisdiction, office:contest.office, ballotName:candidacy.ballotName, pinnedCsvStatus:candidacy.officialStatus, currentDetailStatus:detail.officialStatus, ballotStatus:detail.ballotStatus, originUpdate:detail.originUpdate, registrationProcessUrl:detail.registrationProcessUrl, drapProcessUrl:detail.drapProcessUrl, substituteSourceKey:detail.substituteSourceKey, detailEvidence:detail.evidence, references, observedComposition:consistent ? 'role_complete_nesting' : 'ambiguous_history', agreesWithPinnedList:Boolean(matchesList), legalValidity:{validFrom:null, validTo:null, inferred:false}, exceptionReasons:reasons, review:'pending'};
  });
  const stable = collection.projections.map(({evidence, ...record}) => ({...record, evidence:{...evidence, fetchedAt:undefined}}));
  const reviewId = sha256(JSON.stringify({version:1, batchId:batch.batchId, projections:stable}));
  return {version:1, synthetic:batch.dataset.synthetic, reviewId, batchId:batch.batchId, publication:'staging_only', humanAcceptance:'pending', sourceAccess:{basis:batch.dataset.synthetic ? 'Synthetic test fixtures only' : 'Resolução TSE 23.609/2019, art. 74: public consultation; minimized institutional facts only', url:'https://www.tse.jus.br/legislacao/compilada/res/2019/resolucao-no-23-609-de-18-de-dezembro-de-2019', apiLicense:null, publicationAuthorized:false}, totals:{officialCandidacies:cases.length, inspectedCandidacies:cases.length, individualDetails:details.size, roleCompleteObservations:cases.filter(c => c.observedComposition === 'role_complete_nesting').length, ambiguousHistories:cases.filter(c => c.observedComposition === 'ambiguous_history').length, legalIntervalsProven:0}, cases};
}
