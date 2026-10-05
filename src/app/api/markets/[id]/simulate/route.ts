import { NextRequest, NextResponse } from 'next/server';
import { getDesign, getMarket } from '@/lib/db';
import { runSimulation } from '@/services/simulation/engine';
import { SimulationParamsSchema } from '@/domain/schemas';
import { z } from 'zod';

const SimulateRequestSchema = z.object({
  designId: z.string(),
  params: SimulationParamsSchema,
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: unknown = await req.json();
    const parsed = SimulateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid simulation parameters', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { designId, params: simParams } = parsed.data;

    const market = await getMarket(id);
    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    const design = await getDesign(designId);
    if (!design) {
      return NextResponse.json({ error: 'Design not found' }, { status: 404 });
    }

    const result = runSimulation({
      segments: design.curve.segments,
      startingPrice: market.startingPrice,
      graduationThreshold: design.graduation.quoteThreshold,
      fees: design.fees,
      params: simParams,
    });

    return NextResponse.json({ result });
  } catch (err) {
    console.error('[POST /api/markets/:id/simulate]', err);
    return NextResponse.json(
      { error: 'Simulation failed', message: 'Database operation failed' },
      { status: 500 }
    );
  }
}
