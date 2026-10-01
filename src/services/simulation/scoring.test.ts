/**
 * Objective scoring + candidate generation tests
 */

import { describe, it, expect } from 'vitest';
import { scoreObjective, computeWeightedScore, OBJECTIVE_WEIGHTS } from '@/services/simulation/scoring';
import { generateCandidates } from '@/services/simulation/generator';
import type { SimulationResult, MarketBrief } from '@/domain/types';
import { nanoid } from 'nanoid';

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeFakeResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
  return {
    scenario:             'B',
    pricePath:            [{ tradeIndex: 0, price: 0.001 }, { tradeIndex: 1, price: 0.0015 }],
    quoteAccumulation:    [{ tradeIndex: 0, quoteAccumulated: 0, graduationPct: 0 }, { tradeIndex: 1, quoteAccumulated: 5, graduationPct: 5.9 }],
    trades:               [],
    totalFees:            0.2,
    averagePriceImpact:   3.5,
    maxPriceImpact:       8.0,
    finalPrice:           0.0015,
    startingPrice:        0.001,
    quoteAtGraduation:    5,
    graduationReached:    false,
    capitalRequired:      5,
    liquidityUtilization: 0.06,
    tradeCount:           20,
    ...overrides,
  };
}

function makeBrief(overrides: Partial<MarketBrief> = {}): MarketBrief {
  const now = new Date().toISOString();
  return {
    id:            nanoid(16),
    tokenName:     'Test Token',
    tokenSymbol:   'TEST',
    totalSupply:   1_000_000,
    quoteMint:     'So11111111111111111111111111111111111111112',
    startingPrice: 0.0001,
    graduationQuoteAmount: 85,
    expectedDemand: { profile: 'medium' },
    objective:     'balanced',
    createdAt:     now,
    updatedAt:     now,
    ...overrides,
  };
}

// ── Objective scoring ──────────────────────────────────────────────────────

describe('scoreObjective', () => {
  it('returns scores between 0 and 1 for all dimensions', () => {
    const result   = makeFakeResult();
    const breakdown = scoreObjective('balanced', result, 85);
    expect(breakdown.priceImpactScore).toBeGreaterThanOrEqual(0);
    expect(breakdown.priceImpactScore).toBeLessThanOrEqual(1);
    expect(breakdown.capitalFormationScore).toBeGreaterThanOrEqual(0);
    expect(breakdown.capitalFormationScore).toBeLessThanOrEqual(1);
    expect(breakdown.progressionScore).toBeGreaterThanOrEqual(0);
    expect(breakdown.progressionScore).toBeLessThanOrEqual(1);
    expect(breakdown.feeScore).toBeGreaterThanOrEqual(0);
    expect(breakdown.feeScore).toBeLessThanOrEqual(1);
  });

  it('weights for each objective sum to 1.0', () => {
    const objectives = ['controlled_discovery', 'low_price_impact', 'fast_capital_formation', 'balanced'] as const;
    for (const obj of objectives) {
      const w = OBJECTIVE_WEIGHTS[obj];
      const total = w.priceImpact + w.capitalFormation + w.progression + w.fee;
      expect(total).toBeCloseTo(1.0, 5);
    }
  });

  it('low_price_impact gives highest weight to priceImpact', () => {
    const w = OBJECTIVE_WEIGHTS.low_price_impact;
    expect(w.priceImpact).toBeGreaterThan(w.capitalFormation);
    expect(w.priceImpact).toBeGreaterThan(w.progression);
    expect(w.priceImpact).toBeGreaterThan(w.fee);
  });

  it('fast_capital_formation gives highest weight to capitalFormation', () => {
    const w = OBJECTIVE_WEIGHTS.fast_capital_formation;
    expect(w.capitalFormation).toBeGreaterThan(w.priceImpact);
    expect(w.capitalFormation).toBeGreaterThan(w.progression);
    expect(w.capitalFormation).toBeGreaterThan(w.fee);
  });

  it('high price impact → lower priceImpactScore', () => {
    const low  = scoreObjective('balanced', makeFakeResult({ averagePriceImpact: 1 }),  85);
    const high = scoreObjective('balanced', makeFakeResult({ averagePriceImpact: 50 }), 85);
    expect(low.priceImpactScore).toBeGreaterThan(high.priceImpactScore);
  });

  it('graduated result → higher capitalFormationScore', () => {
    const notGrad = scoreObjective('balanced', makeFakeResult({ quoteAtGraduation: 5,  graduationReached: false }), 85);
    const grad    = scoreObjective('balanced', makeFakeResult({ quoteAtGraduation: 85, graduationReached: true  }), 85);
    expect(grad.capitalFormationScore).toBeGreaterThan(notGrad.capitalFormationScore);
  });
});

describe('computeWeightedScore', () => {
  it('returns a value between 0 and 1', () => {
    const breakdown = scoreObjective('balanced', makeFakeResult(), 85);
    const score     = computeWeightedScore(breakdown);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('is deterministic', () => {
    const breakdown = scoreObjective('balanced', makeFakeResult(), 85);
    expect(computeWeightedScore(breakdown)).toBe(computeWeightedScore(breakdown));
  });
});

// ── Candidate generation ───────────────────────────────────────────────────

describe('generateCandidates', () => {
  it('produces exactly 3 designs', () => {
    const brief = makeBrief();
    const { designs } = generateCandidates(brief);
    expect(designs).toHaveLength(3);
  });

  it('all designs have unique IDs', () => {
    const brief = makeBrief();
    const { designs } = generateCandidates(brief);
    const ids = designs.map((d) => d.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('designs are meaningfully different (different feeBps)', () => {
    const brief = makeBrief();
    const { designs } = generateCandidates(brief);
    const fees = designs.map((d) => d.fees.baseFeeBps);
    // At least 2 different fee values
    expect(new Set(fees).size).toBeGreaterThan(1);
  });

  it('all designs have the same market brief ID', () => {
    const brief = makeBrief();
    const { designs } = generateCandidates(brief);
    for (const d of designs) {
      expect(d.marketBriefId).toBe(brief.id);
    }
  });

  it('all designs have ≤ 16 curve segments (Meteora MAX_CURVE_POINT)', () => {
    const brief = makeBrief();
    const { designs } = generateCandidates(brief);
    for (const d of designs) {
      expect(d.curve.segments.length).toBeLessThanOrEqual(16);
    }
  });

  it('all designs have fee bps within Meteora limits [25, 9900]', () => {
    const brief = makeBrief();
    const { designs } = generateCandidates(brief);
    for (const d of designs) {
      expect(d.fees.baseFeeBps).toBeGreaterThanOrEqual(25);
      expect(d.fees.baseFeeBps).toBeLessThanOrEqual(9900);
    }
  });

  it('designs are sorted by objectiveScore descending', () => {
    const brief = makeBrief();
    const { designs } = generateCandidates(brief);
    for (let i = 1; i < designs.length; i++) {
      const prev = designs[i - 1];
      const curr = designs[i];
      if (prev && curr) {
        expect(prev.objectiveScore).toBeGreaterThanOrEqual(curr.objectiveScore);
      }
    }
  });

  it('all objective scores are between 0 and 1', () => {
    const brief = makeBrief();
    const { designs } = generateCandidates(brief);
    for (const d of designs) {
      expect(d.objectiveScore).toBeGreaterThanOrEqual(0);
      expect(d.objectiveScore).toBeLessThanOrEqual(1);
    }
  });

  it('works for all four objectives', () => {
    const objectives = ['controlled_discovery', 'low_price_impact', 'fast_capital_formation', 'balanced'] as const;
    for (const obj of objectives) {
      const brief = makeBrief({ objective: obj });
      const { designs } = generateCandidates(brief);
      expect(designs).toHaveLength(3);
    }
  });
});
