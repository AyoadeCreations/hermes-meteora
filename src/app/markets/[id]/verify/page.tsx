'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { PageLayout, MarketSubNav } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import { track, safeId } from '@/lib/telemetry';
import { formatBps } from '@/lib/format';
import type { MarketBrief, MarketDesign, FormationPlan, RiskSignal } from '@/domain/types';
import type { MarketObjectiveInput } from '@/domain/market-objective';
import { LAUNCH_OBJECTIVE_LABELS, DESIRED_BEHAVIOR_LABELS } from '@/domain/market-objective';
import { AlertTriangle, CheckCircle, Info, Shield } from 'lucide-react';

type PlanWithRisks = FormationPlan & { riskSignals: RiskSignal[] };

const QUOTE_LABELS: Record<string, string> = {
  So11111111111111111111111111111111111111112: 'SOL (Native)',
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU': 'USDC (Devnet)',
};

function ConfigRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between py-2 border-b border-zinc-800 last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={cn('text-xs text-zinc-200', mono && 'font-mono')}>{value}</span>
    </div>
  );
}

function severityIcon(s: RiskSignal['severity']) {
  if (s === 'high') return <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />;
  if (s === 'medium') return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
  return <Info className="w-4 h-4 text-zinc-400 shrink-0" />;
}

export default function VerifyPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const planId = searchParams.get('plan');
  const planTier = searchParams.get('tier') as FormationPlan['tier'] | null;

  const [market, setMarket] = useState<MarketBrief | null>(null);
  const [plan, setPlan] = useState<PlanWithRisks | null>(null);
  const [design, setDesign] = useState<MarketDesign | null>(null);
  const [objective, setObjective] = useState<MarketObjectiveInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingDesigns, setGeneratingDesigns] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void load(); }, [id, planId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [mRes, plansRes, designsRes] = await Promise.all([
        fetch(`/api/markets/${id}`),
        fetch(`/api/markets/${id}/plans`),
        fetch(`/api/markets/${id}/designs`),
      ]);

      const { market: m } = await mRes.json() as { market: MarketBrief };
      setMarket(m);

      const plansData = await plansRes.json() as { plans: PlanWithRisks[]; objective: MarketObjectiveInput };
      setObjective(plansData.objective);

      // Find the selected plan (by id or tier)
      const selectedPlan = planId
        ? plansData.plans.find((p) => p.id === planId)
        : plansData.plans.find((p) => p.tier === planTier) ?? plansData.plans.find((p) => p.isRecommended);
      setPlan(selectedPlan ?? null);

      // Find best matching design (same tier objective or highest score)
      const { designs } = await designsRes.json() as { designs: MarketDesign[] };
      if (designs.length > 0) {
        setDesign(designs[0] ?? null); // highest scoring design
      }

      track('verification_viewed', { marketId: safeId(id) });
    } catch {
      setError('Failed to load verification data.');
    } finally {
      setLoading(false);
    }
  }

  async function generateAndProceed() {
    if (!design) {
      // Trigger design generation first
      setGeneratingDesigns(true);
      try {
        const res = await fetch(`/api/markets/${id}/designs`, { method: 'POST' });
        if (!res.ok) throw new Error('Design generation failed');
        const { designs } = await res.json() as { designs: MarketDesign[] };
        if (designs.length > 0) setDesign(designs[0] ?? null);
      } catch {
        setError('Failed to generate market designs. Return to Design tab.');
      } finally {
        setGeneratingDesigns(false);
      }
      return;
    }

    // Navigate to deploy with the selected design
    router.push(`/markets/${id}/deploy?design=${design.id}`);
  }

  if (loading) return <LoadingState message="Loading configuration…" />;

  if (!plan) {
    return (
      <PageLayout breadcrumbs={[{ label: 'Markets', href: '/markets' }, { label: id }, { label: 'Verify' }]} title="Pre-Launch Verification">
        <MarketSubNav marketId={id} />
        <Card className="p-6 max-w-lg">
          <p className="text-zinc-300 mb-4">No plan selected. Choose a formation plan first.</p>
          <Button onClick={() => router.push(`/markets/${id}/plans`)}>← Back to Plans</Button>
        </Card>
      </PageLayout>
    );
  }

  const cfg = plan.dbcConfiguration;
  const highRisks = plan.riskSignals.filter((r) => r.severity === 'high');
  const otherRisks = plan.riskSignals.filter((r) => r.severity !== 'high');

  return (
    <PageLayout
      breadcrumbs={[{ label: 'Markets', href: '/markets' }, { label: market?.tokenSymbol ?? id, href: `/markets/${id}` }, { label: 'Verify' }]}
      title="Pre-Launch Verification"
      subtitle="Review the exact configuration that will be sent to Meteora DBC. No surprises."
    >
      <MarketSubNav marketId={id} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">

        {/* Left: Configuration */}
        <div className="space-y-5">
          {/* Plan header */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-medium text-zinc-200">{plan.name}</span>
              <Badge variant="outline" className={cn('capitalize text-xs',
                plan.tier === 'conservative' ? 'text-blue-300 border-blue-500/40' :
                plan.tier === 'aggressive' ? 'text-amber-300 border-amber-500/40' :
                'text-indigo-300 border-indigo-500/40'
              )}>{plan.tier}</Badge>
            </div>
            <p className="text-xs text-zinc-400">{plan.rationale}</p>
          </Card>

          {/* Exact DBC config */}
          <Card className="p-5">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
              DBC Configuration
            </h3>
            <ConfigRow label="Quote Asset" value={QUOTE_LABELS[market?.quoteMint ?? ''] ?? market?.quoteMint ?? '—'} />
            <ConfigRow label="Curve Mode" value={cfg.curveMode} mono />
            <ConfigRow label="Initial Market Cap" value={`${cfg.initialMarketCapSol} SOL`} mono />
            <ConfigRow label="Migration Market Cap" value={`${cfg.migrationMarketCapSol} SOL`} mono />
            <ConfigRow label="Base Fee" value={`${cfg.baseFeeBps}bps (${(cfg.baseFeeBps / 100).toFixed(2)}%)`} mono />
            <ConfigRow label="Dynamic Fee" value={cfg.dynamicFeeEnabled ? 'Enabled' : 'Disabled'} />
            <ConfigRow label="Creator Fee Share" value={`${cfg.creatorFeePercentage}%`} mono />
            <ConfigRow label="Curve Segments" value={String(cfg.segmentCount)} mono />
            <ConfigRow label="Liquidity Profile" value={cfg.liquidityProfile} />
            <ConfigRow label="Migration Option" value="MET_DAMM_V2" mono />
            <ConfigRow label="Migration Fee" value="FixedBps25" mono />
            <ConfigRow label="Locked Liquidity" value="10% permanent lock" />
            <ConfigRow label="Collect Fee Mode" value="quote_token" mono />
          </Card>

          {/* Token config */}
          {market && (
            <Card className="p-5">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                Token Configuration
              </h3>
              <ConfigRow label="Token" value={`${market.tokenName} (${market.tokenSymbol})`} />
              <ConfigRow label="Total Supply" value={market.totalSupply.toLocaleString()} mono />
              <ConfigRow label="Starting Price" value={`${market.startingPrice} SOL`} mono />
              <ConfigRow label="Graduation Target" value={`${market.graduationQuoteAmount} SOL`} mono />
              <ConfigRow label="Token Type" value="SPL Token" />
              <ConfigRow label="Token Decimals" value="6" mono />
            </Card>
          )}
        </div>

        {/* Right: Behavior + risks */}
        <div className="space-y-5">
          {/* Expected behavior */}
          <Card className="p-5">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
              How This Market Is Expected to Behave
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">Price Behaviour</p>
                <p className="text-sm text-zinc-200">{plan.expectedOutcomes.priceBehavior}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">Estimated Graduation Progress</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', plan.expectedOutcomes.graduationProgressPct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500')}
                      style={{ width: `${Math.min(100, plan.expectedOutcomes.graduationProgressPct)}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-300 font-mono w-8">{plan.expectedOutcomes.graduationProgressPct}%</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  ESTIMATE — under {objective?.expectedDemand ?? 'expected'} demand.
                  Not a guarantee.
                </p>
              </div>
              {plan.expectedOutcomes.daysToGraduation && (
                <div>
                  <p className="text-xs text-zinc-500 mb-0.5">Days to Graduation (est.)</p>
                  <p className="text-sm text-zinc-200 font-mono">~{plan.expectedOutcomes.daysToGraduation} days</p>
                </div>
              )}
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">Fee Profile vs Baseline</p>
                <p className="text-sm text-zinc-200 capitalize">{plan.expectedOutcomes.feeProfile} than baseline</p>
              </div>
            </div>
          </Card>

          {/* Objective snapshot */}
          {objective && (
            <Card className="p-5">
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                Your Stated Objective
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {objective.objectives.map((o) => (
                  <span key={o} className="text-xs px-2 py-0.5 rounded border border-zinc-700 text-zinc-300">
                    {LAUNCH_OBJECTIVE_LABELS[o]}
                  </span>
                ))}
                {objective.desiredBehavior.map((b) => (
                  <span key={b} className="text-xs px-2 py-0.5 rounded border border-zinc-700 text-zinc-400">
                    {DESIRED_BEHAVIOR_LABELS[b]}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Risk signals */}
          <Card className="p-5">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
              Known Risks
            </h3>
            {plan.riskSignals.length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">No significant risks detected for this configuration.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {[...highRisks, ...otherRisks].map((sig) => (
                  <div key={sig.id} className="flex gap-2.5">
                    {severityIcon(sig.severity)}
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{sig.title}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{sig.explanation}</p>
                      <p className="text-xs text-zinc-600 mt-0.5">Parameter: {sig.affectedParameter}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Assumptions */}
          <Card className="p-5">
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
              Model Assumptions
            </h3>
            <ul className="space-y-1">
              {plan.assumptions.modelNotes.map((note, i) => (
                <li key={i} className="text-xs text-zinc-500">{note}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* Action area */}
      <div className="mt-6 flex gap-3 items-center">
        <Button variant="ghost" onClick={() => router.push(`/markets/${id}/plans?plan=${planId}`)}>
          ← Change Plan
        </Button>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button onClick={generateAndProceed} disabled={generatingDesigns}>
          {generatingDesigns
            ? 'Generating DBC config…'
            : design
              ? 'Proceed to Deploy →'
              : 'Generate DBC Config & Deploy →'}
        </Button>
      </div>
    </PageLayout>
  );
}
