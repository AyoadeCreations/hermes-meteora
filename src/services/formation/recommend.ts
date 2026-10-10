/**
 * formation/recommend.ts
 *
 * Deterministic plan ranker.
 *
 * Scores and ranks the 3 formation plans based on how well each matches
 * the user's stated objective. Returns the recommended plan with
 * 2–4 concise human-readable reasons.
 *
 * All scoring is rule-based. No LLM. No external calls.
 */
import type { FormationPlan, FormationPlanTier } from '@/domain/types';
import type { MarketObjectiveInput, LaunchObjective, DesiredBehavior } from '@/domain/market-objective';

// ── Scoring rules ──────────────────────────────────────────────────────────
//
// Each rule produces a delta [-1, +1] to a plan's recommendation score.
// Total score is normalised to [0, 1] after all rules apply.

interface ScoringRule {
  applies: (plan: FormationPlan, obj: MarketObjectiveInput) => boolean;
  delta: number;
  reason: (plan: FormationPlan) => string;
}

const SCORING_RULES: ScoringRule[] = [
  // ── Risk preference alignment ──────────────────────────────────────────
  {
    applies: (p, o) => o.riskPreference === 'conservative' && p.tier === 'conservative',
    delta: 0.3,
    reason: () => 'Liquidity First matches your conservative risk preference.',
  },
  {
    applies: (p, o) => o.riskPreference === 'balanced' && p.tier === 'balanced',
    delta: 0.3,
    reason: () => 'Aligns with your balanced risk approach.',
  },
  {
    applies: (p, o) => o.riskPreference === 'aggressive' && p.tier === 'aggressive',
    delta: 0.3,
    reason: () => 'Price Discovery First matches your preference for faster outcomes.',
  },
  // Penalise strong mismatches
  {
    applies: (p, o) => o.riskPreference === 'conservative' && p.tier === 'aggressive',
    delta: -0.4,
    reason: () => 'Price Discovery First conflicts with your conservative risk preference.',
  },
  {
    applies: (p, o) => o.riskPreference === 'aggressive' && p.tier === 'conservative',
    delta: -0.25,
    reason: () => 'Liquidity First may be too slow for your growth goals.',
  },

  // ── Demand alignment ────────────────────────────────────────────────────
  {
    applies: (p, o) => o.expectedDemand === 'low' && p.tier === 'conservative',
    delta: 0.25,
    reason: () => 'Liquidity First is appropriate for low expected demand — lower price sensitivity reduces risk.',
  },
  {
    applies: (p, o) => o.expectedDemand === 'high' && p.tier === 'aggressive',
    delta: 0.2,
    reason: () => 'Price Discovery First makes efficient use of high demand for faster graduation.',
  },
  {
    applies: (p, o) => o.expectedDemand === 'low' && p.tier === 'aggressive',
    delta: -0.35,
    reason: () => 'Price Discovery First is unlikely to perform well with low expected demand.',
  },

  // ── Objective alignment ─────────────────────────────────────────────────
  {
    applies: (p, o) => o.objectives.includes('earlyLiquidity') && p.tier === 'conservative',
    delta: 0.2,
    reason: () => 'Liquidity First concentrates liquidity early, directly supporting your liquidity goal.',
  },
  {
    applies: (p, o) => o.objectives.includes('bootstrapTrading') && p.tier === 'aggressive',
    delta: 0.2,
    reason: () => 'Lower fees in Price Discovery First encourage the trading activity you want to bootstrap.',
  },
  {
    applies: (p, o) => o.objectives.includes('targetMarketCap') && p.tier !== 'conservative',
    delta: 0.1,
    reason: (p) => `${capitalize(p.name)} reaches graduation more efficiently.`,
  },
  {
    applies: (p, o) => o.objectives.includes('durableMarket') && p.tier === 'conservative',
    delta: 0.2,
    reason: () => 'Liquidity First\'s lower price sensitivity supports long-term market durability.',
  },
  {
    applies: (p, o) => o.objectives.includes('priceDiscovery') && p.tier === 'balanced',
    delta: 0.15,
    reason: () => 'Balanced Formation provides steady price discovery without extremes.',
  },
  {
    applies: (p, o) => o.objectives.includes('demandTesting') && p.tier === 'balanced',
    delta: 0.15,
    reason: () => 'Balanced Formation gives a clear read on demand without distorting with extreme parameters.',
  },

  // ── Desired behavior alignment ───────────────────────────────────────────
  {
    applies: (p, o) => o.desiredBehavior.includes('lowerVolatility') && p.tier === 'conservative',
    delta: 0.2,
    reason: () => 'Liquidity First produces the most stable price progression.',
  },
  {
    applies: (p, o) => o.desiredBehavior.includes('fasterGraduation') && p.tier === 'aggressive',
    delta: 0.2,
    reason: () => 'Price Discovery First is optimised for reaching graduation quickly.',
  },
  {
    applies: (p, o) => o.desiredBehavior.includes('strongerEarlyLiquidity') && p.tier === 'conservative',
    delta: 0.15,
    reason: () => 'Liquidity First\'s concentrated early liquidity reduces buyer slippage.',
  },
  {
    applies: (p, o) => o.desiredBehavior.includes('discourageRapidTrading') && p.tier === 'conservative',
    delta: 0.15,
    reason: () => 'Higher fees in Liquidity First naturally discourage rapid flipping.',
  },
  {
    applies: (p, o) => o.desiredBehavior.includes('fasterPriceDiscovery') && p.tier !== 'conservative',
    delta: 0.1,
    reason: (p) => `${capitalize(p.name)} responds faster to demand, supporting quicker price discovery.`,
  },

  // ── Balanced plan baseline bonus ────────────────────────────────────────
  {
    applies: (p, o) =>
      p.tier === 'balanced' &&
      o.riskPreference === 'balanced' &&
      !o.objectives.includes('durableMarket') &&
      !o.objectives.includes('bootstrapTrading'),
    delta: 0.1,
    reason: () => 'Balanced Formation is a solid default for balanced risk with no strong directional preference.',
  },
];

// ── Scorer ─────────────────────────────────────────────────────────────────

interface PlanScore {
  plan: FormationPlan;
  score: number;
  reasons: string[];
}

export function rankPlans(
  plans: FormationPlan[],
  objective: MarketObjectiveInput
): FormationPlan[] {
  // Score each plan
  const scored: PlanScore[] = plans.map((plan) => {
    let score = 0.5; // neutral baseline
    const positiveReasons: string[] = [];
    const negativeReasons: string[] = [];

    for (const rule of SCORING_RULES) {
      if (rule.applies(plan, objective)) {
        score += rule.delta;
        if (rule.delta > 0) positiveReasons.push(rule.reason(plan));
        else negativeReasons.push(rule.reason(plan));
      }
    }

    // Clamp to [0, 1]
    score = Math.max(0, Math.min(1, score));

    // Take top 2–4 reasons (prefer positives for the winner)
    const reasons = [...positiveReasons.slice(0, 3), ...negativeReasons.slice(0, 1)].slice(0, 4);

    return { plan, score, reasons };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Mark recommended plan and attach scores/reasons
  return scored.map((s, i) => ({
    ...s.plan,
    recommendationScore: Math.round(s.score * 100) / 100,
    isRecommended: i === 0,
    recommendationReasons: i === 0
      ? s.reasons.length > 0
        ? s.reasons
        : [`${capitalize(s.plan.tier)} plan best matches your stated objectives and risk preference.`]
      : [],
  }));
}

// ── Util ───────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
