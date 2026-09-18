// B01: portable, strict version-one contracts. No game state or identity input.
export const CIVIC_VERSION = 1;
export const UFS = Object.freeze(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']);
export const REVIEW = Object.freeze(['pending', 'approved', 'contested', 'rejected']);
export const PUBLICATION = Object.freeze(['draft', 'published', 'withdrawn']);
export const SLOTS = Object.freeze(['right', 'left', 'international']);
const enumeration = values => ({ type: 'enum', values });
const ref = (target, nullable = false) => ({ type: 'text', target, nullable });
const nullable = type => ({ type, nullable: true });
const publishing = { review: enumeration(REVIEW), publication: enumeration(PUBLICATION), revision: 'positive', updatedAt: 'instant' };

// Every field is required. Explicit null is different from an omitted field.
// These descriptors are also consumed by the isolated PostgreSQL migration.
export const CIVIC_RECORDS = Object.freeze({
  sources: { id: 'text', url: 'https', publisher: 'text', kind: enumeration(['official','campaign','newsroom','synthetic']), locator: nullable('text'), sourceAt: 'instant', fetchedAt: 'instant', generation: 'text', license: 'text', access: enumeration(['open','restricted','unavailable']), collectionState: enumeration(['collected','failed']), lastError: nullable('text') },
  elections: { id: 'text', year: 'positive', sourceId: ref('sources') },
  contests: { id: 'text', electionId: ref('elections'), office: enumeration(['president','governor','senator']), jurisdiction: enumeration(['BR', ...UFS]), vacancies: 'positive', sourceId: ref('sources') },
  persons: { id: 'text', displayName: 'text', sourceId: ref('sources'), gameCandidateId: nullable('text'), gameLinkReview: enumeration(['none', ...REVIEW]) },
  candidacies: { id: 'text', contestId: ref('contests'), sourceKey: 'text', personId: ref('persons'), ballotName: 'text', ballotNumber: 'text', party: nullable('text'), officialStatus: 'text', statusAt: 'instant', sourceId: ref('sources'), ...publishing },
  tickets: { id: 'text', candidacyId: ref('candidacies'), validFrom: 'instant', validTo: nullable('instant'), completeness: enumeration(['complete','partial']), sourceId: ref('sources') },
  members: { id: 'text', ticketId: ref('tickets'), personId: ref('persons'), role: enumeration(['holder','vice','substitute']), position: 'nonnegative', sourceId: ref('sources') },
  claims: { id: 'text', candidacyId: ref('candidacies'), kind: enumeration(['proposal','recorded_vote','executed_measure','observed_result','biography']), theme: 'text', text: 'text', sourceId: ref('sources'), locator: 'text', ...publishing },
  photographs: { id: 'text', personId: ref('persons'), sourceId: ref('sources'), url: 'https', credit: 'text', rights: enumeration(['pending','permitted','denied']), ...publishing },
  outlets: { id: 'text', name: 'text', country: 'country', newsroom: 'text', orientation: enumeration(['right','left','center','mixed','unclassified']), classificationVersion: 'positive', classificationReview: enumeration(REVIEW), methodologySourceId: ref('sources'), usePermission: enumeration(['pending','permitted','denied']) },
  articles: { id: 'text', outletId: ref('outlets'), originOutletId: ref('outlets'), syndicatedFromId: ref('articles', true), canonicalUrl: 'https', headline: 'text', author: nullable('text'), kind: enumeration(['reporting','opinion','analysis','interview','press_release']), language: 'text', translatedFromId: ref('articles', true), sourceAt: 'instant', fetchedAt: 'instant', access: enumeration(['full','metadata_only','paywall','unavailable']), sourceId: ref('sources'), ...publishing },
  events: { id: 'text', title: 'text', summary: 'text', theme: 'text', jurisdiction: enumeration(['BR', ...UFS]), startsAt: 'instant', endsAt: 'instant', sourceId: ref('sources'), ...publishing },
  coverage: { id: 'text', eventId: ref('events'), slot: enumeration(SLOTS), state: enumeration(['present','not_found','collection_failed','restricted','pending','contested','withdrawn']), articleId: ref('articles', true), classificationVersion: nullable('positive'), relevance: nullable('text'), checkedAt: 'instant', reason: nullable('text') },
  editions: { id: 'text', date: 'date', timezone: enumeration(['America/Sao_Paulo']), jurisdiction: enumeration(['BR', ...UFS]), ...publishing },
  editionItems: { id: 'text', editionId: ref('editions'), eventId: ref('events'), position: 'nonnegative', selectionReason: 'text' },
  changes: { id: 'text', entityType: enumeration(['candidacies','claims','photographs','articles','events','editions']), entityId: 'text', revision: 'positive', action: enumeration(['publish','correct','withdraw']), actor: 'text', at: 'instant', reason: 'text' },
  versions: { id: 'text', entityType: enumeration(['candidacies','claims','photographs','articles','events','editions']), entityId: 'text', revision: 'positive', snapshot: 'json' },
});

export class CivicContractError extends TypeError {
  constructor(message, code = 'CIVIC_INVALID') { super(message); this.code = code; }
}
const fail = message => { throw new CivicContractError(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function descriptor(spec) { return typeof spec === 'string' ? { type: spec } : spec; }
function validValue(value, spec) {
  const d = descriptor(spec);
  if (value === null) return d.nullable === true;
  if (d.type === 'json') return object(value);
  if (d.type === 'enum') return d.values.includes(value);
  if (d.type === 'positive' || d.type === 'nonnegative') return Number.isSafeInteger(value) && value >= (d.type === 'positive' ? 1 : 0);
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) return false;
  if (d.type === 'instant') return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  if (d.type === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (d.type === 'country') return /^[A-Z]{2}$/.test(value);
  if (d.type === 'https') { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; } }
  return d.type === 'text';
}
export function validateCivicRecord(kind, record) {
  const fields = CIVIC_RECORDS[kind];
  if (!fields || !object(record)) fail(`record ${kind}`);
  if (Object.keys(record).some(key => !Object.hasOwn(fields, key))) fail(`${kind}: unknown field`);
  for (const [key, spec] of Object.entries(fields)) if (!Object.hasOwn(record, key) || !validValue(record[key], spec)) fail(`${kind}.${key}`);
  if (record.publication === 'published' && record.review !== 'approved') fail(`${kind}: publication requires review`);
  if (kind === 'sources' && (record.collectionState === 'failed') !== (record.lastError !== null)) fail('source failure detail');
  if (kind === 'persons' && ((record.gameCandidateId === null) !== (record.gameLinkReview === 'none'))) fail('game link state');
  if (kind === 'contests' && ((record.office === 'president') !== (record.jurisdiction === 'BR'))) fail('office jurisdiction');
  if (kind === 'tickets' && record.validTo !== null && record.validTo <= record.validFrom) fail('ticket interval');
  if (kind === 'events' && record.endsAt < record.startsAt) fail('event interval');
  if (kind === 'photographs' && record.publication === 'published' && record.rights !== 'permitted') fail('photo rights');
  if (kind === 'coverage') {
    if (record.state === 'present' && (!record.articleId || !record.classificationVersion || !record.relevance)) fail('coverage present evidence');
    if (record.state !== 'present' && !record.reason) fail('coverage gap reason');
    if (['not_found','collection_failed'].includes(record.state) && [record.articleId,record.classificationVersion,record.relevance].some(value => value !== null)) fail('coverage no-result evidence');
  }
  return record;
}

export function candidacyId(electionId, jurisdiction, office, sourceKey) {
  const parts = [electionId, jurisdiction, office, sourceKey];
  if (parts.some(value => typeof value !== 'string' || !value.trim())) fail('candidacy identity');
  return `candidacy:v1:${parts.map(encodeURIComponent).join(':')}`;
}
export function validateCivicDataset(data) {
  if (!object(data) || data.version !== CIVIC_VERSION || !object(data.records)) fail('dataset version');
  if (Object.keys(data).some(key => !['version','synthetic','records'].includes(key)) || typeof data.synthetic !== 'boolean') fail('dataset metadata');
  if (Object.keys(data.records).some(key => !Object.hasOwn(CIVIC_RECORDS, key))) fail('unknown entity');
  const indexes = {};
  for (const kind of Object.keys(CIVIC_RECORDS)) {
    if (!Array.isArray(data.records[kind])) fail(`missing collection ${kind}`);
    indexes[kind] = new Map();
    for (const record of data.records[kind]) {
      validateCivicRecord(kind, record);
      if (indexes[kind].has(record.id)) fail(`duplicate ${kind}`);
      indexes[kind].set(record.id, record);
    }
  }
  for (const [kind, keys] of [['contests', ['electionId','jurisdiction','office']], ['editions', ['date','jurisdiction','revision']], ['changes', ['entityType','entityId','revision']]]) {
    const seen = new Set();
    for (const row of data.records[kind]) {
      const key = JSON.stringify(keys.map(field => row[field]));
      if (seen.has(key)) fail(`duplicate ${kind} scope`);
      seen.add(key);
    }
  }
  for (const [kind, rows] of Object.entries(data.records)) for (const row of rows) for (const [key, spec] of Object.entries(CIVIC_RECORDS[kind])) {
    const { target } = descriptor(spec);
    if (target && row[key] !== null && !indexes[target].has(row[key])) fail(`${kind}.${key}: missing reference`);
  }
  for (const row of data.records.candidacies) {
    const contest = indexes.contests.get(row.contestId);
    if (row.id !== candidacyId(contest.electionId, contest.jurisdiction, contest.office, row.sourceKey)) fail('candidacy identity mismatch');
  }
  for (const ticket of data.records.tickets) {
    const candidate = indexes.candidacies.get(ticket.candidacyId);
    const office = indexes.contests.get(candidate.contestId).office;
    const members = data.records.members.filter(row => row.ticketId === ticket.id);
    const expected = office === 'senator' ? ['holder:0','substitute:1','substitute:2'] : ['holder:0','vice:1'];
    const slots = members.map(row => `${row.role}:${row.position}`);
    if (slots.some(slot => !expected.includes(slot)) || new Set(slots).size !== slots.length || new Set(members.map(row => row.personId)).size !== members.length) fail('ticket roles');
    if (ticket.completeness === 'complete' && slots.length !== expected.length) fail('incomplete ticket');
    if (members.some(row => row.role === 'holder' && row.personId !== candidate.personId)) fail('ticket holder identity');
    for (const other of data.records.tickets) if (ticket.id < other.id && ticket.candidacyId === other.candidacyId && ticket.validFrom < (other.validTo || '9999') && other.validFrom < (ticket.validTo || '9999')) fail('overlapping ticket versions');
  }
  for (const event of data.records.events) {
    const coverage = data.records.coverage.filter(row => row.eventId === event.id);
    if (coverage.length !== 3 || new Set(coverage.map(row => row.slot)).size !== 3) fail('three coverage slots required');
    for (const row of coverage.filter(row => row.state === 'present')) {
      const article = indexes.articles.get(row.articleId);
      const outlet = indexes.outlets.get(article.originOutletId);
      if (article.publication !== 'published' || outlet.classificationReview !== 'approved' || row.classificationVersion !== outlet.classificationVersion) fail('coverage review');
      if (row.slot === 'international' ? outlet.country === 'BR' : outlet.orientation !== row.slot) fail('coverage classification');
    }
  }
  // Both provenance edges form one graph. Resolve iteratively so mixed cycles
  // are rejected too and large imports do not exhaust the call stack.
  const unresolved = new Map();
  const descendants = new Map();
  for (const article of data.records.articles) {
    const parents = new Set([article.syndicatedFromId, article.translatedFromId].filter(Boolean));
    unresolved.set(article.id, parents.size);
    for (const parent of parents) {
      if (!descendants.has(parent)) descendants.set(parent, []);
      descendants.get(parent).push(article.id);
    }
  }
  const ready = [...unresolved].filter(([, count]) => count === 0).map(([id]) => id);
  for (let index = 0; index < ready.length; index++) for (const child of descendants.get(ready[index]) || []) {
    unresolved.set(child, unresolved.get(child) - 1);
    if (unresolved.get(child) === 0) ready.push(child);
  }
  if (ready.length !== data.records.articles.length) fail('article relationship cycle');
  const editionPositions = new Set();
  const editionEvents = new Set();
  for (const row of data.records.editionItems) {
    const position = JSON.stringify([row.editionId, row.position]);
    const event = JSON.stringify([row.editionId, row.eventId]);
    if (editionPositions.has(position) || editionEvents.has(event)) fail('duplicate edition item');
    editionPositions.add(position); editionEvents.add(event);
    const edition = indexes.editions.get(row.editionId);
    const includedEvent = indexes.events.get(row.eventId);
    if (edition.publication === 'published' && (includedEvent.publication !== 'published' || includedEvent.review !== 'approved')) fail('published edition requires published events');
  }
  for (const row of data.records.changes) if (!indexes[row.entityType].has(row.entityId)) fail('change target');
  const versionIndex = new Map();
  const latestVersions = new Map();
  for (const row of data.records.versions) {
    validateCivicRecord(row.entityType, row.snapshot);
    const current = indexes[row.entityType].get(row.entityId);
    if (!current || row.snapshot.id !== row.entityId || row.snapshot.revision !== row.revision) fail('version identity');
    if (row.revision > current.revision) fail('version ahead of entity');
    const key = JSON.stringify([row.entityType,row.entityId,row.revision]);
    if (versionIndex.has(key)) fail('duplicate version');
    versionIndex.set(key, row.snapshot);
    const entityKey = JSON.stringify([row.entityType,row.entityId]);
    if (!latestVersions.has(entityKey) || row.revision > latestVersions.get(entityKey).revision) latestVersions.set(entityKey, row);
  }
  // Historical anchors need not have actions, but the latest recorded snapshot
  // must describe the current entity. Property order has no semantic meaning.
  for (const row of latestVersions.values()) {
    const current = indexes[row.entityType].get(row.entityId);
    if (Object.keys(CIVIC_RECORDS[row.entityType]).some(key => row.snapshot[key] !== current[key])) fail('latest version differs from entity');
  }
  for (const row of data.records.changes) {
    const snapshot = versionIndex.get(JSON.stringify([row.entityType,row.entityId,row.revision]));
    if (!snapshot) fail('change without version');
    const previous = versionIndex.get(JSON.stringify([row.entityType,row.entityId,row.revision - 1]));
    if (row.action === 'publish') {
      if (snapshot.publication !== 'published' || snapshot.review !== 'approved') fail('publish snapshot state');
      if (row.revision > 1 && !previous) fail('change requires previous version');
      if (previous && previous.publication === 'published') fail('publish transition requires unpublished predecessor');
    } else {
      if (!previous) fail('change requires previous version');
      if (previous.publication !== 'published') fail('change requires published predecessor');
      if (row.action === 'withdraw' ? snapshot.publication !== 'withdrawn' : snapshot.publication !== 'published' || snapshot.review !== 'approved') fail('change snapshot state');
    }
  }
  return data;
}

export function validateDirectoryQuery(query) {
  if (!object(query) || Object.keys(query).some(key => !['contestId','party','officialStatus','search','limit','cursor','sort'].includes(key))) fail('directory query: unknown or private signal');
  if (typeof query.contestId !== 'string' || !query.contestId.trim()) fail('contest required');
  if (query.sort !== undefined && query.sort !== 'name') fail('only alphabetical ordering');
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100)) fail('page limit');
  for (const key of ['party','officialStatus','search','cursor']) if (query[key] !== undefined && (typeof query[key] !== 'string' || query[key].length > (key === 'cursor' ? 16384 : 512))) fail(`query ${key}`);
  return { ...query, limit: query.limit ?? 30, sort: 'name' };
}
export function comparisonCandidates(ids, candidates) {
  candidates.forEach(row => validateCivicRecord('candidacies', row));
  if (!Array.isArray(ids) || ids.length < 2 || ids.length > 3 || new Set(ids).size !== ids.length) fail('compare 2–3 distinct candidacies');
  const selected = ids.map(id => candidates.find(row => row.id === id));
  if (selected.some(row => !row || row.publication !== 'published') || new Set(selected.map(row => row.contestId)).size !== 1) fail('incompatible comparison');
  return selected;
}
export function directoryCoverage(contestId, candidacies, officialTotal) {
  if (!Number.isSafeInteger(officialTotal) || officialTotal < 0) fail('official denominator');
  const rows = candidacies.filter(row => row.contestId === contestId);
  const published = rows.filter(row => row.publication === 'published' && row.review === 'approved').length;
  if (new Set(rows.map(row => row.id)).size !== rows.length || rows.length > officialTotal) fail('coverage reconciliation');
  return { official: officialTotal, imported: rows.length, published, unpublished: officialTotal - published };
}

const nameKey = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
// Revision binds a cursor to one published directory snapshot. Consumers must
// restart paging after CIVIC_STALE_CURSOR, never silently combine revisions.
export function directoryPage(input, candidacies, { revision, officialTotal }) {
  const query = validateDirectoryQuery(input);
  candidacies.forEach(row => validateCivicRecord('candidacies', row));
  if (!Number.isSafeInteger(revision) || revision < 1) fail('directory revision');
  const filterKey = JSON.stringify([query.contestId, query.party ?? '', query.officialStatus ?? '', query.search ?? '', query.sort]);
  let after = null;
  if (query.cursor) {
    try { after = JSON.parse(decodeURIComponent(query.cursor)); } catch { fail('invalid cursor'); }
    if (!object(after) || after.version !== 1 || typeof after.name !== 'string' || typeof after.id !== 'string') fail('invalid cursor');
    if (after.revision !== revision || after.filterKey !== filterKey) throw new CivicContractError('Restart directory pagination', 'CIVIC_STALE_CURSOR');
  }
  const rows = candidacies.filter(row => row.contestId === query.contestId && row.publication === 'published' && row.review === 'approved'
    && (!query.party || row.party === query.party) && (!query.officialStatus || row.officialStatus === query.officialStatus)
    && (!query.search || nameKey(row.ballotName).includes(nameKey(query.search)) || row.ballotNumber === query.search));
  rows.sort((a, b) => compareText(nameKey(a.ballotName), nameKey(b.ballotName)) || compareText(a.id, b.id));
  const remaining = after ? rows.filter(row => compareText(nameKey(row.ballotName), after.name) > 0 || (nameKey(row.ballotName) === after.name && compareText(row.id, after.id) > 0)) : rows;
  const items = remaining.slice(0, query.limit).map(row => ({ ...row }));
  const last = items.at(-1);
  const nextCursor = remaining.length > query.limit ? encodeURIComponent(JSON.stringify({ version: 1, revision, filterKey, name: nameKey(last.ballotName), id: last.id })) : null;
  return { version: 1, revision, items, nextCursor, filteredCount: rows.length, coverage: directoryCoverage(query.contestId, candidacies, officialTotal) };
}
