import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createDeployment,
  updateDeploymentStatus,
  getDeploymentByMarket,
  getDeployment,
  resetDeployment,
} from '@/lib/db/markets';
import { WalletAddressSchema } from '@/domain/schemas';

const CreateDeploymentSchema = z.object({
  designId:      z.string().min(1),
  walletAddress: WalletAddressSchema,
});

/**
 * POST /api/markets/:id/deploy
 *
 * Creates a new deployment record, or recycles an existing failed/not_started
 * record so the client can retry without accumulating stale rows.
 *
 * Rules:
 *  - 'confirmed'              → 409 Conflict (already deployed, can't re-deploy)
 *  - 'failed' / 'not_started' → reset status to 'not_started', return fresh record
 *  - 'preparing' / 'awaiting_signature' / 'submitted' → 409 (deployment in progress)
 *  - no existing record       → insert new record
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: unknown = await req.json();
    const parsed = CreateDeploymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid deployment parameters', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    // Check for an existing deployment on this market
    const existing = getDeploymentByMarket(id);

    if (existing) {
      if (existing.status === 'confirmed') {
        // Already deployed on-chain — block re-deploy
        return NextResponse.json(
          { error: 'This market has already been deployed on-chain.' },
          { status: 409 }
        );
      }

      if (['preparing', 'awaiting_signature', 'submitted'].includes(existing.status)) {
        // Deployment is actively in progress — block concurrent attempt
        return NextResponse.json(
          { error: 'A deployment is already in progress for this market.' },
          { status: 409 }
        );
      }

      // Status is 'failed' or 'not_started' — this is a retry.
      // Fully reset the existing record (clears signature, addresses, error message)
      // so the client gets a clean slate without creating a new deployment row.
      resetDeployment(existing.id);

      const reset = getDeployment(existing.id);
      return NextResponse.json({ deployment: reset }, { status: 200 });
    }

    // No existing deployment — create a fresh record
    const deployment = createDeployment({
      marketId:      id,
      designId:      parsed.data.designId,
      walletAddress: parsed.data.walletAddress,
    });

    return NextResponse.json({ deployment }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/markets/:id/deploy]', err);
    return NextResponse.json(
      { error: 'Failed to initiate deployment' },
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
    const deployment = getDeploymentByMarket(id);
    return NextResponse.json({ deployment });
  } catch (err) {
    console.error('[GET /api/markets/:id/deploy]', err);
    return NextResponse.json(
      { error: 'Failed to fetch deployment' },
      { status: 500 }
    );
  }
}

const UpdateDeploymentSchema = z.object({
  deploymentId:  z.string(),
  status:        z.enum(['preparing','awaiting_signature','submitted','confirmed','failed']),
  poolAddress:   z.string().optional(),
  configAddress: z.string().optional(),
  signature:     z.string().optional(),
  errorMessage:  z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // consume
    const body: unknown = await req.json();
    const parsed = UpdateDeploymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid update parameters' },
        { status: 400 }
      );
    }

    updateDeploymentStatus(parsed.data.deploymentId, parsed.data.status, {
      poolAddress:          parsed.data.poolAddress,
      configAddress:        parsed.data.configAddress,
      transactionSignature: parsed.data.signature,
      errorMessage:         parsed.data.errorMessage,
    });

    // Return the updated deployment so the client can sync its local state
    const updated = getDeployment(parsed.data.deploymentId);
    return NextResponse.json({ deployment: updated });
  } catch (err) {
    console.error('[PATCH /api/markets/:id/deploy]', err);
    return NextResponse.json(
      { error: 'Failed to update deployment' },
      { status: 500 }
    );
  }
}
