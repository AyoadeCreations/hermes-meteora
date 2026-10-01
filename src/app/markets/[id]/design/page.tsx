'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageLayout, MarketSubNav } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingState, ErrorState, WarningBanner } from '@/components/ui/States';
import { Stat, StatGrid } from '@/components/ui/Stat';
import type { MarketBrief, MarketDesign } from '@/domain/types';
import { OBJECTIVE_LABELS } from '@/domain/types';
import { formatPrice, formatBps, formatCompact } from '@/lib/format';
import { cn } from '@/lib/cn';
import { RefreshCw, ChevronRight, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { SimulationDisclaimer } from '@/components/ui/SimulationDisclaimer';

const CARD_COLORS = ['#5E6AD2', '#2da44e', '#d97706'] as const;

export default function DesignPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [market,     setMarket]     = useState<MarketBrief | null>(null);
  const [designs,    setDesigns]    = useState<MarketDesign[]>([]);
  const [baseline,   setBaseline]   = useState<MarketDesign | null>(null);
  const [selected,   setSelected]   = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [warnings,   setWarnings]   = useState<string[]>([]);

  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    setError(null);
    let delegatedToGenerate = false;
    try {
      const [mRes, dRes] = await Promise.all([
        fetch(`/api/markets/${id}`),
        fetch(`/api/markets/${id}/designs`),
      ]);
      if (!mRes.ok) throw new Error('Market not found');
      const { market }               = await mRes.json() as { market: MarketBrief };
      const { designs: ex, baseline: bl } = await dRes.json() as { designs: MarketDesign[]; baseline: MarketDesign | null };
      setMarket(market);
      if (ex.length > 0) {
        setDesigns(ex);
        setBaseline(bl);
        setSelected(ex[0]?.id ?? null);
      } else {
        // generate() manages its own loading state — don't setLoading(false) in finally
        delegatedToGenerate = true;
        await generate();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      if (!delegatedToGenerate) setLoading(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setLoading(false); // hand off: generate is now driving the UI state
    setError(null);
    try {
      const res  = await fetch(`/api/markets/${id}/designs`, { method: 'POST' });
      const data = await res.json() as {
        designs?: MarketDesign[];
        baseline?: MarketDesign;
        error?: string;
        violations?: Array<{ message: string }>;
      };
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      const nd = data.designs ?? [];
      setDesigns(nd);
      setBaseline(data.baseline ?? null);
      setSelected(nd[0]?.id ?? null);
      setWarnings((data.violations ?? []).filter((v) => v.message).map((v) => v.message).slice(0, 3));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <PageLayout><LoadingState message="Loading designs…" /></PageLayout>;
  if (error && !market) return <PageLayout><ErrorState message={error} /></PageLayout>;

  const selectedDesign = designs.find((d) => d.id === selected);

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Markets', href: '/' },
        { label: market?.tokenSymbol ?? id, href: `/markets/${id}` },
        { label: 'Design' },
      ]}
      actions={
        <Button variant="ghost" size="sm" loading={generating} onClick={generate}
          icon={<RefreshCw className="w-3.5 h-3.5" />}>
          Regenerate
        </Button>
      }
    >
      <MarketSubNav marketId={id} />

      <div className="mt-5 space-y-5">
        {/* Context strip */}
        {market && (
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className="font-medium text-text-secondary">{market.tokenName} ({market.tokenSymbol})</span>
            <span className="text-text-tertiary">Supply: <span className="text-text-secondary">{formatCompact(market.totalSupply)}</span></span>
            <span className="text-text-tertiary">Start: <span className="text-text-secondary">{formatPrice(market.startingPrice)}</span></span>
            <span className="text-text-tertiary">Grad: <span className="text-text-secondary">{market.graduationQuoteAmount} SOL</span></span>
            <Badge variant="accent">{OBJECTIVE_LABELS[market.objective]}</Badge>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="space-y-1.5">
            {warnings.map((w, i) => <WarningBanner key={i}>{w}</WarningBanner>)}
          </div>
        )}

        {generating && <LoadingState message="Generating candidate configurations…" />}

        {designs.length > 0 && (
          <>
            <div className="text-xs text-text-tertiary">
              Three candidate market configurations, each optimised differently for your objective.
              Scores are computed from the simulation results below.
            </div>

            <SimulationDisclaimer compact />

            {/* 3 candidate cards */}
            <div className="grid grid-cols-3 gap-4">
              {designs.map((d, idx) => (
                <DesignCard key={d.id} design={d} idx={idx} selected={selected === d.id}
                  color={CARD_COLORS[idx % CARD_COLORS.length] ?? '#c8a862'}
                  onSelect={() => setSelected(d.id)} />
              ))}
            </div>

            {/* Detail panel */}
            {selectedDesign && <DesignDetail design={selectedDesign} baseline={baseline} />}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <span className="text-xs text-text-tertiary">
                {selectedDesign
                  ? <>Selected: <span className="font-medium text-text-primary">{selectedDesign.name}</span></>
                  : 'Select a design to continue'}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" size="md" onClick={() => router.push(`/markets/${id}/simulate`)} disabled={!selected}>
                  Simulate
                </Button>
                <Button variant="secondary" size="md" onClick={() => router.push(`/markets/${id}/compare`)} disabled={designs.length < 2}>
                  Compare All
                </Button>
                <Button variant="primary" size="md" disabled={!selected}
                  iconRight={<ChevronRight className="w-4 h-4" />}
                  onClick={() => selected && router.push(`/markets/${id}/deploy?design=${selected}`)}>
                  Select & Deploy
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}

// ── Design Card ─────────────────────────────────────────────────────────────

function DesignCard({ design, idx, selected, color, onSelect }: {
  design: MarketDesign; idx: number; selected: boolean; color: string; onSelect: () => void;
}) {
  const score = (design.objectiveScore * 100).toFixed(1);
  return (
    <button type="button" onClick={onSelect} className={cn(
      'text-left p-4 rounded-xl border w-full transition-all duration-150 active:scale-[0.99]',
      selected
        ? 'border-accent bg-accent-subtle shadow-glow [background-image:linear-gradient(135deg,rgba(94,106,210,0.1)_0%,transparent_100%)]'
        : 'border-border bg-bg-surface hover:border-border-strong hover:bg-bg-elevated'
    )}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="text-2xs font-semibold uppercase tracking-widest" style={{ color }}>
            Design {String.fromCharCode(65 + idx)}
          </span>
          <h3 className="text-sm font-semibold text-text-primary mt-0.5">{design.name}</h3>
        </div>
        {selected && <CheckCircle className="w-4 h-4 text-accent shrink-0" />}
      </div>

      {/* Score bar */}
      <div className="mb-3">
        <div className="flex justify-between mb-1">
          <span className="text-2xs text-text-tertiary">Objective Score</span>
          <span className="text-xs mono font-semibold" style={{ color: selected ? color : '#9899A6' }}>{score}</span>
        </div>
        <div className="h-1 bg-bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, design.objectiveScore * 100)}%`, backgroundColor: color }} />
        </div>
      </div>

      {/* Score breakdown mini */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-2xs mb-3">
        {[
          { label: 'Price Impact', val: design.scoreBreakdown.priceImpactScore, w: design.scoreBreakdown.weights.priceImpact },
          { label: 'Capital',      val: design.scoreBreakdown.capitalFormationScore, w: design.scoreBreakdown.weights.capitalFormation },
          { label: 'Progression',  val: design.scoreBreakdown.progressionScore, w: design.scoreBreakdown.weights.progression },
          { label: 'Fees',         val: design.scoreBreakdown.feeScore, w: design.scoreBreakdown.weights.fee },
        ].map((dim) => (
          <div key={dim.label} className="flex items-center justify-between gap-1">
            <span className="text-text-tertiary">{dim.label}</span>
            <span className="mono text-text-secondary">{(dim.val * 100).toFixed(0)}</span>
          </div>
        ))}
      </div>

      {/* Key params */}
      <div className="grid grid-cols-2 gap-1.5 text-2xs border-t border-border-subtle pt-2">
        <div><span className="text-text-tertiary">Fee </span><span className="mono text-text-secondary">{formatBps(design.fees.baseFeeBps)}</span></div>
        <div><span className="text-text-tertiary">Segs </span><span className="mono text-text-secondary">{design.curve.segments.length}</span></div>
        <div><span className="text-text-tertiary">Grad </span><span className="mono text-text-secondary">{design.graduation.quoteThreshold.toFixed(0)} SOL</span></div>
        <div><span className="text-text-tertiary">Impact </span><span className="mono text-text-secondary">{design.simulation.averagePriceImpact.toFixed(1)}%</span></div>
      </div>

      {design.warnings.length > 0 && (
        <div className="mt-2 flex items-center gap-1 text-2xs text-warning">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>{design.warnings.length} warning{design.warnings.length > 1 ? 's' : ''}</span>
        </div>
      )}
    </button>
  );
}

// ── Design Detail ────────────────────────────────────────────────────────────

function DesignDetail({ design, baseline }: { design: MarketDesign; baseline: MarketDesign | null }) {
  const sim = design.simulation;
  const gradPct = (sim.quoteAtGraduation / design.graduation.quoteThreshold * 100).toFixed(1);

  return (
    <Card elevated>
      {/* WHY THIS DESIGN */}
      <div className="flex items-start gap-2 mb-4 p-3 rounded bg-accent-subtle border border-accent/20">
        <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-accent mb-1">Why this design?</p>
          <p className="text-xs text-text-secondary leading-relaxed">{design.description}</p>
        </div>
      </div>

      {/* Simulation summary */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-widest text-text-tertiary">Simulation Summary</h3>
        <Badge variant="muted">Scenario B — Medium buys</Badge>
      </div>

      <StatGrid cols={4} className="mb-4">
        <Stat label="Starting Price"   value={formatPrice(sim.startingPrice)} size="sm" />
        <Stat label="Final Price"      value={formatPrice(sim.finalPrice)}    size="sm" />
        <Stat label="Avg Price Impact" value={`${sim.averagePriceImpact.toFixed(2)}%`} size="sm" />
        <Stat label="Total Fees"       value={`${sim.totalFees.toFixed(4)} SOL`}       size="sm" />
      </StatGrid>

      <StatGrid cols={4} className="mb-4">
        <Stat label="Graduation Progress" value={`${gradPct}%`} sub={sim.graduationReached ? '🎓 Reached' : 'Not reached'} size="sm" />
        <Stat label="Capital Required"    value={`${sim.capitalRequired.toFixed(2)} SOL`} size="sm" />
        <Stat label="Trades"              value={sim.tradeCount.toString()} size="sm" />
        <Stat label="Liq. Utilization"    value={`${(sim.liquidityUtilization * 100).toFixed(1)}%`} size="sm" />
      </StatGrid>

      {/* Objective score breakdown — full */}
      <div className="border-t border-border pt-4 mb-4">
        <h4 className="text-2xs uppercase tracking-widest text-text-tertiary mb-3">
          Objective Score Breakdown
          <span className="ml-2 text-text-tertiary normal-case">(score × weight → contribution)</span>
        </h4>
        <div className="space-y-2">
          {[
            { label: 'Price Impact Score',      desc: 'Lower avg impact → higher score (decay at 10%)',   val: design.scoreBreakdown.priceImpactScore,      w: design.scoreBreakdown.weights.priceImpact },
            { label: 'Capital Formation Score', desc: 'Graduation progress in simulation (linear 0→1)',    val: design.scoreBreakdown.capitalFormationScore,  w: design.scoreBreakdown.weights.capitalFormation },
            { label: 'Price Progression Score', desc: 'Smoothness of price path (1 − CV of step sizes)',  val: design.scoreBreakdown.progressionScore,       w: design.scoreBreakdown.weights.progression },
            { label: 'Fee Efficiency Score',    desc: 'Fee rate proximity to 3% of capital (decay at 4%)',val: design.scoreBreakdown.feeScore,               w: design.scoreBreakdown.weights.fee },
          ].map((dim) => {
            const contribution = dim.val * dim.w;
            return (
              <div key={dim.label} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center text-xs">
                <div>
                  <span className="text-text-primary">{dim.label}</span>
                  <p className="text-2xs text-text-tertiary">{dim.desc}</p>
                </div>
                <span className="mono text-text-secondary text-right">{(dim.val * 100).toFixed(0)}</span>
                <span className="text-text-tertiary">× {(dim.w * 100).toFixed(0)}%</span>
                <span className="mono text-accent font-medium text-right">= {(contribution * 100).toFixed(1)}</span>
              </div>
            );
          })}
          <div className="flex justify-end pt-2 border-t border-border-subtle">
            <span className="text-xs text-text-tertiary mr-2">Total Score</span>
            <span className="text-sm font-medium mono text-accent">{(design.objectiveScore * 100).toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Baseline comparison */}
      {baseline && (
        <div className="border-t border-border pt-4 mb-4">
          <h4 className="text-2xs uppercase tracking-widest text-text-tertiary mb-3">vs Baseline Market</h4>
          <div className="grid grid-cols-4 gap-3 text-xs">
            {[
              {
                label: 'Avg Price Impact',
                designed: `${sim.averagePriceImpact.toFixed(2)}%`,
                base:     `${baseline.simulation.averagePriceImpact.toFixed(2)}%`,
                better:   sim.averagePriceImpact < baseline.simulation.averagePriceImpact,
              },
              {
                label: 'Graduation Progress',
                designed: `${(sim.quoteAtGraduation / design.graduation.quoteThreshold * 100).toFixed(1)}%`,
                base:     `${(baseline.simulation.quoteAtGraduation / baseline.graduation.quoteThreshold * 100).toFixed(1)}%`,
                better:   sim.quoteAtGraduation > baseline.simulation.quoteAtGraduation,
              },
              {
                label: 'Fee',
                designed: formatBps(design.fees.baseFeeBps),
                base:     formatBps(baseline.fees.baseFeeBps),
                better:   null,
              },
              {
                label: 'Objective Score',
                designed: (design.objectiveScore * 100).toFixed(1),
                base:     (baseline.objectiveScore * 100).toFixed(1),
                better:   design.objectiveScore > baseline.objectiveScore,
              },
            ].map((row) => (
              <div key={row.label} className="p-2 rounded bg-bg-muted border border-border-subtle">
                <p className="text-2xs text-text-tertiary mb-1">{row.label}</p>
                <p className="mono text-text-primary font-medium">{row.designed}</p>
                <p className="mono text-text-tertiary text-2xs">Baseline: {row.base}</p>
                {row.better !== null && (
                  <p className={cn('text-2xs font-medium mt-0.5', row.better ? 'text-success' : 'text-danger')}>
                    {row.better ? '▲ Better' : '▼ Worse'}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="text-2xs text-text-tertiary mt-2">
            Under identical simulated demand (Scenario B). Baseline uses 4 segments, uniform liquidity, 3% fee — no objective optimisation.
          </p>
        </div>
      )}

      {/* Warnings */}
      {design.warnings.length > 0 && (
        <div className="border-t border-border pt-4 space-y-1.5">
          {design.warnings.map((w, i) => <WarningBanner key={i}>{w}</WarningBanner>)}
        </div>
      )}
    </Card>
  );
}
