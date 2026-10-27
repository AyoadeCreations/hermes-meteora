'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, Link2, ArrowUpRight } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Stat, StatGrid } from '@/components/ui/Stat';
import { EvidenceBadge } from '@/components/ui/EvidenceBadge';
import { SniperStressTest } from '@/components/simulation/SniperStressTest';
import { OBJECTIVE_LABELS, type MarketDesign, type MarketObjective } from '@/domain/types';
import { curveShape, organicAssumptions } from '@/lib/report';
import { formatPrice, formatDate } from '@/lib/format';

export interface ReportMarket {
  tokenName:             string;
  tokenSymbol:           string;
  totalSupply:           number;
  startingPrice:         number;
  graduationQuoteAmount: number;
  objective:             MarketObjective;
}

const TOOLTIP_STYLE = {
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid rgba(12,12,20,0.09)',
  borderRadius: 14,
  boxShadow: '0 16px 40px -12px rgba(12,12,20,0.22)',
};

function pctBar(v: number) {
  return `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%`;
}

export function ReportView({ market, design }: { market: ReportMarket; design: MarketDesign }) {
  const [copied, setCopied] = useState(false);
  const shape = curveShape(design);
  const { count, size } = organicAssumptions(design);
  const sim = design.simulation;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable: the address bar still has the link */
    }
  }

  const breakdown = [
    { label: 'Price impact',      score: design.scoreBreakdown.priceImpactScore,      weight: design.scoreBreakdown.weights.priceImpact },
    { label: 'Capital formation', score: design.scoreBreakdown.capitalFormationScore, weight: design.scoreBreakdown.weights.capitalFormation },
    { label: 'Price progression', score: design.scoreBreakdown.progressionScore,      weight: design.scoreBreakdown.weights.progression },
    { label: 'Fees',              score: design.scoreBreakdown.feeScore,              weight: design.scoreBreakdown.weights.fee },
  ];

  return (
    <div className="min-h-screen">
      <header className="max-w-4xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <Image src="/hermes-logo.png" alt="" width={32} height={32} className="h-8 w-8" />
          <span className="font-semibold text-[16px] leading-none text-text-primary" style={{ letterSpacing: '-0.04em' }}>
            HERMES
          </span>
        </Link>
        <button
          type="button"
          onClick={copyLink}
          className="h-9 px-4 rounded-full hairline text-sm font-medium text-text-primary inline-flex items-center gap-2 hover:bg-white/80 active:scale-[0.97] transition-[background-color,transform] duration-200"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Link2 className="w-3.5 h-3.5" />}
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-5 md:px-8 pb-24 space-y-6">
        {/* Hero */}
        <section className="pt-8 md:pt-14 pb-4">
          <p className="eyebrow mb-4">Launch report · {formatDate(design.createdAt)}</p>
          <h1 className="display display-lg leading-[1.02]">
            {market.tokenName}{' '}
            <span className="serif-i">launch plan.</span>
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{market.tokenSymbol}</Badge>
            <Badge variant="muted">{design.name}</Badge>
            {OBJECTIVE_LABELS[design.objective].trim().toLowerCase() !== design.name.trim().toLowerCase() && (
              <Badge variant="muted">{OBJECTIVE_LABELS[design.objective]}</Badge>
            )}
          </div>
          {design.description && (
            <p className="mt-5 text-base text-text-secondary max-w-2xl leading-relaxed">{design.description}</p>
          )}
        </section>

        {/* Key facts */}
        <Card>
          <StatGrid cols={4}>
            <Stat label="Starting price"    value={formatPrice(market.startingPrice)} size="sm" />
            <Stat label="Graduation target" value={`${design.graduation.quoteThreshold} SOL`} size="sm" />
            <Stat label="Base fee"          value={`${(design.fees.baseFeeBps / 100).toFixed(2)}%`} size="sm" />
            <Stat label="Objective fit"     value={`${Math.round(design.objectiveScore * 100)}/100`} size="sm" />
          </StatGrid>
        </Card>

        {/* Curve */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="eyebrow">Price curve</h2>
            <EvidenceBadge type="CALCULATED" />
          </div>
          <p className="text-sm text-text-secondary mb-4 max-w-2xl">
            The price a buyer pays as more SOL flows in, from {formatPrice(shape[0]?.price ?? 0)} up to{' '}
            {formatPrice(shape[shape.length - 1]?.price ?? 0)} at graduation.
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={shape}>
              <defs>
                <linearGradient id="rptGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6A3DF0" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#6A3DF0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(12,12,20,0.06)" />
              <XAxis dataKey="quote" type="number" domain={[0, 'dataMax']}
                tickFormatter={(v: number) => `${v.toFixed(0)}`} minTickGap={32}
                tick={{ fill: '#85868F', fontSize: 10 }}
                label={{ value: 'SOL raised', position: 'insideBottomRight', offset: -2, fill: '#85868F', fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => v.toExponential(1)} tick={{ fill: '#85868F', fontSize: 10 }} width={56} />
              <Tooltip contentStyle={TOOLTIP_STYLE}
                formatter={(v: number) => [v.toFixed(8), 'Price']}
                labelFormatter={(v: number) => `${Number(v).toFixed(1)} SOL raised`} />
              <Area type="linear" dataKey="price" stroke="#6A3DF0" strokeWidth={2} fill="url(#rptGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Simulated launch */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="eyebrow">Simulated launch</h2>
            <EvidenceBadge type="SIMULATED" />
          </div>
          <StatGrid cols={4}>
            <Stat label="Final price"   value={formatPrice(sim.finalPrice)} size="sm" />
            <Stat label="Avg impact"    value={`${sim.averagePriceImpact.toFixed(2)}%`} size="sm" />
            <Stat label="Max impact"    value={`${sim.maxPriceImpact.toFixed(2)}%`} size="sm" />
            <Stat label="Graduation"    value={sim.graduationReached ? 'Reached' : `${Math.min(100, (sim.quoteAtGraduation / Math.max(design.graduation.quoteThreshold, 1e-9)) * 100).toFixed(0)}%`} size="sm" />
          </StatGrid>
          <p className="text-xs text-text-tertiary mt-4">
            {sim.tradeCount} simulated trades under the design&rsquo;s assumed demand. A model of how the curve behaves, not a forecast of how many people will trade.
          </p>
        </Card>

        {/* Stress test */}
        <SniperStressTest design={design} organicCount={count} organicSizeQuote={size} />

        {/* Score */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="eyebrow">How the design scores</h2>
            <EvidenceBadge type="CALCULATED" />
          </div>
          <div className="space-y-3">
            {breakdown.map((b) => (
              <div key={b.label}>
                <div className="flex items-baseline justify-between text-xs mb-1.5">
                  <span className="text-text-primary font-medium">{b.label}</span>
                  <span className="font-mono text-text-tertiary">
                    {Math.round(b.score * 100)} · weight {Math.round(b.weight * 100)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-black/[0.05] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: pctBar(b.score), background: 'linear-gradient(90deg,#FFB347,#F0368C 55%,#6A3DF0)' }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {design.warnings.length > 0 && (
          <Card>
            <h2 className="eyebrow mb-3">Known tradeoffs</h2>
            <ul className="space-y-2">
              {design.warnings.map((w, i) => (
                <li key={i} className="text-sm text-text-secondary flex gap-2">
                  <span className="mt-2 w-1 h-1 rounded-full bg-warning shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* About + CTA */}
        <section className="pt-6 text-center space-y-4">
          <p className="text-xs text-text-tertiary max-w-xl mx-auto leading-relaxed">
            This report comes from a simulation of a Meteora Dynamic Bonding Curve design. It has not been deployed
            and does not predict real trading. Figures labelled Simulated or Illustrative rest on stated assumptions.
          </p>
          <Link
            href="/markets/new"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-ink text-white text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-[opacity,transform] duration-200"
          >
            Rehearse your own launch <ArrowUpRight className="w-4 h-4" />
          </Link>
        </section>
      </main>
    </div>
  );
}
