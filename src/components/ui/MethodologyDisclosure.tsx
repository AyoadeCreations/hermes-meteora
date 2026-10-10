/**
 * MethodologyDisclosure.tsx
 *
 * Compact expandable explanation of how HERMES evaluates a market.
 * Grounded in the actual implementation — no overclaiming.
 *
 * Place wherever methodology transparency is appropriate:
 * - Formation plan cards
 * - Verify page
 * - Market condition card (if desired)
 */

'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/cn';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { EvidenceBadge } from './EvidenceBadge';

interface MethodologyDisclosureProps {
  /** Context-specific additional note shown below the standard text */
  contextNote?: string;
  className?: string;
}

export function MethodologyDisclosure({ contextNote, className }: MethodologyDisclosureProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('rounded-lg border border-border bg-bg-surface', className)}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center justify-between w-full px-4 py-3',
          'text-left transition-colors duration-150',
          'hover:bg-bg-elevated rounded-lg',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent'
        )}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
          <span className="text-xs font-medium text-text-secondary">
            How HERMES evaluates this
          </span>
        </div>
        {open
          ? <ChevronUp   className="w-3.5 h-3.5 text-text-disabled shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-text-disabled shrink-0" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3 animate-slide-up">
          <p className="text-2xs text-text-tertiary leading-relaxed">
            HERMES uses four distinct sources of information. Understanding which one applies to
            each value helps you judge how much weight to give it.
          </p>

          <div className="space-y-2">
            <MethodologyRow
              type="OBSERVED"
              heading="Observed on-chain data"
              body="Values read directly from the Solana blockchain or stored from confirmed transactions. Pool addresses, transaction signatures, and deployment status fall into this category."
            />
            <MethodologyRow
              type="CALCULATED"
              heading="Calculated from inputs"
              body="Values derived deterministically from the parameters you provide — market cap calculations, fee percentages, liquidity distributions. Given the same inputs, HERMES always produces the same output."
            />
            <MethodologyRow
              type="SIMULATED"
              heading="Simulation model outputs"
              body="Price paths, graduation progress estimates, and capital requirements produced by the HERMES deterministic trade simulation engine. These are not real trading results — they model how a DBC curve would behave under a defined trade scenario."
            />
            <MethodologyRow
              type="ASSUMPTION"
              heading="User-supplied assumptions"
              body="Demand level, launch capital, and behavioral preferences you stated in the objective form. These are inputs to the model, not observed facts. Different assumptions produce different formation plans."
            />
            <MethodologyRow
              type="ESTIMATE"
              heading="Model estimates"
              body="Forward-looking outputs such as estimated graduation progress or days to graduation. These combine deterministic calculation with your stated assumptions. They can be wrong — especially if real demand differs from expectations."
            />
          </div>

          <p className="text-2xs text-text-disabled leading-relaxed border-t border-border pt-2">
            HERMES does not use historical market benchmarks, machine learning, or external price feeds.
            All formation logic is rule-based and auditable.
          </p>

          {contextNote && (
            <p className="text-2xs text-text-tertiary leading-relaxed border-t border-border pt-2">
              {contextNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MethodologyRow({
  type,
  heading,
  body,
}: {
  type: React.ComponentProps<typeof EvidenceBadge>['type'];
  heading: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-bg-elevated border border-border-subtle">
      <EvidenceBadge type={type} className="mt-0.5 shrink-0" />
      <div>
        <p className="text-2xs font-medium text-text-secondary">{heading}</p>
        <p className="text-2xs text-text-tertiary mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
