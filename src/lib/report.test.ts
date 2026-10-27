import { describe, it, expect } from 'vitest';
import { organicAssumptions, curveShape, reportPath } from '@/lib/report';
import type { MarketDesign } from '@/domain/types';

function design(over: Partial<MarketDesign> = {}): MarketDesign {
  return {
    curve: {
      segments: [
        { priceStart: 1, priceEnd: 2, quoteTokens: 10, baseTokens: 1, sqrtPriceLow: '0', sqrtPriceHigh: '0', liquidityWeight: 0.5 },
        { priceStart: 2, priceEnd: 3, quoteTokens: 15, baseTokens: 1, sqrtPriceLow: '0', sqrtPriceHigh: '0', liquidityWeight: 0.5 },
      ],
    },
    simulation: { trades: [] },
    ...over,
  } as unknown as MarketDesign;
}

describe('curveShape', () => {
  it('accumulates quote across segment boundaries', () => {
    expect(curveShape(design())).toEqual([
      { quote: 0, price: 1 },
      { quote: 10, price: 2 },
      { quote: 25, price: 3 },
    ]);
  });
});

describe('organicAssumptions', () => {
  it('falls back to defaults with no simulated buys', () => {
    expect(organicAssumptions(design())).toEqual({ count: 50, size: 1.7 });
  });
  it('reads count and size from the design simulation', () => {
    const d = design({
      simulation: { trades: [
        { direction: 'buy', amountIn: 2.5 }, { direction: 'sell', amountIn: 1 }, { direction: 'buy', amountIn: 2.5 },
      ] } as unknown as MarketDesign['simulation'],
    });
    expect(organicAssumptions(d)).toEqual({ count: 2, size: 2.5 });
  });
});

describe('reportPath', () => {
  it('encodes the design id', () => {
    expect(reportPath('a/b')).toBe('/report/a%2Fb');
  });
});
