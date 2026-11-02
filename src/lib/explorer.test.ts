import { describe, it, expect } from 'vitest';
import { explorerUrl } from './explorer';

describe('explorerUrl', () => {
  it('puts the devnet cluster after the path', () => {
    expect(explorerUrl('account', 'ABC', 'devnet')).toBe('https://solscan.io/account/ABC?cluster=devnet');
  });
  it('has no cluster query on mainnet', () => {
    expect(explorerUrl('tx', 'SIG', 'mainnet-beta')).toBe('https://solscan.io/tx/SIG');
  });
  it('defaults to devnet', () => {
    expect(explorerUrl('token', 'MINT')).toBe('https://solscan.io/token/MINT?cluster=devnet');
  });
});
