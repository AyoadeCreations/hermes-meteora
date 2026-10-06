/**
 * formation/scenarios.ts
 *
 * Scenario stress-tester for FormationPlans.
 *
 * Wraps the existing runAllScenarios() engine — no new simulation math.
 * Maps the 4 named demand scenarios to appropriate trade size inputs,
 * then runs all 4 engine scenarios (A/B/C/D) for each.
 *
 * DETERMINISTIC: all outputs are computed from the curve + fee config.
 * ESTIMATE: graduation progress numbers are modeled, not guaranteed.
 * NOT MODELED: real-world market conditions, external liquidity, social dynamics.
 */
import { runAllScenarios } from '@/services/simulation/engine';
import type { MarketBrief, MarketDesign, SimulationResult, TradeScenario } from '@/domain/types';
import type { FormationPlan } from '@/domain/types';

// ── Scenario definitions ───────────────────────────────────────────────────

export type DemandScenarioName = 'weak' | 'expected' | 'strong' | 'whale';

export interface ScenarioRun {
  name: DemandScenarioName;
  label: string;
  description: string;
  tradeSizeQuote: number;
  tradeCount: number;
  /** All 4 engine scenarios (A/B/C/D) for this demand level */
  results: Record<TradeScenario, SimulationResult>;
  /** Best representative result for summary display (Scenario B) */
  summary: SimulationResult;
}

export interface PlanScenarioResult {
  planId: string;
  planTier: FormationPlan['tier'];
  planName: string;
  scenarios: ScenarioRun[];
  /** Across all scenarios: is graduation ever reached? */
  graduationReachable: boolean;
  /** Which demand levels reach graduation */
  graduatesUnder: DemandScenarioName[];
}

// ── Trade size derivation ──────────────────────────────────────────────────

function tradeSizeForScenario(
  scenarioName: DemandScenarioName,
  graduationQuote: number
): { tradeSizeQuote: number; tradeCount: number } {
  // Trade sizes are fractions of the graduation target — a reasonable proxy
  // for the typical order size relative to the pool depth.
  const base = graduationQuote / 50; // ~2% of graduation target per trade (Scenario B baseline)
  switch (scenarioName) {
    case 'weak':     return { tradeSizeQuote: base * 0.3, tradeCount: 30 };
    case 'expected': return { tradeSizeQuote: base * 1.0, tradeCount: 50 };
    case 'strong':   return { tradeSizeQuote: base * 2.0, tradeCount: 80 };
    case 'whale':    return { tradeSizeQuote: base * 8.0, tradeCount: 20 };
  }
}

const SCENARIO_META: Record<DemandScenarioName, { label: string; description: string }> = {
  weak: {
    label: 'Weak Demand',
    description: 'Few traders, smaller order sizes. Tests resilience under poor conditions.',
  },
  expected: {
    label: 'Expected Demand',
    description: 'Demand matches the creator\'s stated expectations.',
  },
  strong: {
    label: 'Strong Demand',
    description: 'High participation with larger orders. Tests upside performance.',
  },
  whale: {
    label: 'Whale-Heavy Demand',
    description: 'A small number of large buyers dominate. Tests concentrated buying impact.',
  },
};

// ── Main runner ────────────────────────────────────────────────────────────

/**
 * Run all 4 demand scenarios for a given plan + design.
 * The design must already be generated (has curve segments + fees).
 */
export function runPlanScenarios(
  plan: FormationPlan,
  design: MarketDesign,
  brief: MarketBrief
): PlanScenarioResult {
  const demandScenarios: DemandScenarioName[] = ['weak', 'expected', 'strong', 'whale'];
  const graduatesUnder: DemandScenarioName[] = [];

  const scenarioRuns: ScenarioRun[] = demandScenarios.map((name) => {
    const { tradeSizeQuote, tradeCount } = tradeSizeForScenario(name, brief.graduationQuoteAmount);

    const results = runAllScenarios({
      segments: design.curve.segments,
      startingPrice: brief.startingPrice,
      graduationThreshold: design.graduation.quoteThreshold,
      fees: design.fees,
      tradeSizeQuote,
      tradeCount,
    });

    const summary = results['B']; // Scenario B = medium buys — best summary proxy

    if (results['B'].graduationReached || results['C'].graduationReached) {
      graduatesUnder.push(name);
    }

    return {
      name,
      label: SCENARIO_META[name].label,
      description: SCENARIO_META[name].description,
      tradeSizeQuote,
      tradeCount,
      results,
      summary,
    };
  });

  return {
    planId: plan.id,
    planTier: plan.tier,
    planName: plan.name,
    scenarios: scenarioRuns,
    graduationReachable: graduatesUnder.length > 0,
    graduatesUnder,
  };
}

/**
 * Run scenarios for multiple plans at once.
 * Designs must be passed in the same order as plans.
 */
export function runAllPlanScenarios(
  plans: FormationPlan[],
  designs: MarketDesign[],
  brief: MarketBrief
): PlanScenarioResult[] {
  return plans.map((plan, i) => {
    const design = designs[i];
    if (!design) return null;
    return runPlanScenarios(plan, design, brief);
  }).filter(Boolean) as PlanScenarioResult[];
}
