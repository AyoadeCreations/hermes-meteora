/**
 * MarketCondition — typed model for post-launch market state interpretation.
 *
 * This is a lightweight foundation for the "Read the Market" phase of HERMES.
 * All values are derived exclusively from real MarketObservation data.
 * Nothing here is fabricated or estimated without actual observations.
 *
 * Future extension point: connect to selectedPlanId / configurationSnapshot
 * from LaunchOutcome to enable Plan vs Reality comparison.
 */

// ── Condition Status ──────────────────────────────────────────────────────────

/**
 * The overall market condition status.
 * Derived only when MIN_OBSERVATIONS are present.
 * Extend this union as new statuses are validated against real data.
 */
export type MarketConditionStatus =
  | 'HEALTHY'            // Trading active, liquidity stable, demand positive
  | 'ACTIVE'             // Trading developing, early signals positive
  | 'THIN'               // Low volume or trader activity — fragile liquidity
  | 'VOLATILE'           // Large price swings relative to observation window
  | 'DEMAND_WEAKENING'   // Buy pressure declining, sell side increasing
  | 'INSUFFICIENT_DATA'; // Not enough observations to derive any condition

// ── Signal Direction ──────────────────────────────────────────────────────────

export type SignalDirection = 'up' | 'down' | 'stable' | 'unknown';

// ── Individual Signal ─────────────────────────────────────────────────────────

/**
 * One interpreted metric from a real data source.
 * Only created when the underlying data actually exists.
 */
export interface ConditionSignal {
  /** What metric this signal describes */
  metric: string;
  /**
   * Human-readable value — always a direct representation of observed data.
   * Never fabricated. E.g. "2.1 SOL" not "2.1 SOL (good)".
   */
  value: string;
  /** Direction of change over the observation window */
  direction: SignalDirection;
  /**
   * What this metric means in plain language.
   * Deliberately cautious — avoids overclaiming.
   */
  interpretation: string;
  /** The raw numeric value used to compute this signal, for future use */
  rawValue: number;
}

// ── Confidence Level ──────────────────────────────────────────────────────────

/**
 * How confident we are in the derived condition.
 * Scales with observation count and signal consistency.
 * 'low' = borderline thresholds, few observations.
 * 'medium' = moderate data, some signal agreement.
 * 'high' = strong data, multiple agreeing signals.
 */
export type ConditionConfidence = 'low' | 'medium' | 'high';

// ── Market Condition ──────────────────────────────────────────────────────────

export interface MarketCondition {
  /** Overall market state label */
  status: MarketConditionStatus;

  /** Confidence in this assessment — scales with data quantity and quality */
  confidence: ConditionConfidence;

  /**
   * One-sentence plain-language summary.
   * Carefully scoped — no overclaiming.
   * Empty string when status is INSUFFICIENT_DATA.
   */
  summary: string;

  /** Individual interpreted signals. Only populated when real data exists. */
  signals: ConditionSignal[];

  /** ISO-8601 timestamp of the most recent observation used */
  updatedAt: string;

  /**
   * Whether enough data exists to derive a meaningful condition.
   * false → show "Not enough data yet" UI, never show a fabricated status.
   */
  dataAvailable: boolean;

  /**
   * How many observations were used to derive this condition.
   * Displayed to the user for transparency.
   */
  observationCount: number;

  /**
   * Future extension: link to the formation plan this market was launched with.
   * null until Plan vs Reality feature is built.
   */
  formationPlanId: string | null;
}
