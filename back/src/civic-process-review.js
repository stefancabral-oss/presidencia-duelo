import { createHash } from 'node:crypto';
import { civicRecordDigest } from './civic-import.js';
import { buildDivulgaReview } from './civic-divulga-detail.js';
import { validateCivicDataset } from '../../shared/civic-contract.js';

const fail = reason => { throw new Error(`Civic process review: ${reason}`); };
const exact = (value, keys, required = keys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)) || required.some(key => !Object.hasOwn(value,key))) fail('unexpected or missing fields');
};
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const processKey = value => /^\d{7}-\d{2}\.\d{4}\.6\.\d{2}\.\d{4}$/.test(value) ? value.replace(/\D/g,'') : null;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;
const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && date(value.slice(0,10)) && Number.isFinite(Date.parse(value));
const localTime = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) && date(value.slice(0,10)) && Number(value.slice(11,13)) < 24 && Number(value.slice(14,16)) < 60 && Number(value.slice(17,19)) < 60;
const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 1200 && !/[\u0000-\u001f]/.test(value) && !/\bCPF\b|\b(?:email|e-mail)\b|\b\d{11}\b|\d{3}\.\d{3}\.\d{3}-\d{2}|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value);
const events = new Set(['renunciation_homologated','substitute_selected','substitute_registration_requested','regional_judgment','appeal_received_by_tse']);

// Validates provenance bindings and projects facts for review. It does not read
// court documents, attest their interpretation, approve a gate or emit tickets.
export function buildCivicProcessReview(detailReview, evidence, batch) {
  exact(evidence,['version','batchId','detailReviewId','recordedAt','synthetic','publication','humanAcceptance','legalIntervalsInferred','documents','cases']);
  const { collection, review } = detailReview ?? {};
  if (!collection || !review || collection.synthetic !== false || review.synthetic !== false || evidence.synthetic !== false || evidence.version !== 1 || collection.version !== 1 || review.version !== 1 || evidence.publication !== 'staging_only' || review.publication !== 'staging_only' || evidence.humanAcceptance !== 'pending' || evidence.legalIntervalsInferred !== false || !instant(evidence.recordedAt) || !/^[a-f0-9]{64}$/.test(evidence.batchId) || !/^[a-f0-9]{64}$/.test(evidence.detailReviewId) || evidence.batchId !== review.batchId || evidence.detailReviewId !== review.reviewId || !Array.isArray(evidence.documents) || evidence.documents.length > 200 || !Array.isArray(evidence.cases) || evidence.cases.length !== 0) fail('boundary or identity');
  if (!Array.isArray(collection.projections) || !Array.isArray(review.cases) || collection.projections.length > 1000 || review.cases.length > 1000) fail('detail coverage');
  if (!batch || batch.batchId !== evidence.batchId || batch.dataset?.synthetic !== false) fail('pinned batch identity');
  validateCivicDataset(batch.dataset);
  if (civicRecordDigest(batch.dataset.records) !== batch.report?.transformedRecordsSha256) fail('pinned batch fingerprint');
  const canonical = buildDivulgaReview(batch,collection);
  if (canonical.reviewId !== review.reviewId || hash(canonical.cases) !== hash(review.cases)) fail('pinned candidacy coverage or detail review fingerprint');
  const details = new Map(collection.projections.map(p => [p.sourceKey,p]));
  if (details.size !== collection.projections.length || collection.projections.some(p=>!/^\d{1,20}$/.test(p.sourceKey) || !['BR',collection.pilotUf].includes(p.jurisdiction)) || new Set(review.cases.map(c=>c.sourceKey)).size !== review.cases.length || review.cases.some(c=>!details.has(c.sourceKey) || !Array.isArray(c.references) || !Array.isArray(c.exceptionReasons))) fail('ambiguous source identity');
  const stableDetails = collection.projections.map(({evidence,...record})=>({...record,evidence:{...evidence,fetchedAt:undefined}}));
  if (hash({version:1,batchId:review.batchId,projections:stableDetails}) !== review.reviewId) fail('detail review fingerprint');
  const documentIds = new Set();
  const documents = evidence.documents.map(document => {
    exact(document,['id','process','kind','url','locator','signedAt','consultedAt','summary','sourceKeys','license','legalInterval','datedFacts'],['id','process','kind','url','locator','signedAt','consultedAt','summary','sourceKeys','license','legalInterval']);
    if (!/^[a-z][a-z0-9-]{0,99}$/.test(document.id) || documentIds.has(document.id)) fail('document identity');
    documentIds.add(document.id);
    const key = processKey(document.process);
    let url; try { url = new URL(document.url); } catch { fail('document URL'); }
    if (url.protocol !== 'https:' || url.hostname !== 'consultaunificadapje.tse.jus.br' || url.username || url.password || url.port || url.hash || url.pathname !== '/consulta-publica-unificada/documento' || url.searchParams.get('extensaoArquivo') !== 'text/html' || !url.searchParams.get('path') || [...url.searchParams.keys()].some(k=>!['extensaoArquivo','path'].includes(k)) || [...url.searchParams.keys()].length !== 2) fail('official document URL');
    exact(document.signedAt,['value','timezone','precision','meaning']);
    const signature = (document.signedAt.value === null && document.signedAt.precision === null) || (localTime(document.signedAt.value) && document.signedAt.precision === 'second' && document.signedAt.value.slice(0,10) <= document.consultedAt.slice(0,10));
    if (!key || !text(document.kind) || !text(document.locator) || !text(document.summary) || !signature || document.signedAt.timezone !== null || document.signedAt.meaning !== 'document_signed_at' || !instant(document.consultedAt) || document.license !== null || document.legalInterval !== null) fail('document facts or unverified legal interval');
    if (!Array.isArray(document.sourceKeys) || !document.sourceKeys.length || document.sourceKeys.length > 10 || new Set(document.sourceKeys).size !== document.sourceKeys.length || document.sourceKeys.some(id=>!details.has(id))) fail('document source coverage');
    const subjects = document.sourceKeys.map(id=>details.get(id));
    if (new Set(subjects.map(p=>p.jurisdiction)).size !== 1 || !subjects.some(p=>p.registrationProcess === key || p.drapProcess === key)) fail('document process binding');
    const datedFacts = document.datedFacts ?? [];
    if (!Array.isArray(datedFacts) || datedFacts.length > 20) fail('dated fact limit');
    for (const fact of datedFacts) {
      exact(fact,['event','date','precision','basis'],['event','date','precision']);
      if (!events.has(fact.event) || !date(fact.date) || fact.precision !== 'day' || fact.date > document.consultedAt.slice(0,10) || (fact.basis !== undefined && fact.basis !== 'process_header_autuation_at_tse')) fail('dated fact');
    }
    return {...document, datedFacts};
  });
  const cases = review.cases.map(c => {
    const related = new Set([c.sourceKey,...c.references.map(r=>r.sourceKey),c.substituteSourceKey].filter(Boolean));
    const applicable = documents.filter(d=>d.sourceKeys.some(key=>related.has(key)));
    return {candidacyId:c.candidacyId, sourceKey:c.sourceKey, jurisdiction:c.jurisdiction, office:c.office, documentIds:applicable.map(d=>d.id), pendingReasons:[...c.exceptionReasons], legalValidity:{validFrom:null,validTo:null,inferred:false}, humanAcceptance:'pending'};
  });
  const stable = documents.map(({consultedAt,...document})=>document);
  return {version:1, evidenceId:hash({batchId:evidence.batchId,detailReviewId:evidence.detailReviewId,documents:stable,cases}), batchId:evidence.batchId, detailReviewId:evidence.detailReviewId, publication:'staging_only', humanAcceptance:'pending', complete:false, legalIntervalsProven:0, legalIntervalsInferred:false, totals:{candidacies:cases.length,individualDetails:details.size,documents:documents.length,candidaciesWithDocuments:cases.filter(c=>c.documentIds.length).length}, documents,cases};
}
