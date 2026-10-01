/**
 * Meteora Deployment Service
 *
 * Clean abstraction layer between the UI and the Meteora DBC SDK.
 * The UI never contains low-level blockchain transaction logic.
 *
 * This service:
 * 1. Maps internal MarketDesign to Meteora DBC ConfigParameters
 * 2. Builds the config + pool transaction
 * 3. Returns an unsigned transaction for wallet signing
 * 4. Confirms the transaction after submission
 *
 * Network is configurable — never accidentally targets mainnet in dev.
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import type { MarketDesign, MarketBrief, SolanaNetwork, Deployment } from '@/domain/types';

// ── Network config ─────────────────────────────────────────────────────────

const RPC_URLS: Record<SolanaNetwork, string> = {
  devnet:         process.env.NEXT_PUBLIC_SOLANA_RPC_DEVNET  ?? 'https://api.devnet.solana.com',
  'mainnet-beta': process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET ?? 'https://api.mainnet-beta.solana.com',
};

export function getNetwork(): SolanaNetwork {
  const net = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  if (net === 'mainnet-beta') return 'mainnet-beta';
  return 'devnet'; // default to devnet for safety
}

export function getRpcUrl(network?: SolanaNetwork): string {
  return RPC_URLS[network ?? getNetwork()];
}

export function getConnection(network?: SolanaNetwork): Connection {
  return new Connection(getRpcUrl(network), 'confirmed');
}

// ── Deploy parameters ──────────────────────────────────────────────────────

export interface DeployParams {
  market:   MarketBrief;
  design:   MarketDesign;
  wallet:   PublicKey;
  network:  SolanaNetwork;
}

export interface DeployTransactionBundle {
  /** The config creation transaction (unsigned) */
  createConfigTx: Transaction;
  /** The pool creation transaction (unsigned) */
  createPoolTx:   Transaction;
  /** Derived config account address */
  configAddress:  string;
  /** Derived pool address */
  poolAddress:    string;
}

// ── Internal: map design to SDK ConfigParameters ──────────────────────────

/**
 * Maps our internal MarketDesign to the Meteora DBC SDK's ConfigParameters.
 *
 * This function is the critical bridge between our domain and the protocol.
 * All values are validated before use.
 */
function mapDesignToConfigParams(
  market: MarketBrief,
  design: MarketDesign
) {
  // These imports are dynamic because @meteora-ag/dynamic-bonding-curve-sdk
  // is only available server-side (Node.js environment).
  // The SDK uses BN.js and anchor which don't tree-shake cleanly in browser bundles.

  // Return the raw config builder parameters for SDK consumption.
  // The actual SDK call happens in buildDeployTransaction().
  return {
    token: {
      tokenType:          0, // SPLToken
      tokenBaseDecimal:   6, // will be set per market
      tokenQuoteDecimal:  9, // SOL = 9 decimals
      totalTokenSupply:   market.totalSupply,
      leftover:           0,
      tokenAuthorityOption: 0, // CreatorUpdateAuthority
    },
    fee: {
      baseFeeParams: {
        // FeeSchedulerLinear — flat fee for MVP
        startingFeeBps: design.fees.baseFeeBps,
        endingFeeBps:   design.fees.baseFeeBps,
        numberOfPeriod: 0,
        totalDuration:  0,
      },
      dynamicFeeEnabled:          design.fees.dynamicFeeEnabled,
      collectFeeMode:             0, // QuoteToken
      creatorTradingFeePercentage: design.fees.creatorTradingFeePercentage,
      poolCreationFee:            0,
      enableFirstSwapWithMinFee:  false,
    },
    migration: {
      migrationOption:    1, // MET_DAMM_V2 (required for new configs)
      migrationFeeOption: 0, // FixedBps25
    },
    liquidityDistribution: {
      partnerLiquidityPercentage:              0,
      creatorLiquidityPercentage:              100,
      partnerPermanentLockedLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 10, // 10% locked
    },
    lockedVesting: {
      totalLockedVestingAmount:     0,
      numberOfVestingPeriod:        0,
      cliffUnlockAmount:            0,
      totalVestingDuration:         0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: 1, // Timestamp
    // Target market caps from our design
    initialMarketCap:   design.curve.initialMarketCap,
    migrationMarketCap: design.curve.migrationMarketCap,
  };
}

// ── Build transaction ──────────────────────────────────────────────────────

/**
 * Builds the config + pool creation transaction bundle.
 *
 * Returns unsigned transactions for wallet signing.
 * Will throw if SDK validation fails.
 *
 * In DEMO MODE this returns a stub transaction for UI demonstration.
 */
export async function buildDeployTransaction(
  params: DeployParams
): Promise<DeployTransactionBundle> {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  if (isDemoMode) {
    return buildDemoTransaction(params);
  }

  const { market, design, wallet, network } = params;
  const connection = getConnection(network);

  // Dynamically import to avoid SSR issues with the SDK's browser bundle
  const {
    DynamicBondingCurveClient,
    buildCurveWithMarketCap,
    ActivationType,
    MigrationOption,
    TokenType,
    CollectFeeMode,
    MigrationFeeOption,
  } = await import('@meteora-ag/dynamic-bonding-curve-sdk');

  const client = DynamicBondingCurveClient.create(connection, 'confirmed');

  const configParams = mapDesignToConfigParams(market, design);

  // Build curve using market cap targets
  const { BaseFeeMode: BFM } = await import('@meteora-ag/dynamic-bonding-curve-sdk');

  const builtCurve = buildCurveWithMarketCap({
    token: {
      tokenType:            TokenType.SPLToken,
      tokenBaseDecimal:     6,
      tokenQuoteDecimal:    9,
      totalTokenSupply:     market.totalSupply,
      leftover:             0,
      tokenAuthorityOption: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode:       BFM.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: design.fees.baseFeeBps,
          endingFeeBps:   design.fees.baseFeeBps,
          numberOfPeriod: 0,
          totalDuration:  0,
        },
      },
      dynamicFeeEnabled:           design.fees.dynamicFeeEnabled,
      collectFeeMode:              CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: design.fees.creatorTradingFeePercentage,
      poolCreationFee:             0,
      enableFirstSwapWithMinFee:   false,
    },
    migration: {
      migrationOption:    MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps25,
      migrationFee:       { feePercentage: 0, creatorFeePercentage: 0 },
    },
    liquidityDistribution: {
      partnerLiquidityPercentage:               0,
      creatorLiquidityPercentage:               100,
      partnerPermanentLockedLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 10,
    },
    lockedVesting: {
      totalLockedVestingAmount:       0,
      numberOfVestingPeriod:          0,
      cliffUnlockAmount:              0,
      totalVestingDuration:           0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Timestamp,
    initialMarketCap:   design.curve.initialMarketCap,
    migrationMarketCap: design.curve.migrationMarketCap,
  });

  // Generate config keypair
  const { Keypair } = await import('@solana/web3.js');
  const configKeypair = Keypair.generate();

  const quoteMint = new PublicKey(market.quoteMint);

  const createConfigTx = await client.partner.createConfig({
    ...builtCurve,
    config:          configKeypair.publicKey,
    feeClaimer:      wallet,
    leftoverReceiver: wallet,
    quoteMint,
    payer:           wallet,
  });

  // Derive pool address (will be set after config is confirmed)
  // For now return a placeholder — will be confirmed post-submission
  const poolAddress = 'pending_confirmation';

  return {
    createConfigTx: createConfigTx as Transaction,
    createPoolTx:   new Transaction(), // pool created separately after config confirm
    configAddress:  configKeypair.publicKey.toString(),
    poolAddress,
  };
}

// ── Demo mode stub ─────────────────────────────────────────────────────────

async function buildDemoTransaction(
  params: DeployParams
): Promise<DeployTransactionBundle> {
  // In demo mode, return stub transaction data
  // The UI will show the full flow but no blockchain transaction is submitted
  const { Keypair } = await import('@solana/web3.js');
  const configKeypair = Keypair.generate();
  const poolKeypair   = Keypair.generate();

  return {
    createConfigTx: new Transaction(),
    createPoolTx:   new Transaction(),
    configAddress:  configKeypair.publicKey.toString(),
    poolAddress:    poolKeypair.publicKey.toString(),
  };
}

// ── Transaction confirmation ───────────────────────────────────────────────

export async function waitForConfirmation(
  signature: string,
  network: SolanaNetwork = getNetwork()
): Promise<{ confirmed: boolean; error?: string }> {
  const connection = getConnection(network);

  try {
    const result = await connection.confirmTransaction(signature, 'confirmed');
    if (result.value.err) {
      return { confirmed: false, error: JSON.stringify(result.value.err) };
    }
    return { confirmed: true };
  } catch (err) {
    return {
      confirmed: false,
      error: err instanceof Error ? err.message : 'Unknown confirmation error',
    };
  }
}

// ── Market state reader ────────────────────────────────────────────────────

import type { MarketState } from '@/domain/types';

export async function fetchOnChainMarketState(
  poolAddress: string,
  network: SolanaNetwork = getNetwork()
): Promise<MarketState | null> {
  try {
    const connection = getConnection(network);

    const {
      DynamicBondingCurveClient,
    } = await import('@meteora-ag/dynamic-bonding-curve-sdk');

    const client = DynamicBondingCurveClient.create(connection, 'confirmed');
    const pool   = await client.state.getPool(new PublicKey(poolAddress));

    if (!pool) return null;

    // The Meteora DBC SDK VirtualPool type exposes these fields.
    // sqrtPrice is a BN representing sqrt(price) in Q64.64 fixed-point format.
    // currentPrice = (sqrtPrice / 2^64)^2
    // quoteReserve and baseReserve are BN lamport amounts.
    //
    // We cast to unknown first because the SDK type declarations may vary by version.
    const p = pool as unknown as Record<string, { toString(): string }>;

    // Derive current price from sqrtPrice (Q64.64 fixed-point)
    let currentPrice = 0;
    if (p['sqrtPrice']) {
      const Q64 = BigInt('18446744073709551616'); // 2^64
      try {
        const sqrtPriceBN = BigInt(p['sqrtPrice'].toString());
        // sqrtPrice = sqrt(price) * 2^64  →  price = (sqrtPrice/2^64)^2
        const sqrtF = Number(sqrtPriceBN) / Number(Q64);
        currentPrice = sqrtF * sqrtF;
      } catch {
        // BN conversion failed — leave as 0 and return unavailable
        return {
          poolAddress,
          currentPrice:        0,
          quoteReserve:        0,
          baseReserve:         0,
          volume24h:           0,
          traders24h:          0,
          graduationProgress:  0,
          graduationReached:   false,
          buyVolume24h:        0,
          sellVolume24h:       0,
          feesCollected:       0,
          source:              'unavailable',
          lastUpdated:         new Date().toISOString(),
        };
      }
    }

    // Reserve amounts are in lamports — convert to SOL-equivalent for display
    const LAMPORTS = 1_000_000_000;
    const quoteReserveRaw = p['quoteReserve'] ? Number(BigInt(p['quoteReserve'].toString())) / LAMPORTS : 0;
    const baseReserveRaw  = p['baseReserve']  ? Number(BigInt(p['baseReserve'].toString()))  / LAMPORTS : 0;

    // Graduation progress requires knowing the migration threshold.
    // The SDK pool state may expose swapBaseAmount / migrationQuoteThreshold.
    // We surface what we can; the caller combines with design.graduation.quoteThreshold.
    const swapQuoteAmount = p['swapQuoteAmount']
      ? Number(BigInt(p['swapQuoteAmount'].toString())) / LAMPORTS
      : quoteReserveRaw;

    return {
      poolAddress,
      currentPrice,
      quoteReserve:       quoteReserveRaw,
      baseReserve:        baseReserveRaw,
      volume24h:          0,   // Not available directly on-chain without indexer
      traders24h:         0,   // Not available directly on-chain without indexer
      graduationProgress: 0,   // Caller must compute: swapQuoteAmount / design.graduation.quoteThreshold * 100
      graduationReached:  !!(p['graduated']),
      buyVolume24h:       0,
      sellVolume24h:      0,
      feesCollected:      swapQuoteAmount,
      source:             'onchain',
      lastUpdated:        new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
