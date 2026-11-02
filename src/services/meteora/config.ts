/**
 * Single source of truth for DBC config values that were previously
 * duplicated (and had drifted) between deployment.ts and the execute route.
 */

/**
 * Liquidity at migration. The four percentages must sum to exactly 100:
 * partner + creator + partnerLocked + creatorLocked.
 * 90% creator + 10% permanently locked is what the devnet-tested route used.
 */
export const LIQUIDITY_DISTRIBUTION = {
  partnerLiquidityPercentage:                0,
  partnerPermanentLockedLiquidityPercentage: 0,
  creatorLiquidityPercentage:                90,
  creatorPermanentLockedLiquidityPercentage: 10,
} as const;

export function liquiditySum(d: typeof LIQUIDITY_DISTRIBUTION = LIQUIDITY_DISTRIBUTION): number {
  return (
    d.partnerLiquidityPercentage +
    d.partnerPermanentLockedLiquidityPercentage +
    d.creatorLiquidityPercentage +
    d.creatorPermanentLockedLiquidityPercentage
  );
}

export const SOL_MINT = 'So11111111111111111111111111111111111111112';

/** Known quote mints, so common cases need no RPC call. */
const KNOWN_QUOTE_DECIMALS: Record<string, number> = {
  [SOL_MINT]: 9,
  // USDC devnet
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': 6,
  // USDC mainnet
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6,
};

export function knownQuoteDecimals(mint: string): number | undefined {
  return KNOWN_QUOTE_DECIMALS[mint];
}

/**
 * Decimals of the quote mint: from the known list, otherwise read on-chain.
 * Never assumes 9, because a wrong value silently mis-prices the curve.
 */
export async function resolveQuoteDecimals(
  connection: import('@solana/web3.js').Connection,
  mint: string,
): Promise<number> {
  const known = knownQuoteDecimals(mint);
  if (known !== undefined) return known;
  const { PublicKey } = await import('@solana/web3.js');
  const { getMint } = await import('@solana/spl-token');
  const info = await getMint(connection, new PublicKey(mint));
  return info.decimals;
}
