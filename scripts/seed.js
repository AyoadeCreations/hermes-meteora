/**
 * seed.js — Plain JS seed script for demo data.
 * Run with: node scripts/seed.js
 */

const path    = require('path');
const { nanoid } = require('nanoid');
const Database  = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, '..', 'data', 'meteora-mfe.db');
const SOL_MINT = 'So11111111111111111111111111111111111111112';

// ── Schema (minimal, matches schema.ts) ───────────────────────────────────

const SCHEMA_SQL = `
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS markets (
  id TEXT PRIMARY KEY, token_name TEXT NOT NULL, token_symbol TEXT NOT NULL,
  total_supply REAL NOT NULL, quote_mint TEXT NOT NULL, starting_price REAL NOT NULL,
  graduation_quote REAL NOT NULL, demand_profile TEXT NOT NULL,
  demand_participants INTEGER, demand_volume REAL, objective TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_markets_created_at ON markets(created_at DESC);

CREATE TABLE IF NOT EXISTS market_designs (
  id TEXT PRIMARY KEY, market_id TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT NOT NULL, configuration TEXT NOT NULL,
  simulation_result TEXT NOT NULL, objective_score REAL NOT NULL,
  score_breakdown TEXT NOT NULL, warnings TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_designs_market_id ON market_designs(market_id);

CREATE TABLE IF NOT EXISTS deployments (
  id TEXT PRIMARY KEY, market_id TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  design_id TEXT NOT NULL REFERENCES market_designs(id),
  wallet_address TEXT NOT NULL, pool_address TEXT, config_address TEXT,
  transaction_signature TEXT,
  status TEXT NOT NULL DEFAULT 'not_started',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deployments_market_id ON deployments(market_id);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY, market_id TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  price REAL NOT NULL, quote_reserve REAL NOT NULL,
  volume_24h REAL NOT NULL DEFAULT 0, traders INTEGER NOT NULL DEFAULT 0,
  buy_volume REAL NOT NULL DEFAULT 0, sell_volume REAL NOT NULL DEFAULT 0,
  graduation_progress REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_observations_market_id_ts ON observations(market_id, timestamp DESC);
`;

// ── Helpers ────────────────────────────────────────────────────────────────

function isoAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

// ── Open DB ────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.exec(SCHEMA_SQL);

// ── Guard: skip if already seeded ─────────────────────────────────────────

const existing = db.prepare('SELECT id FROM markets LIMIT 1').all();
if (existing.length > 0) {
  console.log('✓ DB already has markets — skipping seed.');
  db.close();
  process.exit(0);
}

// ── 1. Market ──────────────────────────────────────────────────────────────

const marketId = nanoid(16);

db.prepare(`
  INSERT INTO markets (id, token_name, token_symbol, total_supply, quote_mint,
    starting_price, graduation_quote, demand_profile, demand_participants,
    demand_volume, objective, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  marketId, 'Meridian Protocol', 'MRD',
  1_000_000_000, SOL_MINT,
  0.000001, 85,
  'medium', 1200, 420, 'balanced',
  isoAgo(120), isoAgo(60)
);

console.log(`✓ Market: Meridian Protocol (MRD)  id=${marketId}`);

// ── 2. Designs ─────────────────────────────────────────────────────────────

const designData = [
  {
    name:          'Balanced Formation',
    description:   'Optimises across price discovery, liquidity depth, and capital formation. Uses 4 curve segments with moderate fees and dynamic fee enabled for volatile periods.',
    objectiveScore: 0.81,
    baseFeeBps:    250,
    dynamicFee:    true,
    segments:      4,
    initialMcap:   0.05,
    migrationMcap: 85.0,
    avgImpact:     2.4,
    finalPrice:    0.000092,
    capitalReq:    74.2,
    graduation:    82,
  },
  {
    name:          'Controlled Discovery',
    description:   'Prioritises smooth price progression with concentrated liquidity in the lower price range. Steeper curve above mid-price discourages early speculation.',
    objectiveScore: 0.74,
    baseFeeBps:    300,
    dynamicFee:    false,
    segments:      5,
    initialMcap:   0.03,
    migrationMcap: 85.0,
    avgImpact:     1.8,
    finalPrice:    0.000078,
    capitalReq:    81.1,
    graduation:    76,
  },
  {
    name:          'Fast Capital Formation',
    description:   'Steeper curve with lower fee maximises trade volume. Graduation is reachable with fewer traders but at higher per-trade price impact.',
    objectiveScore: 0.69,
    baseFeeBps:    150,
    dynamicFee:    true,
    segments:      3,
    initialMcap:   0.08,
    migrationMcap: 85.0,
    avgImpact:     4.1,
    finalPrice:    0.000105,
    capitalReq:    67.3,
    graduation:    89,
  },
];

const designIds = [];

for (const d of designData) {
  const id = nanoid(16);
  designIds.push(id);

  const pricePath = Array.from({ length: 50 }, (_, i) => ({
    tradeIndex: i,
    price:      d.finalPrice * (i / 50) * (1 + Math.sin(i / 8) * 0.05),
  }));

  const simulation = {
    scenario:             'B',
    pricePath,
    quoteAccumulation:    pricePath.map((p, i) => ({
      tradeIndex: i,
      quoteAccumulated: (i / 50) * d.capitalReq,
      graduationPct:    (i / 50) * d.graduation,
    })),
    trades:               [],
    totalFees:            d.capitalReq * (d.baseFeeBps / 10000),
    averagePriceImpact:   d.avgImpact,
    maxPriceImpact:       d.avgImpact * 2.2,
    finalPrice:           d.finalPrice,
    startingPrice:        0.000001,
    quoteAtGraduation:    (d.graduation / 100) * 85,
    graduationReached:    d.graduation >= 100,
    capitalRequired:      d.capitalReq,
    liquidityUtilization: 0.72,
    tradeCount:           50,
  };

  const scoreBreakdown = {
    priceImpactScore:      1 - Math.min(d.avgImpact / 10, 1),
    capitalFormationScore: d.graduation / 100,
    progressionScore:      0.78,
    feeScore:              1 - Math.abs((d.baseFeeBps / 10000) - 0.03) / 0.04,
    weights: { priceImpact: 0.25, capitalFormation: 0.25, progression: 0.25, fee: 0.25 },
  };

  const segs = Array.from({ length: d.segments }, (_, i) => ({
    sqrtPriceLow:    String(Math.floor(Math.sqrt(0.000001 * (1 + i * 0.8)) * 1e12)),
    sqrtPriceHigh:   String(Math.floor(Math.sqrt(0.000001 * (1 + (i + 1) * 0.8)) * 1e12)),
    priceStart:      0.000001 * (1 + i * 0.8),
    priceEnd:        0.000001 * (1 + (i + 1) * 0.8),
    baseTokens:      1_000_000_000 / d.segments,
    quoteTokens:     85 / d.segments,
    liquidityWeight: 1 / d.segments,
  }));

  const config = {
    marketBriefId: marketId,
    objective:     'balanced',
    curve: {
      builderType:        'buildCurveWithMarketCap',
      segments:           segs,
      initialMarketCap:   d.initialMcap,
      migrationMarketCap: d.migrationMcap,
    },
    liquidityDistribution: [
      { priceMin: 0.000001, priceMax: 0.00005, weight: 0.5,  description: 'Discovery range' },
      { priceMin: 0.00005,  priceMax: 0.0001,  weight: 0.35, description: 'Growth range'    },
      { priceMin: 0.0001,   priceMax: 0.0002,  weight: 0.15, description: 'Upper range'     },
    ],
    fees: {
      baseFeeBps:                  d.baseFeeBps,
      dynamicFeeEnabled:           d.dynamicFee,
      creatorTradingFeePercentage: 10,
      collectFeeMode:              'quote_token',
    },
    graduation: { quoteThreshold: 85 },
    warnings:   [],
    createdAt:  isoAgo(90),
  };

  db.prepare(`
    INSERT INTO market_designs (id, market_id, name, description, configuration,
      simulation_result, objective_score, score_breakdown, warnings, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, marketId, d.name, d.description,
    JSON.stringify(config),
    JSON.stringify(simulation),
    d.objectiveScore,
    JSON.stringify(scoreBreakdown),
    JSON.stringify([]),
    isoAgo(90)
  );
}

// Baseline
const baselineId  = nanoid(16);
const baselineSim = {
  scenario: 'B', pricePath: [], quoteAccumulation: [], trades: [],
  totalFees: 2.1, averagePriceImpact: 5.5, maxPriceImpact: 9.8,
  finalPrice: 0.000082, startingPrice: 0.000001,
  quoteAtGraduation: 62, graduationReached: false,
  capitalRequired: 78, liquidityUtilization: 0.55, tradeCount: 50,
};
db.prepare(`
  INSERT INTO market_designs (id, market_id, name, description, configuration,
    simulation_result, objective_score, score_breakdown, warnings, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  baselineId, marketId, 'Baseline Market',
  '4 segments, uniform liquidity, 3% fee — no objective optimisation.',
  JSON.stringify({ marketBriefId: marketId, objective: 'balanced', curve: { builderType: 'buildCurve', segments: [], initialMarketCap: 0.05, migrationMarketCap: 85 }, liquidityDistribution: [], fees: { baseFeeBps: 300, dynamicFeeEnabled: false, creatorTradingFeePercentage: 0, collectFeeMode: 'quote_token' }, graduation: { quoteThreshold: 85 }, warnings: [], createdAt: isoAgo(90) }),
  JSON.stringify(baselineSim),
  0.55,
  JSON.stringify({ priceImpactScore: 0.45, capitalFormationScore: 0.73, progressionScore: 0.60, feeScore: 0.70, weights: { priceImpact: 0.25, capitalFormation: 0.25, progression: 0.25, fee: 0.25 } }),
  JSON.stringify([]),
  isoAgo(90)
);

console.log(`✓ Inserted ${designIds.length} designs + baseline`);

// ── 3. Deployment (confirmed) ──────────────────────────────────────────────

const deploymentId = nanoid(16);

db.prepare(`
  INSERT INTO deployments (id, market_id, design_id, wallet_address,
    pool_address, config_address, transaction_signature, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  deploymentId, marketId, designIds[0],
  'Demo1111111111111111111111111111111111111111',
  'MRDpoo1111111111111111111111111111111111111',
  'MRDcfg1111111111111111111111111111111111111',
  '4uQeVj5tqViQh7yWWGStvkEG1Zu1mDwkXJFJeEexmaR5XM7VzZt6hHVDk7vX1SfzJdPMxANpqdArtm5eXrCXnm',
  'confirmed',
  isoAgo(55), isoAgo(50)
);

console.log(`✓ Confirmed deployment created`);

// ── 4. Observations (60 data points over 55 min) ──────────────────────────

const obStmt = db.prepare(`
  INSERT INTO observations (id, market_id, timestamp, price, quote_reserve,
    volume_24h, traders, buy_volume, sell_volume, graduation_progress)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const TOTAL = 60;

for (let i = 0; i < TOTAL; i++) {
  const t        = i / (TOTAL - 1);
  const noise    = (Math.random() - 0.5) * 0.08;
  const price    = 0.000001 + (0.000054 - 0.000001) * Math.pow(t, 0.7) * (1 + noise);
  const quote    = 12.4 * t;
  const gradPct  = (quote / 85) * 100;
  const vol24h   = 0.4 + Math.random() * 1.2;
  const traders  = Math.floor(8 + t * 40 + Math.random() * 5);
  const buyVol   = vol24h * (0.55 + Math.random() * 0.2);
  const ts       = isoAgo(Math.round((TOTAL - i) * (55 / TOTAL)));

  obStmt.run(nanoid(16), marketId, ts, price, quote, vol24h, traders, buyVol, vol24h - buyVol, gradPct);
}

console.log(`✓ Inserted ${TOTAL} observations`);
console.log('');
console.log('🎯 Demo market ready:');
console.log(`   Name: Meridian Protocol (MRD)`);
console.log(`   ID:   ${marketId}`);
console.log(`   URL:  http://localhost:3000/markets/${marketId}/analysis`);
console.log('');

db.close();
