/**
 * Scoring Engine Verification Tests (Audit D)
 *
 * Verifies that scores are derived from actual simulation outputs
 * and that the mathematical properties of each dimension hold.
 *
 * These are not range tests — they verify specific relationships.
 */

import { describe, it, expect } from 'vitest';
import { scoreObjective, computeWeightedScore, OBJECTIVE_WEIGHTS } from '@/services/simulation/scoring';
import { generateCandidates } from '@/services/simulation/generator';
import type { SimulationResult, MarketBrief } from '@/domain/types';
import { nanoid } from 'nanoid';

function makeResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
  return {
    scenario:             'B',
    pricePath:            [
      { tradeIndex: 0, price: 0.001 },
      { tradeIndex: 1, price: 0.0012 },
      { tradeIndex: 2, price: 0.0014 },
      { tradeIndex: 3, price: 0.0016 },
    ],
    quoteAccumulation:    [
      { tradeIndex: 0, quoteAccumulated: 0,  graduationPct: 0  },
      { tradeIndex: 1, quoteAccumulated: 10, graduationPct: 12 },
      { tradeIndex: 2, quoteAccumulated: 20, graduationPct: 24 },
      { tradeIndex: 3, quoteAccumulated: 30, graduationPct: 35 },
    ],
    trades:               [],
    totalFees:            0.9,   // 3% of 30 SOL capital
    averagePriceImpact:   3.0,
    maxPriceImpact:       5.0,
    finalPrice:           0.0016,
    startingPrice:        0.001,
    quoteAtGraduation:    30,
    graduationReached:    false,
    capitalRequired:      30,
    liquidityUtilization: 0.15,
    tradeCount:           20,
    ...overrides,
  };
}

function makeBrief(overrides: Partial<MarketBrief> = {}): MarketBrief {
  const now = new Date().toISOString();
  return {
    id: nanoid(16), tokenName: 'T', tokenSymbol: 'T',
    totalSupply: 1_000_000,
    quoteMint: 'So11111111111111111111111111111111111111112',
    startingPrice: 0.0001, graduationQuoteAmount: 85,
    expectedDemand: { profile: 'medium' }, objective: 'balanced',
    createdAt: now, updatedAt: now, ...overrides,
  };
}

describe('Scoring engine: verified math', () => {
  // ── Price impact score ────────────────────────────────────────────────────

  it('price impact score at 0% impact = 1.0', () => {
    const r = makeResult({ averagePriceImpact: 0 });
    const bd = scoreObjective('balanced', r, 85);
    expect(bd.priceImpactScore).toBeCloseTo(1.0, 3);
  });

  it('price impact score at 10% impact ≈ 0.5 (half-target)', () => {
    const r = makeResult({ averagePriceImpact: 10 });
    const bd = scoreObjective('balanced', r, 85);
    // decay formula: 1 / (1 + 10/10) = 0.5
    expect(bd.priceImpactScore).toBeCloseTo(0.5, 3);
  });

  it('price impact score at 10% < score at 5%', () => {
    const low  = scoreObjective('balanced', makeResult({ averagePriceImpact: 5 }),  85);
    const high = scoreObjective('balanced', makeResult({ averagePriceImpact: 10 }), 85);
    expect(low.priceImpactScore).toBeGreaterThan(high.priceImpactScore);
  });

  // ── Capital formation score ───────────────────────────────────────────────

  it('capital formation score at 0% graduation = 0.0', () => {
    const r = makeResult({ quoteAtGraduation: 0 });
    const bd = scoreObjective('balanced', r, 85);
    expect(bd.capitalFormationScore).toBeCloseTo(0, 5);
  });

  it('capital formation score at 100% graduation = 1.0', () => {
    const r = makeResult({ quoteAtGraduation: 85, graduationReached: true });
    const bd = scoreObjective('balanced', r, 85);
    expect(bd.capitalFormationScore).toBeCloseTo(1.0, 5);
  });

  it('capital formation score at 50% graduation ≈ 0.5', () => {
    const r = makeResult({ quoteAtGraduation: 42.5 });
    const bd = scoreObjective('balanced', r, 85);
    expect(bd.capitalFormationScore).toBeCloseTo(0.5, 2);
  });

  // ── Progression score ─────────────────────────────────────────────────────

  it('monotone price path has high progression score', () => {
    // Perfectly uniform steps
    const r = makeResult({
      pricePath: [
        { tradeIndex: 0, price: 1.0 },
        { tradeIndex: 1, price: 1.1 },
        { tradeIndex: 2, price: 1.2 },
        { tradeIndex: 3, price: 1.3 },
      ],
    });
    const bd = scoreObjective('balanced', r, 85);
    // CV of [0.1, 0.0909, 0.0833] is low → high score
    expect(bd.progressionScore).toBeGreaterThan(0.7);
  });

  it('chaotic price path has lower progression score than smooth', () => {
    const smooth = makeResult({
      pricePath: [
        { tradeIndex: 0, price: 1.0 },
        { tradeIndex: 1, price: 1.1 },
        { tradeIndex: 2, price: 1.2 },
        { tradeIndex: 3, price: 1.3 },
      ],
    });
    const chaotic = makeResult({
      pricePath: [
        { tradeIndex: 0, price: 1.0 },
        { tradeIndex: 1, price: 2.0 },
        { tradeIndex: 2, price: 0.5 },
        { tradeIndex: 3, price: 3.0 },
      ],
    });
    const bdSmooth  = scoreObjective('balanced', smooth,  85);
    const bdChaotic = scoreObjective('balanced', chaotic, 85);
    expect(bdSmooth.progressionScore).toBeGreaterThan(bdChaotic.progressionScore);
  });

  // ── Fee score ─────────────────────────────────────────────────────────────

  it('fee score is highest when fee rate ≈ 3% of capital', () => {
    // totalFees = 3% of capitalRequired = 1 * 0.03 = 0.03
    const perfect = makeResult({ totalFees: 0.03, capitalRequired: 1.0 });
    const low     = makeResult({ totalFees: 0.001, capitalRequired: 1.0 });
    const high    = makeResult({ totalFees: 0.15,  capitalRequired: 1.0 });
    const bdP = scoreObjective('balanced', perfect, 85);
    const bdL = scoreObjective('balanced', low,     85);
    const bdH = scoreObjective('balanced', high,    85);
    expect(bdP.feeScore).toBeGreaterThan(bdL.feeScore);
    expect(bdP.feeScore).toBeGreaterThan(bdH.feeScore);
  });

  // ── Weighted score ────────────────────────────────────────────────────────

  it('weighted score = sum of (weight × dimension)', () => {
    const result = makeResult();
    const bd = scoreObjective('controlled_discovery', result, 85);
    const w  = OBJECTIVE_WEIGHTS['controlled_discovery']!;
    const expected =
      w.priceImpact      * bd.priceImpactScore +
      w.capitalFormation * bd.capitalFormationScore +
      w.progression      * bd.progressionScore +
      w.fee              * bd.feeScore;
    expect(computeWeightedScore(bd)).toBeCloseTo(expected, 10);
  });

  // ── End-to-end: generated design scores trace to simulation ──────────────

  it('generated design objectiveScore is computed from its actual simulation', () => {
    const brief = makeBrief({ objective: 'low_price_impact' });
    const { designs } = generateCandidates(brief);
    for (const design of designs) {
      // Recompute score from the stored simulation and compare
      const recomputed = scoreObjective(
        design.objective,
        design.simulation,
        design.graduation.quoteThreshold
      );
      const recomputedTotal = computeWeightedScore(recomputed);
      expect(design.objectiveScore).toBeCloseTo(recomputedTotal, 8);
    }
  });

  it('designs sorted by objectiveScore match score ordering across all objectives', () => {
    const objectives = ['controlled_discovery', 'low_price_impact', 'fast_capital_formation', 'balanced'] as const;
    for (const obj of objectives) {
      const brief = makeBrief({ objective: obj });
      const { designs } = generateCandidates(brief);
      for (let i = 1; i < designs.length; i++) {
        expect(designs[i - 1]!.objectiveScore).toBeGreaterThanOrEqual(designs[i]!.objectiveScore);
      }
    }
  });
});
