/**
 * Sniper stress test.
 *
 * Replays a curve design against a fixed stream of organic buyers plus a burst
 * of bot buys at launch, under four protection presets modelled on Meteora's
 * anti-sniper tools (decaying fee scheduler, size based rate limiter, gated
 * early access).
 *
 * This is NOT a prediction of real bot behaviour. Every parameter is an
 * illustrative assumption, and the output must be labelled ILLUSTRATIVE.
 * It is deterministic: the same input always gives the same result.
 *
 * Bot model: bots fire first in the launch window, split their capital across
 * `botCount` buys, hold, then exit into the curve once the window closes.
 * Their profit is the quote they get back minus what they spent, fees included.
 */

import type { CurveSegment, FeeConfig } from '@/domain/types';
import {
  initSegmentState,
  executeBuy,
  executeSell,
  type SegmentState,
} from './engine';

export type ProtectionId = 'none' | 'scheduler' | 'limiter' | 'gated';

export const PROTECTION_LABELS: Record<ProtectionId, string> = {
  none:      'No protection',
  scheduler: 'Fee scheduler',
  limiter:   'Scheduler + rate limiter',
  gated:     'Scheduler + limiter + gated entry',
};

export const PROTECTION_ORDER: ProtectionId[] = ['none', 'scheduler', 'limiter', 'gated'];

export interface StressConfig {
  /** Length of the launch window in seconds. */
  windowSeconds: number;
  /** Number of organic buys spread across the window. */
  organicCount: number;
  /** Quote size of each organic buy. */
  organicSizeQuote: number;
  /** Number of separate bot buys the bot capital is split into. */
  botCount: number;
  /** Total bot capital as a fraction (0 to 1) of the graduation target. */
  botCapitalPct: number;
  /** Fee scheduler: starting fee that decays linearly to the base fee. */
  scheduler: { startBps: number; durationSeconds: number };
  /** Rate limiter: surcharge on buys larger than the reference size. */
  limiter: { referenceQuote: number; stepBps: number; capBps: number };
  /** Gated entry: seconds only whitelisted buyers can trade, and their share of organic buys. */
  gate: { seconds: number; whitelistedShare: number };
}

export interface StressInput {
  segments:            CurveSegment[];
  startingPrice:       number;
  graduationThreshold: number;
  fees:                FeeConfig;
  config:              StressConfig;
}

export interface LaunchMetrics {
  botSpend:            number;
  botTokens:           number;
  botFeesPaid:         number;
  botExitProceeds:     number;
  /** Exit proceeds minus spend. Positive means bots took value out. */
  botProfit:           number;
  /** Bot profit as a percentage of bot spend. */
  botRoiPct:           number;
  /** Share of all tokens sold during the window that went to bots. */
  botSupplySharePct:   number;
  organicSpent:        number;
  organicTokens:       number;
  organicFilledPct:    number;
  /** Quote paid per token including fees. */
  organicEffectivePrice: number;
  quoteAccumulated:    number;
  graduatedAtSecond:   number | null;
}

export interface PresetResult {
  id:    ProtectionId;
  label: string;
  withBots: LaunchMetrics;
  /** Same preset with no bots: isolates what the protection itself costs organic buyers. */
  withoutBots: LaunchMetrics;
  /** Bot profit per 100 quote that organic buyers put in. */
  leakagePer100: number;
  /** Organic effective price with bots vs a bot free, unprotected launch. */
  organicCostVsIdealPct: number;
  /** The part of that caused by the protection fees, with no bots present. */
  protectionTaxPct: number;
  /** The part caused by bots. */
  botDrivenPct: number;
}

export interface StressResult {
  /** Organic effective price in a bot free, unprotected launch. */
  idealOrganicPrice: number;
  presets: PresetResult[];
}

export function defaultStressConfig(opts: {
  organicSizeQuote: number;
  organicCount?: number;
}): StressConfig {
  return {
    windowSeconds:    120,
    organicCount:     opts.organicCount ?? 40,
    organicSizeQuote: opts.organicSizeQuote,
    botCount:         5,
    botCapitalPct:    0.2,
    scheduler:        { startBps: 1500, durationSeconds: 60 },
    limiter:          { referenceQuote: opts.organicSizeQuote * 1.25, stepBps: 1000, capBps: 2500 },
    gate:             { seconds: 10, whitelistedShare: 0.25 },
  };
}

// ── Fees ───────────────────────────────────────────────────────────────────

const MAX_FEE_BPS = 9900;

function feeBpsFor(
  preset: ProtectionId,
  t: number,
  amount: number,
  baseBps: number,
  cfg: StressConfig,
): number {
  let bps = baseBps;

  if (preset !== 'none') {
    const { startBps, durationSeconds } = cfg.scheduler;
    const progress = durationSeconds > 0 ? Math.min(1, Math.max(0, t / durationSeconds)) : 1;
    bps = Math.max(baseBps, startBps + (baseBps - startBps) * progress);
  }

  if ((preset === 'limiter' || preset === 'gated') && amount > cfg.limiter.referenceQuote) {
    const ratio = amount / cfg.limiter.referenceQuote - 1;
    bps += Math.min(cfg.limiter.capBps, cfg.limiter.stepBps * ratio);
  }

  return Math.min(MAX_FEE_BPS, bps);
}

// ── Event stream ───────────────────────────────────────────────────────────

interface LaunchEvent {
  t:     number;
  actor: 'organic' | 'bot';
  size:  number;
}

function buildEvents(
  preset: ProtectionId,
  withBots: boolean,
  graduationThreshold: number,
  cfg: StressConfig,
): LaunchEvent[] {
  const events: LaunchEvent[] = [];
  const T = cfg.windowSeconds;
  const N = cfg.organicCount;
  const gated = preset === 'gated';

  if (gated && N > 0) {
    const G = cfg.gate.seconds;
    const early = Math.min(N, Math.round(N * cfg.gate.whitelistedShare));
    for (let j = 0; j < early; j++) {
      events.push({ t: ((j + 0.5) * G) / Math.max(early, 1), actor: 'organic', size: cfg.organicSizeQuote });
    }
    const rest = N - early;
    for (let j = 0; j < rest; j++) {
      events.push({ t: G + (j * (T - G)) / Math.max(rest, 1), actor: 'organic', size: cfg.organicSizeQuote });
    }
  } else {
    for (let i = 0; i < N; i++) {
      events.push({ t: 1 + (i * (T - 1)) / Math.max(N, 1), actor: 'organic', size: cfg.organicSizeQuote });
    }
  }

  if (withBots && cfg.botCount > 0 && cfg.botCapitalPct > 0) {
    const start = gated ? cfg.gate.seconds : 0;
    const each  = (graduationThreshold * cfg.botCapitalPct) / cfg.botCount;
    for (let k = 0; k < cfg.botCount; k++) {
      events.push({ t: start + k * 0.15, actor: 'bot', size: each });
    }
  }

  // Bots win ties: they are faster than any human.
  events.sort((a, b) => a.t - b.t || (a.actor === 'bot' ? -1 : 1) - (b.actor === 'bot' ? -1 : 1));
  return events;
}

// ── One launch ─────────────────────────────────────────────────────────────

function runLaunch(
  input: StressInput,
  preset: ProtectionId,
  withBots: boolean,
): LaunchMetrics {
  const { segments, startingPrice, graduationThreshold, fees, config } = input;
  const states: SegmentState[] = segments.map(initSegmentState);
  const events = buildEvents(preset, withBots, graduationThreshold, config);

  let price = startingPrice;
  let quoteAccumulated = 0;
  let graduatedAtSecond: number | null = null;

  let botSpend = 0, botTokens = 0, botFees = 0;
  let orgSpent = 0, orgTokens = 0, orgFilled = 0, orgAttempted = 0;

  for (const ev of events) {
    if (graduatedAtSecond !== null) {
      if (ev.actor === 'organic') orgAttempted++;
      continue;
    }

    const bps  = feeBpsFor(preset, ev.t, ev.size, fees.baseFeeBps, config);
    const fee  = (ev.size * bps) / 10_000;
    const net  = ev.size - fee;
    const { baseOut, quoteUsed, newPrice } = executeBuy(states, price, net);

    if (ev.actor === 'organic') orgAttempted++;
    if (quoteUsed <= 0 || baseOut <= 0) continue;

    price = newPrice;
    // Only the quote that actually moved the curve, plus its fee, is spent.
    const feeOnUsed = quoteUsed * (bps / (10_000 - bps));
    const spent = quoteUsed + feeOnUsed;
    quoteAccumulated += spent;

    if (ev.actor === 'bot') {
      botSpend  += spent;
      botTokens += baseOut;
      botFees   += feeOnUsed;
    } else {
      orgSpent  += spent;
      orgTokens += baseOut;
      orgFilled++;
    }

    if (quoteAccumulated >= graduationThreshold) graduatedAtSecond = ev.t;
  }

  // Bots exit into the curve once the window closes.
  let botExit = 0;
  if (botTokens > 0) {
    const { quoteOut } = executeSell(states, price, botTokens);
    botExit = quoteOut * (1 - fees.baseFeeBps / 10_000);
  }

  const totalTokens = botTokens + orgTokens;
  return {
    botSpend,
    botTokens,
    botFeesPaid:       botFees,
    botExitProceeds:   botExit,
    botProfit:         botExit - botSpend,
    botRoiPct:         botSpend > 0 ? ((botExit - botSpend) / botSpend) * 100 : 0,
    botSupplySharePct: totalTokens > 0 ? (botTokens / totalTokens) * 100 : 0,
    organicSpent:      orgSpent,
    organicTokens:     orgTokens,
    organicFilledPct:  orgAttempted > 0 ? (orgFilled / orgAttempted) * 100 : 0,
    organicEffectivePrice: orgTokens > 0 ? orgSpent / orgTokens : 0,
    quoteAccumulated,
    graduatedAtSecond,
  };
}

// ── Public ─────────────────────────────────────────────────────────────────

export function runStressTest(input: StressInput): StressResult {
  if (input.segments.length === 0) {
    throw new Error('Cannot stress test: no curve segments provided');
  }

  const ideal = runLaunch(input, 'none', false).organicEffectivePrice;
  const pct = (price: number) => (ideal > 0 && price > 0 ? ((price - ideal) / ideal) * 100 : 0);

  const presets = PROTECTION_ORDER.map((id): PresetResult => {
    const withBots    = runLaunch(input, id, true);
    const withoutBots = runLaunch(input, id, false);
    const costWith    = pct(withBots.organicEffectivePrice);
    const tax         = pct(withoutBots.organicEffectivePrice);
    return {
      id,
      label: PROTECTION_LABELS[id],
      withBots,
      withoutBots,
      leakagePer100: withBots.organicSpent > 0 ? (withBots.botProfit / withBots.organicSpent) * 100 : 0,
      organicCostVsIdealPct: costWith,
      protectionTaxPct:      tax,
      botDrivenPct:          costWith - tax,
    };
  });

  return { idealOrganicPrice: ideal, presets };
}
