/**
 * Constraint Engine
 *
 * Validates market configuration parameters and tells operators
 * when a configuration is inconsistent or inadvisable.
 *
 * The system must be willing to say:
 *   "This configuration does not satisfy your stated objective."
 *
 * All rules are documented with the reason for rejection.
 */

import type { ConstraintViolation } from '@/domain/schemas';
import type { MarketBrief, SimulationResult, FeeConfig } from '@/domain/types';

const MIN_FEE_BPS      = 25;
const MAX_FEE_BPS      = 9900;
const MAX_CURVE_POINTS = 16;
const MIN_TOTAL_SUPPLY = 1_000;
const MAX_PRICE_IMPACT = 50;
const MIN_GRAD_PROGRESS = 10;

// ── Rule helpers ───────────────────────────────────────────────────────────

type Severity = 'error' | 'warning';

function v(
  field:    string,
  rule:     string,
  message:  string,
  severity: Severity,
): ConstraintViolation {
  return { field, rule, message, severity };
}

// ── Brief validation ───────────────────────────────────────────────────────

export function validateBrief(brief: MarketBrief): ConstraintViolation[] {
  const vs: ConstraintViolation[] = [];

  // Starting price must be positive — zero causes division by zero in CLMM
  if (brief.startingPrice <= 0) {
    vs.push(v(
      'startingPrice', 'zero_starting_price',
      'Starting price must be greater than zero. A zero price causes division by zero in curve calculations.',
      'error'
    ));
  }

  // Supply sanity
  if (brief.totalSupply < MIN_TOTAL_SUPPLY) {
    vs.push(v(
      'totalSupply', 'supply_too_low',
      `Total supply of ${brief.totalSupply.toLocaleString()} is below the minimum of ${MIN_TOTAL_SUPPLY.toLocaleString()}. Very low supply makes curve behaviour degenerate.`,
      'error'
    ));
  }

  if (brief.totalSupply > 1e15) {
    vs.push(v(
      'totalSupply', 'supply_too_high',
      'Total supply is extremely large. This may cause precision issues in curve calculations. Consider a supply in the millions or billions range.',
      'warning'
    ));
  }

  // Graduation vs starting price
  if (brief.graduationQuoteAmount <= 0) {
    vs.push(v(
      'graduationQuoteAmount', 'zero_graduation',
      'Graduation target must be positive.',
      'error'
    ));
  }

  // Graduation target must exceed the starting price.
  // A graduation target below (or at) the starting price is physically impossible:
  // the pool accumulates quote by selling base tokens — it cannot graduate before
  // collecting at least as much quote as a single trade at the starting price.
  if (brief.startingPrice > 0 && brief.graduationQuoteAmount < brief.startingPrice) {
    vs.push(v(
      'graduationQuoteAmount', 'graduation_below_starting_price',
      `Graduation target (${brief.graduationQuoteAmount} SOL) is below the starting price (${brief.startingPrice} SOL). ` +
      `The pool must accumulate at least as much quote as its starting price to function correctly. ` +
      `Raise the graduation target or lower the starting price.`,
      'error'
    ));
  }

  if (brief.startingPrice > 0
    && brief.graduationQuoteAmount >= brief.startingPrice
    && brief.graduationQuoteAmount < brief.startingPrice * 10) {
    vs.push(v(
      'graduationQuoteAmount', 'graduation_very_small',
      `Graduation target (${brief.graduationQuoteAmount} SOL) is very small relative to starting price (${brief.startingPrice} SOL). The curve may graduate almost instantly.`,
      'warning'
    ));
  }

  // Implied market cap sanity
  if (brief.startingPrice > 0) {
    const impliedMcap = brief.startingPrice * brief.totalSupply;

    if (impliedMcap > 1e12) {
      vs.push(v(
        'startingPrice', 'implied_market_cap_too_large',
        `Starting price × supply implies a market cap of ${impliedMcap.toExponential(2)} SOL — this is unrealistically large. Consider a lower starting price.`,
        'warning'
      ));
    }

    // Graduation impossibility: target > 50% of implied market cap
    if (brief.graduationQuoteAmount > impliedMcap * 0.5) {
      vs.push(v(
        'graduationQuoteAmount', 'graduation_exceeds_half_market_cap',
        `Graduation target (${brief.graduationQuoteAmount} SOL) exceeds 50% of the implied market cap (${(impliedMcap * 0.5).toFixed(2)} SOL). Graduation may be unreachable in practice.`,
        'warning'
      ));
    }
  }

  // Graduation impossibly large (absolute)
  if (brief.graduationQuoteAmount > 1e9) {
    vs.push(v(
      'graduationQuoteAmount', 'graduation_unrealistic_absolute',
      `Graduation target of ${brief.graduationQuoteAmount.toExponential(2)} SOL is unrealistically large. This configuration would never graduate.`,
      'error'
    ));
  }

  // Demand vs graduation objective mismatch
  const isLowDemand = brief.expectedDemand.profile === 'low';
  // Any graduation target above 50 SOL with low demand is a practical mismatch
  const isHighGrad  = brief.graduationQuoteAmount > 50;

  if (isLowDemand && isHighGrad && brief.objective === 'fast_capital_formation') {
    vs.push(v(
      'objective', 'objective_demand_conflict',
      `You selected Fast Capital Formation but expect Low demand with a graduation target of ${brief.graduationQuoteAmount} SOL. Under low demand, fast graduation is unlikely. Consider reducing the graduation target or selecting a different objective.`,
      'warning'
    ));
  }

  if (isLowDemand && isHighGrad) {
    vs.push(v(
      'graduationQuoteAmount', 'high_graduation_low_demand',
      `Graduation target of ${brief.graduationQuoteAmount} SOL is high relative to expected low demand. Under the simulated scenarios, this market may not graduate.`,
      'warning'
    ));
  }

  // Objective: low_price_impact with very high graduation is inconsistent
  // (optimising for low impact on a short curve is easy; on a long curve it matters more)
  if (brief.objective === 'low_price_impact' && brief.graduationQuoteAmount > 500) {
    vs.push(v(
      'objective', 'low_impact_high_grad_note',
      `Low Price Impact objective with a ${brief.graduationQuoteAmount} SOL graduation target means the curve must support a long price journey with consistently low impact. Ensure you have sufficient supply distribution.`,
      'warning'
    ));
  }

  return vs;
}

// ── Fee validation ─────────────────────────────────────────────────────────

export function validateFeeConfig(fees: FeeConfig): ConstraintViolation[] {
  const vs: ConstraintViolation[] = [];

  if (fees.baseFeeBps < MIN_FEE_BPS) {
    vs.push(v(
      'fees.baseFeeBps', 'fee_below_minimum',
      `Fee of ${fees.baseFeeBps} bps is below the Meteora DBC minimum of ${MIN_FEE_BPS} bps. The protocol will reject this configuration.`,
      'error'
    ));
  }

  if (fees.baseFeeBps > MAX_FEE_BPS) {
    vs.push(v(
      'fees.baseFeeBps', 'fee_above_maximum',
      `Fee of ${fees.baseFeeBps} bps exceeds the Meteora DBC maximum of ${MAX_FEE_BPS} bps. The protocol will reject this configuration.`,
      'error'
    ));
  }

  if (fees.baseFeeBps > 1000) {
    vs.push(v(
      'fees.baseFeeBps', 'high_fee_warning',
      `Fee of ${fees.baseFeeBps} bps (${(fees.baseFeeBps / 100).toFixed(1)}%) is above 10%. High fees reduce net proceeds for sellers and may discourage trading activity.`,
      'warning'
    ));
  }

  if (fees.creatorTradingFeePercentage > 50) {
    vs.push(v(
      'fees.creatorTradingFeePercentage', 'creator_fee_very_high',
      `Creator trading fee of ${fees.creatorTradingFeePercentage}% is very high. This reduces the effective liquidity available to traders.`,
      'warning'
    ));
  }

  return vs;
}

// ── Simulation result validation ───────────────────────────────────────────

export function validateSimulationResult(
  result:    SimulationResult,
  objective: string,
): ConstraintViolation[] {
  const vs: ConstraintViolation[] = [];

  if (result.averagePriceImpact > MAX_PRICE_IMPACT) {
    vs.push(v(
      'simulation.averagePriceImpact', 'extreme_price_impact',
      `Average simulated price impact of ${result.averagePriceImpact.toFixed(1)}% is extreme. Buyers will face severe slippage. Consider a design with more front-loaded liquidity.`,
      'error'
    ));
  } else if (result.averagePriceImpact > 20) {
    vs.push(v(
      'simulation.averagePriceImpact', 'high_price_impact',
      `Average simulated price impact of ${result.averagePriceImpact.toFixed(1)}% is high. Consider whether this aligns with your objective.`,
      'warning'
    ));
  }

  if (result.maxPriceImpact > 80) {
    vs.push(v(
      'simulation.maxPriceImpact', 'max_price_impact_extreme',
      `Maximum single-trade price impact reaches ${result.maxPriceImpact.toFixed(1)}%. The curve has very thin liquidity in some segments.`,
      'warning'
    ));
  }

  const lastGrad = result.quoteAccumulation[result.quoteAccumulation.length - 1];
  if (lastGrad && lastGrad.graduationPct < MIN_GRAD_PROGRESS) {
    vs.push(v(
      'simulation.graduationProgress', 'low_graduation_progress',
      `Under the simulated scenario, this design only reaches ${lastGrad.graduationPct.toFixed(1)}% toward graduation. Consider reducing the graduation target or increasing expected demand assumptions.`,
      'warning'
    ));
  }

  if (result.liquidityUtilization < 0.02) {
    vs.push(v(
      'simulation.liquidityUtilization', 'insufficient_utilization',
      'The simulated trades barely touch available liquidity. The curve may be over-provisioned for the expected demand level.',
      'warning'
    ));
  }

  return vs;
}

// ── Design feasibility ─────────────────────────────────────────────────────

export function validateDesignFeasibility(
  brief:             MarketBrief,
  feeBps:            number,
  segmentCount:      number,
): ConstraintViolation[] {
  const vs: ConstraintViolation[] = [];

  if (segmentCount > MAX_CURVE_POINTS) {
    vs.push(v(
      'curve.segments', 'too_many_segments',
      `${segmentCount} curve segments exceeds the Meteora DBC limit of ${MAX_CURVE_POINTS}. The protocol will reject this configuration.`,
      'error'
    ));
  }

  if (feeBps < MIN_FEE_BPS || feeBps > MAX_FEE_BPS) {
    vs.push(v(
      'fees.baseFeeBps', 'fee_out_of_range',
      `Fee of ${feeBps} bps is outside the Meteora DBC accepted range of [${MIN_FEE_BPS}, ${MAX_FEE_BPS}] bps.`,
      'error'
    ));
  }

  return vs;
}

// ── Aggregate helpers ──────────────────────────────────────────────────────

export function hasErrors(violations: ConstraintViolation[]): boolean {
  return violations.some((v) => v.severity === 'error');
}

export function getErrorMessages(violations: ConstraintViolation[]): string[] {
  return violations.filter((v) => v.severity === 'error').map((v) => v.message);
}

export function getWarningMessages(violations: ConstraintViolation[]): string[] {
  return violations.filter((v) => v.severity === 'warning').map((v) => v.message);
}
