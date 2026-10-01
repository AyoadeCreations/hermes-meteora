/**
 * Objective Scoring Engine
 *
 * Translates a MarketObjective into measurable evaluation weights,
 * then scores a SimulationResult against those weights.
 *
 * Scoring model is transparent and fully documented.
 * Every score is derived from actual simulation output — no arbitrary values.
 *
 * A user can understand "why did Design A score higher?" from the breakdown
 * without reading source code.
 *
 * score = w_impact × priceImpactScore
 *       + w_capital × capitalFormationScore
 *       + w_progression × progressionScore
 *       + w_fee × feeScore
 *
 * Each component is normalised to [0, 1].
 * Weights per objective sum to 1.0.
 */

import type {
  MarketObjective,
  SimulationResult,
  ObjectiveScoreBreakdown,
  ObjectiveWeights,
} from '@/domain/types';

// ── Weight profiles ────────────────────────────────────────────────────────

/**
 * Each objective emphasises different market quality dimensions.
 *
 * controlled_discovery: smooth progression + low impact
 * low_price_impact:     lowest possible slippage above all else
 * fast_capital_formation: graduate as fast as possible
 * balanced:             optimise across all four dimensions equally-ish
 */
export const OBJECTIVE_WEIGHTS: Record<MarketObjective, ObjectiveWeights> = {
  controlled_discovery: {
    priceImpact:      0.40,
    capitalFormation: 0.20,
    progression:      0.35,
    fee:              0.05,
  },
  low_price_impact: {
    priceImpact:      0.60,
    capitalFormation: 0.15,
    progression:      0.20,
    fee:              0.05,
  },
  fast_capital_formation: {
    priceImpact:      0.15,
    capitalFormation: 0.60,
    progression:      0.15,
    fee:              0.10,
  },
  balanced: {
    priceImpact:      0.30,
    capitalFormation: 0.30,
    progression:      0.25,
    fee:              0.15,
  },
};

// ── Normalisation helpers ──────────────────────────────────────────────────

/**
 * Soft exponential decay: value=0 → 1.0, value=halfTarget → 0.5, value→∞ → 0
 * Used for dimensions where lower is better (price impact, fee distance).
 */
function decayScore(value: number, halfTarget: number): number {
  if (halfTarget <= 0) return value === 0 ? 1 : 0;
  return 1 / (1 + value / halfTarget);
}

/**
 * Linear score: value=0 → 0, value≥cap → 1.0
 * Used for dimensions where higher is better up to a ceiling.
 */
function linearScore(value: number, cap: number): number {
  if (cap <= 0) return 0;
  return Math.min(1, value / cap);
}

// ── Score dimensions ───────────────────────────────────────────────────────

/**
 * PRICE IMPACT SCORE [0, 1]
 *
 * Measures: average per-trade price impact across buy trades.
 * Normalisation: decay with half-target = 10%.
 *   0%  impact → 1.0
 *   10% impact → 0.5
 *   25% impact → ~0.29
 *
 * Lower price impact = better score.
 */
function scorePriceImpact(result: SimulationResult): number {
  return decayScore(result.averagePriceImpact, 10);
}

/**
 * CAPITAL FORMATION SCORE [0, 1]
 *
 * Measures: fraction of graduation threshold accumulated in simulation.
 * Normalisation: linear, capped at 1.0 when graduation is reached.
 *   0% progress → 0.0
 *   50% progress → 0.5
 *   100% (graduation) → 1.0
 */
function scoreCapitalFormation(
  result: SimulationResult,
  graduationThreshold: number
): number {
  if (graduationThreshold <= 0) return 0;
  return Math.min(1, result.quoteAtGraduation / graduationThreshold);
}

/**
 * PROGRESSION SCORE [0, 1]
 *
 * Measures: smoothness of price path.
 * Method: coefficient of variation (stddev/mean) of relative step sizes.
 * A perfectly monotone curve has CV=0 → score=1.0.
 * A chaotic price path has high CV → score approaches 0.
 *
 * score = max(0, 1 - CV/2)
 * capped so that CV=2 (extreme choppiness) gives score=0.
 */
function scoreProgression(result: SimulationResult): number {
  const prices = result.pricePath.map((p) => p.price);
  if (prices.length < 3) return 0.5;

  const steps: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1] ?? 0;
    const curr = prices[i] ?? 0;
    if (prev > 0) {
      steps.push(Math.abs((curr - prev) / prev));
    }
  }

  if (steps.length === 0) return 0.5;

  const n    = steps.length;
  const mean = steps.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 1.0; // flat price = perfectly smooth (no-buy case)

  const variance = steps.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const cv       = Math.sqrt(variance) / mean;

  return Math.max(0, Math.min(1, 1 - cv / 2));
}

/**
 * FEE SCORE [0, 1]
 *
 * Measures: how well the fee rate fits a healthy target range.
 * Target: fees = 1–5% of total capital deployed.
 * Below 0.5% or above 15% is penalised.
 * Half-target for decay = 4% distance from optimal midpoint (3%).
 */
function scoreFee(result: SimulationResult): number {
  if (result.capitalRequired <= 0) return 0;
  const feeRate = result.totalFees / result.capitalRequired;
  const optimal = 0.03; // 3% of capital as fees is the target midpoint
  const dist    = Math.abs(feeRate - optimal);
  return decayScore(dist, 0.04);
}

// ── Main scoring function ──────────────────────────────────────────────────

export function scoreObjective(
  objective:           MarketObjective,
  result:              SimulationResult,
  graduationThreshold: number,
): ObjectiveScoreBreakdown {
  const weights = OBJECTIVE_WEIGHTS[objective];

  return {
    priceImpactScore:      scorePriceImpact(result),
    capitalFormationScore: scoreCapitalFormation(result, graduationThreshold),
    progressionScore:      scoreProgression(result),
    feeScore:              scoreFee(result),
    weights,
  };
}

/**
 * Final weighted score from a breakdown.
 * score = Σ(weight_i × dimension_i)
 */
export function computeWeightedScore(breakdown: ObjectiveScoreBreakdown): number {
  const { weights: w } = breakdown;
  return (
    w.priceImpact      * breakdown.priceImpactScore      +
    w.capitalFormation * breakdown.capitalFormationScore  +
    w.progression      * breakdown.progressionScore      +
    w.fee              * breakdown.feeScore
  );
}
