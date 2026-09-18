import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { migrateCivic, rollbackEmptyCivic, insertCivicFixture } from '../src/civic-schema.js';
import { civicFixture } from '../../shared/civic-fixtures.js';

if (!process.env.DATABASE_URL || process.env.CIVIC_DISPOSABLE_TEST !== '1') throw new Error('Requires disposable DATABASE_URL and CIVIC_DISPOSABLE_TEST=1');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const quote = name => '"' + name.replaceAll('"', '""') + '"';
async function publicFingerprint() {
  const tables = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  const payload = [];
  for (const { tablename } of tables.rows) {
    const rows = await pool.query(`SELECT row_to_json(t)::text AS value FROM public.${quote(tablename)} t ORDER BY row_to_json(t)::text`);
    payload.push([tablename, rows.rows.map(row => row.value)]);
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
let relationalChecks = 0;
async function rejectedWrite(sql, params = [], expected) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assert.rejects(async () => { await client.query(sql, params); await client.query('SET CONSTRAINTS ALL IMMEDIATE'); }, expected);
    relationalChecks += 1;
  } finally { await client.query('ROLLBACK'); client.release(); }
}
try {
  assert.equal((await pool.query("SELECT 1 FROM pg_namespace WHERE nspname='civic_v1'")).rowCount, 0, 'smoke requires a fresh civic namespace');
  const before = await publicFingerprint();
  assert.equal((await migrateCivic(pool)).applied, true);
  assert.equal((await migrateCivic(pool)).applied, false);
  await rollbackEmptyCivic(pool);
  assert.equal(await publicFingerprint(), before);
  await migrateCivic(pool);
  const fixture = civicFixture();
  await insertCivicFixture(pool, fixture);
  // A different valid person/source must not rewrite historical membership.
  const alternateSource = { ...fixture.records.sources[0], id: 'synthetic-source-alternate' };
  const sourceKeys = Object.keys(alternateSource);
  await pool.query(`INSERT INTO civic_v1.sources (${sourceKeys.map(quote).join(',')}) VALUES (${sourceKeys.map((_, index) => '$' + (index + 1)).join(',')})`, sourceKeys.map(key => alternateSource[key]));
  // A partial historical ticket still forms through deferred INSERT validation.
  const formation = await pool.connect();
  try {
    await formation.query('BEGIN');
    await formation.query('INSERT INTO civic_v1.tickets (id,"candidacyId","validFrom","validTo",completeness,"sourceId") SELECT $1,"candidacyId",$2,$3,$4,"sourceId" FROM civic_v1.tickets WHERE id=$5', ['governor-partial-history','2032-07-01T12:00:00.000Z','2032-08-01T12:00:00.000Z','partial','governor-0-v0']);
    await formation.query('INSERT INTO civic_v1.members (id,"ticketId","personId",role,position,"sourceId") VALUES ($1,$2,$3,$4,$5,$6)', ['governor-partial-holder','governor-partial-history','governor-holder-0','holder',0,'synthetic-source']);
    await formation.query('COMMIT');
  } catch (error) { await formation.query('ROLLBACK'); throw error; }
  finally { formation.release(); }
  assert.equal((await pool.query('SELECT count(*)::int n FROM civic_v1.members WHERE "ticketId"=$1', ['governor-partial-history'])).rows[0].n, 1);
  await pool.query('UPDATE civic_v1.members SET "personId"="personId" WHERE id=$1', ['president-0-v0-member-1']);
  assert.equal((await pool.query('SELECT count(*)::int n FROM civic_v1.candidacies')).rows[0].n, 5);
  assert.equal((await pool.query('SELECT count(*)::int n FROM civic_v1.members WHERE role=$1', ['substitute'])).rows[0].n, 4);
  await assert.rejects(rollbackEmptyCivic(pool), /populated/);
  await assert.rejects(insertCivicFixture(pool, civicFixture()), /duplicate key/);
  await rejectedWrite('UPDATE civic_v1.members SET role=$1 WHERE id=$2', ['vice', 'senator-0-v0-member-1'], /immutable ticket member composition/);
  await rejectedWrite('DELETE FROM civic_v1.members WHERE id=$1', ['senator-0-v0-member-2'], /immutable ticket member composition/);
  await rejectedWrite('UPDATE civic_v1.tickets SET "validTo"=NULL WHERE id=$1', ['governor-0-v0']);
  await rejectedWrite('UPDATE civic_v1.claims SET review=$1 WHERE id=$2', ['pending','proposal']);
  await rejectedWrite('UPDATE civic_v1.versions SET revision=2');
  await rejectedWrite('DELETE FROM civic_v1.changes');
  await rejectedWrite('UPDATE civic_v1.members SET "personId"=$1 WHERE id=$2', ['missing','president-0-v0-member-1']);
  await rejectedWrite('UPDATE civic_v1.members SET "personId"=$1 WHERE id=$2', ['president-holder-1','president-0-v0-member-1'], /immutable ticket member composition/);
  await rejectedWrite('UPDATE civic_v1.members SET id=$1 WHERE id=$2', ['rewritten-member','president-0-v0-member-1'], /immutable ticket member composition/);
  await rejectedWrite('UPDATE civic_v1.members SET "ticketId"=$1 WHERE id=$2', ['governor-0-v1','president-0-v0-member-1'], /immutable ticket member composition/);
  await rejectedWrite('UPDATE civic_v1.members SET position=$1 WHERE id=$2', [2,'senator-0-v0-member-1'], /immutable ticket member composition/);
  await rejectedWrite('UPDATE civic_v1.members SET "sourceId"=$1 WHERE id=$2', ['synthetic-source-alternate','president-0-v0-member-1'], /immutable ticket member composition/);
  await rejectedWrite('DELETE FROM civic_v1.members WHERE id=$1', ['governor-partial-holder'], /immutable ticket member composition/);
  for (const coverageId of ['left','international']) {
    await rejectedWrite('UPDATE civic_v1.coverage SET "articleId"=$1 WHERE id=$2', ['article-a',coverageId], /coverage_no_result/);
    await rejectedWrite('UPDATE civic_v1.coverage SET "classificationVersion"=$1 WHERE id=$2', [1,coverageId], /coverage_no_result/);
    await rejectedWrite('UPDATE civic_v1.coverage SET relevance=$1 WHERE id=$2', ['Unexpected result',coverageId], /coverage_no_result/);
  }
  assert.equal(await publicFingerprint(), before, 'all preexisting public tables and rows must be unchanged');
  console.log(JSON.stringify({ migration: 'pass', emptyRollback: 'pass', populatedRollback: 'refused', repeat: 'idempotent', fixtureCandidacies: 5, relationalChecks, legacyPublicFingerprintUnchanged: before }));
} finally { await pool.end(); }
