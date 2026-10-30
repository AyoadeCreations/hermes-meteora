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
/** In flight schema setup, shared by concurrent callers so they never race. */
let _initPromise: Promise<void> | null = null;

/** Arbitrary constant: all instances take the same lock while creating tables. */
const SCHEMA_LOCK_KEY = 727_274_001;

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
      // Serverless Postgres (Neon) can take several seconds to wake from idle
      connectionTimeoutMillis: 15_000,
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
 * Idempotent, and safe under concurrency: simultaneous cold starts used to race
 * inside CREATE TABLE IF NOT EXISTS and fail with a duplicate key error on
 * pg_type. Concurrent callers in one instance now share a single promise, and
 * different instances serialize on a transaction scoped advisory lock (which,
 * unlike a session lock, is safe behind a transaction pooler).
 * A failure is not cached, so the next request retries.
 */
export async function ensurePgSchema(): Promise<void> {
  if (_initialized) return;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const pool = getPgPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [SCHEMA_LOCK_KEY]);
      await client.query(SCHEMA_SQL_PG);
      await client.query('COMMIT');
      _initialized = true;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  })();

  try {
    await _initPromise;
  } finally {
    _initPromise = null;
  }
}

/** Lightweight connectivity probe used by the health endpoint. */
export async function pingPg(): Promise<void> {
  const pool = getPgPool();
  await pool.query('SELECT 1');
}
