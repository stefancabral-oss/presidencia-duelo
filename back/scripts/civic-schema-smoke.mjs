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
async function rejectedWrite(sql, params = []) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assert.rejects(async () => { await client.query(sql, params); await client.query('SET CONSTRAINTS ALL IMMEDIATE'); });
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
  await insertCivicFixture(pool, civicFixture());
  assert.equal((await pool.query('SELECT count(*)::int n FROM civic_v1.candidacies')).rows[0].n, 5);
  assert.equal((await pool.query('SELECT count(*)::int n FROM civic_v1.members WHERE role=$1', ['substitute'])).rows[0].n, 4);
  await assert.rejects(rollbackEmptyCivic(pool), /populated/);
  await assert.rejects(insertCivicFixture(pool, civicFixture()), /duplicate key/);
  await rejectedWrite('UPDATE civic_v1.members SET role=$1 WHERE id=$2', ['vice', 'senator-0-v0-member-1']);
  await rejectedWrite('DELETE FROM civic_v1.members WHERE id=$1', ['senator-0-v0-member-2']);
  await rejectedWrite('UPDATE civic_v1.tickets SET "validTo"=NULL WHERE id=$1', ['governor-0-v0']);
  await rejectedWrite('UPDATE civic_v1.claims SET review=$1 WHERE id=$2', ['pending','proposal']);
  await rejectedWrite('UPDATE civic_v1.versions SET revision=2');
  await rejectedWrite('DELETE FROM civic_v1.changes');
  await rejectedWrite('UPDATE civic_v1.members SET "personId"=$1 WHERE id=$2', ['missing','president-0-v0-member-1']);
  assert.equal(await publicFingerprint(), before, 'all preexisting public tables and rows must be unchanged');
  console.log(JSON.stringify({ migration: 'pass', emptyRollback: 'pass', populatedRollback: 'refused', repeat: 'idempotent', fixtureCandidacies: 5, relationalChecks: 7, legacyPublicFingerprintUnchanged: before }));
} finally { await pool.end(); }
