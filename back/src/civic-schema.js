import { createHash } from 'node:crypto';
import { CIVIC_RECORDS, descriptor, validateCivicDataset } from '../../shared/civic-contract.js';

export const CIVIC_SCHEMA = 'civic_v1';
const q = name => '"' + name.replaceAll('"', '""') + '"';
const literal = value => "'" + value.replaceAll("'", "''") + "'";
const table = name => `${CIVIC_SCHEMA}.${q(name)}`;
const sqlType = d => ['positive','nonnegative'].includes(d.type) ? 'bigint' : d.type === 'instant' ? 'timestamptz' : d.type === 'date' ? 'date' : d.type === 'json' ? 'jsonb' : 'text';

function column(name, spec) {
  const d = descriptor(spec); const key = q(name);
  const checks = [];
  if (['text','https','country','enum'].includes(d.type)) checks.push(`length(btrim(${key})) > 0`);
  if (d.type === 'enum') checks.push(`${key} IN (${d.values.map(literal).join(',')})`);
  if (d.type === 'country') checks.push(`${key} ~ '^[A-Z]{2}$'`);
  if (d.type === 'positive') checks.push(`${key} BETWEEN 1 AND 9007199254740991`);
  if (d.type === 'nonnegative') checks.push(`${key} BETWEEN 0 AND 9007199254740991`);
  return `${key} ${sqlType(d)}${d.nullable ? '' : ' NOT NULL'}${name === 'id' ? ' PRIMARY KEY' : ''}${checks.length ? ` CHECK (${checks.join(' AND ')})` : ''}`;
}
const constraints = {
  contests: ["UNIQUE (\"electionId\", jurisdiction, office)", "CHECK ((office='president')=(jurisdiction='BR'))"],
  candidacies: ['UNIQUE ("contestId", "sourceKey")'],
  tickets: ['CHECK ("validTo" IS NULL OR "validTo" > "validFrom")'],
  members: ['UNIQUE ("ticketId", role, position)', 'UNIQUE ("ticketId", "personId")'],
  events: ['CHECK ("endsAt" >= "startsAt")'],
  coverage: ['UNIQUE ("eventId", slot)', `CHECK ((state='present' AND "articleId" IS NOT NULL AND "classificationVersion" IS NOT NULL AND relevance IS NOT NULL) OR (state<>'present' AND reason IS NOT NULL))`],
  editions: ['UNIQUE (date, jurisdiction, revision)'],
  editionItems: ['UNIQUE ("editionId", position)', 'UNIQUE ("editionId", "eventId")'],
  changes: ['UNIQUE ("entityType", "entityId", revision)'],
  versions: ['UNIQUE ("entityType", "entityId", revision)'],
};
export const CIVIC_MIGRATION_SQL = Object.entries(CIVIC_RECORDS).map(([kind, fields]) => {
  const extra = [...(constraints[kind] || [])];
  if (fields.publication) extra.push("CHECK (publication <> 'published' OR review = 'approved')");
  if (kind === 'photographs') extra.push("CHECK (publication <> 'published' OR rights = 'permitted')");
  return `CREATE TABLE ${table(kind)} (${[...Object.entries(fields).map(([name, spec]) => column(name, spec)), ...extra].join(',\n')});`;
}).join('\n') + '\n' + Object.entries(CIVIC_RECORDS).flatMap(([kind, fields]) => Object.entries(fields).flatMap(([name, spec]) => {
  const d = descriptor(spec);
  return d.target ? [`ALTER TABLE ${table(kind)} ADD FOREIGN KEY (${q(name)}) REFERENCES ${table(d.target)}(id) DEFERRABLE INITIALLY DEFERRED;`, `CREATE INDEX ON ${table(kind)} (${q(name)});`] : [];
})).join('\n') + `
CREATE INDEX ON civic_v1.candidacies ("contestId", "ballotName", id);
CREATE INDEX ON civic_v1.articles ("canonicalUrl");
CREATE INDEX ON civic_v1.events (jurisdiction, "startsAt");
CREATE FUNCTION civic_v1.check_ticket() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tid text; ticket civic_v1.tickets; holder text; office_name text; total integer; correct integer;
BEGIN
  IF TG_TABLE_NAME = 'tickets' THEN tid := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN tid := OLD."ticketId";
  ELSE
    IF TG_OP='UPDATE' AND OLD."ticketId"<>NEW."ticketId" THEN RAISE EXCEPTION 'ticket member cannot change version'; END IF;
    tid := NEW."ticketId";
  END IF;
  SELECT * INTO ticket FROM civic_v1.tickets WHERE id=tid;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT c."personId", co.office INTO holder, office_name FROM civic_v1.candidacies c JOIN civic_v1.contests co ON co.id=c."contestId" WHERE c.id=ticket."candidacyId" FOR UPDATE OF c;
  IF EXISTS (SELECT 1 FROM civic_v1.tickets t WHERE t."candidacyId"=ticket."candidacyId" AND t.id<>ticket.id AND tstzrange(t."validFrom",t."validTo",'[)') && tstzrange(ticket."validFrom",ticket."validTo",'[)')) THEN RAISE EXCEPTION 'overlapping ticket versions'; END IF;
  SELECT count(*), count(*) FILTER (WHERE (role='holder' AND position=0 AND "personId"=holder) OR (office_name='senator' AND role='substitute' AND position IN (1,2)) OR (office_name<>'senator' AND role='vice' AND position=1)) INTO total, correct FROM civic_v1.members WHERE "ticketId"=tid;
  IF total<>correct OR (ticket.completeness='complete' AND total<>CASE WHEN office_name='senator' THEN 3 ELSE 2 END) THEN RAISE EXCEPTION 'invalid ticket composition'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER ticket_contract AFTER INSERT OR UPDATE ON civic_v1.tickets DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION civic_v1.check_ticket();
CREATE CONSTRAINT TRIGGER member_contract AFTER INSERT OR UPDATE OR DELETE ON civic_v1.members DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION civic_v1.check_ticket();
CREATE FUNCTION civic_v1.immutable_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only civic history'; END $$;
CREATE TRIGGER immutable_versions BEFORE UPDATE OR DELETE ON civic_v1.versions FOR EACH ROW EXECUTE FUNCTION civic_v1.immutable_history();
CREATE TRIGGER immutable_changes BEFORE UPDATE OR DELETE ON civic_v1.changes FOR EACH ROW EXECUTE FUNCTION civic_v1.immutable_history();
`;
const checksum = createHash('sha256').update(CIVIC_MIGRATION_SQL).digest('hex');

export async function migrateCivic(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(170210)");
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${CIVIC_SCHEMA}`);
    await client.query(`CREATE TABLE IF NOT EXISTS ${CIVIC_SCHEMA}.migrations (version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    const prior = await client.query(`SELECT checksum FROM ${CIVIC_SCHEMA}.migrations WHERE version=1`);
    if (prior.rowCount && prior.rows[0].checksum !== checksum) throw new Error('Civic migration checksum mismatch');
    if (!prior.rowCount) {
      await client.query(CIVIC_MIGRATION_SQL);
      await client.query(`INSERT INTO ${CIVIC_SCHEMA}.migrations(version,checksum) VALUES(1,$1)`, [checksum]);
    }
    await client.query('COMMIT'); return { version: 1, applied: !prior.rowCount, checksum };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

// Rollback is allowed only before any data has been imported. A populated
// deployment rolls back its feature flags/application, retaining this schema.
export async function rollbackEmptyCivic(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(170210)');
    for (const kind of Object.keys(CIVIC_RECORDS)) {
      await client.query(`LOCK TABLE ${table(kind)} IN ACCESS EXCLUSIVE MODE`);
      if ((await client.query(`SELECT 1 FROM ${table(kind)} LIMIT 1`)).rowCount) throw new Error('Civic rollback refuses populated schema');
    }
    // Static namespace, never supplied by CLI or content.
    await client.query(`DROP TABLE ${Object.keys(CIVIC_RECORDS).map(table).join(',')} RESTRICT`);
    await client.query('DROP FUNCTION civic_v1.check_ticket(), civic_v1.immutable_history() RESTRICT');
    await client.query('DROP TABLE civic_v1.migrations RESTRICT');
    await client.query('DROP SCHEMA civic_v1 RESTRICT');
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

// Fixture/staging ingestion only. B02/B06 own real imports/publication.
export async function insertCivicFixture(pool, dataset) {
  validateCivicDataset(dataset);
  if (!dataset.synthetic) throw new Error('Only synthetic fixtures supported by B01');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [kind, rows] of Object.entries(dataset.records)) for (const row of rows) {
      const keys = Object.keys(row);
      await client.query(`INSERT INTO ${table(kind)} (${keys.map(q).join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')})`, keys.map(key => row[key]));
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
