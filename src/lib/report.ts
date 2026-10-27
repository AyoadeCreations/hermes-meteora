/**
 * Shared helpers for the public launch report.
 */

import type { MarketDesign } from '@/domain/types';
import { runStressTest, defaultStressConfig, type StressResult } from '@/services/simulation/stress';

/** The organic flow the report's stress test replays, taken from the design's own simulation. */
export function organicAssumptions(design: MarketDesign): { count: number; size: number } {
  const buys = design.simulation.trades.filter((t) => t.direction === 'buy');
  const count = buys.length > 0 ? buys.length : 50;
  const size  = buys[0]?.amountIn && buys[0].amountIn > 0 ? buys[0].amountIn : 1.7;
  return { count: Math.min(300, count), size };
}

/** Stress test with default bot settings, used for the report headline and share image. */
export function defaultStressFor(design: MarketDesign): StressResult | null {
  const first = design.curve.segments[0];
  if (!first) return null;
  const { count, size } = organicAssumptions(design);
  try {
    return runStressTest({
      segments:            design.curve.segments,
      startingPrice:       first.priceStart,
      graduationThreshold: design.graduation.quoteThreshold,
      fees:                design.fees,
      config:              defaultStressConfig({ organicSizeQuote: size, organicCount: count }),
    });
  } catch {
    return null;
  }
}

/** One point per segment boundary: cumulative quote raised against price. */
export function curveShape(design: MarketDesign): { quote: number; price: number }[] {
  const pts: { quote: number; price: number }[] = [];
  let cum = 0;
  design.curve.segments.forEach((seg, i) => {
    if (i === 0) pts.push({ quote: 0, price: seg.priceStart });
    cum += seg.quoteTokens;
    pts.push({ quote: cum, price: seg.priceEnd });
  });
  return pts;
}

/** Relative path of a design's public report. */
export function reportPath(designId: string): string {
  return `/report/${encodeURIComponent(designId)}`;
}
