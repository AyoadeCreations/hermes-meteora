/**
 * deriveMarketCondition.ts
 *
 * Pure function: MarketObservation[] → MarketCondition.
 *
 * SAFETY RULES (enforced by this function):
 * - Never fabricates data. If a metric isn't in observations[], it is omitted.
 * - Returns INSUFFICIENT_DATA when fewer than MIN_OBSERVATIONS are present.
 * - All thresholds are conservative — we prefer under-claiming to over-claiming.
 * - Interpretations use measured language ("appears", "suggests") not certainties.
 *
 * DERIVABLE FROM REAL MarketObservation FIELDS:
 *   price            → price trend (first vs last window)
 *   quoteReserve     → liquidity trend
 *   volume24h        → volume trend (early half vs recent half)
 *   buyVolume        → buy/sell pressure ratio
 *   sellVolume       → buy/sell pressure ratio
 *   graduationProgress → graduation rate
 *   traders          → activity level
 *
 * NOT USED (not in observations schema):
 *   market cap, ROI, fees earned, wallet count, external price feeds
 */

import type { MarketObservation } from '@/domain/types';
import type {
  MarketCondition,
  ConditionSignal,
  MarketConditionStatus,
  ConditionConfidence,
  SignalDirection,
} from '@/domain/market-condition';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum observations required before any condition is derived */
export const MIN_OBSERVATIONS = 5;

/** Fraction of the window considered "early" vs "recent" */
const WINDOW_SPLIT = 0.5;

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Derive a MarketCondition from a real observations array.
 * Pass formationPlanId when the Plan vs Reality feature is built.
 */
export function deriveMarketCondition(
  observations: MarketObservation[],
  formationPlanId: string | null = null
): MarketCondition {
  // Guard: insufficient data
  if (observations.length < MIN_OBSERVATIONS) {
    return {
      status:           'INSUFFICIENT_DATA',
      confidence:       'low',
      summary:          '',
      signals:          [],
      updatedAt:        observations[observations.length - 1]?.timestamp ?? new Date().toISOString(),
      dataAvailable:    false,
      observationCount: observations.length,
      formationPlanId,
    };
  }

  // Sort ascending by timestamp (defensive — DB returns DESC but callers may vary)
  const sorted = [...observations].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const n         = sorted.length;
  const splitIdx  = Math.floor(n * WINDOW_SPLIT);
  const early     = sorted.slice(0, splitIdx);
  const recent    = sorted.slice(splitIdx);
  // Safe: guard above ensures n >= MIN_OBSERVATIONS >= 1
  const first     = sorted[0]!;
  const last      = sorted[n - 1]!;

  // ── Build signals ──────────────────────────────────────────────────────────

  const signals: ConditionSignal[] = [];

  // 1. Volume trend (requires volume24h values in both halves)
  const earlyVol   = avg(early.map(o => o.volume24h));
  const recentVol  = avg(recent.map(o => o.volume24h));
  if (earlyVol > 0 || recentVol > 0) {
    const volDir    = trend(earlyVol, recentVol, 0.1);
    signals.push({
      metric:         'Volume',
      value:          `${last.volume24h.toFixed(2)} SOL (24h)`,
      direction:      volDir,
      interpretation: volDir === 'up'
        ? 'Trading activity is increasing over the observation window.'
        : volDir === 'down'
        ? 'Trading activity has declined over the observation window.'
        : 'Trading activity appears relatively stable.',
      rawValue: last.volume24h,
    });
  }

  // 2. Buy/sell pressure (requires both buyVolume and sellVolume)
  const totalVol   = last.buyVolume + last.sellVolume;
  if (totalVol > 0) {
    const buyRatio  = last.buyVolume / totalVol;
    const pressDir: SignalDirection =
      buyRatio > 0.58  ? 'up' :
      buyRatio < 0.42  ? 'down' :
                         'stable';
    signals.push({
      metric:         'Demand Pressure',
      value:          `${(buyRatio * 100).toFixed(0)}% buy-side`,
      direction:      pressDir,
      interpretation: pressDir === 'up'
        ? 'Buy-side activity is dominant in recent observations.'
        : pressDir === 'down'
        ? 'Sell-side pressure is elevated relative to buying activity.'
        : 'Buy and sell activity appear balanced.',
      rawValue: buyRatio,
    });
  }

  // 3. Liquidity (quote reserve) trend
  const earlyReserve = avg(early.map(o => o.quoteReserve));
  const recentReserve = avg(recent.map(o => o.quoteReserve));
  if (earlyReserve > 0 || recentReserve > 0) {
    const liqDir = trend(earlyReserve, recentReserve, 0.05);
    signals.push({
      metric:         'Liquidity',
      value:          `${last.quoteReserve.toFixed(2)} SOL reserve`,
      direction:      liqDir,
      interpretation: liqDir === 'up'
        ? 'Quote reserve is growing — liquidity conditions are improving.'
        : liqDir === 'down'
        ? 'Quote reserve is declining — liquidity may be thinning.'
        : 'Quote reserve appears stable.',
      rawValue: last.quoteReserve,
    });
  }

  // 4. Price movement (volatility proxy: max spread across window)
  if (first.price > 0 && last.price > 0) {
    const prices      = sorted.map(o => o.price);
    const maxPrice    = Math.max(...prices);
    const minPrice    = Math.min(...prices);
    const spreadPct   = minPrice > 0 ? ((maxPrice - minPrice) / minPrice) * 100 : 0;
    const priceDir    = trend(first.price, last.price, 0.02);
    signals.push({
      metric:         'Price Movement',
      value:          `${spreadPct.toFixed(1)}% range`,
      direction:      priceDir,
      interpretation: spreadPct > 150
        ? 'Price has swung dramatically across the observation window — elevated short-term volatility.'
        : spreadPct > 40
        ? 'Price has moved significantly across the observation window, consistent with active discovery.'
        : 'Price movement has been relatively contained.',
      rawValue: spreadPct,
    });
  }

  // 5. Graduation progress rate
  const gradFirst = first.graduationProgress;
  const gradLast  = last.graduationProgress;
  if (gradLast > 0) {
    const gradDelta = gradLast - gradFirst;
    const gradDir: SignalDirection =
      gradDelta > 2  ? 'up' :
      gradDelta < -1 ? 'down' :
                       'stable';
    signals.push({
      metric:         'Graduation Progress',
      value:          `${gradLast.toFixed(1)}%`,
      direction:      gradDir,
      interpretation: gradLast >= 100
        ? 'Graduation threshold reached — migration conditions met.'
        : gradDir === 'up'
        ? 'Graduation progress is advancing across the observation window.'
        : gradDir === 'stable'
        ? 'Graduation progress is relatively flat.'
        : 'Graduation progress has not advanced recently.',
      rawValue: gradLast,
    });
  }

  // ── Derive overall status ──────────────────────────────────────────────────

  const status    = classifyStatus(signals, sorted);
  const confidence = deriveConfidence(n, signals);
  const summary   = buildSummary(status, signals, last);

  return {
    status,
    confidence,
    summary,
    signals,
    updatedAt:        last.timestamp,
    dataAvailable:    true,
    observationCount: n,
    formationPlanId,
  };
}

// ── Classification ─────────────────────────────────────────────────────────────

function classifyStatus(
  signals: ConditionSignal[],
  sorted: MarketObservation[]
): MarketConditionStatus {
  // Safe: classifyStatus is only called after the MIN_OBSERVATIONS guard
  const last = sorted[sorted.length - 1]!;

  const volSignal    = signals.find(s => s.metric === 'Volume');
  const pressSignal  = signals.find(s => s.metric === 'Demand Pressure');
  const liqSignal    = signals.find(s => s.metric === 'Liquidity');
  const priceSignal  = signals.find(s => s.metric === 'Price Movement');

  // Thin takes first priority — very low activity markets are thin regardless
  // of price movement (a thin market can have large % swings on tiny volume)
  if (last.volume24h < 0.05 && last.traders < 5) return 'THIN';

  // Demand weakening: sell pressure dominant + volume declining or stable
  if (
    pressSignal?.direction === 'down' &&
    (volSignal?.direction === 'down' || volSignal?.direction === 'stable')
  ) return 'DEMAND_WEAKENING';

  // Volatile: meaningful price spread AND sufficient volume to matter
  // (threshold: >150% range — distinguishes extreme volatility from normal
  // bonding-curve price progression, and volume not near-zero)
  if (
    priceSignal &&
    priceSignal.rawValue > 150 &&
    last.volume24h >= 0.05
  ) return 'VOLATILE';

  // Healthy: stable/growing liquidity + positive buy pressure + growing volume
  if (
    liqSignal?.direction !== 'down' &&
    pressSignal?.direction !== 'down' &&
    volSignal?.direction === 'up' &&
    last.traders >= 5
  ) return 'HEALTHY';

  // Active: developing activity, signals mixed but not alarming
  return 'ACTIVE';
}

function deriveConfidence(
  n: number,
  signals: ConditionSignal[]
): ConditionConfidence {
  if (n >= 30 && signals.length >= 4) return 'high';
  if (n >= 12 && signals.length >= 3) return 'medium';
  return 'low';
}

function buildSummary(
  status: MarketConditionStatus,
  signals: ConditionSignal[],
  last: MarketObservation
): string {  const liqSignal = signals.find(s => s.metric === 'Liquidity');
  const volSignal = signals.find(s => s.metric === 'Volume');

  switch (status) {
    case 'HEALTHY':
      return 'Trading activity is developing with positive demand signals and stable liquidity conditions.';
    case 'ACTIVE':
      return liqSignal?.direction === 'up'
        ? 'Market activity is building. Liquidity conditions appear to be strengthening.'
        : 'Trading activity is developing. Early demand signals are mixed.';
    case 'THIN':
      return `Low observed trading activity. ${last.traders} active trader${last.traders !== 1 ? 's' : ''} in current window.`;
    case 'VOLATILE':
      return 'Price has moved significantly across the observation window. Interpret signals with caution.';
    case 'DEMAND_WEAKENING':
      return volSignal?.direction === 'down'
        ? 'Buy-side pressure and trading volume have both declined recently.'
        : 'Sell-side activity is elevated relative to buy-side in recent observations.';
    default:
      return '';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Returns direction based on relative change vs a minimum threshold */
function trend(
  from: number,
  to: number,
  minRelativeChange: number
): SignalDirection {
  if (from === 0 && to === 0) return 'stable';
  if (from === 0) return 'up';
  const rel = (to - from) / Math.abs(from);
  if (rel >  minRelativeChange) return 'up';
  if (rel < -minRelativeChange) return 'down';
  return 'stable';
}
