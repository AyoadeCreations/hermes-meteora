import { dbErrorResponse } from '@/lib/db/diagnose';
import { NextRequest, NextResponse } from 'next/server';
import { getMarket } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const market = await getMarket(id);
    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }
    return NextResponse.json({ market });
  } catch (err) {
    return dbErrorResponse(err, 'Failed to fetch market', 'GET /api/markets/:id');
  }
}
