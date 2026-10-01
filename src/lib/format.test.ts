import { describe, it, expect } from 'vitest';
import { formatNumber, formatCompact, formatPrice, formatBps, formatAddress, formatPercent, lamportsToSol, solToLamports } from '@/lib/format';

describe('formatNumber', () => {
  it('formats to 2 decimals by default', () => { expect(formatNumber(1234.5678)).toBe('1,234.57'); });
  it('returns — for non-finite', () => { expect(formatNumber(Infinity)).toBe('—'); });
});

describe('formatCompact', () => {
  it('formats millions', () => { expect(formatCompact(1_500_000)).toBe('1.50M'); });
  it('formats thousands', () => { expect(formatCompact(2500)).toBe('2.50K'); });
  it('formats billions', () => { expect(formatCompact(2_000_000_000)).toBe('2.00B'); });
});

describe('formatBps', () => {
  it('converts 100 bps to 1.00%', () => { expect(formatBps(100)).toBe('1.00%'); });
  it('converts 25 bps to 0.25%', () => { expect(formatBps(25)).toBe('0.25%'); });
});

describe('formatAddress', () => {
  it('truncates long address', () => {
    const addr = 'So11111111111111111111111111111111111111112';
    expect(formatAddress(addr, 4)).toContain('…');
  });
  it('returns short address unchanged', () => { expect(formatAddress('abc', 4)).toBe('abc'); });
});

describe('formatPercent', () => {
  it('adds + for positive', () => { expect(formatPercent(5)).toBe('+5.00%'); });
  it('negative has no +', () => { expect(formatPercent(-3)).toBe('-3.00%'); });
});

describe('lamport conversions', () => {
  it('1 SOL = 1e9 lamports', () => { expect(solToLamports(1)).toBe(1_000_000_000); });
  it('1e9 lamports = 1 SOL', () => { expect(lamportsToSol(1_000_000_000)).toBe(1); });
});
