'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageLayout, MarketSubNav } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/States';
import type { MarketDesign } from '@/domain/types';
import { formatPrice, formatBps, formatScore } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { ChevronRight } from 'lucide-react';
import { SimulationDisclaimer } from '@/components/ui/SimulationDisclaimer';

const DESIGN_COLORS  = ['#5E6AD2', '#2da44e', '#d97706'];
const BASELINE_COLOR = '#5C5D6E';
const DESIGN_LABELS  = ['A', 'B', 'C'];

export default function ComparePage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [designs,  setDesigns]  = useState<MarketDesign[]>([]);
  const [baseline, setBaseline] = useState<MarketDesign | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch(`/api/markets/${id}/designs`);
      const data = await res.json() as { designs: MarketDesign[]; baseline: MarketDesign | null };
      setDesigns(data.designs ?? []);
      setBaseline(data.baseline ?? null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <PageLayout><LoadingState /></PageLayout>;

  // Index of the best-scoring design (designs are sorted DESC by the API,
  // but re-compute defensively so the badge is always accurate)
  const bestIdx = designs.reduce(
    (best, d, i) => (d.objectiveScore > (designs[best]?.objectiveScore ?? -1) ? i : best),
    0
  );

  // All designs including baseline for charting
  const allDesigns = baseline ? [...designs, baseline] : designs;

  // Build comparison table rows
  const rows: Array<{ label: string; key: string; format: (d: MarketDesign) => string; highlight?: (values: string[]) => number | null }> = [
    { label: 'Starting Price',   key: 'start',  format: (d) => formatPrice(d.simulation.startingPrice) },
    { label: 'Final Price',      key: 'final',  format: (d) => formatPrice(d.simulation.finalPrice) },
    { label: 'Capital Required', key: 'cap',    format: (d) => `${d.simulation.capitalRequired.toFixed(2)} SOL` },
    { label: 'Avg Price Impact', key: 'impact', format: (d) => `${d.simulation.averagePriceImpact.toFixed(2)}%` },
    { label: 'Max Price Impact', key: 'maximp', format: (d) => `${d.simulation.maxPriceImpact.toFixed(2)}%` },
    { label: 'Total Fees',       key: 'fees',   format: (d) => `${d.simulation.totalFees.toFixed(4)} SOL` },
    { label: 'Grad Progress',    key: 'grad',   format: (d) => `${((d.simulation.quoteAtGraduation / d.graduation.quoteThreshold) * 100).toFixed(1)}%` },
    { label: 'Base Fee',         key: 'bfee',   format: (d) => formatBps(d.fees.baseFeeBps) },
    { label: 'Dynamic Fee',      key: 'dfee',   format: (d) => d.fees.dynamicFeeEnabled ? 'Yes' : 'No' },
    { label: 'Curve Segments',   key: 'segs',   format: (d) => d.curve.segments.length.toString() },
    { label: 'Objective Score',  key: 'score',  format: (d) => formatScore(d.objectiveScore) },
  ];

  // Build merged price path for chart (all designs + baseline)
  const maxLen = Math.max(...allDesigns.map((d) => d.simulation.pricePath.length));
  const chartData = Array.from({ length: maxLen }, (_, i) => {
    const point: Record<string, number | undefined> = { trade: i };
    designs.forEach((d, idx) => {
      const p = d.simulation.pricePath[i];
      point[`design${idx}`] = p?.price;
    });
    if (baseline) {
      const p = baseline.simulation.pricePath[i];
      point['baseline'] = p?.price;
    }
    return point;
  });

  // Build capital accumulation chart data
  const capData = Array.from({ length: maxLen }, (_, i) => {
    const point: Record<string, number | undefined> = { trade: i };
    designs.forEach((d, idx) => {
      const p = d.simulation.quoteAccumulation[i];
      point[`design${idx}`] = p?.quoteAccumulated;
    });
    if (baseline) {
      const p = baseline.simulation.quoteAccumulation[i];
      point['baseline'] = p?.quoteAccumulated;
    }
    return point;
  });

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Markets', href: '/' },
        { label: id.slice(0, 8), href: `/markets/${id}` },
        { label: 'Compare' },
      ]}
    >
      <MarketSubNav marketId={id} />

      <div className="mt-6 space-y-5">
        {/* Simulation disclaimer */}
        <SimulationDisclaimer />

        {/* Scenario label */}
        <div className="flex items-center gap-2">
          <Badge variant="muted">Scenario B — Medium buys</Badge>
          <span className="text-2xs text-text-tertiary">Identical simulation conditions applied to all designs</span>
          {baseline && (
            <span className="ml-auto text-2xs text-text-tertiary">
              <span style={{ color: BASELINE_COLOR }}>■</span> Baseline = default 4-segment uniform curve, 3% fee, no objective optimisation
            </span>
          )}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <h4 className="text-2xs uppercase tracking-widest text-text-tertiary mb-3">
              SIMULATED Price Curves
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="trade" tick={{ fill: '#5C5D6E', fontSize: 10 }} />
                <YAxis tickFormatter={(v: number) => v.toFixed(6)} tick={{ fill: '#5C5D6E', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#111116', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}
                  formatter={(v: number, name: string) => {
                    if (name === 'baseline') return [v.toFixed(8), 'Baseline'];
                    const idx = parseInt(name.replace('design', ''));
                    return [v.toFixed(8), `${DESIGN_LABELS[idx]} — ${designs[idx]?.name ?? name}`];
                  }}
                />
                <Legend formatter={(value: string) => {
                  if (value === 'baseline') return <span style={{ color: '#9899A6', fontSize: 11 }}>Baseline</span>;
                  const idx = parseInt(value.replace('design', ''));
                  return <span style={{ color: '#9899A6', fontSize: 11 }}>{DESIGN_LABELS[idx]} — {designs[idx]?.name}</span>;
                }} />
                {designs.map((_, idx) => (
                  <Line key={idx} type="monotone" dataKey={`design${idx}`}
                    stroke={DESIGN_COLORS[idx] ?? '#5E6AD2'} dot={false} strokeWidth={2} />
                ))}
                {baseline && (
                  <Line type="monotone" dataKey="baseline"
                    stroke={BASELINE_COLOR} dot={false} strokeWidth={1} strokeDasharray="4 3" />
                )}
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h4 className="text-2xs uppercase tracking-widest text-text-tertiary mb-3">
              SIMULATED Capital Formation
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={capData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="trade" tick={{ fill: '#5C5D6E', fontSize: 10 }} />
                <YAxis tickFormatter={(v: number) => `${v.toFixed(0)} SOL`} tick={{ fill: '#5C5D6E', fontSize: 10 }} width={60} />
                <Tooltip
                  contentStyle={{ background: '#111116', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}
                  formatter={(v: number, name: string) => {
                    if (name === 'baseline') return [`${v.toFixed(4)} SOL`, 'Baseline'];
                    const idx = parseInt(name.replace('design', ''));
                    return [`${v.toFixed(4)} SOL`, `${DESIGN_LABELS[idx]} — ${designs[idx]?.name ?? name}`];
                  }}
                />
                <Legend formatter={(value: string) => {
                  if (value === 'baseline') return <span style={{ color: '#9899A6', fontSize: 11 }}>Baseline</span>;
                  const idx = parseInt(value.replace('design', ''));
                  return <span style={{ color: '#9899A6', fontSize: 11 }}>{DESIGN_LABELS[idx]} — {designs[idx]?.name}</span>;
                }} />
                {designs.map((_, idx) => (
                  <Line key={idx} type="monotone" dataKey={`design${idx}`}
                    stroke={DESIGN_COLORS[idx] ?? '#5E6AD2'} dot={false} strokeWidth={2} />
                ))}
                {baseline && (
                  <Line type="monotone" dataKey="baseline"
                    stroke={BASELINE_COLOR} dot={false} strokeWidth={1} strokeDasharray="4 3" />
                )}
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Comparison table */}
        <Card noPad>
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="text-left py-2.5 px-4 text-2xs uppercase tracking-widest text-text-tertiary border-b border-border">
                  Metric
                </th>
                {designs.map((d, i) => (
                  <th key={d.id} className="py-2.5 px-4 text-right border-b border-border">
                    <button
                      type="button"
                      onClick={() => setSelected(d.id)}
                      className={cn(
                        'text-2xs font-medium uppercase tracking-wide',
                        // Specific transitions — never shorthand
                        'transition-[color,transform] duration-150 ease-cinema',
                        'active:scale-[0.97]',
                        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded',
                        selected === d.id
                          ? 'text-accent'
                          : 'text-text-secondary hover:text-text-primary'
                      )}
                    >
                      {DESIGN_LABELS[i]} — {d.name}
                    </button>
                  </th>
                ))}
                {baseline && (
                  <th className="py-2.5 px-4 text-right border-b border-border">
                    <span className="text-2xs font-medium uppercase tracking-wide" style={{ color: BASELINE_COLOR }}>
                      Baseline
                    </span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="hover:bg-bg-muted/50">
                  <td className="py-2 px-4 text-xs text-text-secondary border-b border-border-subtle">{row.label}</td>
                  {designs.map((d, i) => {
                    const val     = row.format(d);
                    const isScore = row.key === 'score';
                    return (
                      <td key={d.id} className={cn(
                        'py-2 px-4 text-right text-xs mono border-b border-border-subtle',
                        isScore ? 'text-accent font-medium' : 'text-text-primary'
                      )}>
                        {val}
                        {isScore && i === bestIdx && designs.length > 1 && (
                          <span className="ml-1 text-2xs text-success">▲ Best</span>
                        )}
                      </td>
                    );
                  })}
                  {baseline && (
                    <td className="py-2 px-4 text-right text-xs mono border-b border-border-subtle text-text-tertiary italic">
                      {row.format(baseline)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {baseline && (
            <p className="px-4 py-2 text-2xs text-text-tertiary border-t border-border-subtle italic">
              Baseline is shown for reference only. It uses a simple default configuration with no objective optimisation.
              Under identical simulated demand, differences reflect the impact of market design choices.
            </p>
          )}
        </Card>

        {/* Objective score bars — includes baseline */}
        <Card>
          <h4 className="text-2xs uppercase tracking-widest text-text-tertiary mb-3">
            Objective Score Breakdown
          </h4>
          <div className="space-y-3">
            {designs.map((d, idx) => (
              <div key={d.id} className="flex items-center gap-3">
                <span className="text-xs text-text-secondary w-40 shrink-0 truncate">
                  {DESIGN_LABELS[idx]} — {d.name}
                </span>
                <div className="flex-1 h-1.5 bg-bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-cinema"
                    style={{
                      width: `${d.objectiveScore * 100}%`,
                      backgroundColor: DESIGN_COLORS[idx] ?? '#c8a862',
                      transitionDelay: `${idx * 80}ms`,
                    }}
                  />
                </div>
                <span className="text-xs mono text-text-secondary w-10 text-right shrink-0">
                  {formatScore(d.objectiveScore)}
                </span>
              </div>
            ))}
            {baseline && (
              <div className="flex items-center gap-3 border-t border-border-subtle pt-3 mt-1">
                <span className="text-xs w-40 shrink-0 truncate italic" style={{ color: BASELINE_COLOR }}>
                  Baseline
                </span>
                <div className="flex-1 h-1.5 bg-bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-cinema"
                    style={{
                      width: `${baseline.objectiveScore * 100}%`,
                      backgroundColor: BASELINE_COLOR,
                      transitionDelay: `${designs.length * 80}ms`,
                    }}
                  />
                </div>
                <span className="text-xs mono w-10 text-right shrink-0" style={{ color: BASELINE_COLOR }}>
                  {formatScore(baseline.objectiveScore)}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Action */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="primary"
            size="md"
            disabled={!selected || designs.length === 0}
            iconRight={<ChevronRight className="w-4 h-4" />}
            onClick={() => {
              const target = selected ?? designs[0]?.id;
              if (target) router.push(`/markets/${id}/deploy?design=${target}`);
            }}
          >
            Deploy Selected
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
