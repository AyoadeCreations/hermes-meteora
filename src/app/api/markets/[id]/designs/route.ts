import { NextRequest, NextResponse } from 'next/server';
import { getMarket, saveDesigns, getDesigns } from '@/lib/db/markets';
import { generateCandidates } from '@/services/simulation/generator';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const market = getMarket(id);
    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
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

    // Save all designs including baseline
    const allDesigns = [...result.designs, result.baseline];
    saveDesigns(allDesigns);

    return NextResponse.json({
      designs:    result.designs,
      baseline:   result.baseline,
      violations: result.violations,
    });
  } catch (err) {
    console.error('[POST /api/markets/:id/designs]', err);
    return NextResponse.json(
      { error: 'Failed to generate designs' },
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
    const allDesigns = getDesigns(id);
    // Separate baseline from candidates
    const baseline = allDesigns.find((d) => d.name === 'Baseline Market') ?? null;
    const designs  = allDesigns.filter((d) => d.name !== 'Baseline Market');
    return NextResponse.json({ designs, baseline });
  } catch (err) {
    console.error('[GET /api/markets/:id/designs]', err);
    return NextResponse.json(
      { error: 'Failed to fetch designs' },
      { status: 500 }
    );
  }
}
