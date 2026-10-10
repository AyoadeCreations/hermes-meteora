'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageLayout, MarketSubNav } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/States';
import { EvidenceBadge, EvidenceNote } from '@/components/ui/EvidenceBadge';
import { MethodologyDisclosure } from '@/components/ui/MethodologyDisclosure';
import { cn } from '@/lib/cn';
import { track, safeId } from '@/lib/telemetry';
import type { FormationPlan, RiskSignal } from '@/domain/types';
import type { MarketObjectiveInput } from '@/domain/market-objective';
import { LAUNCH_OBJECTIVE_LABELS, RISK_PREFERENCE_LABELS } from '@/domain/market-objective';
import {
  AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp,
  Droplets, TrendingUp, Minus, ArrowRight,
} from 'lucide-react';

type PlanWithRisks = FormationPlan & { riskSignals: RiskSignal[] };

// ── Strategy visual config — keyed by tier ──────────────────────────────────

const TIER_CONFIG = {
  conservative: {
    label:        'Liquidity First',
    tagline:      'Prioritises stronger early liquidity. Lower price sensitivity, deeper curve depth.',
    tradeOff:     'Trade-off: Higher fees and slower price progression in exchange for more stable early liquidity.',
    icon:         Droplets,
    iconColor:    'text-success',
    cardBorder:   'border-success/30',
    cardBg:       'bg-success/[0.04]',
    activeBorder: 'border-success/60',
    activeBg:     'bg-success/[0.07]',
    activeRing:   'ring-1 ring-success/25',
    badgeColor:   'text-success',
    badgeBg:      'bg-success/[0.10] border-success/30',
    selectColor:  'border-success/50 text-success bg-success/[0.08]',
  },
  balanced: {
    label:        'Balanced Formation',
    tagline:      'Balances liquidity depth, price discovery, and graduation pace.',
    tradeOff:     'Trade-off: No extreme in either direction — a deliberate middle ground.',
    icon:         Minus,
    iconColor:    'text-accent',
    cardBorder:   'border-accent/30',
    cardBg:       'bg-accent/[0.04]',
    activeBorder: 'border-accent/60',
    activeBg:     'bg-accent/[0.08]',
    activeRing:   'ring-1 ring-accent/25',
    badgeColor:   'text-accent',
    badgeBg:      'bg-accent-subtle border-accent/30',
    selectColor:  'border-accent/50 text-accent bg-accent-subtle',
  },
  aggressive: {
    label:        'Price Discovery First',
    tagline:      'Prioritises faster price response and graduation. Higher price sensitivity.',
    tradeOff:     'Trade-off: Lower fees and faster graduation, but higher sensitivity to demand shortfalls.',
    icon:         TrendingUp,
    iconColor:    'text-warning',
    cardBorder:   'border-warning/30',
    cardBg:       'bg-warning/[0.04]',
    activeBorder: 'border-warning/60',
    activeBg:     'bg-warning/[0.07]',
    activeRing:   'ring-1 ring-warning/25',
    badgeColor:   'text-warning',
    badgeBg:      'bg-warning/[0.10] border-warning/30',
    selectColor:  'border-warning/50 text-warning bg-warning/[0.07]',
  },
} as const;

function severityIcon(s: RiskSignal['severity']) {
  if (s === 'high')   return <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0" />;
  if (s === 'medium') return <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />;
  return                     <Info          className="w-3.5 h-3.5 text-text-tertiary shrink-0" />;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PlansPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();

  const [plans,         setPlans]         = useState<PlanWithRisks[]>([]);
  const [objective,     setObjective]     = useState<MarketObjectiveInput | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [selected,      setSelected]      = useState<string | null>(null);
  const [expandedRisks, setExpandedRisks] = useState<Record<string, boolean>>({});
  const [expandedCfg,   setExpandedCfg]   = useState<Record<string, boolean>>({});

  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/markets/${id}/plans`);
      if (!res.ok) {
        const { error: e } = await res.json() as { error?: string };
        if (res.status === 422) setError('complete-objective');
        else                   setError(e ?? 'Failed to load plans');
        return;
      }
      const data = await res.json() as { plans: PlanWithRisks[]; objective: MarketObjectiveInput };
      setPlans(data.plans);
      setObjective(data.objective);
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
    router.push(`/markets/${id}/verify?plan=${selected}&tier=${plan?.tier ?? ''}`);
  }

  if (loading) return <LoadingState message="Generating formation plans…" />;

  if (error === 'complete-objective') {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Markets', href: '/' }, { label: id }, { label: 'Formation Plans' }]}
        title="Formation Plans"
      >
        <MarketSubNav marketId={id} />
        <div className="max-w-lg mt-4">
          <Card className="p-6 text-center space-y-4">
            <p className="text-sm text-text-secondary">
              Complete the Market Objective step before generating formation plans.
            </p>
            <Button onClick={() => router.push(`/markets/${id}/objective`)}>
              Set Market Objective →
            </Button>
          </Card>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Markets', href: '/' }, { label: id }, { label: 'Formation Plans' }]}
        title="Formation Plans"
      >
        <MarketSubNav marketId={id} />
        <p className="text-danger mt-4">{error}</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Markets', href: '/' },
        { label: id, href: `/markets/${id}` },
        { label: 'Formation Plans' },
      ]}
      title="Formation Plans"
      subtitle="Three candidate market configurations derived from your objective. Select one to continue."
    >
      <MarketSubNav marketId={id} />

      <div className="mt-5 space-y-5">

        {/* ── Objective context strip ── */}
        {objective && (
          <div className="flex flex-wrap items-center gap-2 p-3.5 rounded-xl border border-border bg-bg-surface">
            <span className="text-2xs text-text-tertiary uppercase tracking-[0.12em] mr-1 shrink-0">
              Your objective
            </span>
            <Badge variant="outline">{objective.assetType}</Badge>
            <Badge variant="outline">{objective.expectedDemand} demand</Badge>
            <Badge variant="outline">{objective.launchCapital} SOL capital</Badge>
            <Badge variant="outline">{RISK_PREFERENCE_LABELS[objective.riskPreference]} risk</Badge>
            {objective.objectives.slice(0, 2).map(o => (
              <span
                key={o}
                className="text-2xs text-text-tertiary px-1.5 py-0.5 rounded border border-border"
              >
                {LAUNCH_OBJECTIVE_LABELS[o]}
              </span>
            ))}
            <button
              onClick={() => router.push(`/markets/${id}/objective`)}
              className="ml-auto text-2xs text-text-tertiary hover:text-text-secondary underline underline-offset-2 shrink-0"
            >
              edit
            </button>
          </div>
        )}

        {/* ── Plan cards ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isSelected    = selected === plan.id;
            const risksExpanded = expandedRisks[plan.id];
            const cfgExpanded   = expandedCfg[plan.id];
            const cfg           = TIER_CONFIG[plan.tier];
            const Icon          = cfg.icon;
            const highRisks     = plan.riskSignals.filter(r => r.severity === 'high').length;
            const medRisks      = plan.riskSignals.filter(r => r.severity === 'medium').length;

            return (
              <div
                key={plan.id}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => handleSelect(plan.id)}
                onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') handleSelect(plan.id); }}
                className={cn(
                  'rounded-xl border-2 cursor-pointer p-5 space-y-4',
                  'transition-[border-color,background-color,box-shadow] duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                  isSelected
                    ? cn(cfg.activeBorder, cfg.activeBg, cfg.activeRing)
                    : cn(cfg.cardBorder, cfg.cardBg, 'hover:border-border-strong')
                )}
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-bg-base/60 border border-white/[0.06]">
                        <Icon className={cn('w-3.5 h-3.5', cfg.iconColor)} />
                      </div>
                      <span className={cn(
                        'text-2xs font-medium px-2 py-0.5 rounded border',
                        cfg.badgeBg, cfg.badgeColor
                      )}>
                        {cfg.label}
                      </span>
                    </div>
                    {plan.isRecommended && (
                      <span className="text-2xs font-medium px-2 py-0.5 rounded border border-success/40 text-success bg-success/[0.08] flex items-center gap-1 shrink-0">
                        <CheckCircle className="w-3 h-3" /> Recommended
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary">{plan.name}</h3>
                  <p className="text-2xs text-text-tertiary mt-1 leading-relaxed">{cfg.tradeOff}</p>
                </div>

                {/* Key parameters */}
                <div className="grid grid-cols-2 gap-2">
                  <ParamCell label="Base Fee"   value={`${plan.dbcConfiguration.baseFeeBps}bps`} mono />
                  <ParamCell label="Dynamic Fee" value={plan.dbcConfiguration.dynamicFeeEnabled ? 'On' : 'Off'} />
                  <ParamCell
                    label="Est. Graduation"
                    value={`${plan.expectedOutcomes.graduationProgressPct}%`}
                    mono
                    highlight={plan.expectedOutcomes.graduationProgressPct >= 100}
                    badge="ESTIMATE"
                  />
                  <ParamCell label="Segments" value={String(plan.dbcConfiguration.segmentCount)} mono />
                </div>

                {/* Price behaviour */}
                <div className="rounded-lg bg-bg-elevated border border-border-subtle p-3">
                  <p className="text-2xs text-text-tertiary uppercase tracking-[0.1em] mb-1">
                    Expected price behaviour
                  </p>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {plan.expectedOutcomes.priceBehavior}
                  </p>
                  <EvidenceNote type="SIMULATED" className="mt-2">
                    Deterministic simulation under {objective?.expectedDemand ?? 'stated'} demand.
                    Not a real trading result.
                  </EvidenceNote>
                </div>

                {/* Recommendation rationale */}
                {plan.isRecommended && plan.recommendationReasons.length > 0 && (
                  <div className="rounded-lg bg-bg-elevated border border-border-subtle p-3">
                    <p className="text-2xs text-text-disabled uppercase tracking-[0.1em] mb-2">
                      Why HERMES surfaces this first
                    </p>
                    <ul className="space-y-1.5">
                      {plan.recommendationReasons.map((r, i) => (
                        <li key={i} className="text-2xs text-text-secondary flex items-start gap-1.5">
                          <ArrowRight className="w-2.5 h-2.5 text-accent mt-0.5 shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                    <p className="text-2xs text-text-disabled mt-2 pt-2 border-t border-border">
                      Scoring is rule-based and deterministic — not a prediction.
                    </p>
                  </div>
                )}

                {/* Inspect DBC parameters (expandable) */}
                <div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setExpandedCfg(prev => ({ ...prev, [plan.id]: !prev[plan.id] })); }}
                    className="flex items-center gap-1.5 text-2xs text-text-tertiary hover:text-text-secondary w-full"
                  >
                    <span>Inspect DBC parameters</span>
                    {cfgExpanded
                      ? <ChevronUp   className="w-3 h-3 ml-auto" />
                      : <ChevronDown className="w-3 h-3 ml-auto" />}
                  </button>
                  {cfgExpanded && (
                    <div className="mt-2 space-y-1 p-3 rounded-lg bg-bg-elevated border border-border-subtle animate-slide-up">
                      <SmallConfigRow label="Curve mode"     value={plan.dbcConfiguration.curveMode} />
                      <SmallConfigRow label="Initial MCap"   value={`${plan.dbcConfiguration.initialMarketCapSol} SOL`} />
                      <SmallConfigRow label="Migration MCap" value={`${plan.dbcConfiguration.migrationMarketCapSol} SOL`} />
                      <SmallConfigRow label="Creator fee"    value={`${plan.dbcConfiguration.creatorFeePercentage}%`} />
                      <SmallConfigRow label="Liquidity"      value={plan.dbcConfiguration.liquidityProfile} />
                      <EvidenceNote type="CALCULATED" className="mt-2 pt-2 border-t border-border">
                        Derived from your objective and launch parameters using fixed rules.
                      </EvidenceNote>
                    </div>
                  )}
                </div>

                {/* Risk signals (expandable) */}
                {plan.riskSignals.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setExpandedRisks(prev => ({ ...prev, [plan.id]: !prev[plan.id] })); }}
                      className="flex items-center gap-2 text-2xs text-text-tertiary hover:text-text-secondary w-full"
                    >
                      <span>
                        {highRisks > 0 && <span className="text-danger">{highRisks} high </span>}
                        {medRisks  > 0 && <span className="text-warning">{medRisks} medium </span>}
                        {highRisks === 0 && medRisks === 0 && <span>{plan.riskSignals.length} low </span>}
                        risk signal{plan.riskSignals.length !== 1 ? 's' : ''}
                      </span>
                      {risksExpanded
                        ? <ChevronUp   className="w-3 h-3 ml-auto" />
                        : <ChevronDown className="w-3 h-3 ml-auto" />}
                    </button>
                    {risksExpanded && (
                      <div className="mt-2 space-y-2 animate-slide-up">
                        {plan.riskSignals.map(sig => (
                          <div key={sig.id} className="flex gap-2 bg-bg-elevated rounded-lg p-2.5 border border-border-subtle">
                            {severityIcon(sig.severity)}
                            <div>
                              <p className="text-2xs font-medium text-text-secondary">{sig.title}</p>
                              <p className="text-2xs text-text-tertiary mt-0.5 leading-relaxed">{sig.explanation}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Selection indicator */}
                <div className={cn(
                  'flex items-center justify-center py-1.5 rounded-lg border text-2xs font-medium',
                  'transition-[border-color,background-color,color] duration-150',
                  isSelected ? cfg.selectColor : 'border-border text-text-disabled'
                )}>
                  {isSelected ? '✓ Selected' : 'Click to select'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Methodology disclosure */}
        <MethodologyDisclosure
          contextNote="Formation plans are generated deterministically from your objective. The recommendation score ranks plans by how well their configuration aligns with your stated preferences — it is not a prediction of market outcomes."
        />

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button variant="ghost" onClick={() => router.push(`/markets/${id}/objective`)}>
            ← Edit Objective
          </Button>
          <Button onClick={handleContinue} disabled={!selected}>
            Verify Selected Plan →
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}

// ── Helper components ────────────────────────────────────────────────────────

function ParamCell({
  label, value, mono = false, highlight = false, badge,
}: {
  label:      string;
  value:      string;
  mono?:      boolean;
  highlight?: boolean;
  badge?:     React.ComponentProps<typeof EvidenceBadge>['type'];
}) {
  return (
    <div className="bg-bg-elevated rounded-lg border border-border-subtle px-2.5 py-2">
      <p className="text-2xs text-text-tertiary">{label}</p>
      <div className="flex items-center gap-1.5 mt-0.5">
        <p className={cn(
          'text-xs text-text-primary',
          mono && 'font-mono',
          highlight && 'text-success'
        )}>
          {value}
        </p>
        {badge && <EvidenceBadge type={badge} />}
      </div>
    </div>
  );
}

function SmallConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-border-subtle last:border-0">
      <p className="text-2xs text-text-tertiary">{label}</p>
      <p className="text-2xs text-text-secondary font-mono">{value}</p>
    </div>
  );
}
