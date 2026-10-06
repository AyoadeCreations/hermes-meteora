import { NextRequest, NextResponse } from 'next/server';
import { getMarket, getObjective, getDesigns } from '@/lib/db';
import { generateFormationPlans } from '@/services/formation/planner';
import { rankPlans } from '@/services/formation/recommend';
import { detectRiskSignals } from '@/services/formation/risk';
import type { MarketObjectiveInput } from '@/domain/market-objective';
import type { FormationPlan } from '@/domain/types';

/**
 * GET /api/markets/:id/plans
 *
 * Generates (or regenerates) the 3 formation plans for a market.
 * Requires the market to have a saved objective first.
 *
 * Plans are derived deterministically from:
 *   - The MarketObjective (user intent)
 *   - The MarketBrief (capital, supply, price)
 *
 * Risk signals are generated for each plan.
 * Plans are ranked and the recommended one is flagged.
 *
 * Plans are NOT persisted — they are lightweight and regenerated on demand.
 * The selected plan ID is persisted only at deployment time (LaunchOutcome).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [market, rawObjective] = await Promise.all([
      getMarket(id),
      getObjective(id),
    ]);

    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    if (!rawObjective) {
      return NextResponse.json(
        { error: 'No objective found. Complete the Market Objective step first.' },
        { status: 422 }
      );
    }

    const objective = rawObjective as unknown as MarketObjectiveInput;

    // Generate 3 candidate plans
    const { plans: rawPlans } = generateFormationPlans(market, objective);

    // Rank and mark recommended
    const rankedPlans = rankPlans(rawPlans, objective);

    // Attach risk signals to each plan
    const plansWithRisks: Array<FormationPlan & { riskSignals: ReturnType<typeof detectRiskSignals> }> =
      rankedPlans.map((plan) => ({
        ...plan,
        riskSignals: detectRiskSignals(plan, objective),
      }));

    // Fetch existing designs for plan→design linkage (if already generated)
    const existingDesigns = await getDesigns(id);

    return NextResponse.json({
      plans: plansWithRisks,
      hasDesigns: existingDesigns.length > 0,
      objective,
    });
  } catch (err) {
    console.error('[GET /api/markets/:id/plans]', err);
    return NextResponse.json(
      { error: 'Failed to generate plans', message: 'Plan generation failed' },
      { status: 500 }
    );
  }
}
