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
import { solveCurveForTargetRaise, solveCurveForGrowth, SDK_SEGMENTS, expandWeights } from '@/services/meteora/curve-build';
import { knownQuoteDecimals } from '@/services/meteora/config';
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
  const first = segments[0]?.priceStart ?? 0;
  const last  = segments[segments.length - 1]?.priceEnd ?? 0;
  const growthX = first > 0 ? Math.round(last / first) : 0;

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

function buildLiquidityRanges(segments: CurveSegment[], profile: LiqProfile): LiquidityRange[] {
  const labels: Record<LiqProfile, string> = {
    front_heavy: 'High depth near launch price',
    back_heavy:  'High depth near graduation price',
    uniform:     'Even depth across price range',
    mid_heavy:   'High depth in mid-price range',
  };
  return segments.map((seg) => ({
    priceMin:    seg.priceStart,
    priceMax:    seg.priceEnd,
    weight:      seg.liquidityWeight,
    description: labels[profile],
  }));
}

// ── Curve from the SDK ─────────────────────────────────────────────────────

/**
 * Every design's curve is built by Meteora's own SDK builder, so the simulator
 * runs on exactly the curve that would be deployed.
 */
interface CurveSpec {
  profile:      LiqProfile;
  segmentCount: number;
  targetRaise:  number;
  baseFeeBps:   number;
  growthFactor: number;
}

function curveInputBase(brief: MarketBrief, spec: CurveSpec) {
  const quoteDecimals = knownQuoteDecimals(brief.quoteMint) ?? 9;
  const liquidityWeights = expandWeights(buildLiquidityWeights(spec.profile, spec.segmentCount), SDK_SEGMENTS);
  return { totalSupply: brief.totalSupply, quoteDecimals, liquidityWeights, baseFeeBps: spec.baseFeeBps };
}

/**
 * One starting market cap shared by every design for a brief, so designs are
 * comparable. The creator's starting price is used when every design can raise
 * its target from it. Otherwise the starting price is lowered to the highest value
 * from which all of them can, and the creator is told.
 */
async function chooseStartCap(brief: MarketBrief, specs: CurveSpec[]): Promise<{ cap: number; note: string | null }> {
  const userCap = brief.startingPrice * brief.totalSupply;
  let allFeasible = true;
  for (const spec of specs) {
    const r = await solveCurveForTargetRaise({ ...curveInputBase(brief, spec), initialMarketCap: userCap }, spec.targetRaise);
    if (!r.feasible) { allFeasible = false; break; }
  }
  if (allFeasible) return { cap: userCap, note: null };

  let cap = Infinity;
  for (const spec of specs) {
    const r = await solveCurveForGrowth(curveInputBase(brief, spec), spec.growthFactor, spec.targetRaise);
    cap = Math.min(cap, r.initialMarketCap);
  }
  cap *= 0.999;
  const price = cap / brief.totalSupply;
  return {
    cap,
    note:
      `Your starting price (${brief.startingPrice}) is too high to raise ${brief.graduationQuoteAmount} SOL on this supply. ` +
      `All designs start at ${price.toPrecision(3)} per token instead.`,
  };
}

async function buildCurveForDesign(brief: MarketBrief, spec: CurveSpec, startCap: number) {
  const base = curveInputBase(brief, spec);
  const solved = await solveCurveForTargetRaise({ ...base, initialMarketCap: startCap }, spec.targetRaise);
  const notes: string[] = [];
  if (!solved.feasible) {
    notes.push(
      `This curve raises ${solved.migrationQuote.toFixed(1)} SOL at graduation, not the ${spec.targetRaise.toFixed(1)} SOL target.`,
    );
  }
  return {
    solved: { ...solved, initialMarketCap: startCap },
    quoteDecimals: base.quoteDecimals,
    liquidityWeights: base.liquidityWeights,
    notes,
  };
}

// ── Baseline design ────────────────────────────────────────────────────────

/**
 * Baseline: uniform liquidity, 3% fee. Represents a default configuration that
 * any operator might use without a market-design system. Used for comparison.
 */
const BASELINE_FEE_BPS = 300; // 3%, a default launchpad fee
const baselineSpec = (brief: MarketBrief): CurveSpec => ({
  profile: 'uniform', segmentCount: 4, targetRaise: brief.graduationQuoteAmount, baseFeeBps: BASELINE_FEE_BPS, growthFactor: 10,
});

export async function buildBaseline(brief: MarketBrief, shared?: { cap: number; note: string | null }): Promise<MarketDesign> {
  const feeBps = BASELINE_FEE_BPS;
  const start = shared ?? await chooseStartCap(brief, [baselineSpec(brief)]);
  const { solved, quoteDecimals, liquidityWeights, notes } =
    await buildCurveForDesign(brief, baselineSpec(brief), start.cap);
  if (start.note) notes.unshift(start.note);
  const segments = solved.segments;
  const gradThreshold = solved.migrationQuote;

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
    startingPrice:       segments[0]?.priceStart ?? brief.startingPrice,
    graduationThreshold: gradThreshold,
    fees,
    params: { scenario: 'B', tradeCount: 50, tradeSizeQuote, sellFraction: 0.2 },
  });

  const scoreBreakdown = scoreObjective(brief.objective, sim, gradThreshold);

  return {
    id:            nanoid(12),
    marketBriefId: brief.id,
    name:          'Baseline Market',
    description:   'Uniform liquidity curve with a 3% fee. Represents a default configuration without market-design optimisation. Used for comparison only.',
    objective:     brief.objective,
    curve: {
      builderType:        'buildCurveWithLiquidityWeights',
      segments,
      initialMarketCap:   solved.initialMarketCap,
      migrationMarketCap: solved.migrationMarketCap,
      liquidityWeights,
      quoteDecimals,
      leftover:           solved.leftover,
    },
    liquidityDistribution: buildLiquidityRanges(segments, 'uniform'),
    fees,
    graduation: { quoteThreshold: gradThreshold },
    simulation: sim,
    warnings: [
      'This is the baseline comparison design, not a recommended configuration.',
      '3% fee is higher than optimised designs. Not tuned to your stated objective.',
      ...notes,
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

export async function generateCandidates(brief: MarketBrief): Promise<GenerationResult> {
  const allViolations: ConstraintViolation[] = [...validateBrief(brief)];
  const designs: MarketDesign[] = [];

  const templates     = TEMPLATES[brief.objective];
  const demandMult    = demandMultiplier(brief.expectedDemand.profile);
  const tradeSizeQuote = (brief.graduationQuoteAmount / 20) * demandMult;

  const specFor = (t: Template): CurveSpec => ({
    profile:      t.liquidityProfile,
    segmentCount: t.segmentCount,
    targetRaise:  brief.graduationQuoteAmount * t.graduationMultiplier,
    baseFeeBps:   Math.max(MIN_FEE_BPS, Math.min(MAX_FEE_BPS, t.feeBps)),
    growthFactor: t.priceGrowthFactor,
  });
  const shared = await chooseStartCap(brief, [...templates.map(specFor), baselineSpec(brief)]);

  for (const template of templates) {
    const feeBps = Math.max(MIN_FEE_BPS, Math.min(MAX_FEE_BPS, template.feeBps));
    const { solved, quoteDecimals, liquidityWeights, notes } =
      await buildCurveForDesign(brief, specFor(template), shared.cap);
    if (shared.note) notes.unshift(shared.note);
    const segments = solved.segments;
    const graduationThreshold = solved.migrationQuote;

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
      startingPrice:       segments[0]?.priceStart ?? brief.startingPrice,
      graduationThreshold,
      fees,
      params: { scenario: 'B', tradeCount: 50, tradeSizeQuote, sellFraction: 0.2 },
    });

    const scoreBreakdown = scoreObjective(brief.objective, sim, graduationThreshold);
    const objectiveScore = computeWeightedScore(scoreBreakdown);

    const simWarnings = [
      ...validateSimulationResult(sim, brief.objective).map((v) => v.message),
      ...notes,
    ];
    const rationale = buildRationale(template, segments, sim, graduationThreshold);

    designs.push({
      id:            nanoid(12),
      marketBriefId: brief.id,
      name:          template.name,
      description:   rationale,
      objective:     brief.objective,
      curve: {
        builderType:        'buildCurveWithLiquidityWeights',
        segments,
        initialMarketCap:   solved.initialMarketCap,
        migrationMarketCap: solved.migrationMarketCap,
        liquidityWeights,
        quoteDecimals,
        leftover:           solved.leftover,
      },
      liquidityDistribution: buildLiquidityRanges(segments, template.liquidityProfile),
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

  const baseline = await buildBaseline(brief, shared);

  return {
    designs,
    baseline,
    violations: allViolations,
    warnings:   allViolations.map((v) => v.message),
  };
}
