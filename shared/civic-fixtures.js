import { CIVIC_RECORDS, candidacyId } from './civic-contract.js';

// Entirely synthetic identities, URLs and approvals. Never a release dataset.
export function civicFixture() {
  const at = '2032-08-01T12:00:00.000Z';
  const next = '2032-09-01T12:00:00.000Z';
  const pub = { review: 'approved', publication: 'published', revision: 1, updatedAt: at };
  const records = Object.fromEntries(Object.keys(CIVIC_RECORDS).map(kind => [kind, []]));
  records.sources.push({ id: 'synthetic-source', url: 'https://example.test/fixture', publisher: 'Synthetic fixture', kind: 'synthetic', locator: 'fixture:v1', sourceAt: at, fetchedAt: at, generation: 'synthetic-v1', license: 'Synthetic test data; no official extract', access: 'open', collectionState: 'collected', lastError: null });
  const sourceId = records.sources[0].id;
  records.elections.push({ id: 'test-2032', year: 2032, sourceId }, { id: 'test-2028', year: 2028, sourceId });
  for (const [id, electionId, office, jurisdiction, vacancies] of [['president','test-2032','president','BR',1], ['governor','test-2032','governor','SP',1], ['senator','test-2032','senator','SP',2], ['historical','test-2028','senator','SP',1]]) {
    records.contests.push({ id, electionId, office, jurisdiction, vacancies, sourceId });
    const alternatives = id === 'president' ? 2 : 1;
    for (let index = 0; index < alternatives; index++) {
      const personId = `${id}-holder-${index}`;
      const person = (pid, name) => ({ id: pid, displayName: name, sourceId, gameCandidateId: null, gameLinkReview: 'none' });
      records.persons.push(person(personId, 'Pessoa Homônima'));
      const idCandidate = candidacyId(electionId, jurisdiction, office, String(index + 1));
      records.candidacies.push({ id: idCandidate, contestId: id, sourceKey: String(index + 1), personId, ballotName: 'Pessoa Homônima', ballotNumber: String(index + 10), party: null, officialStatus: 'Situação sintética com recurso', statusAt: at, sourceId, ...pub });
      const versions = id === 'governor' ? 2 : 1;
      for (let version = 0; version < versions; version++) {
        const ticketId = `${id}-${index}-v${version}`;
        records.tickets.push({ id: ticketId, candidacyId: idCandidate, validFrom: version ? next : at, validTo: versions === 2 && !version ? next : null, completeness: 'complete', sourceId });
        records.members.push({ id: `${ticketId}-holder`, ticketId, personId, role: 'holder', position: 0, sourceId });
        for (let position = 1; position <= (office === 'senator' ? 2 : 1); position++) {
          const pid = `${ticketId}-member-${position}`;
          records.persons.push(person(pid, `Integrante sintético ${position}`));
          records.members.push({ id: pid, ticketId, personId: pid, role: office === 'senator' ? 'substitute' : 'vice', position, sourceId });
        }
      }
    }
  }
  records.claims.push({ id: 'proposal', candidacyId: records.candidacies[0].id, kind: 'proposal', theme: 'education', text: 'Proposta sintética para teste', sourceId, locator: 'p. 1', ...pub });
  records.photographs.push({ id: 'photo-pending', personId: records.persons[0].id, sourceId, url: 'https://example.test/portrait', credit: 'Synthetic', rights: 'pending', ...pub, review: 'pending', publication: 'draft' });
  records.outlets.push({ id: 'outlet-a', name: 'Redação sintética A', country: 'BR', newsroom: 'synthetic-a', orientation: 'right', classificationVersion: 1, classificationReview: 'approved', methodologySourceId: sourceId, usePermission: 'permitted' },
    { id: 'outlet-b', name: 'Redação sintética B', country: 'GB', newsroom: 'synthetic-b', orientation: 'left', classificationVersion: 1, classificationReview: 'contested', methodologySourceId: sourceId, usePermission: 'pending' });
  records.articles.push({ id: 'article-a', outletId: 'outlet-a', originOutletId: 'outlet-a', syndicatedFromId: null, canonicalUrl: 'https://example.test/article-a', headline: 'Manchete sintética', author: null, kind: 'opinion', language: 'pt-BR', translatedFromId: null, sourceAt: at, fetchedAt: next, access: 'full', sourceId, ...pub },
    { id: 'article-b', outletId: 'outlet-b', originOutletId: 'outlet-a', syndicatedFromId: 'article-a', canonicalUrl: 'https://example.test/article-b', headline: 'Republicação sintética', author: null, kind: 'opinion', language: 'en', translatedFromId: 'article-a', sourceAt: at, fetchedAt: next, access: 'paywall', sourceId, ...pub, review: 'pending', publication: 'draft' });
  records.events.push({ id: 'event-a', title: 'Acontecimento sintético', summary: 'Dado de teste, sem afirmação real.', theme: 'education', jurisdiction: 'SP', startsAt: at, endsAt: next, sourceId, ...pub });
  records.coverage.push({ id: 'right', eventId: 'event-a', slot: 'right', state: 'present', articleId: 'article-a', classificationVersion: 1, relevance: 'Mesmo fato sintético', checkedAt: next, reason: null },
    ...['left','international'].map(slot => ({ id: slot, eventId: 'event-a', slot, state: slot === 'left' ? 'collection_failed' : 'not_found', articleId: null, classificationVersion: null, relevance: null, checkedAt: next, reason: 'Lacuna sintética explícita' })));
  records.editions.push({ id: 'edition-a', date: '2032-09-01', timezone: 'America/Sao_Paulo', jurisdiction: 'SP', ...pub });
  records.editionItems.push({ id: 'edition-item-a', editionId: 'edition-a', eventId: 'event-a', position: 0, selectionReason: 'Relevância de teste', });
  records.changes.push({ id: 'change-a', entityType: 'events', entityId: 'event-a', revision: 1, action: 'publish', actor: 'synthetic-editor', at, reason: 'Test fixture, not human approval' });
  records.versions.push({ id: 'version-a', entityType: 'events', entityId: 'event-a', revision: 1, snapshot: { ...records.events[0] } });
  return { version: 1, synthetic: true, records };
}
