import { NextRequest, NextResponse } from 'next/server';
import { getObservations, saveObservation } from '@/lib/db/markets';
import { z } from 'zod';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const observations = getObservations(id, 500);
    return NextResponse.json({ observations });
  } catch (err) {
    console.error('[GET /api/markets/:id/observations]', err);
    return NextResponse.json({ error: 'Failed to fetch observations' }, { status: 500 });
  }
}

const ObservationSchema = z.object({
  price:               z.number().nonnegative(),
  quoteReserve:        z.number().nonnegative(),
  volume24h:           z.number().nonnegative().default(0),
  traders:             z.number().int().nonnegative().default(0),
  buyVolume:           z.number().nonnegative().default(0),
  sellVolume:          z.number().nonnegative().default(0),
  graduationProgress:  z.number().min(0).max(100).default(0),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body   = await req.json() as unknown;
    const parsed = ObservationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid observation data' }, { status: 400 });
    }
    saveObservation({ ...parsed.data, marketId: id, timestamp: new Date().toISOString() });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/markets/:id/observations]', err);
    return NextResponse.json({ error: 'Failed to save observation' }, { status: 500 });
  }
}
