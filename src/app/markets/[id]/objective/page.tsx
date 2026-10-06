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

const ASSET_TYPES: AssetType[] = ['community', 'protocol', 'creator', 'ai', 'rwa', 'other'];
const LAUNCH_OBJECTIVES: LaunchObjective[] = [
  'priceDiscovery', 'bootstrapTrading', 'targetMarketCap',
  'earlyLiquidity', 'demandTesting', 'durableMarket',
];
const DESIRED_BEHAVIORS: DesiredBehavior[] = [
  'lowerVolatility', 'gradualPriceDiscovery', 'fasterPriceDiscovery',
  'strongerEarlyLiquidity', 'discourageRapidTrading', 'fasterGraduation',
];
const RISK_PREFERENCES: RiskPreference[] = ['conservative', 'balanced', 'aggressive'];

export default function ObjectivePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [market, setMarket] = useState<MarketBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [assetType, setAssetType] = useState<AssetType>('community');
  const [objectives, setObjectives] = useState<[LaunchObjective, ...LaunchObjective[]]>(['priceDiscovery']);
  const [demand, setDemand] = useState<'low' | 'moderate' | 'high'>('moderate');
  const [launchCapital, setLaunchCapital] = useState<string>('10');
  const [behaviors, setBehaviors] = useState<DesiredBehavior[]>(['gradualPriceDiscovery']);
  const [riskPref, setRiskPref] = useState<RiskPreference>('balanced');
  const [showProfile, setShowProfile] = useState(false);

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

      // Pre-fill if objective already saved
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
    if (list.includes(item)) return list.filter((x) => x !== item);
    if (list.length >= max) return list;
    return [...list, item];
  }

  async function handleSubmit() {
    const capital = parseFloat(launchCapital);
    if (!capital || capital <= 0) {
      setError('Enter a valid launch capital.');
      return;
    }
    if (objectives.length === 0) { setError('Select at least one objective.'); return; }
    if (behaviors.length === 0) { setError('Select at least one desired behavior.'); return; }

    setSaving(true);
    setError(null);

    const payload: MarketObjectiveInput = {
      assetType,
      objectives,
      expectedDemand: demand,
      launchCapital: capital,
      quoteAsset: market?.quoteMint ?? SOL_MINT,
      desiredBehavior: behaviors,
      riskPreference: riskPref,
    };

    try {
      const res = await fetch(`/api/markets/${id}/objective`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  if (showProfile) {
    return (
      <PageLayout
        breadcrumbs={[{ label: 'Markets', href: '/markets' }, { label: market?.tokenSymbol ?? id, href: `/markets/${id}` }, { label: 'Objective' }]}
        title="Your Market Profile"
        subtitle="Review your formation intent before generating plans."
      >
        <MarketSubNav marketId={id} />
        <div className="max-w-2xl space-y-6">
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="default">{ASSET_TYPE_LABELS[assetType]}</Badge>
              <Badge variant="outline">{launchCapital} SOL launch capital</Badge>
              <Badge variant="outline">{demand} demand</Badge>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Objectives</p>
              <div className="flex flex-wrap gap-2">
                {objectives.map((o) => (
                  <span key={o} className="text-sm text-zinc-200">{LAUNCH_OBJECTIVE_LABELS[o]}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Desired Behavior</p>
              <div className="flex flex-wrap gap-2">
                {behaviors.map((b) => (
                  <span key={b} className="text-sm text-zinc-200">{DESIRED_BEHAVIOR_LABELS[b]}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Risk Preference</p>
              <span className="text-sm text-zinc-200">{RISK_PREFERENCE_LABELS[riskPref]}</span>
            </div>
          </Card>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setShowProfile(false)}>← Edit Objective</Button>
            <Button onClick={() => router.push(`/markets/${id}/plans`)}>
              Generate Formation Plans →
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      breadcrumbs={[{ label: 'Markets', href: '/markets' }, { label: market?.tokenSymbol ?? id, href: `/markets/${id}` }, { label: 'Objective' }]}
      title="Market Objective"
      subtitle="Describe the market you want to create. HERMES will translate this into candidate DBC configurations."
    >
      <MarketSubNav marketId={id} />
      <div className="max-w-2xl space-y-8">

        {/* Asset type */}
        <section>
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
            What kind of asset are you launching?
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {ASSET_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setAssetType(t)}
                className={cn(
                  'px-3 py-2 rounded-lg border text-sm text-left transition-colors',
                  assetType === t
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500'
                )}
              >
                {ASSET_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </section>

        {/* Objectives */}
        <section>
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-1">
            What are you trying to make happen?
          </h2>
          <p className="text-xs text-zinc-500 mb-3">Select up to 3.</p>
          <div className="grid grid-cols-2 gap-2">
            {LAUNCH_OBJECTIVES.map((o) => {
              const selected = objectives.includes(o);
              return (
                <button
                  key={o}
                  onClick={() => setObjectives(toggleMulti(objectives, o, 3) as [LaunchObjective, ...LaunchObjective[]])}
                  className={cn(
                    'px-3 py-3 rounded-lg border text-left transition-colors',
                    selected
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
                  )}
                >
                  <p className={cn('text-sm font-medium', selected ? 'text-indigo-300' : 'text-zinc-300')}>
                    {LAUNCH_OBJECTIVE_LABELS[o]}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">{LAUNCH_OBJECTIVE_DESCRIPTIONS[o]}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Demand */}
        <section>
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
            How strong do you expect early demand to be?
          </h2>
          <div className="flex gap-3">
            {(['low', 'moderate', 'high'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDemand(d)}
                className={cn(
                  'flex-1 py-2 rounded-lg border text-sm capitalize transition-colors',
                  demand === d
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500'
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </section>

        {/* Launch capital */}
        <section>
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
            How much launch capital are you working with? (SOL)
          </h2>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0.1}
              step={0.5}
              value={launchCapital}
              onChange={(e) => setLaunchCapital(e.target.value)}
              className="w-40 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="e.g. 10"
            />
            <span className="text-zinc-500 text-sm">SOL</span>
          </div>
        </section>

        {/* Desired behavior */}
        <section>
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-1">
            What matters most for the market?
          </h2>
          <p className="text-xs text-zinc-500 mb-3">Select up to 3.</p>
          <div className="grid grid-cols-2 gap-2">
            {DESIRED_BEHAVIORS.map((b) => {
              const selected = behaviors.includes(b);
              return (
                <button
                  key={b}
                  onClick={() => setBehaviors(toggleMulti(behaviors, b, 3))}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-sm text-left transition-colors',
                    selected
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500'
                  )}
                >
                  {DESIRED_BEHAVIOR_LABELS[b]}
                </button>
              );
            })}
          </div>
        </section>

        {/* Risk preference */}
        <section>
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
            How should HERMES balance risk and reward?
          </h2>
          <div className="space-y-2">
            {RISK_PREFERENCES.map((r) => (
              <button
                key={r}
                onClick={() => setRiskPref(r)}
                className={cn(
                  'w-full px-4 py-3 rounded-lg border text-left transition-colors',
                  riskPref === r
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
                )}
              >
                <p className={cn('text-sm font-medium', riskPref === r ? 'text-indigo-300' : 'text-zinc-300')}>
                  {RISK_PREFERENCE_LABELS[r]}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">{RISK_PREFERENCE_DESCRIPTIONS[r]}</p>
              </button>
            ))}
          </div>
        </section>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <Button onClick={handleSubmit} disabled={saving} className="w-full">
          {saving ? 'Saving…' : 'See Your Market Profile →'}
        </Button>
      </div>
    </PageLayout>
  );
}
