'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageLayout, MarketSubNav } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { track, safeId } from '@/lib/telemetry';
import type { FormationPlan, RiskSignal } from '@/domain/types';
import type { MarketObjectiveInput } from '@/domain/market-objective';
import { AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';

type PlanWithRisks = FormationPlan & { riskSignals: RiskSignal[] };

const TIER_COLORS = {
  conservative: 'border-blue-500/40 bg-blue-500/5',
  balanced: 'border-indigo-500/40 bg-indigo-500/5',
  aggressive: 'border-amber-500/40 bg-amber-500/5',
};
const TIER_BADGE = {
  conservative: 'border-blue-500/50 text-blue-300',
  balanced: 'border-indigo-500/50 text-indigo-300',
  aggressive: 'border-amber-500/50 text-amber-300',
};

function severityIcon(s: RiskSignal['severity']) {
  if (s === 'high') return <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />;
  if (s === 'medium') return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  return <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0" />;
}

export default function PlansPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [plans, setPlans] = useState<PlanWithRisks[]>([]);
  const [objective, setObjective] = useState<MarketObjectiveInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [expandedRisks, setExpandedRisks] = useState<Record<string, boolean>>({});

  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/markets/${id}/plans`);
      if (!res.ok) {
        const { error: e } = await res.json() as { error?: string };
        if (res.status === 422) {
          setError('complete-objective');
        } else {
          setError(e ?? 'Failed to load plans');
        }
        return;
      }
      const data = await res.json() as { plans: PlanWithRisks[]; objective: MarketObjectiveInput };
      setPlans(data.plans);
      setObjective(data.objective);

      // Pre-select the recommended plan
      const rec = data.plans.find((p) => p.isRecommended);
      if (rec) setSelected(rec.id);

      track('formation_plans_generated', { marketId: safeId(id) });
    } catch {
      setError('Failed to load formation plans.');
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(planId: string) {
    setSelected(planId);
    track('formation_plan_selected', { marketId: safeId(id) });
  }

  function handleContinue() {
    if (!selected) return;
    const plan = plans.find((p) => p.id === selected);
    track('formation_plan_viewed', { marketId: safeId(id) });
    // Navigate to verify with selected plan + trigger design generation
    router.push(`/markets/${id}/verify?plan=${selected}&tier=${plan?.tier ?? ''}`);
  }

  if (loading) return <LoadingState message="Generating formation plans…" />;

  if (error === 'complete-objective') {
    return (
      <PageLayout breadcrumbs={[{ label: 'Markets', href: '/markets' }, { label: id }, { label: 'Plans' }]} title="Formation Plans">
        <MarketSubNav marketId={id} />
        <div className="max-w-lg">
          <Card className="p-6 text-center space-y-4">
            <p className="text-zinc-300">Complete the Market Objective step before generating plans.</p>
            <Button onClick={() => router.push(`/markets/${id}/objective`)}>Set Market Objective →</Button>
          </Card>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout breadcrumbs={[{ label: 'Markets', href: '/markets' }, { label: id }, { label: 'Plans' }]} title="Formation Plans">
        <MarketSubNav marketId={id} />
        <p className="text-red-400">{error}</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      breadcrumbs={[{ label: 'Markets', href: '/markets' }, { label: id, href: `/markets/${id}` }, { label: 'Plans' }]}
      title="Formation Plans"
      subtitle="Three candidate market configurations derived from your objective. Select one to continue."
    >
      <MarketSubNav marketId={id} />

      {/* Objective summary strip */}
      {objective && (
        <div className="flex flex-wrap gap-2 mb-6">
          <Badge variant="outline">{objective.assetType}</Badge>
          <Badge variant="outline">{objective.expectedDemand} demand</Badge>
          <Badge variant="outline">{objective.launchCapital} SOL capital</Badge>
          <Badge variant="outline">{objective.riskPreference} risk</Badge>
          <button
            onClick={() => router.push(`/markets/${id}/objective`)}
            className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
          >
            edit objective
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {plans.map((plan) => {
          const isSelected = selected === plan.id;
          const risksExpanded = expandedRisks[plan.id];
          const highRisks = plan.riskSignals.filter((r) => r.severity === 'high').length;
          const medRisks = plan.riskSignals.filter((r) => r.severity === 'medium').length;

          return (
            <div
              key={plan.id}
              onClick={() => handleSelect(plan.id)}
              className={cn(
                'rounded-xl border-2 cursor-pointer transition-all p-5 space-y-4',
                isSelected
                  ? 'border-indigo-500 bg-indigo-500/8 ring-1 ring-indigo-500/30'
                  : TIER_COLORS[plan.tier]
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded border capitalize', TIER_BADGE[plan.tier])}>
                      {plan.tier}
                    </span>
                    {plan.isRecommended && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded border border-emerald-500/50 text-emerald-300 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Recommended
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-zinc-100">{plan.name}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">{plan.shortDescription}</p>
                </div>
              </div>

              {/* Key parameters */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-zinc-500">Base Fee</p>
                  <p className="text-zinc-200 font-mono">{plan.dbcConfiguration.baseFeeBps}bps</p>
                </div>
                <div>
                  <p className="text-zinc-500">Dynamic Fee</p>
                  <p className="text-zinc-200">{plan.dbcConfiguration.dynamicFeeEnabled ? 'Enabled' : 'Disabled'}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Curve Segments</p>
                  <p className="text-zinc-200 font-mono">{plan.dbcConfiguration.segmentCount}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Est. Graduation</p>
                  <p className={cn('font-mono', plan.expectedOutcomes.graduationProgressPct >= 100 ? 'text-emerald-400' : 'text-zinc-200')}>
                    {plan.expectedOutcomes.graduationProgressPct}%
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500">Initial MCap</p>
                  <p className="text-zinc-200 font-mono">{plan.dbcConfiguration.initialMarketCapSol} SOL</p>
                </div>
                <div>
                  <p className="text-zinc-500">Migration MCap</p>
                  <p className="text-zinc-200 font-mono">{plan.dbcConfiguration.migrationMarketCapSol} SOL</p>
                </div>
              </div>

              {/* Rationale */}
              {plan.isRecommended && (
                <div className="bg-zinc-900/60 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Why HERMES recommends this</p>
                  <ul className="space-y-1">
                    {plan.recommendationReasons.map((r, i) => (
                      <li key={i} className="text-xs text-zinc-300 flex items-start gap-1.5">
                        <span className="text-emerald-400 mt-0.5">→</span> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risk signals */}
              {plan.riskSignals.length > 0 && (
                <div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedRisks(prev => ({ ...prev, [plan.id]: !prev[plan.id] })); }}
                    className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 w-full"
                  >
                    <span className="flex items-center gap-1">
                      {highRisks > 0 && <span className="text-red-400">{highRisks} high</span>}
                      {medRisks > 0 && <span className="text-amber-400">{medRisks} medium</span>}
                      {highRisks === 0 && medRisks === 0 && <span>{plan.riskSignals.length} low</span>}
                      {' '}risk signal{plan.riskSignals.length !== 1 ? 's' : ''}
                    </span>
                    {risksExpanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                  </button>
                  {risksExpanded && (
                    <div className="mt-2 space-y-2">
                      {plan.riskSignals.map((sig) => (
                        <div key={sig.id} className="flex gap-2 bg-zinc-900/60 rounded p-2">
                          {severityIcon(sig.severity)}
                          <div>
                            <p className="text-xs font-medium text-zinc-300">{sig.title}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">{sig.explanation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Select indicator */}
              <div className={cn(
                'flex items-center justify-center py-1.5 rounded border text-xs transition-colors',
                isSelected
                  ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10'
                  : 'border-zinc-700 text-zinc-500'
              )}>
                {isSelected ? '✓ Selected' : 'Click to select'}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={() => router.push(`/markets/${id}/objective`)}>
          ← Edit Objective
        </Button>
        <Button onClick={handleContinue} disabled={!selected}>
          Verify Selected Plan →
        </Button>
      </div>
    </PageLayout>
  );
}
