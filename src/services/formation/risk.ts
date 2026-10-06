/**
 * formation/risk.ts
 *
 * Deterministic risk signal detector.
 *
 * Produces RiskSignal[] from a FormationPlan + MarketObjectiveInput.
 * All signals are rule-based. No LLM. No external calls.
 * No financial promises — these are configuration-level observations only.
 */
import type { FormationPlan, RiskSignal, RiskSeverity } from '@/domain/types';
import type { MarketObjectiveInput } from '@/domain/market-objective';

// ── Signal builder helper ──────────────────────────────────────────────────

let _seq = 0;
function signal(
  severity: RiskSeverity,
  title: string,
  explanation: string,
  affectedParameter: string
): RiskSignal {
  return {
    id: `risk-${++_seq}`,
    severity,
    title,
    explanation,
    affectedParameter,
  };
}

// ── Main detector ──────────────────────────────────────────────────────────

export function detectRiskSignals(
  plan: FormationPlan,
  objective: MarketObjectiveInput
): RiskSignal[] {
  _seq = 0; // reset per call so IDs are stable within a plan
  const signals: RiskSignal[] = [];
  const cfg = plan.dbcConfiguration;

  // ── 1. Insufficient launch capital relative to graduation target ──────────
  // Rule: if launchCapital < 15% of migrationMarketCapSol → high risk
  //       if launchCapital < 30% → medium risk
  if (objective.launchCapital < cfg.migrationMarketCapSol * 0.15) {
    signals.push(signal(
      'high',
      'Insufficient Launch Capital',
      `Your stated launch capital (${objective.launchCapital} SOL) is less than 15% of the ` +
      `migration target (${cfg.migrationMarketCapSol} SOL). The market is unlikely to reach ` +
      `graduation unless additional demand materialises organically.`,
      'launchCapital / migrationMarketCapSol'
    ));
  } else if (objective.launchCapital < cfg.migrationMarketCapSol * 0.3) {
    signals.push(signal(
      'medium',
      'Limited Launch Capital',
      `Launch capital covers less than 30% of the migration target. Graduation will require ` +
      `meaningful organic demand beyond the initial launch allocation.`,
      'launchCapital / migrationMarketCapSol'
    ));
  }

  // ── 2. High demand dependence for aggressive plan ─────────────────────────
  if (plan.tier === 'aggressive' && objective.expectedDemand === 'low') {
    signals.push(signal(
      'high',
      'Aggressive Plan with Low Expected Demand',
      'An aggressive formation plan is calibrated for strong demand. With low expected demand, ' +
      'graduation progress is likely to fall well short of projection and price may stall.',
      'tier / expectedDemand'
    ));
  }

  if (plan.tier === 'aggressive' && objective.expectedDemand === 'moderate') {
    signals.push(signal(
      'medium',
      'Aggressive Plan Depends on Moderate Demand Holding',
      'This plan performs as projected only if demand meets or exceeds the moderate expectation. ' +
      'Any demand shortfall will materially reduce graduation progress.',
      'tier / expectedDemand'
    ));
  }

  // ── 3. High fee friction ──────────────────────────────────────────────────
  if (cfg.baseFeeBps > 700) {
    signals.push(signal(
      'high',
      'Very High Fee Friction',
      `Base fee of ${cfg.baseFeeBps}bps (${(cfg.baseFeeBps / 100).toFixed(2)}%) is unusually high. ` +
      'This may deter traders and reduce volume needed to reach graduation.',
      'baseFeeBps'
    ));
  } else if (cfg.baseFeeBps > 400) {
    signals.push(signal(
      'medium',
      'Elevated Fee Friction',
      `Base fee of ${cfg.baseFeeBps}bps may reduce trading activity compared to lower-fee alternatives. ` +
      'Consider whether this aligns with your trading volume expectations.',
      'baseFeeBps'
    ));
  }

  // ── 4. Very low fee — high whale sensitivity ──────────────────────────────
  if (cfg.baseFeeBps < 50 && plan.tier === 'aggressive') {
    signals.push(signal(
      'medium',
      'Low Fee with Aggressive Curve — Whale Sensitivity',
      `Very low fees (${cfg.baseFeeBps}bps) combined with a steep curve means a single large buy ` +
      'can move price significantly and quickly drain quote reserves.',
      'baseFeeBps / curveMode'
    ));
  }

  // ── 5. Concentrated buying risk for aggressive curve ─────────────────────
  if (plan.tier === 'aggressive' && cfg.segmentCount <= 3) {
    signals.push(signal(
      'medium',
      'High Sensitivity to Concentrated Buying',
      `With only ${cfg.segmentCount} curve segments, concentrated buying (whale activity) ` +
      'can cause large, rapid price movements that may deter retail traders.',
      'segmentCount'
    ));
  }

  // ── 6. No dynamic fee with volatile behavior expectations ─────────────────
  const wantsVolatilityControl =
    objective.desiredBehavior.includes('lowerVolatility') ||
    objective.desiredBehavior.includes('discourageRapidTrading');
  if (wantsVolatilityControl && !cfg.dynamicFeeEnabled) {
    signals.push(signal(
      'low',
      'Dynamic Fee Disabled — Volatility Control Reduced',
      'You indicated a preference for lower volatility or discouraging rapid trading, ' +
      'but dynamic fee is disabled in this plan. Dynamic fee helps absorb large price movements.',
      'dynamicFeeEnabled'
    ));
  }

  // ── 7. Demand testing objective with low capital ──────────────────────────
  if (
    objective.objectives.includes('demandTesting') &&
    objective.launchCapital < 10
  ) {
    signals.push(signal(
      'low',
      'Demand Testing Requires Sufficient Initial Depth',
      'Testing real demand requires enough initial liquidity to make trading meaningful. ' +
      'Very low capital may not provide a reliable signal of actual demand.',
      'launchCapital'
    ));
  }

  // ── 8. Migration target mismatch ──────────────────────────────────────────
  if (cfg.migrationMarketCapSol < cfg.initialMarketCapSol * 3) {
    signals.push(signal(
      'high',
      'Migration Target Too Close to Initial Market Cap',
      `Migration market cap (${cfg.migrationMarketCapSol} SOL) is less than 3× the initial ` +
      `market cap (${cfg.initialMarketCapSol} SOL). This creates an unusually short bonding curve ` +
      'and may behave unpredictably.',
      'migrationMarketCapSol / initialMarketCapSol'
    ));
  }

  // ── 9. Durable market objective with aggressive plan ─────────────────────
  if (
    objective.objectives.includes('durableMarket') &&
    plan.tier === 'aggressive'
  ) {
    signals.push(signal(
      'medium',
      'Durable Market Goal May Conflict with Aggressive Plan',
      'Building a durable market generally benefits from slower, more controlled progression. ' +
      'An aggressive plan optimises for speed, which may attract short-term traders over long-term holders.',
      'objectives / tier'
    ));
  }

  return signals;
}
