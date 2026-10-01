/**
 * HERMES — Validation Telemetry
 *
 * Lightweight client-side instrumentation for the Round 3 validation funnel.
 * Events are logged to the console in development and can be extended to a
 * real analytics sink (PostHog, Amplitude, custom endpoint) later.
 *
 * Rules:
 *  - NEVER capture private keys, seed phrases, or wallet secrets
 *  - NEVER capture full public keys beyond the first 8 chars (for correlation)
 *  - NEVER capture sensitive personal information
 *  - Safe metadata only: event name, timestamp, truncated IDs, status
 */

export type TelemetryEvent =
  | 'wallet_connect_started'
  | 'wallet_connected'
  | 'wallet_connect_failed'
  | 'wallet_disconnected'
  | 'market_creation_started'
  | 'market_configuration_viewed'
  | 'deployment_started'
  | 'deployment_transaction_signed'
  | 'deployment_submitted'
  | 'deployment_confirmed'
  | 'deployment_failed'
  | 'deployment_cancelled';

export interface TelemetryPayload {
  event:      TelemetryEvent;
  ts:         string;           // ISO timestamp
  marketId?:  string;           // truncated
  wallet?:    string;           // first 8 chars only
  network?:   string;
  errorMsg?:  string;           // sanitised error message (no keys/seeds)
  durationMs?: number;          // elapsed time where relevant
  [key: string]: string | number | boolean | undefined;
}

// ── Module-level session start time for duration tracking ──────────────────
const _sessionStart = Date.now();

/**
 * Track a validation funnel event.
 * In production, swap the console.log body for a real sink call.
 */
export function track(event: TelemetryEvent, meta: Omit<TelemetryPayload, 'event' | 'ts'> = {}): void {
  const payload: TelemetryPayload = {
    event,
    ts: new Date().toISOString(),
    ...meta,
  };

  // Development: structured console output
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `%c[HERMES telemetry] ${event}`,
      'color: #5e6ad2; font-weight: bold;',
      payload,
    );
  }

  // Production sink — currently a no-op.
  // To enable: POST payload to /api/telemetry or call analytics.track()
  // IMPORTANT: never include private keys, seeds, or sensitive wallet data.
  if (process.env.NODE_ENV === 'production') {
    // Reserved for future analytics integration.
    // Example: void fetch('/api/telemetry', { method: 'POST', body: JSON.stringify(payload) });
  }
}

/** Safe wallet identifier — first 8 chars of public key only */
export function safeWallet(publicKey: string): string {
  return publicKey.slice(0, 8) + '…';
}

/** Safe market ID — first 8 chars */
export function safeId(id: string): string {
  return id.slice(0, 8) + '…';
}
