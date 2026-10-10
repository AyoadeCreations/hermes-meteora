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
import {
  ASSET_TYPE_LABELS,
  LAUNCH_OBJECTIVE_LABELS,
  LAUNCH_OBJECTIVE_DESCRIPTIONS,
  DESIRED_BEHAVIOR_LABELS,
  RISK_PREFERENCE_LABELS,
  RISK_PREFERENCE_DESCRIPTIONS,
} from '@/domain/market-objective';
import { SOL_MINT } from '@/domain/types';
import type {
  AssetType,
  LaunchObjective,
  DesiredBehavior,
  RiskPreference,
  MarketObjectiveInput,
} from '@/domain/market-objective';
import type { MarketBrief } from '@/domain/types';

const ASSET_TYPES: AssetType[]         = ['community', 'protocol', 'creator', 'ai', 'rwa', 'other'];
const LAUNCH_OBJECTIVES: LaunchObjective[] = [
  'priceDiscovery', 'bootstrapTrading', 'targetMarketCap',
  'earlyLiquidity', 'demandTesting', 'durableMarket',
];
const DESIRED_BEHAVIORS: DesiredBehavior[] = [
  'lowerVolatility', 'gradualPriceDiscovery', 'fasterPriceDiscovery',
  'strongerEarlyLiquidity', 'discourageRapidTrading', 'fasterGraduation',
];
const RISK_PREFERENCES: RiskPreference[] = ['conservative', 'balanced', 'aggressive'];

// ── Shared button styles ──────────────────────────────────────────────────────

function toggleBtn(selected: boolean) {
  return cn(
    'px-3 py-2 rounded-lg border text-sm text-left transition-[border-color,background-color,color] duration-150',
    selected
      ? 'border-accent/60 bg-accent-subtle text-accent'
      : 'border-border bg-bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary'
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ObjectivePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [market,      setMarket]      = useState<MarketBrief | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  // Form state
  const [assetType,    setAssetType]    = useState<AssetType>('community');
  const [objectives,   setObjectives]   = useState<[LaunchObjective, ...LaunchObjective[]]>(['priceDiscovery']);
  const [demand,       setDemand]       = useState<'low' | 'moderate' | 'high'>('moderate');
  const [launchCapital,setLaunchCapital]= useState<string>('10');
  const [behaviors,    setBehaviors]    = useState<DesiredBehavior[]>(['gradualPriceDiscovery']);
  const [riskPref,     setRiskPref]     = useState<RiskPreference>('balanced');

  useEffect(() => {
    void load();
    track('market_objective_started', { marketId: safeId(id) });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try {
      const [mRes, oRes] = await Promise.all([
        fetch(`/api/markets/${id}`),
        fetch(`/api/markets/${id}/objective`),
      ]);
      const { market: m } = await mRes.json() as { market: MarketBrief };
      setMarket(m);

      const { objective: existing } = await oRes.json() as { objective: MarketObjectiveInput | null };
      if (existing) {
        setAssetType(existing.assetType);
        setObjectives(existing.objectives as [LaunchObjective, ...LaunchObjective[]]);
        setDemand(existing.expectedDemand);
        setLaunchCapital(String(existing.launchCapital));
        setBehaviors(existing.desiredBehavior);
        setRiskPref(existing.riskPreference);
      }
    } catch {
      setError('Failed to load market.');
    } finally {
      setLoading(false);
    }
  }

  function toggleMulti<T>(list: T[], item: T, max: number): T[] {
    if (list.includes(item)) return list.filter(x => x !== item);
    if (list.length >= max)  return list;
    return [...list, item];
  }

  async function handleSubmit() {
    const capital = parseFloat(launchCapital);
    if (!capital || capital <= 0)  { setError('Enter a valid launch capital.'); return; }
    if (objectives.length === 0)   { setError('Select at least one objective.'); return; }
    if (behaviors.length === 0)    { setError('Select at least one desired behavior.'); return; }

    setSaving(true);
    setError(null);

    const payload: MarketObjectiveInput = {
      assetType,
      objectives,
      expectedDemand: demand,
      launchCapital:  capital,
      quoteAsset:     market?.quoteMint ?? SOL_MINT,
      desiredBehavior: behaviors,
      riskPreference:  riskPref,
    };

    try {
      const res = await fetch(`/api/markets/${id}/objective`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) {
        const { error: e } = await res.json() as { error?: string };
        throw new Error(e ?? 'Failed to save');
      }
      track('market_objective_completed', { marketId: safeId(id) });
      setShowProfile(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save objective.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState message="Loading market…" />;

  // ── Profile review ─────────────────────────────────────────────────────────

  if (showProfile) {
    return (
      <PageLayout
        breadcrumbs={[
          { label: 'Markets', href: '/' },
          { label: market?.tokenSymbol ?? id, href: `/markets/${id}` },
          { label: 'Objective' },
        ]}
        title="Your Market Profile"
        subtitle="Review your formation intent before generating plans."
      >
        <MarketSubNav marketId={id} />
        <div className="max-w-2xl space-y-5 mt-4">
          <Card className="p-6 space-y-5">

            {/* Quick summary badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">{ASSET_TYPE_LABELS[assetType]}</Badge>
              <Badge variant="outline">{launchCapital} SOL launch capital</Badge>
              <Badge variant="outline">{demand} demand</Badge>
              <Badge variant="outline">{RISK_PREFERENCE_LABELS[riskPref]} risk</Badge>
            </div>

            {/* Objectives */}
            <div>
              <p className="text-2xs text-text-tertiary uppercase tracking-[0.12em] mb-2">
                Market objectives
              </p>
              <div className="flex flex-wrap gap-2">
                {objectives.map(o => (
                  <span
                    key={o}
                    className="text-xs text-text-secondary px-2.5 py-1 rounded-lg bg-bg-elevated border border-border"
                  >
                    {LAUNCH_OBJECTIVE_LABELS[o]}
                  </span>
                ))}
              </div>
            </div>

            {/* Desired behaviors */}
            <div>
              <p className="text-2xs text-text-tertiary uppercase tracking-[0.12em] mb-2">
                Desired behaviors
              </p>
              <div className="flex flex-wrap gap-2">
                {behaviors.map(b => (
                  <span
                    key={b}
                    className="text-xs text-text-secondary px-2.5 py-1 rounded-lg bg-bg-elevated border border-border"
                  >
                    {DESIRED_BEHAVIOR_LABELS[b]}
                  </span>
                ))}
              </div>
            </div>

            {/* Risk preference */}
            <div>
              <p className="text-2xs text-text-tertiary uppercase tracking-[0.12em] mb-1">
                Risk preference
              </p>
              <p className="text-sm text-text-primary">{RISK_PREFERENCE_LABELS[riskPref]}</p>
              <p className="text-xs text-text-tertiary mt-0.5">{RISK_PREFERENCE_DESCRIPTIONS[riskPref]}</p>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setShowProfile(false)}>
              ← Edit Objective
            </Button>
            <Button onClick={() => router.push(`/markets/${id}/plans`)}>
              Generate Formation Plans →
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // ── Objective form ─────────────────────────────────────────────────────────

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Markets', href: '/' },
        { label: market?.tokenSymbol ?? id, href: `/markets/${id}` },
        { label: 'Objective' },
      ]}
      title="Market Objective"
      subtitle="Describe the market you want to create. HERMES will translate this into candidate DBC configurations."
    >
      <MarketSubNav marketId={id} />
      <div className="max-w-2xl space-y-8 mt-4">

        {/* Asset type */}
        <FormSection
          title="What kind of asset are you launching?"
          hint="This helps HERMES surface relevant formation considerations."
        >
          <div className="grid grid-cols-3 gap-2">
            {ASSET_TYPES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setAssetType(t)}
                className={toggleBtn(assetType === t)}
              >
                {ASSET_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </FormSection>

        {/* Launch objectives */}
        <FormSection
          title="What are you trying to make happen?"
          hint="Select up to 3. Your primary objective shapes which formation strategies are surfaced."
        >
          <div className="grid grid-cols-2 gap-2">
            {LAUNCH_OBJECTIVES.map(o => {
              const sel = objectives.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => setObjectives(
                    toggleMulti(objectives, o, 3) as [LaunchObjective, ...LaunchObjective[]]
                  )}
                  className={cn(
                    'px-3 py-3 rounded-lg border text-left',
                    'transition-[border-color,background-color] duration-150',
                    sel
                      ? 'border-accent/60 bg-accent-subtle'
                      : 'border-border bg-bg-surface hover:border-border-strong'
                  )}
                >
                  <p className={cn('text-sm font-medium', sel ? 'text-accent' : 'text-text-primary')}>
                    {LAUNCH_OBJECTIVE_LABELS[o]}
                  </p>
                  <p className="text-xs text-text-tertiary mt-0.5 leading-relaxed">
                    {LAUNCH_OBJECTIVE_DESCRIPTIONS[o]}
                  </p>
                </button>
              );
            })}
          </div>
        </FormSection>

        {/* Expected demand */}
        <FormSection
          title="How strong do you expect early demand to be?"
          hint="This is an input assumption — it affects how formation plans are modeled, not guaranteed."
        >
          <div className="flex gap-3">
            {(['low', 'moderate', 'high'] as const).map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDemand(d)}
                className={cn(
                  'flex-1 py-2.5 rounded-lg border text-sm capitalize font-medium',
                  'transition-[border-color,background-color,color] duration-150',
                  demand === d
                    ? 'border-accent/60 bg-accent-subtle text-accent'
                    : 'border-border bg-bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary'
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </FormSection>

        {/* Launch capital */}
        <FormSection
          title="How much launch capital are you working with? (SOL)"
          hint="Used to scale market cap estimates. This is an input, not a committed amount."
        >
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0.1}
              step={0.5}
              value={launchCapital}
              onChange={e => setLaunchCapital(e.target.value)}
              className={cn(
                'w-36 px-3 py-2 rounded-lg border text-sm font-mono',
                'bg-bg-muted border-border text-text-primary',
                'placeholder:text-text-tertiary',
                'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
                'transition-[border-color] duration-150'
              )}
              placeholder="e.g. 10"
            />
            <span className="text-sm text-text-tertiary">SOL</span>
          </div>
        </FormSection>

        {/* Desired behaviors */}
        <FormSection
          title="What matters most for how the market behaves?"
          hint="Select up to 3. These preferences influence how HERMES weighs the formation strategies."
        >
          <div className="grid grid-cols-2 gap-2">
            {DESIRED_BEHAVIORS.map(b => (
              <button
                key={b}
                type="button"
                onClick={() => setBehaviors(toggleMulti(behaviors, b, 3))}
                className={toggleBtn(behaviors.includes(b))}
              >
                {DESIRED_BEHAVIOR_LABELS[b]}
              </button>
            ))}
          </div>
        </FormSection>

        {/* Risk preference */}
        <FormSection
          title="How should HERMES balance risk and reward?"
          hint="This affects which formation strategies are recommended and how parameters are tuned."
        >
          <div className="space-y-2">
            {RISK_PREFERENCES.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRiskPref(r)}
                className={cn(
                  'w-full px-4 py-3 rounded-lg border text-left',
                  'transition-[border-color,background-color] duration-150',
                  riskPref === r
                    ? 'border-accent/60 bg-accent-subtle'
                    : 'border-border bg-bg-surface hover:border-border-strong'
                )}
              >
                <p className={cn('text-sm font-medium', riskPref === r ? 'text-accent' : 'text-text-primary')}>
                  {RISK_PREFERENCE_LABELS[r]}
                </p>
                <p className="text-xs text-text-tertiary mt-0.5 leading-relaxed">
                  {RISK_PREFERENCE_DESCRIPTIONS[r]}
                </p>
              </button>
            ))}
          </div>
        </FormSection>

        {/* Error */}
        {error && (
          <p className="text-sm text-danger bg-danger-muted border border-danger/20 rounded-lg px-4 py-2.5">
            {error}
          </p>
        )}

        <Button onClick={handleSubmit} disabled={saving} className="w-full sm:w-auto">
          {saving ? 'Saving…' : 'See Your Market Profile →'}
        </Button>
      </div>
    </PageLayout>
  );
}

// ── Form section wrapper ────────────────────────────────────────────────────

function FormSection({
  title, hint, children,
}: {
  title:    string;
  hint?:    string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-text-primary mb-1">{title}</h2>
      {hint && <p className="text-xs text-text-tertiary mb-3 leading-relaxed">{hint}</p>}
      {children}
    </section>
  );
}
