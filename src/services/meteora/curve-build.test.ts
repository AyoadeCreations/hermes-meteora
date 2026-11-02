import { describe, it, expect } from 'vitest';
import { buildDbcCurve, solveCurveForTargetRaise } from './curve-build';

const base = { totalSupply: 1_000_000_000, quoteDecimals: 9, baseFeeBps: 100 };

describe('SDK curve conversion', () => {
  it('turns the SDK curve into segments that add up to the raise', async () => {
    const c = await buildDbcCurve({ ...base, initialMarketCap: 30, migrationMarketCap: 300, liquidityWeights: [1, 1, 1, 1] });
    expect(c.segments.length).toBeGreaterThan(0);
    const quote = c.segments.reduce((a, s) => a + s.quoteTokens, 0);
    expect(Math.abs(quote - c.migrationQuote) / c.migrationQuote).toBeLessThan(0.02);
    expect(c.segments[0]!.priceStart).toBeCloseTo(30 / base.totalSupply, 12);
    for (const s of c.segments) expect(s.priceEnd).toBeGreaterThan(s.priceStart);
  });

  it('different liquidity weights give different curves', async () => {
    const a = await buildDbcCurve({ ...base, initialMarketCap: 30, migrationMarketCap: 300, liquidityWeights: [1, 1, 1, 1] });
    const b = await buildDbcCurve({ ...base, initialMarketCap: 30, migrationMarketCap: 300, liquidityWeights: [4, 3, 2, 1] });
    expect(b.migrationQuote).not.toBeCloseTo(a.migrationQuote, 3);
  });

  it('solves the migration market cap for a target raise', async () => {
    const r = await solveCurveForTargetRaise({ ...base, initialMarketCap: 30, liquidityWeights: [1, 1, 1, 1] }, 85);
    expect(r.feasible).toBe(true);
    expect(Math.abs(r.migrationQuote - 85) / 85).toBeLessThan(0.01);
  });

  it('flags a target that the starting market cap cannot reach', async () => {
    const r = await solveCurveForTargetRaise({ ...base, initialMarketCap: 1000, liquidityWeights: [1, 1, 1, 1] }, 10);
    expect(r.feasible).toBe(false);
    expect(r.migrationQuote).toBeGreaterThan(10);
  });
});
