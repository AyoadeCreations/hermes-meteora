/**
 * Fidelity: the curve the simulator runs must be the curve that deploys.
 * Rebuilding a design from its stored curve inputs (what the deploy route does)
 * must reproduce the simulated segments and graduation target.
 */
import { describe, it, expect } from 'vitest';
import { nanoid } from 'nanoid';
import { generateCandidates } from '@/services/simulation/generator';
import { buildDbcCurve } from './curve-build';
import type { MarketBrief } from '@/domain/types';

function brief(over: Partial<MarketBrief> = {}): MarketBrief {
  const now = new Date().toISOString();
  return {
    id: nanoid(16), tokenName: 'Fidelity', tokenSymbol: 'FID', totalSupply: 1_000_000_000,
    quoteMint: 'So11111111111111111111111111111111111111112', startingPrice: 0.0000001,
    graduationQuoteAmount: 85, expectedDemand: { profile: 'medium' }, objective: 'balanced',
    createdAt: now, updatedAt: now, ...over,
  };
}

describe('simulator and deployment use the same curve', () => {
  for (const [label, over] of [
    ['feasible starting price', {}],
    ['starting price too high for the target', { startingPrice: 0.000001, graduationQuoteAmount: 50 }],
  ] as const) {
    it(`reproduces every design: ${label}`, async () => {
      const { designs, baseline } = await generateCandidates(brief(over));
      for (const d of [...designs, baseline]) {
        const c = d.curve;
        expect(c.liquidityWeights?.length).toBe(16);
        const rebuilt = await buildDbcCurve({
          totalSupply: 1_000_000_000, quoteDecimals: c.quoteDecimals ?? 9,
          initialMarketCap: c.initialMarketCap, migrationMarketCap: c.migrationMarketCap,
          liquidityWeights: c.liquidityWeights!, baseFeeBps: d.fees.baseFeeBps, leftover: c.leftover,
        });
        expect(rebuilt.segments.length).toBe(c.segments.length);
        expect(rebuilt.migrationQuote).toBeCloseTo(d.graduation.quoteThreshold, 6);
        rebuilt.segments.forEach((s, i) => {
          expect(s.priceEnd).toBeCloseTo(c.segments[i]!.priceEnd, 18);
          expect(s.quoteTokens).toBeCloseTo(c.segments[i]!.quoteTokens, 6);
        });
        // The simulation starts at the curve's own first price.
        expect(d.simulation.startingPrice).toBeCloseTo(c.segments[0]!.priceStart, 18);
      }
    });
  }

  it('lands within 1% of the target raise when it is reachable', async () => {
    const { designs } = await generateCandidates(brief());
    const target = 85;
    for (const d of designs) {
      expect(Math.abs(d.graduation.quoteThreshold / target - 1)).toBeLessThan(0.3); // graduation multipliers 0.75 to 1.2
    }
  });
});
