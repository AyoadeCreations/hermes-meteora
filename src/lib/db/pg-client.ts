/**
 * Postgres database client — server-side only.
 * Uses the `pg` package with a connection pool.
 *
 * The pool is module-level so it is reused across warm serverless invocations
 * (Next.js caches module state within a single function instance lifetime).
 *
 * Never import this module from client components.
 */
import { Pool } from 'pg';
import { SCHEMA_SQL_PG } from './schema-pg';

let _pool: Pool | null = null;
let _initialized = false;

export function getPgPool(): Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        '[db] DATABASE_URL is not set. ' +
          'Set it in your Vercel environment variables or .env.local for local Postgres.'
      );
    }
    _pool = new Pool({
      connectionString,
      // Vercel serverless: keep pool small — functions spin up/down frequently
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      ssl: connectionString.includes('localhost')
        ? false
        : { rejectUnauthorized: false },
    });

    _pool.on('error', (err) => {
      console.error('[db] Unexpected pg pool error', err);
    });
  }
  return _pool;
}

/**
 * Ensure schema tables exist.
 * Idempotent — uses CREATE TABLE IF NOT EXISTS everywhere.
 * Called once per cold start.
 */
export async function ensurePgSchema(): Promise<void> {
  if (_initialized) return;
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query(SCHEMA_SQL_PG);
    _initialized = true;
  } finally {
    client.release();
  }
}
