import { describe, it, expect } from 'vitest';
import {
  validateBrief,
  validateFeeConfig,
  validateSimulationResult,
  hasErrors,
  getErrorMessages,
} from '@/services/simulation/constraints';
import type { MarketBrief, FeeConfig, SimulationResult } from '@/domain/types';
import { nanoid } from 'nanoid';

function makeBrief(overrides: Partial<MarketBrief> = {}): MarketBrief {
  const now = new Date().toISOString();
  return {
    id: nanoid(), tokenName: 'Test', tokenSymbol: 'TST',
    totalSupply: 1_000_000,
    quoteMint: 'So11111111111111111111111111111111111111112',
    startingPrice: 0.001, graduationQuoteAmount: 85,
    expectedDemand: { profile: 'medium' }, objective: 'balanced',
    createdAt: now, updatedAt: now, ...overrides,
  };
}

describe('validateBrief', () => {
  it('valid brief has no errors', () => {
    expect(hasErrors(validateBrief(makeBrief()))).toBe(false);
  });
  it('graduation below starting price is an error', () => {
    const v = validateBrief(makeBrief({ startingPrice: 100, graduationQuoteAmount: 0.001 }));
    expect(hasErrors(v)).toBe(true);
  });
  it('supply below minimum is an error', () => {
    expect(hasErrors(validateBrief(makeBrief({ totalSupply: 1 })))).toBe(true);
  });
});

describe('validateFeeConfig', () => {
  const valid: FeeConfig = { baseFeeBps: 100, dynamicFeeEnabled: false, creatorTradingFeePercentage: 10, collectFeeMode: 'quote_token' };
  it('valid fee has no violations', () => { expect(hasErrors(validateFeeConfig(valid))).toBe(false); });
  it('fee below 25 bps is an error', () => { expect(hasErrors(validateFeeConfig({ ...valid, baseFeeBps: 10 }))).toBe(true); });
  it('fee above 9900 bps is an error', () => { expect(hasErrors(validateFeeConfig({ ...valid, baseFeeBps: 10000 }))).toBe(true); });
  it('fee of 1100 bps is a warning not an error', () => {
    const v = validateFeeConfig({ ...valid, baseFeeBps: 1100 });
    expect(hasErrors(v)).toBe(false);
    expect(v.some((x) => x.severity === 'warning')).toBe(true);
  });
});

describe('validateSimulationResult', () => {
  function makeResult(o: Partial<SimulationResult> = {}): SimulationResult {
    return {
      scenario: 'B', pricePath: [{ tradeIndex: 0, price: 0.001 }, { tradeIndex: 1, price: 0.0012 }],
      quoteAccumulation: [{ tradeIndex: 0, quoteAccumulated: 0, graduationPct: 0 }, { tradeIndex: 1, quoteAccumulated: 10, graduationPct: 12 }],
      trades: [], totalFees: 0.1, averagePriceImpact: 3, maxPriceImpact: 5,
      finalPrice: 0.0012, startingPrice: 0.001, quoteAtGraduation: 10,
      graduationReached: false, capitalRequired: 10, liquidityUtilization: 0.1, tradeCount: 10, ...o,
    };
  }
  it('normal result has no errors', () => { expect(hasErrors(validateSimulationResult(makeResult(), 'balanced'))).toBe(false); });
  it('extreme price impact is an error', () => { expect(hasErrors(validateSimulationResult(makeResult({ averagePriceImpact: 60 }), 'balanced'))).toBe(true); });
});
