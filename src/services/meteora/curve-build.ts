/**
 * Builds a design's curve with Meteora's own SDK builder and converts the result
 * back into the simulator's segments. This is the single source of truth: the
 * simulator runs on the curve that will actually be deployed.
 *
 * Units: prices are quote per base in UI units (e.g. SOL per token).
 * The SDK works in raw units, so prices are scaled by 10^(baseDecimals - quoteDecimals).
 */

import type { CurveSegment } from '@/domain/types';
import { LIQUIDITY_DISTRIBUTION } from './config';

export const BASE_DECIMALS = 6;
const Q64 = 2 ** 64;

/** The SDK builder always makes exactly 16 segments on a geometric price ladder. */
export const SDK_SEGMENTS = 16;

/** Spreads n design weights over the SDK's 16 segments (piecewise constant). */
export function expandWeights(weights: number[], count = SDK_SEGMENTS): number[] {
  const n = weights.length || 1;
  return Array.from({ length: count }, (_, i) => Math.max(1e-6, weights[Math.min(n - 1, Math.floor((i * n) / count))] ?? 1));
}

export interface CurveBuildInput {
  totalSupply:        number;
  quoteDecimals:      number;
  /** Market cap at launch, in quote units (starting price x total supply). */
  initialMarketCap:   number;
  /** Market cap at migration, in quote units. */
  migrationMarketCap: number;
  /** One weight per curve segment (1 to 16). */
  liquidityWeights:   number[];
  baseFeeBps:         number;
  dynamicFeeEnabled?:           boolean;
  creatorTradingFeePercentage?: number;
  /** Tokens left over after the curve and migration (absorbs rounding). Searched for when omitted. */
  leftover?:          number;
}

export interface BuiltCurve {
  segments:        CurveSegment[];
  /** Quote raised when the curve completes (the graduation target), in quote units. */
  migrationQuote:  number;
  /** The SDK parameters, ready to pass to createConfig. */
  sdkCurve:        unknown;
  /** Leftover tokens the SDK needed for this curve. */
  leftover:        number;
}

const bnNum = (v: { toString(): string }) => Number(v.toString());

const LEFTOVER_STEPS = [0.0005, 0.001, 0.0025, 0.005, 0.01, 0.02, 0.05, 0.1];

export async function buildDbcCurve(input: CurveBuildInput): Promise<BuiltCurve> {
  const candidates = input.leftover !== undefined
    ? [input.leftover]
    : LEFTOVER_STEPS.map((f) => Math.floor(input.totalSupply * f));
  let lastErr: unknown;
  for (const leftover of candidates) {
    try {
      return await buildWithLeftover(input, leftover);
    } catch (e) {
      lastErr = e;
      if (!(e instanceof Error) || !/leftOverDelta/i.test(e.message)) throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Curve build failed');
}

async function buildWithLeftover(input: CurveBuildInput, leftover: number): Promise<BuiltCurve> {
  const sdk = await import('@meteora-ag/dynamic-bonding-curve-sdk');
  const weights16 = expandWeights(input.liquidityWeights);
  const built = sdk.buildCurveWithLiquidityWeights({
    token: {
      tokenType:            sdk.TokenType.SPLToken,
      tokenBaseDecimal:     BASE_DECIMALS,
      tokenQuoteDecimal:    input.quoteDecimals,
      totalTokenSupply:     input.totalSupply,
      leftover,
      tokenAuthorityOption: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: sdk.BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: input.baseFeeBps,
          endingFeeBps:   input.baseFeeBps,
          numberOfPeriod: 0,
          totalDuration:  0,
        },
      },
      dynamicFeeEnabled:           input.dynamicFeeEnabled ?? false,
      collectFeeMode:              sdk.CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: input.creatorTradingFeePercentage ?? 0,
      poolCreationFee:             0,
      enableFirstSwapWithMinFee:   false,
    },
    migration: {
      migrationOption:    sdk.MigrationOption.MET_DAMM_V2,
      migrationFeeOption: sdk.MigrationFeeOption.FixedBps25,
      migrationFee:       { feePercentage: 0, creatorFeePercentage: 0 },
    },
    liquidityDistribution: { ...LIQUIDITY_DISTRIBUTION },
    lockedVesting: {
      totalLockedVestingAmount:       0,
      numberOfVestingPeriod:          0,
      cliffUnlockAmount:              0,
      totalVestingDuration:           0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType:     sdk.ActivationType.Timestamp,
    initialMarketCap:   input.initialMarketCap,
    migrationMarketCap: input.migrationMarketCap,
    liquidityWeights:   weights16,
  });

  const priceScale = 10 ** (BASE_DECIMALS - input.quoteDecimals);
  const baseScale  = 10 ** BASE_DECIMALS;
  const quoteScale = 10 ** input.quoteDecimals;
  const weightSum  = weights16.reduce((a, b) => a + b, 0) || 1;

  const points = built.curve.map((c: { sqrtPrice: { toString(): string }; liquidity: { toString(): string } }) => ({
    s: bnNum(c.sqrtPrice) / Q64,
    L: bnNum(c.liquidity) / Q64,
  }));

  const segments: CurveSegment[] = [];
  let sLow = bnNum(built.sqrtStartPrice) / Q64;
  points.forEach((p: { s: number; L: number }, i: number) => {
    const sHigh = p.s;
    if (sHigh > sLow && p.L > 0) {
      segments.push({
        sqrtPriceLow:    BigInt(Math.round(sLow * Q64)).toString(),
        sqrtPriceHigh:   BigInt(Math.round(sHigh * Q64)).toString(),
        priceStart:      sLow * sLow * priceScale,
        priceEnd:        sHigh * sHigh * priceScale,
        baseTokens:      (p.L * (1 / sLow - 1 / sHigh)) / baseScale,
        quoteTokens:     (p.L * (sHigh - sLow)) / quoteScale,
        liquidityWeight: (weights16[i] ?? 1) / weightSum,
      });
    }
    sLow = sHigh;
  });

  return {
    segments,
    migrationQuote: bnNum(built.migrationQuoteThreshold) / quoteScale,
    sdkCurve:       built,
    leftover,
  };
}

export interface SolveResult extends BuiltCurve {
  migrationMarketCap: number;
  /** True when the target raise could not be reached from this starting market cap. */
  feasible: boolean;
}

/**
 * Finds the migration market cap whose curve raises `targetQuote` at graduation.
 * The raise grows with the migration market cap, so this bisects on it.
 * If the target is below what the starting market cap can raise (or above the
 * upper bound), returns the closest curve with feasible = false.
 */
export async function solveCurveForTargetRaise(
  base: Omit<CurveBuildInput, 'migrationMarketCap'>,
  targetQuote: number,
): Promise<SolveResult> {
  const tryCap = async (cap: number) => ({ cap, ...(await buildDbcCurve({ ...base, migrationMarketCap: cap })) });

  let lo = base.initialMarketCap * 1.0001;
  let hi = base.initialMarketCap * 1_000_000;
  let best = await tryCap(lo).catch(() => null);
  if (!best) throw new Error('Cannot build a curve from this starting market cap');
  if (best.migrationQuote >= targetQuote) {
    return { ...best, migrationMarketCap: best.cap, feasible: best.migrationQuote <= targetQuote * 1.02 };
  }

  for (let i = 0; i < 40; i++) {
    const mid = Math.sqrt(lo * hi); // geometric: the range spans many orders of magnitude
    const cur = await tryCap(mid).catch(() => null);
    if (!cur) { hi = mid; continue; }
    best = cur;
    if (Math.abs(cur.migrationQuote - targetQuote) / targetQuote < 0.005) {
      return { ...cur, migrationMarketCap: cur.cap, feasible: true };
    }
    if (cur.migrationQuote < targetQuote) lo = mid; else hi = mid;
  }
  return { ...best, migrationMarketCap: best.cap, feasible: Math.abs(best.migrationQuote - targetQuote) / targetQuote < 0.02 };
}

export interface GrowthSolveResult extends BuiltCurve {
  initialMarketCap:   number;
  migrationMarketCap: number;
  feasible:           boolean;
}

/**
 * When the user's starting price cannot raise the target, find the starting market
 * cap that does, holding the price growth from launch to graduation at `growthFactor`.
 * The raise grows with the starting market cap, so this bisects on it.
 */
export async function solveCurveForGrowth(
  base: Omit<CurveBuildInput, 'initialMarketCap' | 'migrationMarketCap'>,
  growthFactor: number,
  targetQuote: number,
): Promise<GrowthSolveResult> {
  const tryInit = async (init: number) => {
    const built = await buildDbcCurve({ ...base, initialMarketCap: init, migrationMarketCap: init * growthFactor });
    return { init, ...built };
  };
  let lo = targetQuote * 1e-4;
  let hi = targetQuote * 1e4;
  let best: Awaited<ReturnType<typeof tryInit>> | null = null;
  for (let i = 0; i < 50; i++) {
    const mid = Math.sqrt(lo * hi);
    const cur = await tryInit(mid).catch(() => null);
    if (!cur) { hi = mid; continue; }
    best = cur;
    if (Math.abs(cur.migrationQuote - targetQuote) / targetQuote < 0.005) break;
    if (cur.migrationQuote < targetQuote) lo = mid; else hi = mid;
  }
  if (!best) throw new Error('Cannot build a curve for this target');
  return {
    ...best,
    initialMarketCap:   best.init,
    migrationMarketCap: best.init * growthFactor,
    feasible:           Math.abs(best.migrationQuote - targetQuote) / targetQuote < 0.02,
  };
}
