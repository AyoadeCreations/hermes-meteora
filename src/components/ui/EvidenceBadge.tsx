/**
 * EvidenceBadge.tsx
 *
 * Compact label identifying the epistemic status of a displayed value.
 * Used throughout formation plans, scenarios, and market condition sections
 * to distinguish between observed data, calculations, simulations, and assumptions.
 *
 * USAGE RULES:
 * - VERIFIED / OBSERVED: directly supported by on-chain or application data.
 * - CALCULATED: derived deterministically from known inputs.
 * - SIMULATED: produced by the application's simulation model.
 * - ASSUMPTION: supplied by the user or introduced by a documented model assumption.
 * - ESTIMATE: model-based estimate under stated conditions (not guaranteed).
 * - UNKNOWN: cannot currently be established.
 *
 * Do not use VERIFIED or OBSERVED unless the value genuinely comes from real data.
 * Use ESTIMATE for forward-looking model outputs (e.g. graduation progress).
 */

import React from 'react';
import { cn } from '@/lib/cn';

export type EvidenceType =
  | 'OBSERVED'
  | 'CALCULATED'
  | 'SIMULATED'
  | 'ASSUMPTION'
  | 'ESTIMATE'
  | 'UNKNOWN';

interface EvidenceBadgeProps {
  type: EvidenceType;
  /** Tooltip / aria-label for accessibility */
  title?: string;
  className?: string;
}

const EVIDENCE_CONFIG: Record<EvidenceType, {
  label:  string;
  color:  string;
  bg:     string;
  border: string;
  description: string;
}> = {
  OBSERVED: {
    label:  'Observed',
    color:  'text-success',
    bg:     'bg-success/[0.10]',
    border: 'border-success/25',
    description: 'Directly observed on-chain or from application records.',
  },
  CALCULATED: {
    label:  'Calculated',
    color:  'text-accent',
    bg:     'bg-accent-subtle',
    border: 'border-accent/25',
    description: 'Derived deterministically from known inputs.',
  },
  SIMULATED: {
    label:  'Simulated',
    color:  'text-chart-e',
    bg:     'bg-[rgba(163,113,247,0.08)]',
    border: 'border-[rgba(163,113,247,0.25)]',
    description: 'Produced by the HERMES simulation model, not real trading.',
  },
  ASSUMPTION: {
    label:  'Assumption',
    color:  'text-warning',
    bg:     'bg-warning/[0.08]',
    border: 'border-warning/25',
    description: 'Supplied by the user or introduced by a documented model assumption.',
  },
  ESTIMATE: {
    label:  'Estimate',
    color:  'text-text-secondary',
    bg:     'bg-bg-elevated',
    border: 'border-border',
    description: 'Model-based estimate under stated demand conditions. Not guaranteed.',
  },
  UNKNOWN: {
    label:  'Unknown',
    color:  'text-text-disabled',
    bg:     'bg-bg-muted',
    border: 'border-border-subtle',
    description: 'Cannot currently be established from available data.',
  },
};

export function EvidenceBadge({ type, title, className }: EvidenceBadgeProps) {
  const cfg = EVIDENCE_CONFIG[type];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5',
        'rounded text-2xs font-medium uppercase tracking-[0.1em]',
        'border',
        cfg.color,
        cfg.bg,
        cfg.border,
        className
      )}
      title={title ?? cfg.description}
      aria-label={`${cfg.label}: ${title ?? cfg.description}`}
    >
      {cfg.label}
    </span>
  );
}

/**
 * Inline methodology note — a single line with an evidence badge and a short explanation.
 * Used inside card bodies to label a specific value or metric.
 */
export function EvidenceNote({
  type,
  children,
  className,
}: {
  type: EvidenceType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-2', className)}>
      <EvidenceBadge type={type} className="mt-0.5 shrink-0" />
      <p className="text-2xs text-text-tertiary leading-relaxed">{children}</p>
    </div>
  );
}
