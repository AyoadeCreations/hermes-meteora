/**
 * Simulation Engine — CLMM-based deterministic bonding curve simulator.
 *
 * This is NOT a real market predictor.
 * All output must be labeled SIMULATED SCENARIO.
 *
 * Math model: Uniswap v3 / Meteora DBC concentrated liquidity.
 *
 * Core identities:
 *   sqrtPrice  = sqrt(quotePerBase)
 *   liquidity L from one segment's quote reserve:
 *     L = quoteReserve / (sqrtHigh - sqrtLow)
 *   Base tokens in that segment:
 *     base = L * (1/sqrtLow - 1/sqrtHigh)
 *   Quote to move price from sqrtLow → sqrtX (buy, price rises):
 *     quoteIn = L * (sqrtX - sqrtLow)
 *   Solving for sqrtX given quoteIn:
 *     sqrtX = sqrtLow + quoteIn / L
 *   Base consumed:
 *     baseOut = L * (1/sqrtLow - 1/sqrtX)
 *
 * This ensures quoteUsed is always derived from actual price movement,
 * not from a base-fraction proxy.
 */

import type {
  SimulationResult,
  PricePoint,
  QuotePoint,
  SimulatedTrade,
  TradeScenario,
  CurveSegment,
  FeeConfig,
} from '@/domain/types';
import type { SimulationParams } from '@/domain/schemas';

// ── Segment state during simulation ───────────────────────────────────────

interface SegmentState {
  priceStart:  number;
  priceEnd:    number;
  baseTokens:  number;
  quoteTokens: number;
  remainingBase: number;
  /** L = quoteTokens / (sqrtHigh - sqrtLow) */
  liquidity:   number;
  sqrtLow:     number;
  sqrtHigh:    number;
  /** Current sqrt price within this segment */
  sqrtCurrent: number;
}

// ── Segment init ───────────────────────────────────────────────────────────

function initSegmentState(seg: CurveSegment): SegmentState {
  const sqrtLow  = Math.sqrt(Math.max(seg.priceStart, 1e-18)); // guard zero
  const sqrtHigh = Math.sqrt(seg.priceEnd);
  const range    = sqrtHigh - sqrtLow;
  const liquidity = range > 0 ? seg.quoteTokens / range : 0;
  return {
    priceStart:    seg.priceStart,
    priceEnd:      seg.priceEnd,
    baseTokens:    seg.baseTokens,
    quoteTokens:   seg.quoteTokens,
    remainingBase: seg.baseTokens,
    liquidity,
    sqrtLow,
    sqrtHigh,
    sqrtCurrent:   sqrtLow,
  };
}

// ── One-trade buy: exact CLMM math ────────────────────────────────────────

/**
 * Compute the result of buying with `netQuoteIn` quote tokens.
 * Traverses segments in order, consuming each until either:
 *   - the trade is filled, or
 *   - the segment is exhausted (all base consumed).
 *
 * Returns:
 *   baseOut   — total base tokens received
 *   quoteUsed — total quote tokens consumed (always ≤ netQuoteIn)
 *   newPrice  — price after the trade
 */
function executeBuy(
  segments:     SegmentState[],
  currentPrice: number,
  netQuoteIn:   number
): { baseOut: number; quoteUsed: number; newPrice: number } {
  let remaining = netQuoteIn;
  let totalBase = 0;
  let newPrice  = currentPrice;

  for (const seg of segments) {
    if (remaining <= 0) break;
    if (seg.remainingBase <= 0) continue;
    // Only enter segment if current price is within or below it
    if (currentPrice > seg.priceEnd * 1.0001) continue;

    const sqrtCurrent = Math.sqrt(Math.max(currentPrice, seg.priceStart, 1e-18));
    const sqrtHigh    = seg.sqrtHigh;
    const L           = seg.liquidity;

    if (L <= 0) continue;

    // Quote to fill this entire segment: L * (sqrtHigh - sqrtCurrent)
    const quoteToFillSegment = L * (sqrtHigh - sqrtCurrent);

    let quoteForThisSeg: number;
    let sqrtNew: number;

    if (remaining >= quoteToFillSegment) {
      // Fill entire remaining segment
      quoteForThisSeg = quoteToFillSegment;
      sqrtNew         = sqrtHigh;
    } else {
      // Partial fill
      quoteForThisSeg = remaining;
      sqrtNew         = sqrtCurrent + quoteForThisSeg / L;
      sqrtNew         = Math.min(sqrtNew, sqrtHigh);
    }

    // Base out = L * (1/sqrtCurrent - 1/sqrtNew)
    const baseFromSeg = sqrtCurrent > 0 && sqrtNew > 0
      ? L * (1 / sqrtCurrent - 1 / sqrtNew)
      : 0;

    const actualBase = Math.min(baseFromSeg, seg.remainingBase);
    seg.remainingBase -= actualBase;
    totalBase         += actualBase;
    remaining         -= quoteForThisSeg;
    newPrice           = sqrtNew * sqrtNew;
    currentPrice       = newPrice; // carry price forward for next segment
  }

  return {
    baseOut:   totalBase,
    quoteUsed: netQuoteIn - remaining,
    newPrice,
  };
}

// ── One-trade sell: CLMM inverse ─────────────────────────────────────────

/**
 * Sell `baseIn` base tokens back into the curve.
 * Price moves down. Walk segments in reverse.
 */
function executeSell(
  segments:     SegmentState[],
  currentPrice: number,
  baseIn:       number
): { quoteOut: number; newPrice: number } {
  let remaining  = baseIn;
  let totalQuote = 0;
  let newPrice   = currentPrice;

  for (let i = segments.length - 1; i >= 0; i--) {
    if (remaining <= 0) break;
    const seg = segments[i];
    if (!seg) continue;
    // Only enter segments at or above current price
    if (currentPrice < seg.priceStart * 0.9999) continue;

    const sqrtCurrent = Math.sqrt(Math.min(currentPrice, seg.priceEnd));
    const sqrtLow     = seg.sqrtLow;
    const L           = seg.liquidity;
    if (L <= 0) continue;

    // Base that can be sold into this segment: L * (1/sqrtLow - 1/sqrtCurrent)
    const baseInSegment = sqrtLow > 0 && sqrtCurrent > 0
      ? L * (1 / sqrtLow - 1 / sqrtCurrent)
      : 0;

    let baseForThisSeg: number;
    let sqrtNew: number;

    if (remaining >= baseInSegment) {
      baseForThisSeg = baseInSegment;
      sqrtNew        = sqrtLow;
    } else {
      baseForThisSeg = remaining;
      // sqrtNew from: base = L*(1/sqrtNew - 1/sqrtCurrent) → 1/sqrtNew = base/L + 1/sqrtCurrent
      const invSqrtNew = baseForThisSeg / L + (sqrtCurrent > 0 ? 1 / sqrtCurrent : 0);
      sqrtNew          = invSqrtNew > 0 ? 1 / invSqrtNew : sqrtLow;
      sqrtNew          = Math.max(sqrtNew, sqrtLow);
    }

    // Quote out = L * (sqrtCurrent - sqrtNew)
    const quoteFromSeg = L * (sqrtCurrent - sqrtNew);

    totalQuote  += Math.max(0, quoteFromSeg);
    remaining   -= baseForThisSeg;
    newPrice     = sqrtNew * sqrtNew;
    currentPrice = newPrice;
  }

  return { quoteOut: totalQuote, newPrice };
}

// ── Fee calculation ────────────────────────────────────────────────────────

function calcFee(amount: number, feeBps: number): number {
  return (amount * feeBps) / 10_000;
}

// ── Trade scenario generators ──────────────────────────────────────────────

interface TradeSpec {
  direction:   'buy' | 'sell';
  quoteAmount: number;
}

function generateTradeSequence(
  scenario:       TradeScenario,
  tradeCount:     number,
  tradeSizeQuote: number,
  sellFraction:   number
): TradeSpec[] {
  const trades: TradeSpec[] = [];

  switch (scenario) {
    case 'A': {
      // Many small uniform buys
      const size = tradeSizeQuote * 0.2;
      for (let i = 0; i < tradeCount; i++) {
        trades.push({ direction: 'buy', quoteAmount: size });
      }
      break;
    }
    case 'B': {
      // Medium uniform buys
      for (let i = 0; i < tradeCount; i++) {
        trades.push({ direction: 'buy', quoteAmount: tradeSizeQuote });
      }
      break;
    }
    case 'C': {
      // 10% large trades then small tail
      const largeTrades = Math.max(1, Math.floor(tradeCount * 0.1));
      const largeSize   = tradeSizeQuote * (tradeCount / largeTrades);
      for (let i = 0; i < largeTrades; i++) {
        trades.push({ direction: 'buy', quoteAmount: largeSize });
      }
      for (let i = largeTrades; i < tradeCount; i++) {
        trades.push({ direction: 'buy', quoteAmount: tradeSizeQuote * 0.05 });
      }
      break;
    }
    case 'D': {
      // Interleaved buys and sells
      const sellCount = Math.floor(tradeCount * sellFraction);
      const step      = Math.floor((tradeCount - sellCount) / Math.max(sellCount, 1));
      let sellsDone   = 0;
      for (let i = 0; i < tradeCount; i++) {
        const isSell = sellsDone < sellCount && i > 0 && i % (step + 1) === 0;
        if (isSell) {
          trades.push({ direction: 'sell', quoteAmount: tradeSizeQuote * 0.4 });
          sellsDone++;
        } else {
          trades.push({ direction: 'buy', quoteAmount: tradeSizeQuote });
        }
      }
      break;
    }
  }

  return trades;
}

// ── Public interfaces ──────────────────────────────────────────────────────

export interface SimulationInput {
  segments:            CurveSegment[];
  startingPrice:       number;
  graduationThreshold: number;
  fees:                FeeConfig;
  params:              SimulationParams;
}

// ── Main simulation ────────────────────────────────────────────────────────

export function runSimulation(input: SimulationInput): SimulationResult {
  const { segments, startingPrice, graduationThreshold, fees, params } = input;

  if (segments.length === 0) {
    throw new Error('Cannot simulate: no curve segments provided');
  }

  // Initialise mutable segment state
  const segStates = segments.map(initSegmentState);

  let price              = startingPrice;
  let quoteAccumulated   = 0;
  let baseConsumed       = 0;

  const pricePath:         PricePoint[]     = [{ tradeIndex: 0, price }];
  const quoteAccumulation: QuotePoint[]     = [{ tradeIndex: 0, quoteAccumulated: 0, graduationPct: 0 }];
  const trades:            SimulatedTrade[] = [];

  let totalAbsImpact = 0;
  let maxImpact      = 0;
  let buyTradeCount  = 0;

  const tradeSeq = generateTradeSequence(
    params.scenario,
    params.tradeCount,
    params.tradeSizeQuote,
    params.sellFraction,
  );

  for (let i = 0; i < tradeSeq.length; i++) {
    const t = tradeSeq[i];
    if (!t) continue;

    const priceBefore = price;

    if (t.direction === 'buy') {
      const feePaid  = calcFee(t.quoteAmount, fees.baseFeeBps);
      const netQuote = t.quoteAmount - feePaid;

      const { baseOut, quoteUsed, newPrice } = executeBuy(segStates, price, netQuote);

      if (quoteUsed <= 0) break; // no more liquidity

      price            = newPrice;
      quoteAccumulated += quoteUsed + feePaid; // fee is collected on top
      baseConsumed     += baseOut;

      const impact = priceBefore > 0 ? ((price - priceBefore) / priceBefore) * 100 : 0;
      totalAbsImpact += Math.abs(impact);
      maxImpact       = Math.max(maxImpact, Math.abs(impact));
      buyTradeCount++;

      trades.push({
        index:          i + 1,
        direction:      'buy',
        amountIn:       t.quoteAmount,
        amountOut:      baseOut,
        priceAfter:     price,
        priceImpactPct: impact,
        feePaid,
      });
    } else {
      // Sell
      const baseIn = t.quoteAmount / Math.max(price, 1e-18);
      const feePaid = calcFee(t.quoteAmount * 0.97, fees.baseFeeBps); // approximate

      const { quoteOut, newPrice } = executeSell(segStates, price, baseIn);

      price = newPrice;

      const impact = priceBefore > 0 ? ((price - priceBefore) / priceBefore) * 100 : 0;
      totalAbsImpact += Math.abs(impact);
      maxImpact       = Math.max(maxImpact, Math.abs(impact));

      trades.push({
        index:          i + 1,
        direction:      'sell',
        amountIn:       baseIn,
        amountOut:      quoteOut - feePaid,
        priceAfter:     price,
        priceImpactPct: impact,
        feePaid,
      });
    }

    const gradPct = Math.min(100, (quoteAccumulated / Math.max(graduationThreshold, 1e-18)) * 100);
    pricePath.push({ tradeIndex: i + 1, price });
    quoteAccumulation.push({ tradeIndex: i + 1, quoteAccumulated, graduationPct: gradPct });

    if (quoteAccumulated >= graduationThreshold) break;
  }

  const tradeCount    = trades.length;
  const totalFees     = trades.reduce((s, t) => s + t.feePaid, 0);
  // Average impact only over buy trades (directional metric)
  const avgImpact     = buyTradeCount > 0 ? totalAbsImpact / buyTradeCount : 0;

  const totalAvailableBase = segments.reduce((s, seg) => s + seg.baseTokens, 0);
  const liquidityUtilization = totalAvailableBase > 0
    ? Math.min(1, baseConsumed / totalAvailableBase)
    : 0;

  return {
    scenario:            params.scenario,
    pricePath,
    quoteAccumulation,
    trades,
    totalFees,
    averagePriceImpact:  avgImpact,
    maxPriceImpact:      maxImpact,
    finalPrice:          price,
    startingPrice,
    quoteAtGraduation:   quoteAccumulated,
    graduationReached:   quoteAccumulated >= graduationThreshold,
    capitalRequired:     quoteAccumulated,
    liquidityUtilization,
    tradeCount,
  };
}

// ── Multi-scenario runner ──────────────────────────────────────────────────

export function runAllScenarios(
  input: Omit<SimulationInput, 'params'> & { tradeSizeQuote: number; tradeCount?: number }
): Record<TradeScenario, SimulationResult> {
  const base: Omit<SimulationParams, 'scenario'> = {
    tradeCount:     input.tradeCount ?? 50,
    tradeSizeQuote: input.tradeSizeQuote,
    sellFraction:   0.2,
  };
  return {
    A: runSimulation({ ...input, params: { ...base, scenario: 'A' } }),
    B: runSimulation({ ...input, params: { ...base, scenario: 'B' } }),
    C: runSimulation({ ...input, params: { ...base, scenario: 'C' } }),
    D: runSimulation({ ...input, params: { ...base, scenario: 'D' } }),
  };
}
