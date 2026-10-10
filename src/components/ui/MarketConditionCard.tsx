/**
 * MarketConditionCard.tsx
 *
 * Displays a derived MarketCondition from real observations.
 *
 * DISPLAY RULES:
 * - If dataAvailable = false → shows "Not enough data yet" state. Never fakes a status.
 * - Only renders signals that were actually derived from real data.
 * - Confidence level is always shown for transparency.
 * - Uses the existing HERMES visual system — no external dependencies.
 */

import React from 'react';
import { cn } from '@/lib/cn';
import type { MarketCondition, MarketConditionStatus, SignalDirection } from '@/domain/market-condition';
import { MIN_OBSERVATIONS } from '@/services/market-condition/deriveMarketCondition';
import { TrendingUp, TrendingDown, Minus, HelpCircle, Activity } from 'lucide-react';

// ── Status config ─────────────────────────────────────────────────────────────

interface StatusConfig {
  label:       string;
  color:       string;       // text
  bg:          string;       // badge bg
  border:      string;       // card border accent
  dot:         string;       // indicator dot
}

const STATUS_CONFIG: Record<MarketConditionStatus, StatusConfig> = {
  HEALTHY: {
    label:  'Healthy',
    color:  'text-success',
    bg:     'bg-success/[0.12] border-success/25',
    border: 'border-success/20',
    dot:    'bg-success',
  },
  ACTIVE: {
    label:  'Active',
    color:  'text-accent',
    bg:     'bg-accent-subtle border-accent/25',
    border: 'border-accent/25',
    dot:    'bg-accent',
  },
  THIN: {
    label:  'Thin',
    color:  'text-warning',
    bg:     'bg-warning/[0.10] border-warning/25',
    border: 'border-warning/20',
    dot:    'bg-warning',
  },
  VOLATILE: {
    label:  'Volatile',
    color:  'text-danger',
    bg:     'bg-danger/[0.10] border-danger/25',
    border: 'border-danger/20',
    dot:    'bg-danger',
  },
  DEMAND_WEAKENING: {
    label:  'Demand Weakening',
    color:  'text-warning',
    bg:     'bg-warning/[0.10] border-warning/25',
    border: 'border-warning/20',
    dot:    'bg-warning animate-pulse-slow',
  },
  INSUFFICIENT_DATA: {
    label:  'Insufficient Data',
    color:  'text-text-tertiary',
    bg:     'bg-bg-elevated border-border',
    border: 'border-border',
    dot:    'bg-text-disabled',
  },
};

// ── Direction icon ────────────────────────────────────────────────────────────

function DirectionIcon({ direction, className }: { direction: SignalDirection; className?: string }) {
  switch (direction) {
    case 'up':      return <TrendingUp   className={cn('w-3.5 h-3.5 text-success',  className)} />;
    case 'down':    return <TrendingDown className={cn('w-3.5 h-3.5 text-danger',   className)} />;
    case 'stable':  return <Minus        className={cn('w-3.5 h-3.5 text-text-tertiary', className)} />;
    case 'unknown': return <HelpCircle   className={cn('w-3.5 h-3.5 text-text-disabled', className)} />;
  }
}

// ── Confidence label ──────────────────────────────────────────────────────────

const CONFIDENCE_LABEL: Record<string, string> = {
  low:    'Low confidence',
  medium: 'Medium confidence',
  high:   'High confidence',
};

// ── Main component ────────────────────────────────────────────────────────────

interface MarketConditionCardProps {
  condition:     MarketCondition;
  /** Optional: show a compact inline version (no signals detail) */
  compact?:      boolean;
  className?:    string;
}

export function MarketConditionCard({
  condition,
  compact = false,
  className,
}: MarketConditionCardProps) {
  const cfg = STATUS_CONFIG[condition.status];

  return (
    <div
      className={cn(
        'rounded-xl border bg-bg-surface',
        '[background-image:linear-gradient(180deg,rgba(255,255,255,0.025)_0%,transparent_100%)]',
        cfg.border,
        className
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Activity className="w-3.5 h-3.5 text-text-tertiary" />
            <span className="text-2xs text-text-tertiary uppercase tracking-[0.12em] font-medium">
              Market Condition
            </span>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2 mt-2">
            <span className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border',
              cfg.bg, cfg.color
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
              {cfg.label}
            </span>

            {condition.dataAvailable && (
              <span className="text-2xs text-text-disabled">
                {CONFIDENCE_LABEL[condition.confidence]}
              </span>
            )}
          </div>
        </div>

        {/* Observation count badge */}
        <div className="text-right">
          <p className="text-2xs text-text-disabled">
            {condition.observationCount} observation{condition.observationCount !== 1 ? 's' : ''}
          </p>
          {condition.dataAvailable && (
            <p className="text-2xs text-text-disabled mt-0.5">
              {MIN_OBSERVATIONS} min required
            </p>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-5 py-4">

        {/* No data state */}
        {!condition.dataAvailable && (
          <InsufficientDataState observationCount={condition.observationCount} />
        )}

        {/* Summary + signals */}
        {condition.dataAvailable && (
          <>
            {/* Summary */}
            {condition.summary && (
              <p className="text-xs text-text-secondary leading-relaxed mb-4">
                {condition.summary}
              </p>
            )}

            {/* Signals */}
            {!compact && condition.signals.length > 0 && (
              <div className="space-y-1">
                <p className="text-2xs text-text-disabled uppercase tracking-[0.12em] mb-2">
                  Signals
                </p>
                {condition.signals.map(signal => (
                  <SignalRow key={signal.metric} signal={signal} />
                ))}
              </div>
            )}

            {/* Disclaimer */}
            <p className="mt-4 text-2xs text-text-disabled leading-relaxed border-t border-border pt-3">
              Derived from {condition.observationCount} on-chain observations.
              Not a forecast — reflects observed data only.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── Signal row ────────────────────────────────────────────────────────────────

function SignalRow({ signal }: { signal: MarketCondition['signals'][number] }) {
  return (
    <div className={cn(
      'flex items-start justify-between gap-3',
      'px-3 py-2.5 rounded-lg',
      'bg-bg-elevated border border-border-subtle',
      'transition-[background-color] duration-150',
    )}>
      {/* Left: metric + interpretation */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary">{signal.metric}</p>
        <p className="text-2xs text-text-tertiary mt-0.5 leading-relaxed">{signal.interpretation}</p>
      </div>

      {/* Right: value + direction */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-text-secondary font-mono">{signal.value}</span>
        <DirectionIcon direction={signal.direction} />
      </div>
    </div>
  );
}

// ── Insufficient data state ───────────────────────────────────────────────────

function InsufficientDataState({ observationCount }: { observationCount: number }) {
  const remaining = Math.max(0, MIN_OBSERVATIONS - observationCount);

  return (
    <div className="text-center py-3">
      <p className="text-xs text-text-secondary mb-1">
        Not enough data yet.
      </p>
      <p className="text-2xs text-text-tertiary leading-relaxed max-w-xs mx-auto">
        {observationCount === 0
          ? `Market condition requires at least ${MIN_OBSERVATIONS} observations. No observations have been recorded yet.`
          : `${remaining} more observation${remaining !== 1 ? 's' : ''} needed before a condition can be derived.`
        }
      </p>
      <p className="text-2xs text-text-disabled mt-2">
        No fabricated metrics will ever be shown.
      </p>
    </div>
  );
}
