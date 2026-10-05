/**
 * POST /api/markets/:id/deploy/execute
 *
 * Step 2 of the deploy flow.
 * Loads market + design from DB, builds a Meteora DBC transaction,
 * partial-signs it with the config keypair, and returns it base64-encoded
 * for the client wallet to co-sign and submit.
 *
 * Blockhash protocol:
 * The client fetches a fresh blockhash BEFORE calling this route and
 * passes it as `clientBlockhash`. The server uses that exact value for
 * `recentBlockhash` and signs over it. The client must NOT overwrite
 * `recentBlockhash` after deserialization — doing so would invalidate
 * the config keypair's partial signature (recentBlockhash is part of the
 * signed message bytes in legacy Solana transactions).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDeployment, getDesign, getMarket } from '@/lib/db';
import type { MarketBrief, MarketDesign, SolanaNetwork } from '@/domain/types';

// NOTE: No static imports from @solana/web3.js or @meteora-ag/dynamic-bonding-curve-sdk.
// All usage is via dynamic import() inside buildWithSdk to prevent webpack from
// bundling these packages statically (which crashes Vercel serverless functions).

const ExecuteSchema = z.object({
  deploymentId: z.string().min(1),
  walletAddress: z.string().min(32),
  network: z.enum(['devnet', 'mainnet-beta']).default('devnet'),
  clientBlockhash: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: marketId } = await params;
    const body: unknown = await req.json();
    const parsed = ExecuteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid execute parameters', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { deploymentId, walletAddress, network, clientBlockhash } = parsed.data;

    // ── Load records ────────────────────────────────────────────────────
    const deployment = await getDeployment(deploymentId);
    if (!deployment) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    const market = await getMarket(marketId);
    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    const design = await getDesign(deployment.designId);
    if (!design) {
      return NextResponse.json({ error: 'Design not found' }, { status: 404 });
    }

    // ── Build transaction ────────────────────────────────────────────────
    // walletAddress validation + all Solana work is inside buildWithSdk
    // so that @solana/web3.js is only loaded via dynamic import at runtime.
    try {
      const result = await buildWithSdk({
        market,
        design,
        walletAddress,
        network: network as SolanaNetwork,
        clientBlockhash,
      });

      return NextResponse.json({
        createConfigTxBase64: result.createConfigTxBase64,
        configAddress: result.configAddress,
        poolAddress: 'pending_confirmation',
        network,
        blockhash: result.blockhash,
        lastValidBlockHeight: result.lastValidBlockHeight,
      });
    } catch (sdkErr) {
      const msg = sdkErr instanceof Error ? sdkErr.message : String(sdkErr);
      console.error('[deploy/execute] build failed:', msg);
      return NextResponse.json(
        { error: `Failed to build transaction: ${msg}`, message: 'Transaction build failed' },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('[POST /api/markets/:id/deploy/execute]', err);
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json(
      { error: message, message: 'Transaction build failed' },
      { status: 500 }
    );
  }
}

// ── SDK build path ─────────────────────────────────────────────────────────
async function buildWithSdk(params: {
  market: MarketBrief;
  design: MarketDesign;
  walletAddress: string;
  network: SolanaNetwork;
  clientBlockhash: string | undefined;
}): Promise<{
  createConfigTxBase64: string;
  configAddress: string;
  blockhash: string;
  lastValidBlockHeight: number;
}> {
  const { market, design, walletAddress, network, clientBlockhash } = params;

  // All @solana/web3.js usage is via dynamic import — no static bundle.
  const {
    Connection,
    PublicKey,
    Transaction,
    SystemProgram,
    Keypair,
  } = await import('@solana/web3.js');

  // Validate wallet address (throws if invalid → caught by caller)
  const wallet = new PublicKey(walletAddress);

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const rpcUrl =
    network === 'mainnet-beta'
      ? (process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET ?? 'https://api.mainnet-beta.solana.com')
      : (process.env.NEXT_PUBLIC_SOLANA_RPC_DEVNET ?? 'https://api.devnet.solana.com');

  const connection = new Connection(rpcUrl, 'confirmed');

  // ── Demo mode: minimal stub transaction ────────────────────────────────
  if (isDemoMode) {
    const configKeypair = Keypair.generate();

    let bh: { blockhash: string; lastValidBlockHeight: number };
    if (clientBlockhash) {
      const latest = await connection.getLatestBlockhash('confirmed');
      bh = { blockhash: clientBlockhash, lastValidBlockHeight: latest.lastValidBlockHeight };
    } else {
      bh = await connection.getLatestBlockhash('confirmed');
    }

    const tx = new Transaction();
    tx.add(SystemProgram.transfer({ fromPubkey: wallet, toPubkey: wallet, lamports: 0 }));
    tx.recentBlockhash = bh.blockhash;
    tx.feePayer = wallet;

    const buf = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    return {
      createConfigTxBase64: Buffer.from(buf).toString('base64'),
      configAddress: configKeypair.publicKey.toString(),
      blockhash: bh.blockhash,
      lastValidBlockHeight: bh.lastValidBlockHeight,
    };
  }

  // ── Real path: Meteora DBC SDK ─────────────────────────────────────────
  const {
    DynamicBondingCurveClient,
    buildCurveWithMarketCap,
    ActivationType,
    MigrationOption,
    TokenType,
    CollectFeeMode,
    MigrationFeeOption,
    BaseFeeMode,
  } = await import('@meteora-ag/dynamic-bonding-curve-sdk');

  const client = DynamicBondingCurveClient.create(connection, 'confirmed');

  // ── LP allocation (must sum to 100) ──────────────────────────────────────
  const lpAlloc = {
    partnerLiquidityPercentage: 0,
    partnerPermanentLockedLiquidityPercentage: 0,
    creatorLiquidityPercentage: 90,
    creatorPermanentLockedLiquidityPercentage: 10,
  };

  const builtCurve = buildCurveWithMarketCap({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: 6,
      tokenQuoteDecimal: 9,
      totalTokenSupply: market.totalSupply,
      leftover: 0,
      tokenAuthorityOption: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: design.fees.baseFeeBps,
          endingFeeBps: design.fees.baseFeeBps,
          numberOfPeriod: 0,
          totalDuration: 0,
        },
      },
      dynamicFeeEnabled: design.fees.dynamicFeeEnabled,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: design.fees.creatorTradingFeePercentage,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps25,
      migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
    },
    liquidityDistribution: lpAlloc,
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Timestamp,
    initialMarketCap: design.curve.initialMarketCap,
    migrationMarketCap: design.curve.migrationMarketCap,
  });

  const configKeypair = Keypair.generate();
  const quoteMint = new PublicKey(market.quoteMint);

  const createConfigTx = await client.partner.createConfig({
    ...builtCurve,
    config: configKeypair.publicKey,
    feeClaimer: wallet,
    leftoverReceiver: wallet,
    quoteMint,
    payer: wallet,
  });

  // ── Determine blockhash and sign ───────────────────────────────────────────
  const txAny = createConfigTx as unknown;
  const isVersioned =
    txAny !== null &&
    typeof txAny === 'object' &&
    'message' in (txAny as object) &&
    typeof (txAny as { message: unknown }).message === 'object' &&
    (txAny as { message: { version?: unknown } }).message.version !== undefined;

  let txBuffer: Buffer;
  let txBlockhash: string;
  let txLastValidBlockHeight: number;

  if (isVersioned) {
    const bh = await connection.getLatestBlockhash('confirmed');
    txBlockhash = bh.blockhash;
    txLastValidBlockHeight = bh.lastValidBlockHeight;
    const vt = txAny as { serialize: () => Uint8Array };
    txBuffer = Buffer.from(vt.serialize());
  } else {
    const lt = txAny as InstanceType<typeof Transaction>;

    let bh: { blockhash: string; lastValidBlockHeight: number };
    if (clientBlockhash) {
      const latest = await connection.getLatestBlockhash('confirmed');
      bh = { blockhash: clientBlockhash, lastValidBlockHeight: latest.lastValidBlockHeight };
      console.log('[deploy/execute] using client blockhash:', clientBlockhash.slice(0, 8) + '…');
    } else {
      bh = await connection.getLatestBlockhash('confirmed');
      console.log('[deploy/execute] fetched own blockhash:', bh.blockhash.slice(0, 8) + '…');
    }

    txBlockhash = bh.blockhash;
    txLastValidBlockHeight = bh.lastValidBlockHeight;
    lt.recentBlockhash = txBlockhash;
    lt.feePayer = wallet;
    lt.partialSign(configKeypair);

    console.log('[deploy/execute] config:', configKeypair.publicKey.toString().slice(0, 8) + '…');

    txBuffer = Buffer.from(
      lt.serialize({ requireAllSignatures: false, verifySignatures: false })
    );
    const signed = lt.signatures.filter((s) => s.signature !== null).length;
    console.log(`[deploy/execute] tx ${txBuffer.length}b | ${signed}/${lt.signatures.length} sigs`);
  }

  return {
    createConfigTxBase64: txBuffer.toString('base64'),
    configAddress: configKeypair.publicKey.toString(),
    blockhash: txBlockhash,
    lastValidBlockHeight: txLastValidBlockHeight,
  };
}
