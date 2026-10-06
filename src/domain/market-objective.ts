/**
 * Market Objective — the user's intent before DBC configuration.
 *
 * This is the entry point to the HERMES Market Formation Intelligence layer.
 * The user describes what they want to create; HERMES translates it into
 * candidate DBC FormationPlans.
 *
 * Keep this model small — the user should complete intake in under 2 minutes.
 */
import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────────────

export type AssetType =
  | 'community'   // Community / social token
  | 'protocol'    // Protocol / governance token
  | 'creator'     // Creator / personal brand token
  | 'ai'          // AI agent / AI product token
  | 'rwa'         // Real-world asset token
  | 'other';      // Anything else

export type LaunchObjective =
  | 'priceDiscovery'       // Find fair value through early trading
  | 'bootstrapTrading'     // Activate a trading community quickly
  | 'targetMarketCap'      // Reach a specific graduation target
  | 'earlyLiquidity'       // Provide deep early liquidity for buyers
  | 'demandTesting'        // Test how much real demand exists
  | 'durableMarket';       // Build a stable long-term market

export type DesiredBehavior =
  | 'lowerVolatility'          // Smooth, predictable price movement
  | 'gradualPriceDiscovery'    // Slow, controlled price progression
  | 'fasterPriceDiscovery'     // Faster price response to demand
  | 'strongerEarlyLiquidity'   // Deep liquidity in early price ranges
  | 'discourageRapidTrading'   // Higher friction deters flippers
  | 'fasterGraduation';        // Optimise for reaching migration threshold

export type RiskPreference =
  | 'conservative'   // Prioritise stability over speed
  | 'balanced'       // Trade off risk and reward equally
  | 'aggressive';    // Accept more risk for faster outcomes

// ── Main type ──────────────────────────────────────────────────────────────

export interface MarketObjectiveInput {
  /** Type of asset being launched */
  assetType: AssetType;
  /** Primary and (optional) secondary objective */
  objectives: [LaunchObjective, ...LaunchObjective[]]; // at least 1
  /** Anticipated demand level from the creator's network */
  expectedDemand: 'low' | 'moderate' | 'high';
  /** Approximate launch capital available in SOL */
  launchCapital: number;
  /** Which quote asset (reuses MarketBrief.quoteMint) */
  quoteAsset: string;
  /** How the creator wants the market to behave */
  desiredBehavior: DesiredBehavior[];
  /** How much risk the creator is willing to accept */
  riskPreference: RiskPreference;
  /** Free-text context (optional, max 280 chars) */
  context?: string;
}

// ── Stored record (with market linkage) ───────────────────────────────────

export interface MarketObjective extends MarketObjectiveInput {
  id: string;
  marketId: string;
  createdAt: string;
  updatedAt: string;
}

// ── Zod schemas ────────────────────────────────────────────────────────────

export const AssetTypeSchema = z.enum([
  'community',
  'protocol',
  'creator',
  'ai',
  'rwa',
  'other',
]);

export const LaunchObjectiveSchema = z.enum([
  'priceDiscovery',
  'bootstrapTrading',
  'targetMarketCap',
  'earlyLiquidity',
  'demandTesting',
  'durableMarket',
]);

export const DesiredBehaviorSchema = z.enum([
  'lowerVolatility',
  'gradualPriceDiscovery',
  'fasterPriceDiscovery',
  'strongerEarlyLiquidity',
  'discourageRapidTrading',
  'fasterGraduation',
]);

export const RiskPreferenceSchema = z.enum([
  'conservative',
  'balanced',
  'aggressive',
]);

export const MarketObjectiveInputSchema = z.object({
  assetType: AssetTypeSchema,
  objectives: z
    .array(LaunchObjectiveSchema)
    .min(1, 'Select at least one objective')
    .max(3, 'Select at most 3 objectives'),
  expectedDemand: z.enum(['low', 'moderate', 'high']),
  launchCapital: z
    .number()
    .positive('Launch capital must be positive')
    .max(100_000, 'Enter a realistic launch capital'),
  quoteAsset: z.string().min(32).max(44),
  desiredBehavior: z
    .array(DesiredBehaviorSchema)
    .min(1, 'Select at least one behavior')
    .max(3, 'Select at most 3 behaviors'),
  riskPreference: RiskPreferenceSchema,
  context: z.string().max(280).optional(),
});

export type MarketObjectiveInputParsed = z.infer<typeof MarketObjectiveInputSchema>;

// ── Display labels ─────────────────────────────────────────────────────────

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  community: 'Community Token',
  protocol: 'Protocol / Governance',
  creator: 'Creator Token',
  ai: 'AI Agent / Product',
  rwa: 'Real-World Asset',
  other: 'Other',
};

export const LAUNCH_OBJECTIVE_LABELS: Record<LaunchObjective, string> = {
  priceDiscovery: 'Price Discovery',
  bootstrapTrading: 'Bootstrap Trading',
  targetMarketCap: 'Reach Target Market Cap',
  earlyLiquidity: 'Early Liquidity',
  demandTesting: 'Test Demand',
  durableMarket: 'Build Durable Market',
};

export const LAUNCH_OBJECTIVE_DESCRIPTIONS: Record<LaunchObjective, string> = {
  priceDiscovery: 'Let the market find fair value through organic early trading.',
  bootstrapTrading: 'Activate a community of traders quickly around your token.',
  targetMarketCap: 'Reach a specific graduation market cap threshold efficiently.',
  earlyLiquidity: 'Ensure buyers face low slippage in early price ranges.',
  demandTesting: 'Discover how much real demand exists before committing capital.',
  durableMarket: 'Prioritise long-term stability over short-term price action.',
};

export const DESIRED_BEHAVIOR_LABELS: Record<DesiredBehavior, string> = {
  lowerVolatility: 'Lower Volatility',
  gradualPriceDiscovery: 'Gradual Price Discovery',
  fasterPriceDiscovery: 'Faster Price Discovery',
  strongerEarlyLiquidity: 'Stronger Early Liquidity',
  discourageRapidTrading: 'Discourage Rapid Trading',
  fasterGraduation: 'Faster Graduation',
};

export const RISK_PREFERENCE_LABELS: Record<RiskPreference, string> = {
  conservative: 'Conservative',
  balanced: 'Balanced',
  aggressive: 'Aggressive',
};

export const RISK_PREFERENCE_DESCRIPTIONS: Record<RiskPreference, string> = {
  conservative: 'Prioritise stability. Accept slower progression in exchange for predictability.',
  balanced: 'Balance speed and stability. Good for most launches.',
  aggressive: 'Optimise for speed and impact. Accept higher sensitivity to demand fluctuations.',
};
