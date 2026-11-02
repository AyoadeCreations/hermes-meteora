import { describe, it, expect } from 'vitest';
import { LIQUIDITY_DISTRIBUTION, liquiditySum, knownQuoteDecimals, SOL_MINT } from './config';

describe('DBC config constants', () => {
  it('liquidity percentages sum to exactly 100', () => {
    expect(liquiditySum()).toBe(100);
    expect(LIQUIDITY_DISTRIBUTION.creatorPermanentLockedLiquidityPercentage).toBe(10);
  });
  it('knows SOL is 9 decimals and USDC is 6', () => {
    expect(knownQuoteDecimals(SOL_MINT)).toBe(9);
    expect(knownQuoteDecimals('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')).toBe(6);
    expect(knownQuoteDecimals('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe(6);
  });
  it('returns undefined for unknown mints so the caller must read the chain', () => {
    expect(knownQuoteDecimals('11111111111111111111111111111111')).toBeUndefined();
  });
});
