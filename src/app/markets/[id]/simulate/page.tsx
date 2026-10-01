'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { PageLayout, MarketSubNav } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { Stat, StatGrid } from '@/components/ui/Stat';
import type { MarketDesign, SimulationResult } from '@/domain/types';
import { SCENARIO_LABELS, SCENARIO_DESCRIPTIONS } from '@/domain/types';
import type { TradeScenario } from '@/domain/types';
import { formatPrice, formatBps } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Play } from 'lucide-react';
import { SimulationDisclaimer } from '@/components/ui/SimulationDisclaimer';

const SCENARIOS: TradeScenario[] = ['A', 'B', 'C', 'D'];
const CHART_COLORS = { A: '#5E6AD2', B: '#2da44e', C: '#d97706', D: '#e5534b' };

export default function SimulatePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const initialDesign = searchParams.get('design');

  const [designs,       setDesigns]       = useState<MarketDesign[]>([]);
  const [selectedDesign,setSelectedDesign] = useState<string>('');
  const [scenario,      setScenario]      = useState<TradeScenario>('B');
  const [tradeCount,    setTradeCount]    = useState('50');
  const [tradeSizeSOL,  setTradeSizeSOL]  = useState('1.7');
  const [result,        setResult]        = useState<SimulationResult | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [running,       setRunning]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  useEffect(() => { void load(); }, [id, initialDesign]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch(`/api/markets/${id}/designs`);
      const data = await res.json() as { designs: MarketDesign[] };
      setDesigns(data.designs ?? []);
      const first = initialDesign ?? data.designs[0]?.id ?? '';
      setSelectedDesign(first);
      if (first) {
        const design = data.designs.find((d) => d.id === first);
        if (design) setResult(design.simulation);
      }
    } finally {
      setLoading(false);
    }
  }

  const runSim = useCallback(async () => {
    if (!selectedDesign) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/markets/${id}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designId: selectedDesign,
          params: {
            scenario,
            tradeCount:     parseInt(tradeCount) || 50,
            tradeSizeQuote: parseFloat(tradeSizeSOL) || 1.7,
            sellFraction:   0.2,
          },
        }),
      });
      const data = await res.json() as { result?: SimulationResult; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Simulation failed');
      setResult(data.result ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setRunning(false);
    }
  }, [id, selectedDesign, scenario, tradeCount, tradeSizeSOL]);

  if (loading) return <PageLayout><LoadingState /></PageLayout>;

  const design = designs.find((d) => d.id === selectedDesign);

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Markets', href: '/' },
        { label: id.slice(0, 8), href: `/markets/${id}` },
        { label: 'Simulate' },
      ]}
    >
      <MarketSubNav marketId={id} />

      <div className="mt-6 grid grid-cols-[280px_1fr] gap-5">
        {/* Controls */}
        <div className="space-y-4">
          <Card>
            <h3 className="text-2xs uppercase tracking-widest text-text-tertiary mb-3">Design</h3>
            <Field label="Candidate">
              <Select value={selectedDesign} onChange={(e) => setSelectedDesign(e.target.value)}>
                {designs.map((d, i) => (
                  <option key={d.id} value={d.id}>
                    {String.fromCharCode(65 + i)} — {d.name}
                  </option>
                ))}
              </Select>
            </Field>
          </Card>

          <Card>
            <h3 className="text-2xs uppercase tracking-widest text-text-tertiary mb-3">Scenario</h3>
            <div className="space-y-1.5">
              {SCENARIOS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScenario(s)}
                  className={cn(
                    'w-full text-left px-2.5 py-2 rounded border text-xs',
                    // Specific transitions — never `all`
                    'transition-[background-color,border-color,color,transform] duration-150 ease-cinema',
                    // Pressed feedback
                    'active:scale-[0.98]',
                    // Focus ring
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
                    scenario === s
                      ? 'border-accent bg-accent-subtle text-accent'
                      : 'border-border text-text-secondary hover:border-border-strong hover:bg-bg-elevated hover:text-text-primary'
                  )}
                >
                  <span className="font-medium">Scenario {s}:</span>{' '}
                  {SCENARIO_LABELS[s]}
                </button>
              ))}
            </div>
            <p className="text-2xs text-text-tertiary mt-2 italic">
              {SCENARIO_DESCRIPTIONS[scenario]}
            </p>
          </Card>

          <Card>
            <h3 className="text-2xs uppercase tracking-widest text-text-tertiary mb-3">Assumptions</h3>
            <div className="space-y-3">
              <Field label="Trade Count" hint="Number of trades">
                <Input type="number" value={tradeCount} onChange={(e) => setTradeCount(e.target.value)} min={1} max={500} />
              </Field>
              <Field label="Trade Size (SOL)" hint="Per-trade quote amount">
                <Input type="number" value={tradeSizeSOL} onChange={(e) => setTradeSizeSOL(e.target.value)} step="any" min={0} />
              </Field>
            </div>
          </Card>

          <Button
            variant="primary"
            size="md"
            className="w-full"
            loading={running}
            onClick={runSim}
            icon={<Play className="w-3.5 h-3.5" />}
          >
            Run Simulation
          </Button>

          <p className="text-2xs text-text-tertiary text-center">
            SIMULATED SCENARIO — Not a market forecast
          </p>

          {error && <p className="text-2xs text-danger">{error}</p>}
        </div>

        {/* Results */}
        <div className="space-y-4">
          <SimulationDisclaimer />
          {result ? (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="muted">Scenario {result.scenario}: {SCENARIO_LABELS[result.scenario]}</Badge>
                {result.graduationReached && <Badge variant="success" dot>Graduation reached</Badge>}
              </div>

              <StatGrid cols={4}>
                <Stat label="Starting Price"  value={formatPrice(result.startingPrice)} size="sm" />
                <Stat label="Final Price"     value={formatPrice(result.finalPrice)}    size="sm" />
                <Stat label="Avg Impact"      value={`${result.averagePriceImpact.toFixed(2)}%`} size="sm" />
                <Stat label="Total Fees"      value={`${result.totalFees.toFixed(4)} SOL`} size="sm" />
              </StatGrid>

              <StatGrid cols={4}>
                <Stat label="Capital"          value={`${result.capitalRequired.toFixed(2)} SOL`} size="sm" />
                <Stat label="Grad Progress"    value={`${((result.quoteAtGraduation / (design?.graduation.quoteThreshold ?? 85)) * 100).toFixed(1)}%`} size="sm" />
                <Stat label="Trades"           value={result.tradeCount.toString()} size="sm" />
                <Stat label="Max Impact"       value={`${result.maxPriceImpact.toFixed(2)}%`} size="sm" />
              </StatGrid>

              {/* Price path chart */}
              <Card>
                <h4 className="text-2xs uppercase tracking-widest text-text-tertiary mb-3">
                  Simulated Price Path
                </h4>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={result.pricePath}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="tradeIndex" tick={{ fill: '#5C5D6E', fontSize: 10 }} />
                    <YAxis tickFormatter={(v: number) => v.toFixed(6)} tick={{ fill: '#5C5D6E', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: '#111116', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}
                      labelStyle={{ color: '#9899A6', fontSize: 11 }}
                      itemStyle={{ color: '#EDEDEF', fontSize: 12, fontFamily: 'var(--font-jetbrains)' }}
                      formatter={(v: number) => [v.toFixed(8), 'Price']}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke={CHART_COLORS[result.scenario]}
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* Capital accumulation chart */}
              <Card>
                <h4 className="text-2xs uppercase tracking-widest text-text-tertiary mb-3">
                  Capital Accumulation
                </h4>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={result.quoteAccumulation}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="tradeIndex" tick={{ fill: '#5C5D6E', fontSize: 10 }} />
                    <YAxis tickFormatter={(v: number) => `${v.toFixed(1)} SOL`} tick={{ fill: '#5C5D6E', fontSize: 10 }} width={70} />
                    <Tooltip
                      contentStyle={{ background: '#111116', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}
                      formatter={(v: number) => [`${v.toFixed(4)} SOL`, 'Accumulated']}
                    />
                    <Line type="monotone" dataKey="quoteAccumulated" stroke="#5E6AD2" dot={false} strokeWidth={2} />
                    <ReferenceLine y={design?.graduation.quoteThreshold} stroke="#2da44e" strokeDasharray="4 4" label={{ value: 'Graduation', fill: '#2da44e', fontSize: 10 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-text-tertiary text-sm">
              Configure parameters and run a simulation.
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
