/**
 * POST /api/markets/:id/deploy/pool
 *
 * Step 3 of the deploy flow, called AFTER the config transaction is confirmed.
 * Builds the DBC createPool transaction for the confirmed config, generates the
 * new token's base mint keypair, partial-signs with it, and returns the
 * transaction base64-encoded for the creator's wallet to co-sign and submit.
 *
 * Same blockhash rule as /deploy/execute: the client passes a fresh blockhash,
 * the server signs over it, and the client must not change it afterwards.
 *
 * The base mint keypair only needs to sign this one transaction. It is never
 * stored and never returned.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDeployment, getMarket } from '@/lib/db';
import type { SolanaNetwork } from '@/domain/types';

// Solana and the Meteora SDK are imported dynamically (see /deploy/execute).

const PoolSchema = z.object({
  deploymentId:    z.string().min(1),
  walletAddress:   z.string().min(32),
  configAddress:   z.string().min(32),
  network:         z.enum(['devnet', 'mainnet-beta']).default('devnet'),
  clientBlockhash: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: marketId } = await params;
    const parsed = PoolSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid pool parameters', issues: parsed.error.issues }, { status: 400 });
    }
    const { deploymentId, walletAddress, configAddress, network, clientBlockhash } = parsed.data;

    const deployment = await getDeployment(deploymentId);
    if (!deployment) return NextResponse.json({ error: 'Deployment not found' }, { status: 404 });
    if (deployment.marketId !== marketId) {
      return NextResponse.json({ error: 'Deployment does not belong to this market' }, { status: 400 });
    }
    if (deployment.configAddress && deployment.configAddress !== configAddress) {
      return NextResponse.json({ error: 'Config address does not match this deployment' }, { status: 400 });
    }

    const market = await getMarket(marketId);
    if (!market) return NextResponse.json({ error: 'Market not found' }, { status: 404 });

    const { Connection, PublicKey, Keypair } = await import('@solana/web3.js');
    const { DynamicBondingCurveClient, deriveDbcPoolAddress } = await import('@meteora-ag/dynamic-bonding-curve-sdk');

    const rpcUrl =
      (network as SolanaNetwork) === 'mainnet-beta'
        ? (process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET ?? 'https://api.mainnet-beta.solana.com')
        : (process.env.NEXT_PUBLIC_SOLANA_RPC_DEVNET ?? 'https://api.devnet.solana.com');
    const connection = new Connection(rpcUrl, 'confirmed');

    const wallet = new PublicKey(walletAddress);
    const config = new PublicKey(configAddress);
    const quoteMint = new PublicKey(market.quoteMint);

    // The config must exist on-chain before a pool can be created from it.
    const configInfo = await connection.getAccountInfo(config, 'confirmed');
    if (!configInfo) {
      return NextResponse.json(
        { error: 'The config account is not confirmed on-chain yet. Wait a few seconds and retry.' },
        { status: 409 },
      );
    }

    const baseMint = Keypair.generate();
    const client = DynamicBondingCurveClient.create(connection, 'confirmed');

    const tx = await client.creator.createPool({
      name:        market.tokenName,
      symbol:      market.tokenSymbol,
      uri:         '', // no token metadata hosting yet: the token launches without an image
      payer:       wallet,
      poolCreator: wallet,
      config,
      baseMint:    baseMint.publicKey,
    });

    const bh = clientBlockhash
      ? { blockhash: clientBlockhash, lastValidBlockHeight: (await connection.getLatestBlockhash('confirmed')).lastValidBlockHeight }
      : await connection.getLatestBlockhash('confirmed');

    tx.recentBlockhash = bh.blockhash;
    tx.feePayer = wallet;
    tx.partialSign(baseMint);

    const poolAddress = deriveDbcPoolAddress(quoteMint, baseMint.publicKey, config).toString();

    return NextResponse.json({
      createPoolTxBase64: Buffer.from(tx.serialize({ requireAllSignatures: false, verifySignatures: false })).toString('base64'),
      poolAddress,
      baseMint: baseMint.publicKey.toString(),
      blockhash: bh.blockhash,
      lastValidBlockHeight: bh.lastValidBlockHeight,
      network,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[POST /api/markets/:id/deploy/pool]', message);
    return NextResponse.json({ error: `Failed to build pool transaction: ${message}` }, { status: 500 });
  }
}
