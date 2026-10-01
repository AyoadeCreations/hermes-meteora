'use client';

import React from 'react';
import { FlaskConical } from 'lucide-react';

/**
 * SimulationDisclaimer
 *
 * Displayed on every page that shows simulated data.
 * Explains what the simulation IS and what it is NOT —
 * critical for judges who may not know DBC.
 */
export function SimulationDisclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded border border-accent/20 bg-accent/5 text-2xs text-accent/80">
        <FlaskConical className="w-3 h-3 shrink-0" />
        <span>
          <strong className="text-accent">SIMULATED SCENARIO</strong> — deterministic math model, not a market forecast.
          Actual trading behavior depends on real demand.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-accent/20 bg-accent/5">
      <FlaskConical className="w-4 h-4 text-accent shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-medium text-accent mb-1">
          What these numbers mean
        </p>
        <p className="text-xs text-text-secondary leading-relaxed">
          Every chart and metric on this page is computed from a{' '}
          <strong className="text-text-primary">deterministic mathematical simulation</strong> of
          how the bonding curve behaves under an assumed demand scenario — not a prediction of
          actual market performance. The math uses the same concentrated liquidity model as
          Meteora DBC (CLMM). Think of it as architectural blueprints:{' '}
          <em>they describe what the structure will look like, not how many people will enter.</em>
        </p>
        <p className="text-xs text-text-tertiary mt-1.5">
          Simulation assumptions: fixed trade sizes, no MEV, no sandwich attacks, no sell pressure
          beyond scenario D. Real markets will differ.
        </p>
      </div>
    </div>
  );
}
