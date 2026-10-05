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
    console.error('[POST /api/markets]', err);
    return NextResponse.json(
      { error: 'Failed to create market', message: 'Database operation failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const markets = await listMarkets();
    return NextResponse.json({ markets });
  } catch (err) {
    console.error('[GET /api/markets]', err);
    return NextResponse.json(
      { error: 'Failed to fetch markets', message: 'Database operation failed' },
      { status: 500 }
    );
  }
}
