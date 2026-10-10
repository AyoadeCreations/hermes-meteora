'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { PageLayout, MarketSubNav } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/States';
import { EvidenceBadge, EvidenceNote } from '@/components/ui/EvidenceBadge';
import { MethodologyDisclosure } from '@/components/ui/MethodologyDisclosure';
import { cn } from '@/lib/cn';
import { track, safeId } from '@/lib/telemetry';
import { formatBps } from '@/lib/format';
import type { MarketBrief, MarketDesign, FormationPlan, RiskSignal } from '@/domain/types';
import type { MarketObjectiveInput } from '@/domain/market-objective';
import { LAUNCH_OBJECTIVE_LABELS, DESIRED_BEHAVIOR_LABELS } from '@/domain/market-objective';
import { AlertTriangle, CheckCircle, Info, Shield } from 'lucide-react';

type PlanWithRisks = FormationPlan & { riskSignals: RiskSignal[] };

const QUOTE_LABELS: Record<string, string> = {
  So11111111111111111111111111111111111111112:          'SOL (Native)',
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU':  'USDC (Devnet)',
};

// ── Config row ────────────────────────────────────────────────────────────────

function ConfigRow({
  label,
  value,
  mono = false,
  badge,
}: {
  label:  string;
  value:  string;
  mono?:  boolean;
  badge?: React.ComponentProps<typeof EvidenceBadge>['type'];
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0 gap-4">
      <span className="text-xs text-text-tertiary shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        {badge && <EvidenceBadge type={badge} />}
        <span className={cn('text-xs text-text-primary text-right', mono && 'font-mono')}>{value}</span>
      </div>
    </div>
  );
}

function severityIcon(s: RiskSignal['severity']) {
  if (s === 'high')   return <AlertTriangle className="w-4 h-4 text-danger shrink-0" />;
  if (s === 'medium') return <AlertTriangle className="w-4 h-4 text-warning shrink-0" />;
  return                     <Info          className="w-4 h-4 text-text-tertiary shrink-0" />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VerifyPage() {
  const { id }        = useParams<{ id: string }>();
  const searchParams  = useSearchParams();
  const router        = useRouter();

  const planId   = searchParams.get('plan');
  const planTier = searchParams.get('tier') as FormationPlan['tier'] | null;

  const [market,            setMarket]            = useState<MarketBrief | null>(null);
  const [plan,              setPlan]              = useState<PlanWithRisks | null>(null);
  const [design,            setDesign]            = useState<MarketDesign | null>(null);
  const [objective,         setObjective]         = useState<MarketObjectiveInput | null>(null);
  const [loading,           setLoading]           = useState(true);
  const [generatingDesigns, setGeneratingDesigns] = useState(false);
  const [error,             setError]             = useState<string | null>(null);

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

      const { market: m }   = await mRes.json()    as { market: MarketBrief };
      setMarket(m);

      const plansData = await plansRes.json() as { plans: PlanWithRisks[]; objective: MarketObjectiveInput };
      setObjective(plansData.objective);

      const selectedPlan = planId
        ? plansData.plans.find(p => p.id === planId)
        : plansData.plans.find(p => p.tier === planTier) ?? plansData.plans.find(p => p.isRecommended);
      setPlan(selectedPlan ?? null);

      const { designs } = await designsRes.json() as { designs: MarketDesign[] };
      if (designs.length > 0) setDesign(designs[0] ?? null);

      track('verification_viewed', { marketId: safeId(id) });
    } catch {
      setError('Failed to load verification data.');
    } finally {
      setLoading(false);
    }
  }

  async function generateAndProceed() {
    if (!design) {
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
    router.push(`/markets/${id}/deploy?design=${design.id}`);
  }

  if (loading) return <LoadingState message="Loading configuration…" />;

  if (!plan) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Markets', href: '/' }, { label: id }, { label: 'Verify' }]}
        title="Pre-Launch Verification"
      >
        <MarketSubNav marketId={id} />
        <Card className="p-6 max-w-lg mt-4">
          <p className="text-sm text-text-secondary mb-4">
            No plan selected. Choose a formation plan first.
          </p>
          <Button onClick={() => router.push(`/markets/${id}/plans`)}>
            ← Back to Plans
          </Button>
        </Card>
      </PageLayout>
    );
  }

  const cfg       = plan.dbcConfiguration;
  const highRisks = plan.riskSignals.filter(r => r.severity === 'high');
  const otherRisks= plan.riskSignals.filter(r => r.severity !== 'high');

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Markets', href: '/' },
        { label: market?.tokenSymbol ?? id, href: `/markets/${id}` },
        { label: 'Verify' },
      ]}
      title="Pre-Launch Verification"
      subtitle="Review the exact configuration that will be sent to Meteora DBC. No surprises."
    >
      <MarketSubNav marketId={id} />

      <div className="mt-5 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-4xl">

          {/* ── Left column: configuration ── */}
          <div className="space-y-4">

            {/* Plan header */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-accent shrink-0" />
                <span className="text-sm font-semibold text-text-primary">{plan.name}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'capitalize text-xs ml-auto shrink-0',
                    plan.tier === 'conservative' ? 'text-success border-success/40' :
                    plan.tier === 'aggressive'   ? 'text-warning border-warning/40' :
                                                   'text-accent  border-accent/40'
                  )}
                >
                  {plan.tier === 'conservative' ? 'Liquidity First' :
                   plan.tier === 'aggressive'   ? 'Price Discovery First' :
                                                  'Balanced Formation'}
                </Badge>
              </div>
              <p className="text-xs text-text-tertiary leading-relaxed">{plan.rationale}</p>
            </Card>

            {/* DBC configuration */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-2xs font-medium text-text-tertiary uppercase tracking-[0.12em]">
                  DBC Configuration
                </h3>
                <EvidenceBadge type="CALCULATED" />
              </div>
              <ConfigRow label="Quote Asset"       value={QUOTE_LABELS[market?.quoteMint ?? ''] ?? market?.quoteMint ?? '—'} />
              <ConfigRow label="Curve Mode"        value={cfg.curveMode}                             mono />
              <ConfigRow label="Initial Market Cap" value={`${cfg.initialMarketCapSol} SOL`}         mono />
              <ConfigRow label="Migration MCap"    value={`${cfg.migrationMarketCapSol} SOL`}        mono />
              <ConfigRow label="Base Fee"          value={`${cfg.baseFeeBps}bps (${(cfg.baseFeeBps / 100).toFixed(2)}%)`} mono />
              <ConfigRow label="Dynamic Fee"       value={cfg.dynamicFeeEnabled ? 'Enabled' : 'Disabled'} />
              <ConfigRow label="Creator Fee Share" value={`${cfg.creatorFeePercentage}%`}            mono />
              <ConfigRow label="Curve Segments"    value={String(cfg.segmentCount)}                  mono />
              <ConfigRow label="Liquidity Profile" value={cfg.liquidityProfile} />
              <ConfigRow label="Migration Option"  value="MET_DAMM_V2"                              mono />
              <ConfigRow label="Migration Fee"     value="FixedBps25"                               mono />
              <ConfigRow label="Locked Liquidity"  value="10% permanent lock" />
              <ConfigRow label="Collect Fee Mode"  value="quote_token"                              mono />
            </Card>

            {/* Token config */}
            {market && (
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-2xs font-medium text-text-tertiary uppercase tracking-[0.12em]">
                    Token Configuration
                  </h3>
                  <EvidenceBadge type="CALCULATED" />
                </div>
                <ConfigRow label="Token"              value={`${market.tokenName} (${market.tokenSymbol})`} />
                <ConfigRow label="Total Supply"       value={market.totalSupply.toLocaleString()}    mono />
                <ConfigRow label="Starting Price"     value={`${market.startingPrice} SOL`}          mono />
                <ConfigRow label="Graduation Target"  value={`${market.graduationQuoteAmount} SOL`}  mono />
                <ConfigRow label="Token Type"         value="SPL Token" />
                <ConfigRow label="Token Decimals"     value="6"                                      mono />
              </Card>
            )}
          </div>

          {/* ── Right column: behaviour + risks ── */}
          <div className="space-y-4">

            {/* Expected behavior */}
            <Card className="p-5">
              <h3 className="text-2xs font-medium text-text-tertiary uppercase tracking-[0.12em] mb-4">
                How This Market Is Expected to Behave
              </h3>
              <div className="space-y-4">

                <div>
                  <p className="text-2xs text-text-tertiary mb-1">Price Behaviour</p>
                  <p className="text-sm text-text-primary">{plan.expectedOutcomes.priceBehavior}</p>
                  <EvidenceNote type="SIMULATED" className="mt-1.5">
                    Deterministic simulation output — not a real trading result.
                  </EvidenceNote>
                </div>

                <div>
                  <p className="text-2xs text-text-tertiary mb-1.5">Estimated Graduation Progress</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-[width] duration-700 ease-cinema',
                          plan.expectedOutcomes.graduationProgressPct >= 100 ? 'bg-success' : 'bg-accent'
                        )}
                        style={{ width: `${Math.min(100, plan.expectedOutcomes.graduationProgressPct)}%` }}
                      />
                    </div>
                    <span className="text-xs text-text-primary font-mono w-10 shrink-0">
                      {plan.expectedOutcomes.graduationProgressPct}%
                    </span>
                  </div>
                  <EvidenceNote type="ESTIMATE" className="mt-1.5">
                    Under {objective?.expectedDemand ?? 'expected'} demand.
                    Not a guarantee.
                  </EvidenceNote>
                </div>

                {plan.expectedOutcomes.daysToGraduation && (
                  <div>
                    <p className="text-2xs text-text-tertiary mb-0.5">Est. Days to Graduation</p>
                    <p className="text-sm text-text-primary font-mono">
                      ~{plan.expectedOutcomes.daysToGraduation} days
                    </p>
                    <EvidenceNote type="ESTIMATE" className="mt-1">
                      Rough estimate under stated demand.
                    </EvidenceNote>
                  </div>
                )}

                <div>
                  <p className="text-2xs text-text-tertiary mb-0.5">Fee Profile vs Baseline</p>
                  <p className="text-sm text-text-primary capitalize">
                    {plan.expectedOutcomes.feeProfile} than baseline
                  </p>
                </div>
              </div>
            </Card>

            {/* Objective snapshot */}
            {objective && (
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-2xs font-medium text-text-tertiary uppercase tracking-[0.12em]">
                    Your Stated Objective
                  </h3>
                  <EvidenceBadge type="ASSUMPTION" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {objective.objectives.map(o => (
                    <span
                      key={o}
                      className="text-xs px-2 py-0.5 rounded border border-border text-text-secondary"
                    >
                      {LAUNCH_OBJECTIVE_LABELS[o]}
                    </span>
                  ))}
                  {objective.desiredBehavior.map(b => (
                    <span
                      key={b}
                      className="text-xs px-2 py-0.5 rounded border border-border text-text-tertiary"
                    >
                      {DESIRED_BEHAVIOR_LABELS[b]}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Risk signals */}
            <Card className="p-5">
              <h3 className="text-2xs font-medium text-text-tertiary uppercase tracking-[0.12em] mb-3">
                Known Risks
              </h3>
              {plan.riskSignals.length === 0 ? (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span className="text-sm">No significant risks detected for this configuration.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...highRisks, ...otherRisks].map(sig => (
                    <div key={sig.id} className="flex gap-2.5">
                      {severityIcon(sig.severity)}
                      <div>
                        <p className="text-sm font-medium text-text-primary">{sig.title}</p>
                        <p className="text-xs text-text-tertiary mt-0.5 leading-relaxed">{sig.explanation}</p>
                        <p className="text-2xs text-text-disabled mt-0.5">
                          Parameter: {sig.affectedParameter}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Assumptions */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-2xs font-medium text-text-tertiary uppercase tracking-[0.12em]">
                  Model Assumptions
                </h3>
                <EvidenceBadge type="ASSUMPTION" />
              </div>
              <ul className="space-y-1.5">
                {plan.assumptions.modelNotes.map((note, i) => (
                  <li key={i} className="text-xs text-text-tertiary leading-relaxed">
                    {note}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>

        {/* Methodology disclosure */}
        <div className="max-w-4xl">
          <MethodologyDisclosure
            contextNote="The DBC configuration is derived from your objective using deterministic rules. It will be exactly what is submitted to Meteora. The expected behaviour estimates are simulation outputs — they will not match real on-chain results precisely."
          />
        </div>

        {/* Action area */}
        <div className="flex flex-wrap gap-3 items-center pt-1">
          <Button variant="ghost" onClick={() => router.push(`/markets/${id}/plans?plan=${planId}`)}>
            ← Change Plan
          </Button>
          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}
          <Button onClick={generateAndProceed} disabled={generatingDesigns}>
            {generatingDesigns
              ? 'Generating DBC config…'
              : design
                ? 'Proceed to Deploy →'
                : 'Generate DBC Config & Deploy →'}
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
