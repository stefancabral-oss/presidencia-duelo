import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCivicDataset, validateCivicRecord, candidacyId, validateDirectoryQuery, comparisonCandidates, directoryCoverage, directoryPage } from './civic-contract.js';
import { civicFixture } from './civic-fixtures.js';

test('synthetic contract covers executive, senate, homonyms, history and vice replacement', () => {
  const data = validateCivicDataset(civicFixture());
  assert.equal(data.records.candidacies.length, 5);
  assert.equal(new Set(data.records.candidacies.map(row => row.id)).size, 5);
  assert.notEqual(candidacyId('e:a', 'BR', 'president', 'b'), candidacyId('e', 'BR', 'president', 'a:b'));
  assert.ok(data.records.persons.every(row => row.gameCandidateId === null));
});
for (const [name, mutate, expected] of [
  ['cross-election identity', d => { d.records.candidacies[0].id = 'wrong'; }, /missing reference|identity/],
  ['same-party relationship cannot create a person', d => { d.records.members[1].personId = 'party-match'; }, /reference/],
  ['senator vice', d => { d.records.members.find(row => row.role === 'substitute').role = 'vice'; }, /roles/],
  ['missing second substitute', d => { d.records.members.splice(d.records.members.findIndex(row => row.position === 2), 1); }, /incomplete/],
  ['overlapping vice replacement', d => { d.records.tickets.find(row => row.id === 'governor-0-v0').validTo = null; }, /overlapping/],
  ['pending content published', d => { d.records.candidacies[0].review = 'pending'; }, /review/],
  ['photo not permitted', d => { d.records.photographs[0].publication = 'published'; d.records.photographs[0].review = 'approved'; }, /rights/],
  ['missing coverage slot', d => { d.records.coverage.pop(); }, /three coverage/],
  ['gap without explanation', d => { d.records.coverage[1].reason = null; }, /gap/],
  ['unreviewed classification', d => { d.records.outlets[0].classificationReview = 'contested'; }, /coverage review/],
  ['wrong international origin', d => { d.records.coverage[0].slot = 'international'; d.records.coverage[2].slot = 'right'; }, /classification/],
  ['syndication cycle', d => { d.records.articles[0].syndicatedFromId = 'article-b'; }, /cycle/],
  ['duplicate edition member', d => { d.records.editionItems.push({ ...d.records.editionItems[0], id: 'duplicate', position: 1 }); }, /duplicate edition/],
  ['unknown private field', d => { d.records.persons[0].googleSubject = 'private'; }, /unknown/],
  ['invalid calendar date', d => { d.records.editions[0].date = '2032-02-30'; }, /date/],
]) test(`reject ${name}`, () => { const data = civicFixture(); mutate(data); assert.throws(() => validateCivicDataset(data), expected); });
test('vacancies come from data; photo/proposal absence does not shrink candidacy denominator', () => {
  const data = civicFixture(); data.records.contests[2].vacancies = 3;
  data.records.photographs = []; data.records.claims = [];
  validateCivicDataset(data);
  assert.deepEqual(directoryCoverage('president', data.records.candidacies, 3), { official: 3, imported: 2, published: 2, unpublished: 1 });
});
test('public reads reject preference/identity signals and incompatible comparisons', () => {
  const candidates = civicFixture().records.candidacies;
  assert.equal(validateDirectoryQuery({ contestId: 'president' }).limit, 30);
  for (const key of ['google','recoveryKey','votes','latitude','playerId']) assert.throws(() => validateDirectoryQuery({ contestId: 'president', [key]: 'x' }), /private signal/);
  assert.throws(() => validateDirectoryQuery({ contestId: 'president', sort: 'popularity' }), /alphabetical/);
  assert.equal(comparisonCandidates(candidates.slice(0, 2).map(c => c.id), candidates).length, 2);
  assert.throws(() => comparisonCandidates([candidates[0].id, candidates[2].id], candidates), /incompatible/);
});
test('access and collection failure are separate from editorial review and publication', () => {
  const source = civicFixture().records.sources[0];
  validateCivicRecord('sources', { ...source, access: 'restricted', collectionState: 'failed', lastError: 'Provider unavailable' });
  assert.throws(() => validateCivicRecord('sources', { ...source, collectionState: 'failed' }), /failure/);
});
test('stable homonym pagination rejects stale revisions and changed filters', () => {
  const candidates = civicFixture().records.candidacies;
  const options = { revision: 1, officialTotal: 2 };
  const first = directoryPage({ contestId: 'president', limit: 1 }, candidates, options);
  const second = directoryPage({ contestId: 'president', limit: 1, cursor: first.nextCursor }, candidates.toReversed(), options);
  assert.notEqual(first.items[0].id, second.items[0].id);
  assert.equal(second.nextCursor, null);
  assert.throws(() => directoryPage({ contestId: 'president', cursor: first.nextCursor }, candidates, { ...options, revision: 2 }), { code: 'CIVIC_STALE_CURSOR' });
  assert.throws(() => directoryPage({ contestId: 'president', search: 'different', cursor: first.nextCursor }, candidates, options), { code: 'CIVIC_STALE_CURSOR' });
});
test('withdrawal retains a version and audit event, and removes public reading', () => {
  const data = civicFixture(); const row = data.records.candidacies[0];
  data.records.versions.push({ id: 'candidate-v1', entityType: 'candidacies', entityId: row.id, revision: 1, snapshot: { ...row } });
  row.publication = 'withdrawn'; row.revision = 2;
  data.records.versions.push({ id: 'candidate-v2', entityType: 'candidacies', entityId: row.id, revision: 2, snapshot: { ...row } });
  data.records.changes.push({ id: 'withdraw-candidate', entityType: 'candidacies', entityId: row.id, revision: 2, action: 'withdraw', actor: 'synthetic', at: row.updatedAt, reason: 'test correction' });
  validateCivicDataset(data);
  assert.equal(directoryPage({ contestId: 'president' }, data.records.candidacies, { revision: 2, officialTotal: 2 }).items.length, 1);
  assert.equal(data.records.versions.find(v => v.id === 'candidate-v1').snapshot.publication, 'published');
});

test('read helpers reject accidental private fields before returning records', () => {
  const candidates = civicFixture().records.candidacies;
  candidates[0].playerId = 'must-not-leak';
  assert.throws(() => directoryPage({ contestId: 'president' }, candidates, { revision: 1, officialTotal: 2 }), /unknown field/);
  assert.throws(() => comparisonCandidates(candidates.slice(0, 2).map(c => c.id), candidates), /unknown field/);
});

test('generated cursor remains usable for long valid search filters', () => {
  const candidates = civicFixture().records.candidacies;
  const search = 'á'.repeat(300);
  candidates[0].ballotName = search;
  candidates[1].ballotName = search;
  const query = { contestId: 'president', search, limit: 1 };
  const options = { revision: 1, officialTotal: 2 };
  const first = directoryPage(query, candidates, options);
  const second = directoryPage({ ...query, cursor: first.nextCursor }, candidates, options);
  assert.equal(second.items.length, 1);
  assert.notEqual(first.items[0].id, second.items[0].id);
});
