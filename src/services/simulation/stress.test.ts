/**
 * Sniper stress test: behaviour tests.
 * Asserts structural properties (direction of effects, invariants), not
 * magic numbers, so tuning the illustrative defaults does not break them.
 */

import { describe, it, expect } from 'vitest';
import { runStressTest, defaultStressConfig, type StressInput } from '@/services/simulation/stress';
import type { CurveSegment, FeeConfig } from '@/domain/types';

function seg(p0: number, p1: number, quote: number): CurveSegment {
  const sl = Math.sqrt(p0);
  const sh = Math.sqrt(p1);
  const L  = quote / (sh - sl);
  return {
    sqrtPriceLow: '0', sqrtPriceHigh: '0',
    priceStart: p0, priceEnd: p1,
    baseTokens: L * (1 / sl - 1 / sh),
    quoteTokens: quote,
    liquidityWeight: 0.25,
  };
}

const PRICES = [1e-6, 1.8e-6, 2.6e-6, 3.4e-6, 4.2e-6];
const SEGMENTS = PRICES.slice(0, -1).map((p, i) => seg(p, PRICES[i + 1] ?? p * 2, 21.25));
const FEES: FeeConfig = {
  baseFeeBps: 100, dynamicFeeEnabled: false,
  creatorTradingFeePercentage: 10, collectFeeMode: 'quote_token',
};

function input(over: Partial<ReturnType<typeof defaultStressConfig>> = {}): StressInput {
  return {
    segments: SEGMENTS,
    startingPrice: 1e-6,
    graduationThreshold: 85,
    fees: FEES,
    config: { ...defaultStressConfig({ organicSizeQuote: 1.7 }), ...over },
  };
}

const byId = (r: ReturnType<typeof runStressTest>, id: string) => {
  const p = r.presets.find((x) => x.id === id);
  if (!p) throw new Error(`missing preset ${id}`);
  return p;
};

describe('runStressTest', () => {
  it('is deterministic', () => {
    expect(runStressTest(input())).toEqual(runStressTest(input()));
  });

  it('returns all four presets in order', () => {
    const r = runStressTest(input());
    expect(r.presets.map((p) => p.id)).toEqual(['none', 'scheduler', 'limiter', 'gated']);
  });

  it('with no bots there is no bot activity and no bot driven cost', () => {
    const r = runStressTest(input({ botCapitalPct: 0 }));
    for (const p of r.presets) {
      expect(p.withBots.botSpend).toBe(0);
      expect(p.withBots.botProfit).toBe(0);
      expect(p.withBots.botSupplySharePct).toBe(0);
      expect(p.leakagePer100).toBe(0);
      expect(p.botDrivenPct).toBeCloseTo(0, 9);
    }
  });

  it('unprotected launch: bots take supply and profit, organic buyers overpay', () => {
    const none = byId(runStressTest(input()), 'none');
    expect(none.withBots.botSupplySharePct).toBeGreaterThan(0);
    expect(none.withBots.botProfit).toBeGreaterThan(0);
    expect(none.organicCostVsIdealPct).toBeGreaterThan(0);
    expect(none.protectionTaxPct).toBeCloseTo(0, 9);
  });

  it('fee scheduler and gated entry both leak less than no protection', () => {
    const r = runStressTest(input());
    const none = byId(r, 'none').withBots.botProfit;
    expect(byId(r, 'scheduler').withBots.botProfit).toBeLessThan(none);
    expect(byId(r, 'gated').withBots.botProfit).toBeLessThan(none);
  });

  it('protection is not free: it adds a fee cost for organic buyers', () => {
    const r = runStressTest(input());
    for (const id of ['scheduler', 'limiter', 'gated']) {
      expect(byId(r, id).protectionTaxPct).toBeGreaterThan(0);
    }
  });

  it('rate limiter cuts bot profit when bots make a few large buys', () => {
    const r = runStressTest(input({ botCount: 2 }));
    expect(byId(r, 'limiter').withBots.botProfit).toBeLessThan(byId(r, 'scheduler').withBots.botProfit);
  });

  it('rate limiter does nothing when bots split into small buys', () => {
    const r = runStressTest(input({ botCount: 20 }));
    expect(byId(r, 'limiter').withBots.botProfit).toBeCloseTo(byId(r, 'scheduler').withBots.botProfit, 9);
  });

  it('more bot capital means a bigger share of supply', () => {
    const small = byId(runStressTest(input({ botCapitalPct: 0.1 })), 'none').withBots.botSupplySharePct;
    const large = byId(runStressTest(input({ botCapitalPct: 0.3 })), 'none').withBots.botSupplySharePct;
    expect(large).toBeGreaterThan(small);
  });

  it('keeps every metric finite at extreme settings', () => {
    const r = runStressTest(input({ botCapitalPct: 1, botCount: 1, organicCount: 200 }));
    for (const p of r.presets) {
      for (const m of [p.withBots, p.withoutBots]) {
        for (const v of Object.values(m)) {
          if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
        }
      }
    }
  });

  it('throws on an empty curve', () => {
    expect(() => runStressTest({ ...input(), segments: [] })).toThrow(/no curve segments/);
  });
});
