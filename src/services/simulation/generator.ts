/**
 * Candidate Generation Engine
 *
 * Architecture:
 *   MarketBrief → Constraint Validation → Candidate Generator
 *   → Simulation Engine → Objective Scorer → Ranked Designs + Baseline
 *
 * Generates exactly 3 materially different candidates per objective,
 * plus one baseline design for comparison.
 *
 * Candidates differ in: curve aggressiveness, segmentation,
 * liquidity distribution, fee structure, and graduation threshold.
 *
 * All designs respect Meteora DBC protocol limits:
 *   MIN_FEE_BPS = 25, MAX_FEE_BPS = 9900, MAX_CURVE_POINTS = 16
 */

import { nanoid } from 'nanoid';
import type { MarketBrief, MarketDesign, CurveSegment, LiquidityRange } from '@/domain/types';
import type { ConstraintViolation } from '@/domain/schemas';
import { runSimulation } from './engine';
import { scoreObjective, computeWeightedScore } from './scoring';
import {
  validateBrief,
  validateFeeConfig,
  validateSimulationResult,
  validateDesignFeasibility,
} from './constraints';

const MIN_FEE_BPS   = 25;
const MAX_FEE_BPS   = 9900;
const Q64           = BigInt('18446744073709551616'); // 2^64
const MIN_PRICE     = 1e-18; // guard against division by zero in CLMM

// ── Sqrt price ─────────────────────────────────────────────────────────────

function priceToSqrtPrice(price: number): bigint {
  const safePrice = Math.max(price, MIN_PRICE);
  return BigInt(Math.round(Math.sqrt(safePrice) * Number(Q64)));
}

// ── Segment builder ────────────────────────────────────────────────────────

function buildSegments(
  prices:           number[],
  totalSupply:      number,
  liquidityWeights: number[],
): CurveSegment[] {
  const totalWeight = liquidityWeights.reduce((a, b) => a + b, 0);
  const segments: CurveSegment[] = [];

  for (let i = 0; i < prices.length - 1; i++) {
    const priceStart = Math.max(prices[i] ?? MIN_PRICE, MIN_PRICE);
    const priceEnd   = Math.max(prices[i + 1] ?? priceStart * 2, priceStart * 1.0001);
    const weight     = ((liquidityWeights[i] ?? 1) / totalWeight);
    // 70% of supply on curve, 30% reserved for migration
    const baseTokens = Math.floor(totalSupply * weight * 0.70);
    // Approximate quote reserve using geometric mean price
    const meanPrice  = Math.sqrt(priceStart * priceEnd);
    const quoteTokens = baseTokens * meanPrice;

    segments.push({
      sqrtPriceLow:    priceToSqrtPrice(priceStart).toString(),
      sqrtPriceHigh:   priceToSqrtPrice(priceEnd).toString(),
      priceStart,
      priceEnd,
      baseTokens,
      quoteTokens,
      liquidityWeight: weight,
    });
  }

  return segments;
}

// ── Exponential price ladder ───────────────────────────────────────────────

function buildPricePoints(start: number, growthFactor: number, count: number): number[] {
  const points: number[] = [];
  for (let i = 0; i <= count; i++) {
    points.push(start * Math.pow(growthFactor, i / count));
  }
  return points;
}

// ── Liquidity weight profiles ──────────────────────────────────────────────

type LiqProfile = 'front_heavy' | 'uniform' | 'back_heavy' | 'mid_heavy';

function buildLiquidityWeights(profile: LiqProfile, count: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    const t = count > 1 ? i / (count - 1) : 0;
    switch (profile) {
      case 'front_heavy': return Math.max(0.1, 1 - t * 0.75);
      case 'back_heavy':  return Math.max(0.1, 0.25 + t * 0.75);
      case 'uniform':     return 1.0;
      case 'mid_heavy': {
        const dist = Math.abs(t - 0.5);
        return Math.max(0.1, 1 - dist * 1.5);
      }
    }
  });
}

// ── Demand multiplier ──────────────────────────────────────────────────────

function demandMultiplier(profile: 'low' | 'medium' | 'high'): number {
  return { low: 0.4, medium: 1.0, high: 2.2 }[profile];
}

// ── Candidate template ─────────────────────────────────────────────────────

interface Template {
  id:          'A' | 'B' | 'C';
  name:        string;
  liquidityProfile: LiqProfile;
  graduationMultiplier: number;
  priceGrowthFactor:    number;
  segmentCount:         number;
  feeBps:               number;
  dynamicFee:           boolean;
  creatorFeePct:        number;
}

// Templates are meaningfully different:
// - feeBps range: 50 → 200 (4x)
// - priceGrowthFactor: 6x → 60x (10x difference)
// - segmentCount: 4 → 12 (3x)
// - liquidityProfile: completely different shapes
const TEMPLATES: Record<MarketBrief['objective'], Template[]> = {
  controlled_discovery: [
    { id: 'A', name: 'Controlled Discovery',  liquidityProfile: 'front_heavy', graduationMultiplier: 1.0,  priceGrowthFactor: 8,  segmentCount: 10, feeBps: 100, dynamicFee: false, creatorFeePct: 10 },
    { id: 'B', name: 'Balanced Formation',    liquidityProfile: 'uniform',     graduationMultiplier: 1.0,  priceGrowthFactor: 20, segmentCount: 6,  feeBps: 150, dynamicFee: true,  creatorFeePct: 10 },
    { id: 'C', name: 'Progressive Ramp',      liquidityProfile: 'back_heavy',  graduationMultiplier: 0.90, priceGrowthFactor: 40, segmentCount: 4,  feeBps: 75,  dynamicFee: false, creatorFeePct: 5  },
  ],
  low_price_impact: [
    { id: 'A', name: 'Deep Liquidity Pool',   liquidityProfile: 'front_heavy', graduationMultiplier: 1.2,  priceGrowthFactor: 6,  segmentCount: 12, feeBps: 50,  dynamicFee: false, creatorFeePct: 5  },
    { id: 'B', name: 'Wide Market Spread',    liquidityProfile: 'uniform',     graduationMultiplier: 1.0,  priceGrowthFactor: 12, segmentCount: 10, feeBps: 75,  dynamicFee: false, creatorFeePct: 7  },
    { id: 'C', name: 'Mid-Range Depth',       liquidityProfile: 'mid_heavy',   graduationMultiplier: 1.0,  priceGrowthFactor: 18, segmentCount: 8,  feeBps: 100, dynamicFee: true,  creatorFeePct: 10 },
  ],
  fast_capital_formation: [
    { id: 'A', name: 'Sprint Curve',          liquidityProfile: 'back_heavy',  graduationMultiplier: 0.75, priceGrowthFactor: 60, segmentCount: 4,  feeBps: 50,  dynamicFee: false, creatorFeePct: 5  },
    { id: 'B', name: 'Efficient Growth',      liquidityProfile: 'uniform',     graduationMultiplier: 0.85, priceGrowthFactor: 35, segmentCount: 6,  feeBps: 100, dynamicFee: false, creatorFeePct: 7  },
    { id: 'C', name: 'Graduated Ramp',        liquidityProfile: 'mid_heavy',   graduationMultiplier: 0.90, priceGrowthFactor: 25, segmentCount: 8,  feeBps: 150, dynamicFee: true,  creatorFeePct: 10 },
  ],
  balanced: [
    { id: 'A', name: 'Steady Discovery',      liquidityProfile: 'front_heavy', graduationMultiplier: 1.0,  priceGrowthFactor: 12, segmentCount: 8,  feeBps: 100, dynamicFee: false, creatorFeePct: 10 },
    { id: 'B', name: 'Balanced Formation',    liquidityProfile: 'uniform',     graduationMultiplier: 1.0,  priceGrowthFactor: 25, segmentCount: 6,  feeBps: 150, dynamicFee: true,  creatorFeePct: 10 },
    { id: 'C', name: 'Growth Optimised',      liquidityProfile: 'back_heavy',  graduationMultiplier: 0.90, priceGrowthFactor: 45, segmentCount: 4,  feeBps: 75,  dynamicFee: false, creatorFeePct: 5  },
  ],
};

// ── Design rationale generator ─────────────────────────────────────────────

/**
 * Deterministic explanation derived from actual config parameters.
 * No LLM — text is assembled from concrete measurements.
 */
function buildRationale(
  template:  Template,
  segments:  CurveSegment[],
  sim:       { averagePriceImpact: number; quoteAtGraduation: number; capitalRequired: number },
  gradThreshold: number,
): string {
  const gradPct  = gradThreshold > 0 ? (sim.quoteAtGraduation / gradThreshold * 100).toFixed(1) : '0.0';
  const feePct   = (template.feeBps / 100).toFixed(2);
  const segments_s = segments.length;
  const growthX  = template.priceGrowthFactor;

  const profileDesc: Record<LiqProfile, string> = {
    front_heavy:  'concentrates effective liquidity near the starting price, reducing early price impact for the first buyers',
    uniform:      'distributes liquidity evenly across the entire price range, providing consistent depth throughout the curve',
    back_heavy:   'places more liquidity in the upper price range, which accelerates price progression and capital formation at the cost of higher early impact',
    mid_heavy:    'concentrates liquidity in the mid-price range, balancing early accessibility with upper-range efficiency',
  };

  const impactNote = sim.averagePriceImpact < 5
    ? 'producing low per-trade slippage'
    : sim.averagePriceImpact < 15
    ? 'producing moderate per-trade slippage'
    : 'producing higher per-trade slippage in exchange for faster price progression';

  return (
    `This design uses ${segments_s} curve segments spanning a ${growthX}× price range. ` +
    `The ${template.liquidityProfile.replace('_', '-')} liquidity profile ${profileDesc[template.liquidityProfile]}. ` +
    `At ${feePct}% base fee, ${impactNote}. ` +
    `Under the simulated scenario, this configuration reaches ${gradPct}% of the graduation target, ` +
    `requiring ${sim.capitalRequired.toFixed(2)} SOL in capital.`
  );
}

// ── Liquidity range descriptions ───────────────────────────────────────────

function buildLiquidityRanges(prices: number[], profile: LiqProfile): LiquidityRange[] {
  const weights = buildLiquidityWeights(profile, prices.length - 1);
  const labels: Record<LiqProfile, string> = {
    front_heavy: 'High depth near launch price',
    back_heavy:  'High depth near graduation price',
    uniform:     'Even depth across price range',
    mid_heavy:   'High depth in mid-price range',
  };
  return prices.slice(0, -1).map((pMin, i) => ({
    priceMin:    pMin,
    priceMax:    prices[i + 1] ?? pMin * 2,
    weight:      weights[i] ?? 1,
    description: labels[profile],
  }));
}

// ── Baseline design ────────────────────────────────────────────────────────

/**
 * Baseline: simple linear curve, uniform liquidity, median fee.
 * Represents a naive/default configuration that any operator might use
 * without a market-design system.
 * Used for comparison — not the recommended choice.
 */
export function buildBaseline(brief: MarketBrief): MarketDesign {
  const prices   = buildPricePoints(brief.startingPrice, 10, 4);
  const weights  = buildLiquidityWeights('uniform', 4);
  const segments = buildSegments(prices, brief.totalSupply, weights);
  const gradThreshold = brief.graduationQuoteAmount;
  const feeBps   = 300; // 3% — a default launchpad fee

  const fees = {
    baseFeeBps:                 feeBps,
    dynamicFeeEnabled:          false,
    creatorTradingFeePercentage: 10,
    collectFeeMode:             'quote_token' as const,
  };

  const demandMult     = demandMultiplier(brief.expectedDemand.profile);
  const tradeSizeQuote = (brief.graduationQuoteAmount / 20) * demandMult;

  const sim = runSimulation({
    segments,
    startingPrice:       brief.startingPrice,
    graduationThreshold: gradThreshold,
    fees,
    params: { scenario: 'B', tradeCount: 50, tradeSizeQuote, sellFraction: 0.2 },
  });

  const scoreBreakdown = scoreObjective(brief.objective, sim, gradThreshold);

  return {
    id:            nanoid(12),
    marketBriefId: brief.id,
    name:          'Baseline Market',
    description:   'Simple 4-segment uniform curve with 3% fee. Represents a default configuration without market-design optimisation. Used for comparison only.',
    objective:     brief.objective,
    curve: {
      builderType:        'buildCurve',
      segments,
      initialMarketCap:   Math.max(0.001, Math.min(
        brief.startingPrice * brief.totalSupply,
        brief.graduationQuoteAmount * 0.5
      )),
      migrationMarketCap: brief.graduationQuoteAmount,
    },
    liquidityDistribution: buildLiquidityRanges(prices, 'uniform'),
    fees,
    graduation: { quoteThreshold: gradThreshold },
    simulation: sim,
    warnings: [
      'This is the baseline comparison design — not a recommended configuration.',
      '3% fee is higher than optimised designs. Not tuned to your stated objective.',
    ],
    objectiveScore:  computeWeightedScore(scoreBreakdown),
    scoreBreakdown,
    createdAt:       new Date().toISOString(),
  };
}

// ── Main generation function ───────────────────────────────────────────────

export interface GenerationResult {
  designs:    MarketDesign[];   // 3 candidates, sorted by score desc
  baseline:   MarketDesign;     // for comparison
  violations: ConstraintViolation[];
  warnings:   string[];
}

export function generateCandidates(brief: MarketBrief): GenerationResult {
  const allViolations: ConstraintViolation[] = [...validateBrief(brief)];
  const designs: MarketDesign[] = [];

  const templates     = TEMPLATES[brief.objective];
  const demandMult    = demandMultiplier(brief.expectedDemand.profile);
  const tradeSizeQuote = (brief.graduationQuoteAmount / 20) * demandMult;

  for (const template of templates) {
    const prices   = buildPricePoints(brief.startingPrice, template.priceGrowthFactor, template.segmentCount);
    const weights  = buildLiquidityWeights(template.liquidityProfile, template.segmentCount);
    const segments = buildSegments(prices, brief.totalSupply, weights);

    const graduationThreshold = brief.graduationQuoteAmount * template.graduationMultiplier;

    const feeBps = Math.max(MIN_FEE_BPS, Math.min(MAX_FEE_BPS, template.feeBps));
    const fees = {
      baseFeeBps:                 feeBps,
      dynamicFeeEnabled:          template.dynamicFee,
      creatorTradingFeePercentage: template.creatorFeePct,
      collectFeeMode:             'quote_token' as const,
    };

    allViolations.push(...validateFeeConfig(fees));
    allViolations.push(...validateDesignFeasibility(brief, feeBps, segments.length));

    const sim = runSimulation({
      segments,
      startingPrice:       brief.startingPrice,
      graduationThreshold,
      fees,
      params: { scenario: 'B', tradeCount: 50, tradeSizeQuote, sellFraction: 0.2 },
    });

    const scoreBreakdown = scoreObjective(brief.objective, sim, graduationThreshold);
    const objectiveScore = computeWeightedScore(scoreBreakdown);

    const simWarnings = validateSimulationResult(sim, brief.objective).map((v) => v.message);
    const rationale   = buildRationale(template, segments, sim, graduationThreshold);

    designs.push({
      id:            nanoid(12),
      marketBriefId: brief.id,
      name:          template.name,
      description:   rationale,
      objective:     brief.objective,
      curve: {
        builderType:        'buildCurveWithLiquidityWeights',
        segments,
        // initialMarketCap must be a small SOL value representing the implied
        // market cap at launch. SDK expects SOL units, not price×supply in lamports.
        // We clamp to [0.001, migrationMarketCap * 0.5] to ensure it is always
        // smaller than migrationMarketCap and within SDK-valid range.
        initialMarketCap:   Math.max(0.001, Math.min(
          brief.startingPrice * brief.totalSupply,
          brief.graduationQuoteAmount * template.graduationMultiplier * 0.5
        )),
        // migrationMarketCap = the graduation quote threshold in SOL.
        // This is what the SDK uses to determine when the pool graduates.
        migrationMarketCap: brief.graduationQuoteAmount * template.graduationMultiplier,
      },
      liquidityDistribution: buildLiquidityRanges(prices, template.liquidityProfile),
      fees,
      graduation: { quoteThreshold: graduationThreshold },
      simulation:    sim,
      warnings:      simWarnings,
      objectiveScore,
      scoreBreakdown,
      createdAt:     new Date().toISOString(),
    });
  }

  // Sort by objective score descending
  designs.sort((a, b) => b.objectiveScore - a.objectiveScore);

  const baseline = buildBaseline(brief);

  return {
    designs,
    baseline,
    violations: allViolations,
    warnings:   allViolations.map((v) => v.message),
  };
}
