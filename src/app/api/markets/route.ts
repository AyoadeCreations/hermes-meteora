import { dbErrorResponse } from '@/lib/db/diagnose';
import { NextRequest, NextResponse } from 'next/server';
import { CreateMarketBriefSchema } from '@/domain/schemas';
import { createMarket, listMarkets } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const parsed = CreateMarketBriefSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const market = await createMarket(parsed.data);
    return NextResponse.json({ market }, { status: 201 });
  } catch (err) {
    return dbErrorResponse(err, 'Failed to create market', 'POST /api/markets');
  }
}

export async function GET() {
  try {
    const markets = await listMarkets();
    return NextResponse.json({ markets });
  } catch (err) {
    return dbErrorResponse(err, 'Failed to fetch markets', 'GET /api/markets');
  }
}
