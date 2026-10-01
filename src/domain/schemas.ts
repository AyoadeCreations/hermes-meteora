/**
 * Zod validation schemas.
 * Used on both client and server to validate all inputs.
 * Never trust values from the frontend without validating here first.
 */

import { z } from 'zod';

// ── Constants mirrored from Meteora DBC SDK ─────────────────────────────

const MIN_FEE_BPS = 25;
const MAX_FEE_BPS = 9900;
const MAX_CURVE_POINTS = 16;

// ── Solana address validator ───────────────────────────────────────────────

const solanaAddress = z
  .string()
  .min(32)
  .max(44)
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, 'Invalid Solana base58 address');

// ── Market Brief schema ────────────────────────────────────────────────────

export const MarketObjectiveSchema = z.enum([
  'controlled_discovery',
  'low_price_impact',
  'fast_capital_formation',
  'balanced',
]);

export const DemandProfileSchema = z.enum(['low', 'medium', 'high']);

export const CreateMarketBriefSchema = z.object({
  tokenName: z
    .string()
    .min(1, 'Token name is required')
    .max(64, 'Token name too long'),

  tokenSymbol: z
    .string()
    .min(1, 'Token symbol is required')
    .max(10, 'Token symbol too long')
    .toUpperCase(),

  totalSupply: z
    .number()
    .min(1, 'Total supply must be at least 1')
    .max(1e15, 'Total supply too large')
    .int('Supply must be a whole number'),

  quoteMint: solanaAddress,

  startingPrice: z
    .number()
    .positive('Starting price must be positive')
    .max(1e9, 'Starting price unreasonably large'),

  graduationQuoteAmount: z
    .number()
    .positive('Graduation target must be positive')
    .max(1e12, 'Graduation target unreasonably large'),

  expectedDemand: z.object({
    profile:               DemandProfileSchema,
    estimatedParticipants: z.number().int().positive().optional(),
    estimatedVolume:       z.number().positive().optional(),
  }),

  objective: MarketObjectiveSchema,
});

export type CreateMarketBriefInput = z.infer<typeof CreateMarketBriefSchema>;

// ── Fee config schema ──────────────────────────────────────────────────────

export const FeeConfigSchema = z.object({
  baseFeeBps: z
    .number()
    .int()
    .min(MIN_FEE_BPS, `Minimum fee is ${MIN_FEE_BPS} bps`)
    .max(MAX_FEE_BPS, `Maximum fee is ${MAX_FEE_BPS} bps`),

  dynamicFeeEnabled: z.boolean(),

  creatorTradingFeePercentage: z
    .number()
    .min(0)
    .max(100),

  collectFeeMode: z.enum(['quote_token', 'output_token']),
});

// ── Curve segment schema ───────────────────────────────────────────────────

export const CurveSegmentSchema = z.object({
  sqrtPriceLow:    z.string(),
  sqrtPriceHigh:   z.string(),
  priceStart:      z.number().nonnegative(),
  priceEnd:        z.number().nonnegative(),
  baseTokens:      z.number().nonnegative(),
  quoteTokens:     z.number().nonnegative(),
  liquidityWeight: z.number().nonnegative(),
});

// ── Curve schema ───────────────────────────────────────────────────────────

export const CurveSchema = z.object({
  builderType: z.enum([
    'buildCurve',
    'buildCurveWithMarketCap',
    'buildCurveWithTwoSegments',
    'buildCurveWithMidPrice',
    'buildCurveWithLiquidityWeights',
  ]),
  segments:           z.array(CurveSegmentSchema).min(1).max(MAX_CURVE_POINTS),
  initialMarketCap:   z.number().positive(),
  migrationMarketCap: z.number().positive(),
});

// ── Simulation result schema ───────────────────────────────────────────────

export const TradeScenarioSchema = z.enum(['A', 'B', 'C', 'D']);

const PricePointSchema = z.object({
  tradeIndex: z.number().int().nonnegative(),
  price:      z.number().nonnegative(),
});

const QuotePointSchema = z.object({
  tradeIndex:       z.number().int().nonnegative(),
  quoteAccumulated: z.number().nonnegative(),
  graduationPct:    z.number().min(0).max(100),
});

const SimulatedTradeSchema = z.object({
  index:          z.number().int().nonnegative(),
  direction:      z.enum(['buy', 'sell']),
  amountIn:       z.number().nonnegative(),
  amountOut:      z.number().nonnegative(),
  priceAfter:     z.number().nonnegative(),
  priceImpactPct: z.number(),
  feePaid:        z.number().nonnegative(),
});

export const SimulationResultSchema = z.object({
  scenario:          TradeScenarioSchema,
  pricePath:         z.array(PricePointSchema),
  quoteAccumulation: z.array(QuotePointSchema),
  trades:            z.array(SimulatedTradeSchema),
  totalFees:         z.number().nonnegative(),
  averagePriceImpact:z.number(),
  maxPriceImpact:    z.number(),
  finalPrice:        z.number().nonnegative(),
  startingPrice:     z.number().nonnegative(),
  quoteAtGraduation: z.number().nonnegative(),
  graduationReached: z.boolean(),
  capitalRequired:   z.number().nonnegative(),
  liquidityUtilization: z.number().min(0).max(1),
  tradeCount:        z.number().int().nonnegative(),
});

// ── Deployment schema ──────────────────────────────────────────────────────

export const DeploymentStatusSchema = z.enum([
  'not_started',
  'preparing',
  'awaiting_signature',
  'submitted',
  'confirmed',
  'failed',
]);

// ── Wallet address ────────────────────────────────────────────────────────

export const WalletAddressSchema = solanaAddress;

// ── Simulation parameters (user-editable assumptions) ─────────────────────

export const SimulationParamsSchema = z.object({
  scenario: TradeScenarioSchema,

  /** Number of trades to simulate */
  tradeCount: z.number().int().min(1).max(500).default(50),

  /** Trade size in quote asset units for scenarios A/B/C */
  tradeSizeQuote: z.number().positive().max(1e9),

  /** Sell fraction for scenario D (0–0.5) */
  sellFraction: z.number().min(0).max(0.5).default(0.2),
});

export type SimulationParams = z.infer<typeof SimulationParamsSchema>;

// ── Constraint violation ───────────────────────────────────────────────────

export const ConstraintViolationSchema = z.object({
  field:    z.string(),
  rule:     z.string(),
  message:  z.string(),
  severity: z.enum(['error', 'warning']),
});

export type ConstraintViolation = z.infer<typeof ConstraintViolationSchema>;
