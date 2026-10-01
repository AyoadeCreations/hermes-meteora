import { NextRequest, NextResponse } from 'next/server';
import { CreateMarketBriefSchema } from '@/domain/schemas';
import { createMarket, listMarkets } from '@/lib/db/markets';

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

    const market = createMarket(parsed.data);
    return NextResponse.json({ market }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/markets]', err);
    return NextResponse.json(
      { error: 'Failed to create market' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const markets = listMarkets();
    return NextResponse.json({ markets });
  } catch (err) {
    console.error('[GET /api/markets]', err);
    return NextResponse.json(
      { error: 'Failed to fetch markets' },
      { status: 500 }
    );
  }
}
