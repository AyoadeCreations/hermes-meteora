/**
 * seed-observations.js
 * Seeds observations onto the existing confirmed market (JUPITER $JUP).
 * Safe to run multiple times — clears existing observations first.
 */
const path   = require('path');
const { nanoid } = require('nanoid');
const Database   = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '..', 'data', 'meteora-mfe.db');

const db = new Database(DB_PATH);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');

// Target the JUPITER market which has a confirmed deployment
const market = db.prepare("SELECT * FROM markets WHERE token_symbol = '$JUP' LIMIT 1").get();
if (!market) {
  console.error('No $JUP market found. Exiting.');
  db.close();
  process.exit(1);
}

console.log(`Seeding observations for: ${market.token_name} (${market.token_symbol}) id=${market.id}`);

// Clear existing observations for this market
db.prepare('DELETE FROM observations WHERE market_id = ?').run(market.id);

function isoAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

const obStmt = db.prepare(`
  INSERT INTO observations (id, market_id, timestamp, price, quote_reserve,
    volume_24h, traders, buy_volume, sell_volume, graduation_progress)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const TOTAL        = 72;
const DURATION_MIN = 66;   // 66 minutes of history
const START_PRICE  = 0.0000008;
const END_PRICE    = 0.0000061;
const START_QUOTE  = 0;
const END_QUOTE    = 18.7;   // 18.7 SOL in, graduation at 85
const GRAD_TARGET  = 85;

for (let i = 0; i < TOTAL; i++) {
  const t      = i / (TOTAL - 1);
  const noise  = (Math.random() - 0.48) * 0.06;

  // Price follows a power curve with mild noise
  const price  = START_PRICE + (END_PRICE - START_PRICE) * Math.pow(t, 0.65) * (1 + noise);

  // Quote reserve grows roughly linearly with some bursts
  const burstFactor = 1 + (i % 12 === 0 ? Math.random() * 0.15 : 0);
  const quote  = Math.max(0, (START_QUOTE + (END_QUOTE - START_QUOTE) * t * burstFactor));

  const gradPct = (quote / GRAD_TARGET) * 100;

  // Volume and traders increase over time
  const vol24h   = 0.3 + t * 2.1 + (Math.random() - 0.5) * 0.4;
  const traders  = Math.floor(4 + t * 55 + (Math.random() - 0.5) * 6);
  const buyRatio = 0.55 + (Math.random() - 0.5) * 0.18;
  const buyVol   = vol24h * buyRatio;
  const sellVol  = vol24h - buyVol;

  const minutesAgo = Math.round((TOTAL - i) * (DURATION_MIN / TOTAL));
  const timestamp  = isoAgo(minutesAgo);

  obStmt.run(
    nanoid(16), market.id, timestamp,
    price, quote, vol24h, traders,
    buyVol, sellVol, gradPct
  );
}

const count = db.prepare('SELECT COUNT(*) as c FROM observations WHERE market_id = ?').get(market.id);
console.log(`✓ Inserted ${count.c} observations`);

// Also add a confirmed deployment if there isn't one with tx sig
const dep = db.prepare("SELECT * FROM deployments WHERE market_id = ? AND status = 'confirmed' LIMIT 1").get(market.id);
if (dep && !dep.transaction_signature) {
  db.prepare(`UPDATE deployments SET
    transaction_signature = ?,
    config_address = ?,
    pool_address = ?,
    updated_at = ?
    WHERE id = ?`
  ).run(
    '4uQeVj5tqViQh7yWWGStvkEG1Zu1mDwkXJFJeEexmaR5XM7VzZt6hHVDk7vX1SfzJdPMxANpqdArtm5eXrCXnm',
    'JUPcfg1111111111111111111111111111111111111',
    'JUPpoo1111111111111111111111111111111111111',
    new Date().toISOString(),
    dep.id
  );
  console.log(`✓ Updated deployment with demo tx signature`);
}

console.log('');
console.log('🎯 Analysis page ready at:');
console.log(`   http://localhost:3000/markets/${market.id}/analysis`);
console.log('');

db.close();
