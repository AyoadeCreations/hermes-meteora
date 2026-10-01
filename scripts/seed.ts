/**
 * Seed script — populates the DB with a demo market, generated designs,
 * and simulated observations for the Analysis page.
 *
 * Run with:
 *   node --require ts-node/register scripts/seed.ts
 * or (if tsx is available):
 *   npx tsx scripts/seed.ts
 */

// ── Bootstrap module resolution ────────────────────────────────────────────
// We need to resolve @/ paths without the Next.js compiler.
const path = require('path');
process.chdir(path.join(__dirname, '..'));

// Patch module resolution for @/ alias
const Module = require('module');
const _resolveFilename = Module._resolveFilename.bind(Module);
Module._resolveFilename = (request: string, parent: NodeJS.Module, isMain: boolean, options: object) => {
  if (request.startsWith('@/')) {
    const resolved = path.join(process.cwd(), 'src', request.slice(2));
    return _resolveFilename(resolved, parent, isMain, options);
  }
  return _resolveFilename(request, parent, isMain, options);
};

import { nanoid } from 'nanoid';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from '../src/lib/db/schema';
import { SOL_MINT } from '../src/domain/types';

// ── Config ─────────────────────────────────────────────────────────────────

const DB_PATH = process.env.DB_PATH ?? './data/meteora-mfe.db';

// ── Setup ──────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.exec(SCHEMA_SQL);

// ── Helpers ────────────────────────────────────────────────────────────────

function now() { return new Date().toISOString(); }

function isoAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

// ── 1. Market ──────────────────────────────────────────────────────────────

const existingMarkets = db.prepare('SELECT id FROM markets LIMIT 1').all();
if (existingMarkets.length > 0) {
  console.log('✓ Markets already seeded — skipping market creation.');
  process.exit(0);
}

const marketId = nanoid(16);

db.prepare(`
  INSERT INTO markets (
    id, token_name, token_symbol, total_supply, quote_mint,
    starting_price, graduation_quote, demand_profile,
    demand_participants, demand_volume, objective, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  marketId,
  'Meridian Protocol',
  'MRD',
  1_000_000_000,
  SOL_MINT,
  0.000001,
  85,
  'medium',
  1200,
  420,
  'balanced',
  isoAgo(120),
  isoAgo(60)
);

console.log(`✓ Created market: Meridian Protocol (MRD) — id=${marketId}`);

// ── 2. Designs ─────────────────────────────────────────────────────────────
// We produce three realistic candidate designs manually, matching what the
// generator would produce for a balanced objective.

const designs = [
  {
    id:          nanoid(16),
    name:        'Balanced Formation',
    description: 'Optimises across price discovery, liquidity depth, and capital formation. Uses 4 curve segments with moderate fees and dynamic fee enabled for volatile periods.',
    objectiveScore: 0.81,
    baseFeeBps:  250,
    dynamicFee:  true,
    segments:    4,
    initialMcap:  0.05,
    migrationMcap: 85.0,
    avgImpact:   2.4,
    finalPrice:  0.000092,
    capitalReq:  74.2,
    graduation:  82,
  },
  {
    id:          nanoid(16),
    name:        'Controlled Discovery',
    description: 'Prioritises smooth price progression. Concentrated liquidity in lower price range with steeper curve above mid-price to discourage speculation.',
    objectiveScore: 0.74,
    baseFeeBps:  300,
    dynamicFee:  false,
    segments:    5,
    initialMcap:  0.03,
    migrationMcap: 85.0,
    avgImpact:   1.8,
    finalPrice:  0.000078,
    capitalReq:  81.1,
    graduation:  76,
  },
  {
    id:          nanoid(16),
    name:        'Fast Capital Formation',
    description: 'Steeper curve with lower fee to maximise trade volume. Graduation threshold is reachable with fewer traders but at higher per-trade price impact.',
    objectiveScore: 0.69,
    baseFeeBps:  150,
    dynamicFee:  true,
    segments:    3,
    initialMcap:  0.08,
    migrationMcap: 85.0,
    avgImpact:   4.1,
    finalPrice:  0.000105,
    capitalReq:  67.3,
    graduation:  89,
  },
];

const baselineId = nanoid(16);

for (const d of designs) {
  const pricePath = Array.from({ length: 50 }, (_, i) => ({
    tradeIndex: i,
    price:      d.finalPrice * (i / 50) * (1 + Math.sin(i / 8) * 0.05),
  }));

  const simulation = {
    scenario:             'B',
    pricePath,
    quoteAccumulation:    pricePath.map((p, i) => ({ tradeIndex: i, quoteAccumulated: (i / 50) * d.capitalReq, graduationPct: (i / 50) * d.graduation })),
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

  const config = {
    marketBriefId:       marketId,
    objective:           'balanced',
    curve: {
      builderType:        'buildCurveWithMarketCap',
      segments:           Array.from({ length: d.segments }, (_, i) => ({
        sqrtPriceLow:     String(Math.floor(Math.sqrt(0.000001 * (1 + i * 0.8)) * 1e12)),
        sqrtPriceHigh:    String(Math.floor(Math.sqrt(0.000001 * (1 + (i + 1) * 0.8)) * 1e12)),
        priceStart:       0.000001 * (1 + i * 0.8),
        priceEnd:         0.000001 * (1 + (i + 1) * 0.8),
        baseTokens:       1_000_000_000 / d.segments,
        quoteTokens:      85 / d.segments,
        liquidityWeight:  1 / d.segments,
      })),
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
      collectFeeMode:              'quote_token' as const,
    },
    graduation: { quoteThreshold: 85 },
    warnings:   [],
    createdAt:  isoAgo(90),
  };

  db.prepare(`
    INSERT INTO market_designs (
      id, market_id, name, description, configuration,
      simulation_result, objective_score, score_breakdown, warnings, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    d.id,
    marketId,
    d.name,
    d.description,
    JSON.stringify(config),
    JSON.stringify(simulation),
    d.objectiveScore,
    JSON.stringify(scoreBreakdown),
    JSON.stringify([]),
    isoAgo(90)
  );
}

// Baseline design
const baselineSim = {
  scenario: 'B', pricePath: [], quoteAccumulation: [], trades: [],
  totalFees: 2.1, averagePriceImpact: 5.5, maxPriceImpact: 9.8,
  finalPrice: 0.000082, startingPrice: 0.000001,
  quoteAtGraduation: 62, graduationReached: false,
  capitalRequired: 78, liquidityUtilization: 0.55, tradeCount: 50,
};
db.prepare(`
  INSERT INTO market_designs (id, market_id, name, description, configuration, simulation_result, objective_score, score_breakdown, warnings, created_at)
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

console.log(`✓ Created ${designs.length} candidate designs + baseline`);

// ── 3. Deployment (simulated confirmed) ────────────────────────────────────

const deploymentId = nanoid(16);
const bestDesignId = designs[0]!.id;

db.prepare(`
  INSERT INTO deployments (
    id, market_id, design_id, wallet_address,
    pool_address, config_address, transaction_signature,
    status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  deploymentId,
  marketId,
  bestDesignId,
  'Demo1111111111111111111111111111111111111111',
  'MRDpoo1111111111111111111111111111111111111',
  'MRDcfg1111111111111111111111111111111111111',
  '4uQeVj5tqViQh7yWWGStvkEG1Zu1mDwkXJFJeEexmaR5XM7VzZt6hHVDk7vX1SfzJdPMxANpqdArtm5eXrCXnm',
  'confirmed',
  isoAgo(55),
  isoAgo(50)
);

console.log(`✓ Created confirmed deployment — config: MRDcfg...`);

// ── 4. Observations (60 data points over 55 minutes) ───────────────────────

const observationStmt = db.prepare(`
  INSERT INTO observations (
    id, market_id, timestamp, price, quote_reserve,
    volume_24h, traders, buy_volume, sell_volume, graduation_progress
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const TOTAL_OBS   = 60;
const basePrice   = 0.000001;
const targetPrice = 0.000054; // realistic after ~55 min activity
const baseQuote   = 0;
const targetQuote = 12.4;     // 12.4 SOL accumulated so far

for (let i = 0; i < TOTAL_OBS; i++) {
  const t          = i / (TOTAL_OBS - 1);
  const noise      = (Math.random() - 0.5) * 0.08;
  const price      = basePrice + (targetPrice - basePrice) * (t ** 0.7) * (1 + noise);
  const quote      = baseQuote + (targetQuote - baseQuote) * t;
  const gradPct    = (quote / 85) * 100;
  const volume24h  = 0.4 + Math.random() * 1.2;
  const traders    = Math.floor(8 + t * 40 + Math.random() * 5);
  const buyVol     = volume24h * (0.55 + Math.random() * 0.2);
  const sellVol    = volume24h - buyVol;
  const timestamp  = isoAgo(Math.round((TOTAL_OBS - i) * (55 / TOTAL_OBS)));

  observationStmt.run(
    nanoid(16),
    marketId,
    timestamp,
    price,
    quote,
    volume24h,
    traders,
    buyVol,
    sellVol,
    gradPct
  );
}

console.log(`✓ Inserted ${TOTAL_OBS} observations over 55 minutes`);
console.log('');
console.log(`🎯 Demo market ready:`);
console.log(`   Name:    Meridian Protocol (MRD)`);
console.log(`   ID:      ${marketId}`);
console.log(`   URL:     http://localhost:3000/markets/${marketId}/analysis`);
console.log('');
console.log('Done.');

db.close();
