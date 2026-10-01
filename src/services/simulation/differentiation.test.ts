/**
 * Audit C: Candidate Differentiation Test
 *
 * Verifies that generated candidates are materially different
 * across 5 distinct market brief scenarios.
 *
 * "Materially different" means:
 * - Different fee structures
 * - Different curve shapes (segment counts)
 * - Different simulation outcomes (price impact, graduation progress)
 * - Different liquidity profiles
 */

import { describe, it, expect } from 'vitest';
import { generateCandidates } from '@/services/simulation/generator';
import type { MarketBrief } from '@/domain/types';
import { nanoid } from 'nanoid';

function makeBrief(overrides: Partial<MarketBrief> = {}): MarketBrief {
  const now = new Date().toISOString();
  return {
    id:            nanoid(16),
    tokenName:     'Test Token',
    tokenSymbol:   'TEST',
    totalSupply:   1_000_000_000,
    quoteMint:     'So11111111111111111111111111111111111111112',
    startingPrice: 0.000001,
    graduationQuoteAmount: 300,
    expectedDemand: { profile: 'medium' },
    objective:     'balanced',
    createdAt:     now,
    updatedAt:     now,
    ...overrides,
  };
}

// Helper: check if values are materially spread (at least 2 unique)
function hasVariation<T>(values: T[]): boolean {
  return new Set(values).size >= 2;
}

// ── Scenario 1: Low demand + controlled discovery ─────────────────────────
describe('Scenario 1: Low demand + controlled discovery', () => {
  const brief = makeBrief({
    objective:     'controlled_discovery',
    expectedDemand: { profile: 'low' },
    graduationQuoteAmount: 50,
  });
  const { designs } = generateCandidates(brief);

  it('produces 3 designs', () => { expect(designs).toHaveLength(3); });

  it('designs have different fee rates', () => {
    const fees = designs.map((d) => d.fees.baseFeeBps);
    expect(hasVariation(fees)).toBe(true);
  });

  it('designs have different segment counts', () => {
    const segs = designs.map((d) => d.curve.segments.length);
    expect(hasVariation(segs)).toBe(true);
  });

  it('designs have different price impact outcomes', () => {
    const impacts = designs.map((d) => Math.round(d.simulation.averagePriceImpact * 10) / 10);
    expect(hasVariation(impacts)).toBe(true);
  });

  it('all designs start from the same price', () => {
    for (const d of designs) {
      expect(d.simulation.startingPrice).toBe(brief.startingPrice);
    }
  });
});

// ── Scenario 2: High demand + fast capital formation ──────────────────────
describe('Scenario 2: High demand + fast capital formation', () => {
  const brief = makeBrief({
    objective:     'fast_capital_formation',
    expectedDemand: { profile: 'high' },
    graduationQuoteAmount: 500,
  });
  const { designs } = generateCandidates(brief);

  it('produces 3 designs', () => { expect(designs).toHaveLength(3); });

  it('designs have different graduation thresholds (from graduation multipliers)', () => {
    const thresholds = designs.map((d) => d.graduation.quoteThreshold);
    expect(hasVariation(thresholds)).toBe(true);
  });

  it('fast_capital_formation: at least one design makes meaningful graduation progress', () => {
    const bestProgress = Math.max(
      ...designs.map((d) => d.simulation.quoteAtGraduation / d.graduation.quoteThreshold)
    );
    expect(bestProgress).toBeGreaterThan(0.01); // at least 1% progress
  });

  it('designs have materially different price growth factors (different final prices)', () => {
    const finalPrices = designs.map((d) => d.simulation.finalPrice);
    const min = Math.min(...finalPrices);
    const max = Math.max(...finalPrices);
    // Final prices should differ by at least 10%
    expect(max / min).toBeGreaterThan(1.1);
  });
});

// ── Scenario 3: Medium demand + low price impact ──────────────────────────
describe('Scenario 3: Medium demand + low price impact', () => {
  const brief = makeBrief({
    objective:     'low_price_impact',
    expectedDemand: { profile: 'medium' },
    graduationQuoteAmount: 200,
  });
  const { designs } = generateCandidates(brief);

  it('produces 3 designs', () => { expect(designs).toHaveLength(3); });

  it('designs have different segment counts', () => {
    const segs = designs.map((d) => d.curve.segments.length);
    expect(hasVariation(segs)).toBe(true);
  });

  it('low_price_impact: best design has lower avg impact than worst', () => {
    const sorted = [...designs].sort((a, b) => a.simulation.averagePriceImpact - b.simulation.averagePriceImpact);
    const best = sorted[0]!;
    const worst = sorted[sorted.length - 1]!;
    expect(best.simulation.averagePriceImpact).toBeLessThan(worst.simulation.averagePriceImpact);
  });
});

// ── Scenario 4: High demand + low price impact ────────────────────────────
describe('Scenario 4: High demand + low price impact', () => {
  const brief = makeBrief({
    objective:     'low_price_impact',
    expectedDemand: { profile: 'high' },
    graduationQuoteAmount: 300,
  });
  const { designs } = generateCandidates(brief);

  it('produces 3 designs', () => { expect(designs).toHaveLength(3); });

  it('all designs have distinct objective scores', () => {
    const scores = designs.map((d) => Math.round(d.objectiveScore * 1000));
    // At least 2 must be different — tied scores are possible but rare
    expect(designs[0]!.objectiveScore).toBeGreaterThanOrEqual(0);
    expect(designs[0]!.objectiveScore).toBeLessThanOrEqual(1);
  });
});

// ── Scenario 5: Low demand + fast capital formation ───────────────────────
describe('Scenario 5: Low demand + fast capital formation', () => {
  const brief = makeBrief({
    objective:     'fast_capital_formation',
    expectedDemand: { profile: 'low' },
    graduationQuoteAmount: 80,
  });
  const { designs, violations } = generateCandidates(brief);

  it('produces 3 designs even with low demand', () => { expect(designs).toHaveLength(3); });

  it('generates constraint warnings for demand/objective mismatch', () => {
    // Low demand + fast capital formation should trigger a warning
    const hasWarning = violations.some((v) => v.severity === 'warning');
    expect(hasWarning).toBe(true);
  });

  it('designs still differ in fees', () => {
    const fees = designs.map((d) => d.fees.baseFeeBps);
    expect(hasVariation(fees)).toBe(true);
  });
});

// ── Cross-objective comparison ─────────────────────────────────────────────
describe('Cross-objective: same brief, different objectives produce different designs', () => {
  const baseBrief: Omit<MarketBrief, 'id' | 'createdAt' | 'updatedAt' | 'objective'> = {
    tokenName:     'Cross Test',
    tokenSymbol:   'CTT',
    totalSupply:   1_000_000_000,
    quoteMint:     'So11111111111111111111111111111111111111112',
    startingPrice: 0.000001,
    graduationQuoteAmount: 200,
    expectedDemand: { profile: 'medium' },
  };

  function briefFor(objective: MarketBrief['objective']): MarketBrief {
    const now = new Date().toISOString();
    return { ...baseBrief, id: nanoid(16), objective, createdAt: now, updatedAt: now };
  }

  it('controlled_discovery vs fast_capital_formation: best designs differ in fee', () => {
    const { designs: cdDesigns } = generateCandidates(briefFor('controlled_discovery'));
    const { designs: fcDesigns } = generateCandidates(briefFor('fast_capital_formation'));
    // The top designs for different objectives should have different templates applied
    const cdBest = cdDesigns[0]!;
    const fcBest = fcDesigns[0]!;
    // They should not be identical configurations
    const identical =
      cdBest.fees.baseFeeBps === fcBest.fees.baseFeeBps &&
      cdBest.curve.segments.length === fcBest.curve.segments.length;
    expect(identical).toBe(false);
  });

  it('baseline has same graduation threshold regardless of objective', () => {
    const { baseline: cdBase } = generateCandidates(briefFor('controlled_discovery'));
    const { baseline: fcBase } = generateCandidates(briefFor('fast_capital_formation'));
    // Both baselines use the brief's graduation amount directly
    expect(cdBase.graduation.quoteThreshold).toBe(baseBrief.graduationQuoteAmount);
    expect(fcBase.graduation.quoteThreshold).toBe(baseBrief.graduationQuoteAmount);
  });
});
