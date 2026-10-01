/**
 * POST /api/markets/:id/deploy/execute
 *
 * Step 2 of the deploy flow.
 * Loads market + design from DB, builds a Meteora DBC transaction,
 * partial-signs it with the config keypair, and returns it base64-encoded
 * for the client wallet to co-sign and submit.
 *
 * Blockhash protocol:
 *   The client fetches a fresh blockhash BEFORE calling this route and
 *   passes it as `clientBlockhash`. The server uses that exact value for
 *   `recentBlockhash` and signs over it. The client must NOT overwrite
 *   `recentBlockhash` after deserialization — doing so would invalidate
 *   the config keypair's partial signature (recentBlockhash is part of the
 *   signed message bytes in legacy Solana transactions).
 *
 *   This arrangement keeps the blockhash fresh (the client fetches it
 *   immediately before the request) while ensuring the server signs the
 *   same bytes the wallet will later submit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';
import { getDeployment, getDesign, getMarket } from '@/lib/db/markets';
import type { SolanaNetwork } from '@/domain/types';

const ExecuteSchema = z.object({
  deploymentId:    z.string().min(1),
  walletAddress:   z.string().min(32),
  network:         z.enum(['devnet', 'mainnet-beta']).default('devnet'),
  // Client supplies a fresh blockhash fetched immediately before this request.
  // If omitted the server fetches its own (legacy fallback — less ideal).
  clientBlockhash: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: marketId } = await params;
    const body: unknown    = await req.json();
    const parsed           = ExecuteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid execute parameters', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { deploymentId, walletAddress, network, clientBlockhash } = parsed.data;

    // ── Load records ────────────────────────────────────────────────────
    const deployment = getDeployment(deploymentId);
    if (!deployment) {
      return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    }

    const market = getMarket(marketId);
    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    const design = getDesign(deployment.designId);
    if (!design) {
      return NextResponse.json({ error: 'Design not found' }, { status: 404 });
    }

    // ── Validate wallet ─────────────────────────────────────────────────
    let walletPubkey: PublicKey;
    try {
      walletPubkey = new PublicKey(walletAddress);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    // ── Build transaction ───────────────────────────────────────────────
    let createConfigTxBase64: string;
    let configAddress: string;
    let txBlockhash: string;
    let txLastValidBlockHeight: number;
    const poolAddress = 'pending_confirmation';

    try {
      const result = await buildWithSdk({
        market,
        design,
        wallet:          walletPubkey,
        network:         network as SolanaNetwork,
        clientBlockhash: clientBlockhash,
      });
      createConfigTxBase64   = result.createConfigTxBase64;
      configAddress          = result.configAddress;
      txBlockhash            = result.blockhash;
      txLastValidBlockHeight = result.lastValidBlockHeight;
    } catch (sdkErr) {
      const msg = sdkErr instanceof Error ? sdkErr.message : String(sdkErr);
      console.error('[deploy/execute] SDK build failed:', msg);
      return NextResponse.json(
        { error: `Failed to build transaction: ${msg}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      createConfigTxBase64,
      configAddress,
      poolAddress,
      network,
      blockhash:            txBlockhash,
      lastValidBlockHeight: txLastValidBlockHeight,
    });

  } catch (err) {
    console.error('[POST /api/markets/:id/deploy/execute]', err);
    const message = err instanceof Error ? err.message : 'Failed to build transaction';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── SDK build path ──────────────────────────────────────────────────────────

async function buildWithSdk(params: {
  market:          ReturnType<typeof getMarket> & object;
  design:          ReturnType<typeof getDesign> & object;
  wallet:          PublicKey;
  network:         SolanaNetwork;
  clientBlockhash: string | undefined;
}): Promise<{
  createConfigTxBase64: string;
  configAddress:        string;
  blockhash:            string;
  lastValidBlockHeight: number;
}> {
  const { market, design, wallet, network, clientBlockhash } = params;

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  const rpcUrl = network === 'mainnet-beta'
    ? (process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET ?? 'https://api.mainnet-beta.solana.com')
    : (process.env.NEXT_PUBLIC_SOLANA_RPC_DEVNET  ?? 'https://api.devnet.solana.com');

  const { Connection } = await import('@solana/web3.js');
  const connection = new Connection(rpcUrl, 'confirmed');

  // ── Demo mode: minimal stub transaction ──────────────────────────────
  if (isDemoMode) {
    const { Keypair } = await import('@solana/web3.js');
    const configKeypair = Keypair.generate();

    // Use the client's blockhash if provided; otherwise fetch one
    let bh: { blockhash: string; lastValidBlockHeight: number };
    if (clientBlockhash) {
      // For demo mode we only need a valid blockhash for the stub tx —
      // fetch lastValidBlockHeight to go with the client-supplied blockhash
      const latest = await connection.getLatestBlockhash('confirmed');
      bh = { blockhash: clientBlockhash, lastValidBlockHeight: latest.lastValidBlockHeight };
    } else {
      bh = await connection.getLatestBlockhash('confirmed');
    }

    const tx = new Transaction();
    tx.add(
      SystemProgram.transfer({
        fromPubkey: wallet,
        toPubkey:   wallet,
        lamports:   0,
      })
    );
    tx.recentBlockhash = bh.blockhash;
    tx.feePayer        = wallet;

    const buf = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    return {
      createConfigTxBase64: Buffer.from(buf).toString('base64'),
      configAddress:        configKeypair.publicKey.toString(),
      blockhash:            bh.blockhash,
      lastValidBlockHeight: bh.lastValidBlockHeight,
    };
  }

  // ── Real path: Meteora DBC SDK ────────────────────────────────────────

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

  // ── LP allocation ─────────────────────────────────────────────────────
  // Six independent buckets that must sum to exactly 100.
  const LP_CREATOR_PERMANENT_LOCK = 10;
  const LP_CREATOR_UNLOCKED       = 100 - LP_CREATOR_PERMANENT_LOCK; // 90

  const lpAlloc = {
    partnerLiquidityPercentage:               0,
    partnerPermanentLockedLiquidityPercentage: 0,
    creatorLiquidityPercentage:               LP_CREATOR_UNLOCKED,       // 90
    creatorPermanentLockedLiquidityPercentage: LP_CREATOR_PERMANENT_LOCK, // 10
  };

  console.log('[deploy/execute] LP allocation:', lpAlloc,
    'total:', Object.values(lpAlloc).reduce((a, b) => a + b, 0));

  const lpTotal = Object.values(lpAlloc).reduce((a, b) => a + b, 0);
  if (lpTotal !== 100) {
    throw new Error(`LP allocation bug: total is ${lpTotal}, expected 100`);
  }

  const builtCurve = buildCurveWithMarketCap({
    token: {
      tokenType:            TokenType.SPLToken,
      tokenBaseDecimal:     6,
      tokenQuoteDecimal:    9,
      totalTokenSupply:     market!.totalSupply,
      leftover:             0,
      tokenAuthorityOption: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode:       BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: design!.fees.baseFeeBps,
          endingFeeBps:   design!.fees.baseFeeBps,
          numberOfPeriod: 0,
          totalDuration:  0,
        },
      },
      dynamicFeeEnabled:           design!.fees.dynamicFeeEnabled,
      collectFeeMode:              CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: design!.fees.creatorTradingFeePercentage,
      poolCreationFee:             0,
      enableFirstSwapWithMinFee:   false,
    },
    migration: {
      migrationOption:    MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps25,
      migrationFee:       { feePercentage: 0, creatorFeePercentage: 0 },
    },
    liquidityDistribution: lpAlloc,
    lockedVesting: {
      totalLockedVestingAmount:       0,
      numberOfVestingPeriod:          0,
      cliffUnlockAmount:              0,
      totalVestingDuration:           0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType:     ActivationType.Timestamp,
    initialMarketCap:   design!.curve.initialMarketCap,
    migrationMarketCap: design!.curve.migrationMarketCap,
  });

  const { Keypair } = await import('@solana/web3.js');
  const configKeypair = Keypair.generate();
  const quoteMint     = new PublicKey(market!.quoteMint);

  const createConfigTx = await client.partner.createConfig({
    ...builtCurve,
    config:           configKeypair.publicKey,
    feeClaimer:       wallet,
    leftoverReceiver: wallet,
    quoteMint,
    payer:            wallet,
  });

  // ── Determine blockhash to sign over ─────────────────────────────────
  //
  // CRITICAL: recentBlockhash is encoded into the signed message bytes.
  // Once we call lt.partialSign(configKeypair), the blockhash is committed.
  // The client MUST NOT overwrite tx.recentBlockhash after deserialization.
  //
  // Strategy: use the client-supplied blockhash when provided.
  // The client fetches this immediately before POSTing here, so it is
  // fresh. We return it back so the client can use it for confirmTransaction.
  // If no client blockhash was provided, we fetch our own.
  //
  const txAny = createConfigTx as unknown;
  const isVersioned = (
    txAny !== null &&
    typeof txAny === 'object' &&
    'message' in (txAny as object) &&
    typeof (txAny as { message: unknown }).message === 'object' &&
    (txAny as { message: { version?: unknown } }).message.version !== undefined
  );

  let txBuffer: Buffer;
  let txBlockhash: string;
  let txLastValidBlockHeight: number;

  if (isVersioned) {
    // VersionedTransaction — SDK currently returns legacy, but kept for future-proofing
    const bh = await connection.getLatestBlockhash('confirmed');
    txBlockhash            = bh.blockhash;
    txLastValidBlockHeight = bh.lastValidBlockHeight;
    const vt = txAny as { serialize: () => Uint8Array };
    txBuffer = Buffer.from(vt.serialize());
  } else {
    // Legacy Transaction
    const lt = txAny as Transaction;

    // Decide which blockhash to sign over:
    //   - clientBlockhash (preferred): client fetched this just before the request
    //   - own fetch (fallback): only used if client didn't provide one
    let bh: { blockhash: string; lastValidBlockHeight: number };
    if (clientBlockhash) {
      // Need lastValidBlockHeight to pair with client's blockhash.
      // We fetch a fresh one; the height returned here is for a current slot,
      // so it slightly underestimates validity window — that's fine and safe.
      const latest = await connection.getLatestBlockhash('confirmed');
      bh = { blockhash: clientBlockhash, lastValidBlockHeight: latest.lastValidBlockHeight };
      console.log('[deploy/execute] using client-provided blockhash:', clientBlockhash.slice(0, 8) + '…');
    } else {
      bh = await connection.getLatestBlockhash('confirmed');
      console.log('[deploy/execute] fetched own blockhash:', bh.blockhash.slice(0, 8) + '…');
    }

    txBlockhash            = bh.blockhash;
    txLastValidBlockHeight = bh.lastValidBlockHeight;

    lt.recentBlockhash = txBlockhash;
    lt.feePayer        = wallet;

    // Partial-sign with config keypair.
    // This commits the signature over: feePayer + instructions + accounts + recentBlockhash.
    // The client adds only the payer (wallet) signature client-side via sendTransaction.
    lt.partialSign(configKeypair);

    console.log('[deploy/execute] config pubkey:', configKeypair.publicKey.toString().slice(0, 8) + '…');

    // requireAllSignatures:false — wallet sig is added by the client
    txBuffer = Buffer.from(
      lt.serialize({ requireAllSignatures: false, verifySignatures: false })
    );

    const signedCount = lt.signatures.filter(s => s.signature !== null).length;
    console.log('[deploy/execute] tx size:', txBuffer.length, 'bytes | partial signatures:', signedCount, '/ total signers:', lt.signatures.length);
  }

  return {
    createConfigTxBase64:  txBuffer.toString('base64'),
    configAddress:         configKeypair.publicKey.toString(),
    blockhash:             txBlockhash,
    lastValidBlockHeight:  txLastValidBlockHeight,
  };
}
