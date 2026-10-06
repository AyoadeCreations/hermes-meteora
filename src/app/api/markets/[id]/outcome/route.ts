import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { saveLaunchOutcome, getLaunchOutcome, getMarket } from '@/lib/db';

const OutcomeSchema = z.object({
  selectedPlanId: z.string().nullable(),
  selectedPlanName: z.string().nullable(),
  selectedDesignId: z.string().min(1),
  transactionSignature: z.string().nullable(),
  poolAddress: z.string().nullable(),
  configAddress: z.string().nullable(),
  launchTimestamp: z.string(),
  configurationSnapshot: z.string(), // JSON string of MarketDesign
  objectiveSnapshot: z.string().nullable(), // JSON string of MarketObjectiveInput
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const market = await getMarket(id);
    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    const body: unknown = await req.json();
    const parsed = OutcomeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid outcome data', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    await saveLaunchOutcome({ marketId: id, ...parsed.data });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/markets/:id/outcome]', err);
    return NextResponse.json(
      { error: 'Failed to record outcome', message: 'Database operation failed' },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const outcome = await getLaunchOutcome(id);
    return NextResponse.json({ outcome });
  } catch (err) {
    console.error('[GET /api/markets/:id/outcome]', err);
    return NextResponse.json(
      { error: 'Failed to fetch outcome', message: 'Database operation failed' },
      { status: 500 }
    );
  }
}
