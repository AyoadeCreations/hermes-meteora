'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageLayout, MarketSubNav } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/States';
import { Stat, StatGrid } from '@/components/ui/Stat';
import type { MarketBrief, MarketDesign, MarketObservation } from '@/domain/types';
import { formatPrice, formatPercent } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();

  const [market,       setMarket]       = useState<MarketBrief | null>(null);
  const [designs,      setDesigns]      = useState<MarketDesign[]>([]);
  const [observations, setObservations] = useState<MarketObservation[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const [mRes, dRes, oRes] = await Promise.all([
        fetch(`/api/markets/${id}`),
        fetch(`/api/markets/${id}/designs`),
        fetch(`/api/markets/${id}/observations`),
      ]);
      const { market }        = await mRes.json() as { market: MarketBrief };
      const { designs }       = await dRes.json() as { designs: MarketDesign[] };
      const { observations }  = await oRes.json() as { observations: MarketObservation[] };
      setMarket(market);
      setDesigns(designs);
      setObservations(observations);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <PageLayout><LoadingState /></PageLayout>;

  // Use best-scoring design as the "designed" reference
  const refDesign = designs[0];
  const sim = refDesign?.simulation;
  const latestObs = observations[observations.length - 1];

  // Build overlay chart: designed price path vs actual observations
  const maxLen = Math.max(sim?.pricePath.length ?? 0, observations.length);
  const overlayData = Array.from({ length: maxLen }, (_, i) => ({
    index:    i,
    designed: sim?.pricePath[i]?.price,
    actual:   observations[i]?.price,
  }));

  // Variance calculations
  const priceDiff   = latestObs && sim
    ? ((latestObs.price - sim.finalPrice) / (sim.finalPrice || 1)) * 100
    : null;
  const gradDiff    = latestObs && refDesign
    ? latestObs.graduationProgress -
      ((sim?.quoteAtGraduation ?? 0) / (refDesign.graduation.quoteThreshold || 1)) * 100
    : null;

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Markets', href: '/' },
        { label: market?.tokenSymbol ?? id, href: `/markets/${id}` },
        { label: 'Analysis' },
      ]}
    >
      <MarketSubNav marketId={id} />

      <div className="mt-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-medium text-text-primary">Designed vs Actual</h2>
            <p className="text-xs text-text-tertiary mt-1">
              Compares original simulation assumptions against observed market behavior.
              These are observations — not claims of prediction.
            </p>
          </div>
          {refDesign && <Badge variant="accent">{refDesign.name}</Badge>}
        </div>

        {/* Variance summary */}
        {(priceDiff !== null || gradDiff !== null) ? (
          <div className="grid grid-cols-3 gap-4">
            {([
              {
                label:    'Price Variance',
                designed: sim ? formatPrice(sim.finalPrice) : '—',
                actual:   latestObs ? formatPrice(latestObs.price) : 'No data',
                variance: priceDiff,
              },
              {
                label:    'Graduation Progress Variance',
                designed: sim && refDesign
                  ? `${((sim.quoteAtGraduation / refDesign.graduation.quoteThreshold) * 100).toFixed(1)}%`
                  : '—',
                actual:   latestObs ? `${latestObs.graduationProgress.toFixed(1)}%` : 'No data',
                variance: gradDiff,
              },
              {
                label:    'Capital Variance',
                designed: sim ? `${sim.capitalRequired.toFixed(2)} SOL` : '—',
                actual:   latestObs ? `${latestObs.quoteReserve.toFixed(2)} SOL` : 'No data',
                variance: latestObs && sim
                  ? ((latestObs.quoteReserve - sim.capitalRequired) / (sim.capitalRequired || 1)) * 100
                  : null,
              },
            ] as Array<{ label: string; designed: string; actual: string; variance: number | null }>).map(
              (card, i) => (
                <div
                  key={card.label}
                  className="animate-slide-up"
                  style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
                >
                  <VarianceCard {...card} />
                </div>
              )
            )}
          </div>
        ) : (
          <div className="p-4 rounded-lg border border-border bg-bg-surface text-xs text-text-tertiary text-center">
            Not enough live observations yet. Deploy the market and allow on-chain activity to accumulate before this comparison is meaningful.
          </div>
        )}

        {/* Overlay chart */}
        {sim && (
          <Card>
            <h4 className="text-2xs uppercase tracking-widest text-text-tertiary mb-1">Price Path: Designed vs Actual</h4>
            <p className="text-2xs text-text-tertiary mb-3">
              <span className="text-accent">Gold dashed</span> = designed simulation (Scenario {sim.scenario}) — SIMULATED, not a forecast &nbsp;·&nbsp;
              <span className="text-danger">Red solid</span> = actual on-chain observations (LIVE DATA)
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={overlayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
                <XAxis dataKey="index" tick={{ fill: '#60607a', fontSize: 10 }} />
                <YAxis tickFormatter={(v: number) => v.toFixed(6)} tick={{ fill: '#60607a', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#18181c', border: '1px solid #2a2a35', borderRadius: 6 }}
                  formatter={(v: number, name: string) => [v.toFixed(8), name === 'designed' ? 'Designed' : 'Actual']}
                />
                <Legend formatter={(v: string) => (
                  <span style={{ color: '#a0a0b0', fontSize: 11 }}>{v === 'designed' ? 'Designed (Simulated)' : 'Actual Observed'}</span>
                )} />
                <Line type="monotone" dataKey="designed" stroke="#c8a862" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="actual"   stroke="#e05050" dot={false} strokeWidth={1.5} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Simulation parameters used */}
        {refDesign && sim && (
          <Card>
            <h4 className="text-2xs uppercase tracking-widest text-text-tertiary mb-3">Simulation Assumptions Used</h4>
            <div className="grid grid-cols-4 gap-3 text-xs">
              {[
                { label: 'Scenario',        value: `${sim.scenario} — ${sim.scenario === 'A' ? 'Small buys' : sim.scenario === 'B' ? 'Medium buys' : sim.scenario === 'C' ? 'Large buy' : 'Mixed'}` },
                { label: 'Trades Simulated', value: sim.tradeCount.toString() },
                { label: 'Exp. Final Price', value: formatPrice(sim.finalPrice) },
                { label: 'Exp. Avg Impact',  value: `${sim.averagePriceImpact.toFixed(2)}%` },
              ].map((row) => (
                <div key={row.label} className="p-2.5 rounded bg-bg-muted border border-border-subtle">
                  <p className="text-2xs text-text-tertiary">{row.label}</p>
                  <p className="text-sm font-medium text-text-secondary mt-0.5 mono">{row.value}</p>
                </div>
              ))}
            </div>
            <p className="text-2xs text-text-tertiary mt-3">
              These were deterministic scenario assumptions, not forecasts. Actual market behavior depends on real demand.
            </p>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}

function VarianceCard({
  label, designed, actual, variance,
}: {
  label:    string;
  designed: string;
  actual:   string;
  variance: number | null;
}) {
  return (
    <Card>
      <p className="text-2xs text-text-tertiary mb-3 uppercase tracking-widest font-medium">{label}</p>
      <div className="space-y-2">
        <div className="flex items-center justify-between py-1">
          <span className="text-2xs text-text-tertiary">Designed</span>
          <span className="text-xs mono text-accent">{designed}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-2xs text-text-tertiary">Actual</span>
          <span className="text-xs mono text-text-primary">{actual}</span>
        </div>
        {variance !== null && (
          <div className={cn(
            'flex items-center justify-between py-1.5 px-2 rounded',
            'border-t border-border-subtle mt-1',
            'transition-[background-color] duration-150',
            variance > 0
              ? 'bg-success/5'
              : variance < 0
              ? 'bg-danger/5'
              : 'bg-transparent'
          )}>
            <span className="text-2xs text-text-tertiary">Variance</span>
            <span className={cn(
              'text-xs font-medium mono',
              variance > 0 ? 'text-success' : variance < 0 ? 'text-danger' : 'text-text-secondary'
            )}>
              {formatPercent(variance)}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
