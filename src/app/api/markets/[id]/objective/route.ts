import { NextRequest, NextResponse } from 'next/server';
import { getObjective, saveObjective, getMarket } from '@/lib/db';
import { MarketObjectiveInputSchema } from '@/domain/market-objective';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const objective = await getObjective(id);
    return NextResponse.json({ objective });
  } catch (err) {
    console.error('[GET /api/markets/:id/objective]', err);
    return NextResponse.json(
      { error: 'Failed to fetch objective', message: 'Database operation failed' },
      { status: 500 }
    );
  }
}

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
    const parsed = MarketObjectiveInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid objective', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    await saveObjective(id, parsed.data as Record<string, unknown>);
    const saved = await getObjective(id);
    return NextResponse.json({ objective: saved }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/markets/:id/objective]', err);
    return NextResponse.json(
      { error: 'Failed to save objective', message: 'Database operation failed' },
      { status: 500 }
    );
  }
}
