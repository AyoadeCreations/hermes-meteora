import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createDeployment,
  updateDeploymentStatus,
  getDeploymentByMarket,
  getDeployment,
  resetDeployment,
} from '@/lib/db';
import { WalletAddressSchema } from '@/domain/schemas';

const CreateDeploymentSchema = z.object({
  designId: z.string().min(1),
  walletAddress: WalletAddressSchema,
});

/**
 * POST /api/markets/:id/deploy
 *
 * Creates a new deployment record, or recycles an existing failed/not_started
 * record so the client can retry without accumulating stale rows.
 *
 * Rules:
 * - 'confirmed'                                  → 409 (already deployed)
 * - 'preparing' / 'awaiting_signature' / 'submitted' → 409 (in progress)
 * - 'failed' / 'not_started'                     → reset and return fresh record
 * - no existing record                           → insert new record
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

    const existing = await getDeploymentByMarket(id);
    if (existing) {
      if (existing.status === 'confirmed') {
        return NextResponse.json(
          { error: 'This market has already been deployed on-chain.' },
          { status: 409 }
        );
      }
      if (['preparing', 'awaiting_signature', 'submitted'].includes(existing.status)) {
        return NextResponse.json(
          { error: 'A deployment is already in progress for this market.' },
          { status: 409 }
        );
      }
      // 'failed' or 'not_started' — retry path
      await resetDeployment(existing.id);
      const reset = await getDeployment(existing.id);
      return NextResponse.json({ deployment: reset }, { status: 200 });
    }

    const deployment = await createDeployment({
      marketId: id,
      designId: parsed.data.designId,
      walletAddress: parsed.data.walletAddress,
    });
    return NextResponse.json({ deployment }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/markets/:id/deploy]', err);
    return NextResponse.json(
      { error: 'Failed to initiate deployment', message: 'Database operation failed' },
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
    const deployment = await getDeploymentByMarket(id);
    return NextResponse.json({ deployment });
  } catch (err) {
    console.error('[GET /api/markets/:id/deploy]', err);
    return NextResponse.json(
      { error: 'Failed to fetch deployment', message: 'Database operation failed' },
      { status: 500 }
    );
  }
}

const UpdateDeploymentSchema = z.object({
  deploymentId: z.string(),
  status: z.enum(['preparing', 'awaiting_signature', 'submitted', 'confirmed', 'failed']),
  poolAddress: z.string().optional(),
  configAddress: z.string().optional(),
  signature: z.string().optional(),
  errorMessage: z.string().optional(),
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

    await updateDeploymentStatus(parsed.data.deploymentId, parsed.data.status, {
      poolAddress: parsed.data.poolAddress,
      configAddress: parsed.data.configAddress,
      transactionSignature: parsed.data.signature,
      errorMessage: parsed.data.errorMessage,
    });

    const updated = await getDeployment(parsed.data.deploymentId);
    return NextResponse.json({ deployment: updated });
  } catch (err) {
    console.error('[PATCH /api/markets/:id/deploy]', err);
    return NextResponse.json(
      { error: 'Failed to update deployment', message: 'Database operation failed' },
      { status: 500 }
    );
  }
}
