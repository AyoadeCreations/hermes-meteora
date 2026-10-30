import { dbErrorResponse } from '@/lib/db/diagnose';
import { NextRequest, NextResponse } from 'next/server';
import { getMarket, saveDesignsIfNone, replaceDesigns, getDesigns } from '@/lib/db';
import type { MarketDesign } from '@/domain/types';
import { generateCandidates } from '@/services/simulation/generator';

const BASELINE_NAME = 'Baseline Market';

function splitDesigns(all: MarketDesign[]) {
  return {
    baseline: all.find((d) => d.name === BASELINE_NAME) ?? null,
    designs:  all.filter((d) => d.name !== BASELINE_NAME),
  };
}

/**
 * Generate designs for a market.
 *
 * Idempotent by default: if the market already has designs, return them. That
 * keeps refreshes, double fired effects and concurrent requests from piling up
 * duplicates. Pass ?regenerate=1 to replace them (designs that a deployment
 * uses are kept, since they are what was actually deployed).
 */
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

    const regenerate = new URL(req.url).searchParams.get('regenerate') === '1';

    if (!regenerate) {
      const existing = await getDesigns(id);
      if (existing.length > 0) {
        return NextResponse.json({ ...splitDesigns(existing), violations: [] });
      }
    }

    const result = generateCandidates(market);
    if (result.designs.length === 0) {
      return NextResponse.json(
        {
          error: "We couldn't generate valid market configurations from these parameters.",
          violations: result.violations,
        },
        { status: 422 }
      );
    }

    const generated = [...result.designs, result.baseline];
    if (regenerate) {
      await replaceDesigns(id, generated);
    } else {
      // Loses gracefully if another request saved first: we then return theirs.
      await saveDesignsIfNone(id, generated);
    }

    return NextResponse.json({
      ...splitDesigns(await getDesigns(id)),
      violations: result.violations,
    });
  } catch (err) {
    return dbErrorResponse(err, 'Failed to generate designs', 'POST /api/markets/:id/designs');
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const allDesigns = await getDesigns(id);

    // Separate baseline from candidates
    return NextResponse.json(splitDesigns(allDesigns));
  } catch (err) {
    return dbErrorResponse(err, 'Failed to fetch designs', 'GET /api/markets/:id/designs');
  }
}
