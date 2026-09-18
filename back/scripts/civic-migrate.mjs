import pg from 'pg';
import { migrateCivic, rollbackEmptyCivic } from '../src/civic-schema.js';
const mode = process.argv[2];
if (!['up','down-empty'].includes(mode) || !process.env.DATABASE_URL) throw new Error('Usage: DATABASE_URL=... node back/scripts/civic-migrate.mjs up|down-empty');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try { console.log(mode === 'up' ? await migrateCivic(pool) : await rollbackEmptyCivic(pool)); }
finally { await pool.end(); }
