/**
 * SQLite database client — server-side only.
 * Uses better-sqlite3 for synchronous access (safe in Next.js Route Handlers).
 *
 * Never import this module from client components.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SCHEMA_SQL } from './schema';

const DB_PATH = process.env.DB_PATH ?? './data/meteora-mfe.db';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure the data directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH);

  // Run schema migrations
  _db.exec(SCHEMA_SQL);

  // Enable performance settings
  _db.pragma('synchronous = NORMAL');
  _db.pragma('cache_size = 10000');

  return _db;
}
