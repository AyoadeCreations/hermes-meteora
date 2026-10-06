/**
 * formation/planner.ts
 *
 * Deterministic FormationPlan generator.
 *
 * Input:  MarketObjectiveInput + MarketBrief (for capital/supply/price context)
 * Output: exactly 3 FormationPlans: conservative, balanced, aggressive
 *
 * Rules are explicit and auditable — no LLM, no randomness.
 * All parameters are derived from the user's stated objective.
 */
import { nanoid } from 'nanoid';
import type { MarketBrief, FormationPlan, FormationPlanTier } from '@/domain/types';
import type {
  MarketObjectiveInput,
  LaunchObjective,
  DesiredBehavior,
  RiskPreference,
} from '@/domain/market-objective';

// ── Internal config template ───────────────────────────────────────────────

interface PlanTemplate {
  tier: FormationPlanTier;
  name: string;
  shortDescription: string;
  curveMode: string;
  /** initialMarketCap as a multiple of brief.startingPrice × brief.totalSupply */
  initialMcapMultiplier: number;
  /** migrationMarketCap = brief.graduationQuoteAmount × this multiplier (SOL equiv) */
  migrationMcapMultiplier: number;
  baseFeeBps: number;
  dynamicFeeEnabled: boolean;
  creatorFeePercentage: number;
  segmentCount: number;
  liquidityProfile: string;
  /** Estimated graduation progress under expected demand (0–100) */
  graduationProgressEstimate: (demandMultiplier: number) => number;
  priceBehaviorDescription: string;
  feeProfile: 'higher' | 'similar' | 'lower';
}

// ── Demand multiplier ─────────────────────────────────────────────────────

function demandMultiplier(demand: MarketObjectiveInput['expectedDemand']): number {
  return demand === 'high' ? 1.6 : demand === 'moderate' ? 1.0 : 0.5;
}

// ── Objective → template adjustments ──────────────────────────────────────
// These nudge the base templates based on what the user says they want.

interface ObjectiveAdjustment {
  feeBpsDelta: number;
  initialMcapMultiplierDelta: number;
  segmentCountDelta: number;
  dynamicFeeOverride?: boolean;
}

function objectiveAdjustments(
  objectives: LaunchObjective[],
  behaviors: DesiredBehavior[]
): ObjectiveAdjustment {
  let feeBpsDelta = 0;
  let initialMcapMultiplierDelta = 0;
  let segmentCountDelta = 0;
  let dynamicFeeOverride: boolean | undefined;

  for (const obj of objectives) {
    if (obj === 'earlyLiquidity') { segmentCountDelta += 2; initialMcapMultiplierDelta -= 0.05; }
    if (obj === 'priceDiscovery') { segmentCountDelta += 1; }
    if (obj === 'bootstrapTrading') { feeBpsDelta -= 25; dynamicFeeOverride = false; }
    if (obj === 'targetMarketCap') { feeBpsDelta -= 15; }
    if (obj === 'demandTesting') { feeBpsDelta += 50; }
    if (obj === 'durableMarket') { feeBpsDelta += 25; segmentCountDelta += 1; }
    if (obj === 'fasterGraduation' as unknown) { feeBpsDelta -= 25; }
  }

  for (const beh of behaviors) {
    if (beh === 'lowerVolatility') { segmentCountDelta += 2; feeBpsDelta += 25; }
    if (beh === 'gradualPriceDiscovery') { segmentCountDelta += 1; initialMcapMultiplierDelta -= 0.02; }
    if (beh === 'fasterPriceDiscovery') { initialMcapMultiplierDelta += 0.03; }
    if (beh === 'strongerEarlyLiquidity') { segmentCountDelta += 2; }
    if (beh === 'discourageRapidTrading') { feeBpsDelta += 75; dynamicFeeOverride = true; }
    if (beh === 'fasterGraduation') { feeBpsDelta -= 25; }
  }

  return { feeBpsDelta, initialMcapMultiplierDelta, segmentCountDelta, dynamicFeeOverride };
}


// ── Base templates ─────────────────────────────────────────────────────────

const BASE_TEMPLATES: PlanTemplate[] = [
  {
    tier: 'conservative',
    name: 'Conservative Formation',
    shortDescription: 'Slower progression, lower price impact, more predictable behaviour.',
    curveMode: 'buildCurveWithMarketCap',
    initialMcapMultiplier: 0.04,
    migrationMcapMultiplier: 1.0,
    baseFeeBps: 300,
    dynamicFeeEnabled: false,
    creatorFeePercentage: 10,
    segmentCount: 6,
    liquidityProfile: 'concentrated-low',
    graduationProgressEstimate: (m) => Math.min(95, 55 * m),
    priceBehaviorDescription: 'Gradual price progression with low slippage in early ranges.',
    feeProfile: 'higher',
  },
  {
    tier: 'balanced',
    name: 'Balanced Formation',
    shortDescription: 'Balanced price discovery, fee income, and graduation pace.',
    curveMode: 'buildCurveWithMarketCap',
    initialMcapMultiplier: 0.06,
    migrationMcapMultiplier: 1.0,
    baseFeeBps: 200,
    dynamicFeeEnabled: true,
    creatorFeePercentage: 10,
    segmentCount: 4,
    liquidityProfile: 'distributed',
    graduationProgressEstimate: (m) => Math.min(100, 70 * m),
    priceBehaviorDescription: 'Moderate price response to demand with reasonable fee friction.',
    feeProfile: 'similar',
  },
  {
    tier: 'aggressive',
    name: 'Aggressive Formation',
    shortDescription: 'Faster price discovery and graduation; higher sensitivity to demand.',
    curveMode: 'buildCurveWithMarketCap',
    initialMcapMultiplier: 0.1,
    migrationMcapMultiplier: 1.0,
    baseFeeBps: 100,
    dynamicFeeEnabled: true,
    creatorFeePercentage: 15,
    segmentCount: 3,
    liquidityProfile: 'top-weighted',
    graduationProgressEstimate: (m) => Math.min(100, 85 * m),
    priceBehaviorDescription: 'Faster price response; graduation reachable with moderate demand.',
    feeProfile: 'lower',
  },
];

// ── Risk label → fee/mcap multiplier (inline, no helper needed) ────────────

function applyRisk(
  risk: RiskPreference,
  feeBps: number,
  mcapMult: number
): { feeBps: number; mcapMult: number } {
  if (risk === 'conservative') return { feeBps: Math.round(feeBps * 1.3), mcapMult: mcapMult * 0.85 };
  if (risk === 'aggressive')   return { feeBps: Math.round(feeBps * 0.75), mcapMult: mcapMult * 1.2 };
  return { feeBps, mcapMult };
}

// ── Clamp helpers ──────────────────────────────────────────────────────────

function clampFeeBps(v: number): number { return Math.max(25, Math.min(9900, v)); }
function clampSegments(v: number): number { return Math.max(2, Math.min(12, v)); }
function clampMcap(v: number, floor: number): number { return Math.max(floor, v); }

// ── Main generator ─────────────────────────────────────────────────────────

export interface FormationPlanResult {
  plans: FormationPlan[];
}

export function generateFormationPlans(
  brief: MarketBrief,
  objective: MarketObjectiveInput
): FormationPlanResult {
  const dm = demandMultiplier(objective.expectedDemand);
  const adj = objectiveAdjustments(objective.objectives, objective.desiredBehavior);

  const plans: FormationPlan[] = BASE_TEMPLATES.map((tpl) => {
    // Apply objective adjustments
    let feeBps = tpl.baseFeeBps + adj.feeBpsDelta;
    let mcapMult = tpl.initialMcapMultiplier + adj.initialMcapMultiplierDelta;
    let segments = tpl.segmentCount + adj.segmentCountDelta;
    const dynFee = adj.dynamicFeeOverride !== undefined
      ? adj.dynamicFeeOverride
      : tpl.dynamicFeeEnabled;

    // Apply risk preference
    const risked = applyRisk(objective.riskPreference, feeBps, mcapMult);
    feeBps = risked.feeBps;
    mcapMult = risked.mcapMult;

    // Clamp values to valid ranges
    feeBps = clampFeeBps(feeBps);
    segments = clampSegments(segments);

    // Derive market cap values from brief
    const initialMcap = clampMcap(brief.startingPrice * brief.totalSupply * mcapMult * 1e-6, 0.001);
    const migrationMcap = clampMcap(brief.graduationQuoteAmount * tpl.migrationMcapMultiplier, initialMcap * 5);

    // Estimate graduation progress
    const gradPct = Math.round(tpl.graduationProgressEstimate(dm));

    // Build assumption description
    const traderEstimate = objective.expectedDemand === 'high' ? 500
      : objective.expectedDemand === 'moderate' ? 200 : 80;
    const volEstimate = Math.round(brief.graduationQuoteAmount * 0.05 * dm * 10) / 10;

    const risks = buildRisks(tpl.tier, feeBps, gradPct, objective, dm);

    return {
      id: nanoid(16),
      marketId: brief.id,
      tier: tpl.tier,
      name: tpl.name,
      shortDescription: tpl.shortDescription,
      rationale: buildRationale(tpl.tier, objective, feeBps, gradPct),
      dbcConfiguration: {
        curveMode: tpl.curveMode,
        initialMarketCapSol: Math.round(initialMcap * 10000) / 10000,
        migrationMarketCapSol: Math.round(migrationMcap * 100) / 100,
        baseFeeBps: feeBps,
        dynamicFeeEnabled: dynFee,
        creatorFeePercentage: tpl.creatorFeePercentage,
        segmentCount: segments,
        liquidityProfile: tpl.liquidityProfile,
      },
      assumptions: {
        demandScenario: objective.expectedDemand,
        estimatedTraders: traderEstimate,
        estimatedDailyVolume: volEstimate,
        modelNotes: [
          'ESTIMATE: graduation progress is modeled, not guaranteed.',
          'ASSUMPTION: demand level matches user-stated expectation.',
          'DETERMINISTIC: fee and curve calculations use fixed rules.',
        ],
      },
      expectedOutcomes: {
        graduationProgressPct: gradPct,
        priceBehavior: tpl.priceBehaviorDescription,
        daysToGraduation: gradPct >= 100 ? estimateDays(dm, tpl.tier) : null,
        feeProfile: tpl.feeProfile,
      },
      risks,
      recommendationScore: 0, // filled by recommend.ts
      isRecommended: false,   // filled by recommend.ts
      recommendationReasons: [],
      createdAt: new Date().toISOString(),
    } satisfies FormationPlan;
  });

  return { plans };
}

// ── Rationale builder ──────────────────────────────────────────────────────

function buildRationale(
  tier: FormationPlanTier,
  obj: MarketObjectiveInput,
  feeBps: number,
  gradPct: number
): string {
  const demandWord = obj.expectedDemand === 'high' ? 'strong'
    : obj.expectedDemand === 'moderate' ? 'moderate' : 'cautious';
  const primaryObjective = obj.objectives[0];

  if (tier === 'conservative') {
    return `Prioritises stability over speed. With ${demandWord} expected demand and a focus on ${primaryObjective}, ` +
      `this plan uses tighter liquidity concentration and ${feeBps}bps base fee to reduce volatility. ` +
      `Estimated graduation progress: ${gradPct}% under expected demand.`;
  }
  if (tier === 'aggressive') {
    return `Optimised for speed. Lower fees (${feeBps}bps) and a steeper curve accelerate graduation. ` +
      `Best suited to ${demandWord} demand where rapid price discovery aligns with the ${primaryObjective} goal. ` +
      `Higher sensitivity to demand fluctuations.`;
  }
  return `Balances price discovery, fee income, and graduation pace. ${feeBps}bps base fee with ` +
    `dynamic fee enabled responds to demand volatility. Good general-purpose choice for ${primaryObjective} ` +
    `with ${demandWord} expected demand. Estimated ${gradPct}% graduation progress.`;
}

// ── Risk builder ────────────────────────────────────────────────────────────

function buildRisks(
  tier: FormationPlanTier,
  feeBps: number,
  gradPct: number,
  obj: MarketObjectiveInput,
  dm: number
): string[] {
  const risks: string[] = [];

  if (tier === 'aggressive') {
    risks.push('Higher sensitivity to demand shortfall — graduation may stall if fewer traders participate than expected.');
    if (obj.expectedDemand === 'low') {
      risks.push('Aggressive curve with low expected demand creates a wide gap between projection and likely reality.');
    }
  }

  if (tier === 'conservative') {
    if (gradPct < 60) {
      risks.push('Graduation may not be reached under expected demand — consider a higher capital target or stronger demand signals.');
    }
    risks.push('Slower price progression may reduce trader interest in early stages.');
  }

  if (feeBps > 500) {
    risks.push(`High fee friction (${feeBps}bps) may deter trading activity.`);
  }

  if (obj.launchCapital < 5) {
    risks.push('Very low launch capital — price impact per trade will be high regardless of configuration.');
  }

  if (dm < 0.6 && tier !== 'conservative') {
    risks.push('Demand expectations are low relative to the plan tier — performance assumptions may be optimistic.');
  }

  if (risks.length === 0) {
    risks.push('No major configuration risks detected for this plan under stated assumptions.');
  }

  return risks;
}

// ── Days to graduation estimate ────────────────────────────────────────────

function estimateDays(dm: number, tier: FormationPlanTier): number {
  const base = tier === 'conservative' ? 14 : tier === 'balanced' ? 7 : 3;
  return Math.max(1, Math.round(base / dm));
}
