/**
 * Core domain types for the Meteora Market Formation Engine.
 *
 * These types are the source of truth for the application.
 * All simulation, generation, and deployment logic operates on these structures.
 */

// ── Market Objective ───────────────────────────────────────────────────────

export type MarketObjective =
  | 'controlled_discovery'  // Controlled price discovery — smooth progression
  | 'low_price_impact'      // Low early price impact — deeper effective liquidity
  | 'fast_capital_formation'// Fast graduation — efficient capital accumulation
  | 'balanced';             // Balanced — optimises across dimensions

export const OBJECTIVE_LABELS: Record<MarketObjective, string> = {
  controlled_discovery:   'Controlled Discovery',
  low_price_impact:       'Low Price Impact',
  fast_capital_formation: 'Fast Capital Formation',
  balanced:               'Balanced Formation',
};

export const OBJECTIVE_DESCRIPTIONS: Record<MarketObjective, string> = {
  controlled_discovery:
    'Prioritises smooth price progression and controlled price impact. Best for tokens needing gradual price discovery.',
  low_price_impact:
    'Prioritises deeper effective liquidity early, reducing slippage for buyers. Best for tokens expecting large individual buys.',
  fast_capital_formation:
    'Prioritises efficient capital accumulation toward graduation. Best for tokens needing fast market establishment.',
  balanced:
    'Optimises across price discovery, liquidity depth, and capital formation. Good general-purpose starting point.',
};

// ── Demand Profile ─────────────────────────────────────────────────────────

export type DemandProfile = 'low' | 'medium' | 'high';

export const DEMAND_LABELS: Record<DemandProfile, string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
};

// ── Market Brief ──────────────────────────────────────────────────────────

export interface MarketBrief {
  id: string;

  tokenName:   string;
  tokenSymbol: string;

  /** Total token supply in base units (e.g. 1_000_000 for 1M tokens) */
  totalSupply: number;

  /** Quote asset mint address (e.g. SOL native mint or USDC) */
  quoteMint: string;

  /** Desired starting price in quote asset units */
  startingPrice: number;

  /** Target quote amount to reach graduation */
  graduationQuoteAmount: number;

  expectedDemand: {
    profile:               DemandProfile;
    estimatedParticipants?: number;
    estimatedVolume?:       number;
  };

  objective: MarketObjective;

  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

// ── Curve Segment ──────────────────────────────────────────────────────────

/**
 * Represents one segment of a bonding curve.
 * Prices are in quote asset units per base token.
 * Reserves are in token amounts (not lamports).
 */
export interface CurveSegment {
  sqrtPriceLow:  string; // BN as string to avoid serialisation issues
  sqrtPriceHigh: string;

  /** Human-readable price at segment start */
  priceStart: number;
  /** Human-readable price at segment end */
  priceEnd: number;

  /** Base tokens available in this segment */
  baseTokens: number;
  /** Quote tokens accumulated across this segment */
  quoteTokens: number;

  /** Liquidity weight for this segment (relative weighting) */
  liquidityWeight: number;
}

// ── Fee Configuration ──────────────────────────────────────────────────────

export interface FeeConfig {
  /** Base fee in basis points (25–9900) */
  baseFeeBps: number;

  /** Whether dynamic fee is enabled */
  dynamicFeeEnabled: boolean;

  /** Creator trading fee percentage (0–100) */
  creatorTradingFeePercentage: number;

  /** Fee collection mode */
  collectFeeMode: 'quote_token' | 'output_token';
}

// ── Liquidity Range ────────────────────────────────────────────────────────

export interface LiquidityRange {
  priceMin: number;
  priceMax: number;
  /** Relative weight of liquidity in this range */
  weight: number;
  /** Human-readable description */
  description: string;
}

// ── Market Design ──────────────────────────────────────────────────────────

export interface MarketDesign {
  id: string;
  marketBriefId: string;

  /** Display name e.g. "Controlled Discovery" */
  name: string;

  /** Short description of the design rationale */
  description: string;

  objective: MarketObjective;

  curve: {
    /** SDK builder used to produce this curve */
    builderType:
      | 'buildCurve'
      | 'buildCurveWithMarketCap'
      | 'buildCurveWithTwoSegments'
      | 'buildCurveWithMidPrice'
      | 'buildCurveWithLiquidityWeights';
    segments:            CurveSegment[];
    initialMarketCap:   number;  // in SOL
    migrationMarketCap: number;  // in SOL
  };

  liquidityDistribution: LiquidityRange[];

  fees: FeeConfig;

  graduation: {
    quoteThreshold: number; // in quote asset units
  };

  /** Simulation result for this design */
  simulation: SimulationResult;

  /** Human-readable warnings about this configuration */
  warnings: string[];

  /**
   * Objective alignment score [0, 1].
   * Computed by the objective engine — see scoring docs.
   */
  objectiveScore: number;

  /**
   * Score component breakdown for transparency.
   */
  scoreBreakdown: ObjectiveScoreBreakdown;

  createdAt: string;
}

// ── Simulation Types ───────────────────────────────────────────────────────

export interface PricePoint {
  tradeIndex: number;
  price:      number;
  sqrtPrice?: string;
}

export interface QuotePoint {
  tradeIndex:       number;
  quoteAccumulated: number;
  graduationPct:    number; // 0–100
}

export interface SimulatedTrade {
  index:          number;
  direction:      'buy' | 'sell';
  amountIn:       number;
  amountOut:      number;
  priceAfter:     number;
  priceImpactPct: number;
  feePaid:        number;
}

export interface SimulationResult {
  /** Scenario that produced this result */
  scenario: TradeScenario;

  pricePath:         PricePoint[];
  quoteAccumulation: QuotePoint[];
  trades:            SimulatedTrade[];

  totalFees:        number;
  averagePriceImpact: number;
  maxPriceImpact:   number;

  finalPrice:        number;
  startingPrice:     number;

  quoteAtGraduation: number;
  graduationReached: boolean;

  capitalRequired:     number;
  liquidityUtilization: number; // 0–1

  /** Total number of simulated trades */
  tradeCount: number;
}

// ── Trade Scenario ─────────────────────────────────────────────────────────

export type TradeScenario = 'A' | 'B' | 'C' | 'D';

export const SCENARIO_LABELS: Record<TradeScenario, string> = {
  A: 'Small repeated buys',
  B: 'Medium buys',
  C: 'Large concentrated buy',
  D: 'Mixed buy/sell activity',
};

export const SCENARIO_DESCRIPTIONS: Record<TradeScenario, string> = {
  A: 'Many small purchases distributed over time. Tests liquidity for retail demand.',
  B: 'Moderate-sized purchases. Tests typical institutional/mid-size buyer behavior.',
  C: 'One or two large purchases. Tests resilience to whale buying and price impact.',
  D: 'Mix of buys and sells. Tests price stability under two-sided flow.',
};

// ── Objective Score Breakdown ──────────────────────────────────────────────

export interface ObjectiveScoreBreakdown {
  /** Normalised price impact score [0, 1] — higher is better */
  priceImpactScore: number;

  /** Normalised capital formation score [0, 1] */
  capitalFormationScore: number;

  /** Normalised price progression score [0, 1] */
  progressionScore: number;

  /** Normalised fee score [0, 1] */
  feeScore: number;

  /** Weights applied for this objective */
  weights: ObjectiveWeights;
}

export interface ObjectiveWeights {
  priceImpact:      number;
  capitalFormation: number;
  progression:      number;
  fee:              number;
}

// ── Deployment ────────────────────────────────────────────────────────────

export type DeploymentStatus =
  | 'not_started'
  | 'preparing'
  | 'awaiting_signature'
  | 'submitted'
  | 'confirmed'
  | 'failed';

export interface Deployment {
  id: string;
  marketId:   string;
  designId:   string;

  walletAddress: string;

  /** On-chain pool address after confirmation */
  poolAddress?: string;

  /** On-chain config account address */
  configAddress?: string;

  /** Solana transaction signature */
  transactionSignature?: string;

  status:    DeploymentStatus;
  errorMessage?: string;

  createdAt: string;
  updatedAt: string;
}

// ── Market Observation ────────────────────────────────────────────────────

export interface MarketObservation {
  id: string;
  marketId:  string;
  timestamp: string;

  price:        number;
  quoteReserve: number;
  volume24h:    number;
  traders:      number;
  buyVolume:    number;
  sellVolume:   number;
  graduationProgress: number; // 0–100
}

// ── Market State (live) ───────────────────────────────────────────────────

export interface MarketState {
  poolAddress:         string;
  currentPrice:        number;
  quoteReserve:        number;
  baseReserve:         number;
  volume24h:           number;
  traders24h:          number;
  graduationProgress:  number; // 0–100
  graduationReached:   boolean;
  buyVolume24h:        number;
  sellVolume24h:       number;
  feesCollected:       number;

  /** Whether this is live on-chain data or from observation store */
  source: 'onchain' | 'cached' | 'unavailable';
  lastUpdated: string;
}

// ── Designed vs Actual ────────────────────────────────────────────────────

export interface DesignedVsActual {
  marketId: string;
  designId: string;

  designed: {
    expectedPricePath:      PricePoint[];
    expectedCapitalPath:    QuotePoint[];
    expectedFinalPrice:     number;
    expectedPriceImpact:    number;
    expectedGradProgress:   number;
    scenarioUsed:           TradeScenario;
  };

  actual: {
    observedPricePath:      Array<{ timestamp: string; price: number }>;
    observedCapital:        Array<{ timestamp: string; quoteReserve: number }>;
    currentPrice:           number;
    currentQuoteReserve:    number;
    currentGradProgress:    number;
  };

  variance: {
    pricePct:         number | null;
    capitalPct:       number | null;
    gradProgressPct:  number | null;
  };
}

// ── Market Design Baseline (for future benchmarking) ─────────────────────

export interface MarketDesignBaseline {
  name: string;
  description: string;
  configuration: {
    feeBps:            number;
    curveType:         string;
    migrationThreshold: number;
  };
  simulation: SimulationResult;
}

// ── Solana network ─────────────────────────────────────────────────────────

export type SolanaNetwork = 'devnet' | 'mainnet-beta';

// ── Well-known addresses ───────────────────────────────────────────────────

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const USDC_DEVNET_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

export const QUOTE_MINTS: Record<string, { label: string; decimals: number }> = {
  [SOL_MINT]:         { label: 'SOL',  decimals: 9 },
  [USDC_DEVNET_MINT]: { label: 'USDC', decimals: 6 },
};
