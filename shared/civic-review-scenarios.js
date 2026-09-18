import assert from 'node:assert/strict';
import { validateCivicDataset, validateCivicRecord } from './civic-contract.js';
import { civicFixture } from './civic-fixtures.js';

// Shared by node:test and the direct local check. Scenarios exercise the real
// validator with synthetic inputs; no implementation logic is copied here.
const accepted = (name, prepare = () => {}) => ({ name, run() { const data = civicFixture(); prepare(data); assert.equal(validateCivicDataset(data), data); } });
const rejected = (name, prepare, expected) => ({ name, run() { const data = civicFixture(); prepare(data); assert.throws(() => validateCivicDataset(data), expected); } });
function history(data, states, actions) {
  const entity = data.records.candidacies[0];
  const original = { ...entity };
  const snapshots = states.map((publication, index) => ({ ...original, publication, review: publication === 'draft' ? 'pending' : 'approved', revision: index + 1, ballotName: index ? 'Nome corrigido sintético' : original.ballotName }));
  Object.assign(entity, snapshots.at(-1));
  const versions = snapshots.map(snapshot => ({ id: 'review-candidate-v' + snapshot.revision, entityType: 'candidacies', entityId: entity.id, revision: snapshot.revision, snapshot }));
  data.records.versions.push(...versions);
  for (const [revision, action] of actions) data.records.changes.push({ id: 'review-change-' + revision, entityType: 'candidacies', entityId: entity.id, revision, action, actor: 'synthetic-reviewer', at: entity.updatedAt, reason: 'Synthetic regression only' });
  return versions;
}
export const civicReviewScenarios = [
  accepted('review accepts existing synthetic fixture'),
  ...['not_found','collection_failed'].flatMap(state => ['articleId','classificationVersion','relevance'].map(field => rejected('review rejects ' + state + ' with ' + field, data => { const row = data.records.coverage[1]; row.state = state; row[field] = field === 'articleId' ? 'article-a' : field === 'classificationVersion' ? 1 : 'Contradictory evidence'; }, /no-result evidence/))),
  accepted('review allows restricted coverage to retain article evidence', data => { Object.assign(data.records.coverage[1], { state: 'restricted', articleId: 'article-b', classificationVersion: 1, relevance: 'Known article behind paywall' }); }),
  ...[['draft','approved'],['draft','pending'],['withdrawn','approved']].map(([publication,review]) => rejected('review rejects published edition with event ' + publication + '/' + review, data => { Object.assign(data.records.events[0], { publication,review }); }, /published edition requires published events/)),
  accepted('review allows draft edition with draft event', data => { data.records.editions[0].publication = 'draft'; data.records.editions[0].review = 'pending'; data.records.events[0].publication = 'draft'; data.records.events[0].review = 'pending'; data.records.changes = []; data.records.versions = []; }),
  { name: 'review represents approved center outlet', run() { const outlet = { ...civicFixture().records.outlets[0], orientation: 'center' }; assert.equal(validateCivicRecord('outlets', outlet), outlet); } },
  rejected('review keeps center out of right coverage', data => { data.records.outlets[0].orientation = 'center'; }, /coverage classification/),
  rejected('review keeps center out of left coverage', data => { data.records.outlets[0].orientation = 'center'; data.records.coverage[0].slot = 'left'; data.records.coverage[1].slot = 'right'; }, /coverage classification/),
  accepted('review international coverage accepts center origin abroad', data => { data.records.outlets[0].orientation = 'center'; data.records.outlets[0].country = 'GB'; data.records.coverage[0].slot = 'international'; data.records.coverage[2].slot = 'right'; }),
  accepted('review bootstraps audited publication at revision one', data => { history(data, ['published'], [[1,'publish']]); }),
  accepted('review corrects a published entity with retained anchor', data => { history(data, ['published','published'], [[2,'correct']]); }),
  accepted('review withdraws a published entity with retained anchor', data => { history(data, ['published','withdrawn'], [[2,'withdraw']]); }),
  accepted('review republishes a withdrawn entity with retained history', data => { history(data, ['published','withdrawn','published'], [[2,'withdraw'],[3,'publish']]); }),
  accepted('review publishes a staged draft', data => { history(data, ['draft','published'], [[2,'publish']]); }),
  rejected('review rejects withdrawal with a published snapshot', data => { history(data, ['published','published'], [[2,'withdraw']]); }, /change snapshot state/),
  rejected('review rejects publication with a withdrawn snapshot', data => { history(data, ['published','withdrawn'], [[2,'publish']]); }, /publish snapshot state/),
  rejected('review rejects correction with a withdrawn snapshot', data => { history(data, ['published','withdrawn'], [[2,'correct']]); }, /change snapshot state/),
  rejected('review rejects correction with a draft snapshot', data => { history(data, ['published','draft'], [[2,'correct']]); }, /change snapshot state/),
  rejected('review rejects publication with a draft snapshot', data => { history(data, ['draft'], [[1,'publish']]); }, /publish snapshot state/),
  ...['correct','withdraw'].map(action => rejected('review rejects ' + action + ' without earlier revision', data => { history(data, [action === 'withdraw' ? 'withdrawn' : 'published'], [[1,action]]); }, /previous version/)),
  ...['correct','withdraw','publish'].map(action => rejected('review rejects missing predecessor for ' + action, data => { const versions = history(data, ['published', action === 'withdraw' ? 'withdrawn' : 'published'], [[2,action]]); data.records.versions = data.records.versions.filter(row => row.id !== versions[0].id); }, /previous version/)),
  rejected('review rejects a gap in audited revisions', data => { const versions = history(data, ['published','published','published'], [[3,'correct']]); data.records.versions = data.records.versions.filter(row => row.id !== versions[1].id); }, /previous version/),
  rejected('review requires correction instead of republishing published content', data => { history(data, ['published','published'], [[2,'publish']]); }, /publish transition/),
  rejected('review rejects withdrawal of a draft', data => { history(data, ['draft','withdrawn'], [[2,'withdraw']]); }, /published predecessor/),
  rejected('review rejects correction of a withdrawn entity', data => { history(data, ['withdrawn','published'], [[2,'correct']]); }, /published predecessor/),
  rejected('review rejects a future version', data => { const versions = history(data, ['published','published'], [[2,'correct']]); versions[1].revision = 3; versions[1].snapshot.revision = 3; }, /version ahead of entity/),
  rejected('review rejects latest snapshot with different entity content', data => { const versions = history(data, ['published','published'], [[2,'correct']]); versions[1].snapshot.ballotName = 'Different snapshot content'; }, /latest version differs/),
  rejected('review rejects current revision missing from recorded history', data => { history(data, ['published','published'], [[2,'correct']]); data.records.candidacies[0].revision = 3; }, /latest version differs/),
  accepted('review compares snapshot fields independently of property order', data => { const versions = history(data, ['published','published'], [[2,'correct']]); versions[1].snapshot = Object.fromEntries(Object.entries(versions[1].snapshot).reverse()); }),
  ...['contests','editions','changes'].map(kind => rejected('review rejects duplicate logical scope for ' + kind, data => { data.records[kind].push({ ...data.records[kind][0], id: 'review-duplicate' }); }, new RegExp('duplicate ' + kind + ' scope'))),
  rejected('review rejects mixed translation and republication cycle', data => { data.records.articles[0].syndicatedFromId = 'article-b'; data.records.articles[1].syndicatedFromId = null; }, /cycle/),
  accepted('review resolves a large acyclic provenance graph iteratively', data => { let parent = 'article-b'; for (let index = 0; index < 4000; index++) { const id = 'review-chain-' + index; data.records.articles.push({ ...data.records.articles[1], id, syndicatedFromId: parent, translatedFromId: null }); parent = id; } }),
];
