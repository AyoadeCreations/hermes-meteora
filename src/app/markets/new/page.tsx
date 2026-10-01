'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageLayout } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { WarningBanner } from '@/components/ui/States';
import {
  OBJECTIVE_LABELS,
  OBJECTIVE_DESCRIPTIONS,
  DEMAND_LABELS,
  SOL_MINT,
  USDC_DEVNET_MINT,
} from '@/domain/types';
import type { MarketObjective, DemandProfile } from '@/domain/types';
import { cn } from '@/lib/cn';
import { formatCompact } from '@/lib/format';
import { ArrowRight, Info } from 'lucide-react';

const OBJECTIVES: MarketObjective[] = [
  'controlled_discovery',
  'low_price_impact',
  'fast_capital_formation',
  'balanced',
];

const QUOTE_MINT_OPTIONS = [
  { value: SOL_MINT,         label: 'SOL (Native)' },
  { value: USDC_DEVNET_MINT, label: 'USDC (Devnet)' },
];

interface FormState {
  tokenName:             string;
  tokenSymbol:           string;
  totalSupply:           string;
  quoteMint:             string;
  startingPrice:         string;
  graduationQuoteAmount: string;
  demandProfile:         DemandProfile;
  estimatedParticipants: string;
  estimatedVolume:       string;
  objective:             MarketObjective;
}

const DEMO_STATE: FormState = {
  tokenName:             'Example Asset',
  tokenSymbol:           'EXMP',
  totalSupply:           '1000000',
  quoteMint:             SOL_MINT,
  startingPrice:         '0.0001',
  graduationQuoteAmount: '85',
  demandProfile:         'medium',
  estimatedParticipants: '500',
  estimatedVolume:       '250',
  objective:             'controlled_discovery',
};

const BLANK_STATE: FormState = {
  tokenName:             '',
  tokenSymbol:           '',
  totalSupply:           '1000000',
  quoteMint:             SOL_MINT,
  startingPrice:         '0.001',
  graduationQuoteAmount: '85',
  demandProfile:         'medium',
  estimatedParticipants: '',
  estimatedVolume:       '',
  objective:             'balanced',
};

export default function NewMarketPage() {
  const router = useRouter();
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  const [form, setForm] = useState<FormState>(isDemoMode ? DEMO_STATE : BLANK_STATE);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.tokenName.trim())  errs.tokenName  = 'Required';
    if (!form.tokenSymbol.trim()) errs.tokenSymbol = 'Required';
    const supply = parseFloat(form.totalSupply);
    if (isNaN(supply) || supply < 1) errs.totalSupply = 'Must be ≥ 1';
    const sp = parseFloat(form.startingPrice);
    if (isNaN(sp) || sp <= 0) errs.startingPrice = 'Must be positive';
    const gq = parseFloat(form.graduationQuoteAmount);
    if (isNaN(gq) || gq <= 0) errs.graduationQuoteAmount = 'Must be positive';
    if (!form.quoteMint) errs.quoteMint = 'Required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setApiError(null);
    try {
      const body = {
        tokenName:             form.tokenName.trim(),
        tokenSymbol:           form.tokenSymbol.trim().toUpperCase(),
        totalSupply:           Math.floor(parseFloat(form.totalSupply)),
        quoteMint:             form.quoteMint,
        startingPrice:         parseFloat(form.startingPrice),
        graduationQuoteAmount: parseFloat(form.graduationQuoteAmount),
        expectedDemand: {
          profile: form.demandProfile,
          estimatedParticipants: form.estimatedParticipants ? parseInt(form.estimatedParticipants) : undefined,
          estimatedVolume:       form.estimatedVolume ? parseFloat(form.estimatedVolume) : undefined,
        },
        objective: form.objective,
      };
      const res = await fetch('/api/markets', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to create market');
      }
      const data = await res.json() as { market: { id: string } };
      router.push(`/markets/${data.market.id}/design`);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  const impliedMcap = parseFloat(form.startingPrice || '0') * parseFloat(form.totalSupply || '0');

  return (
    <PageLayout
      breadcrumbs={[{ label: 'Markets', href: '/' }, { label: 'New Market Brief' }]}
    >
      <div className="max-w-2xl mx-auto">
        <div className="mb-7">
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">
            Create Market Brief
          </h1>
          <p className="text-sm text-text-secondary mt-2 leading-relaxed max-w-lg">
            Define your token parameters and market objective. The engine generates
            3 candidate DBC configurations, simulates their behavior, and scores
            them against your stated objective.
          </p>
        </div>

        {isDemoMode && (
          <div className="mb-4 p-3 rounded border border-warning/30 bg-warning-muted flex items-start gap-2">
            <Info className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div>
              <span className="text-xs font-medium text-warning">Demo Mode — Simulated Scenarios</span>
              <p className="text-2xs text-warning/80 mt-0.5">
                Pre-filled with demo parameters. No live blockchain transactions will be executed.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Quickstart guide */}
          {!isDemoMode && (
            <div className="p-3 rounded-lg border border-border bg-bg-surface">
              <p className="text-xs font-medium text-text-secondary mb-2">
                Suggested values to try first
              </p>
              <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-2xs text-text-tertiary">
                <span>Token Name: <span className="text-text-secondary">My Token</span></span>
                <span>Symbol: <span className="text-text-secondary">MTK</span></span>
                <span>Supply: <span className="text-text-secondary">1,000,000,000</span></span>
                <span>Starting Price: <span className="text-text-secondary">0.000001 SOL</span></span>
                <span>Graduation Target: <span className="text-text-secondary">85 SOL</span></span>
                <span>Demand: <span className="text-text-secondary">Medium</span></span>
              </div>
              <p className="text-2xs text-text-tertiary mt-2">
                These produce a typical meme/community token launch. The engine generates 3 DBC
                configurations, simulates each, and scores them for you.
              </p>
            </div>
          )}
          {/* Token Identity */}
          <Card>
            <h2 className="text-2xs uppercase tracking-widest text-text-tertiary mb-4 font-medium">
              Token Identity
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Token Name" required error={errors.tokenName}>
                <Input value={form.tokenName} onChange={(e) => set('tokenName', e.target.value)} placeholder="e.g. Jupiter Protocol" maxLength={64} error={!!errors.tokenName} />
              </Field>
              <Field label="Symbol" required error={errors.tokenSymbol}>
                <Input value={form.tokenSymbol} onChange={(e) => set('tokenSymbol', e.target.value.toUpperCase())} placeholder="e.g. JUP" maxLength={10} error={!!errors.tokenSymbol} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Field
                label="Total Supply"
                required
                hint="Number of tokens that will exist. Common: 1,000,000 (1M) to 1,000,000,000 (1B). Affects price per token — higher supply = lower price per token at the same market cap."
                error={errors.totalSupply}
              >
                <Input type="number" value={form.totalSupply} onChange={(e) => set('totalSupply', e.target.value)} min={1} step={1} placeholder="e.g. 1000000000" error={!!errors.totalSupply} />
              </Field>
              <Field label="Quote Asset" required hint="The token buyers pay with. SOL is standard for most launches on Solana.">
                <Select value={form.quoteMint} onChange={(e) => set('quoteMint', e.target.value)}>
                  {QUOTE_MINT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          {/* Market Parameters */}
          <Card>
            <h2 className="text-2xs uppercase tracking-widest text-text-tertiary mb-4 font-medium">
              Market Parameters
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Starting Price"
                required
                hint="Price per token in SOL when the first trade happens. For a 1B supply token a typical start is 0.000001 SOL (implies ~1,000 SOL market cap). Lower = cheaper entry, more room to grow."
                error={errors.startingPrice}
              >
                <Input type="number" value={form.startingPrice} onChange={(e) => set('startingPrice', e.target.value)} step="any" min={0} placeholder="e.g. 0.000001" error={!!errors.startingPrice} />
              </Field>
              <Field
                label="Graduation Target (SOL)"
                required
                hint="Total SOL the bonding curve must accumulate before the market graduates to Meteora DAMM v2 (permanent liquidity pool). Pump.fun uses ~85 SOL. Lower = easier to graduate but thinner liquidity."
                error={errors.graduationQuoteAmount}
              >
                <Input type="number" value={form.graduationQuoteAmount} onChange={(e) => set('graduationQuoteAmount', e.target.value)} step="any" min={0} placeholder="e.g. 85" error={!!errors.graduationQuoteAmount} />
              </Field>
            </div>
            {impliedMcap > 0 && (
              <div className="mt-3 px-3 py-2 rounded bg-bg-muted border border-border-subtle">
                <span className="text-2xs text-text-tertiary">
                  Implied starting market cap:{' '}
                  <span className="text-text-secondary font-medium mono">{formatCompact(impliedMcap)} SOL</span>
                  <span className="ml-2 text-text-tertiary">
                    (starting price × total supply — the initial valuation of the entire token supply)
                  </span>
                </span>
              </div>
            )}
          </Card>

          {/* Expected Demand */}
          <Card>
            <h2 className="text-2xs uppercase tracking-widest text-text-tertiary mb-4 font-medium">
              Expected Demand
            </h2>
            <Field label="Demand Profile" hint="Calibrates simulation trade sizes. Low = small individual buys. High = larger buys, faster price movement. This does not affect the on-chain config — only what gets simulated.">
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(['low', 'medium', 'high'] as DemandProfile[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set('demandProfile', p)}
                    className={cn(
                      'px-3 py-2 rounded border text-sm font-medium',
                      // Specific transitions — never `all`
                      'transition-[background-color,border-color,color,transform] duration-150 ease-cinema',
                      // Pressed feedback
                      'active:scale-[0.97]',
                      form.demandProfile === p
                        ? 'border-accent bg-accent-subtle text-accent'
                        : 'border-border text-text-secondary hover:border-border-strong hover:text-text-primary hover:bg-bg-elevated'
                    )}
                  >
                    {DEMAND_LABELS[p]}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Field label="Est. Participants" hint="Optional. Estimated number of unique buyers — used to scale simulated trade sizes.">
                <Input type="number" value={form.estimatedParticipants} onChange={(e) => set('estimatedParticipants', e.target.value)} min={1} placeholder="e.g. 500" />
              </Field>
              <Field label="Est. Volume (SOL)" hint="Optional. Expected total trading volume in SOL — helps size the simulation scenarios.">
                <Input type="number" value={form.estimatedVolume} onChange={(e) => set('estimatedVolume', e.target.value)} step="any" min={0} placeholder="e.g. 250" />
              </Field>
            </div>
          </Card>

          {/* Market Objective */}
          <Card>
            <h2 className="text-2xs uppercase tracking-widest text-text-tertiary mb-1 font-medium">
              Market Objective
            </h2>
            <p className="text-2xs text-text-tertiary mb-4">
              Design objectives used by the scoring engine to rank candidates — not financial guarantees.
            </p>
            <div className="space-y-2">
              {OBJECTIVES.map((obj) => (
                <button
                  key={obj}
                  type="button"
                  onClick={() => set('objective', obj)}
                  className={cn(
                    'w-full text-left p-3.5 rounded-xl border',
                    // Specific transitions — never `all`
                    'transition-[background-color,border-color,transform,box-shadow] duration-150 ease-cinema',
                    // Pressed feedback
                    'active:scale-[0.99]',
                    // Focus ring
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
                    form.objective === obj
                      ? 'border-accent bg-accent-subtle [background-image:linear-gradient(135deg,rgba(94,106,210,0.12)_0%,transparent_100%)]'
                      : 'border-border hover:border-border-strong hover:bg-bg-elevated'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn('text-sm font-medium', form.objective === obj ? 'text-accent' : 'text-text-primary')}>
                      {OBJECTIVE_LABELS[obj]}
                    </span>
                    {form.objective === obj && <Badge variant="accent">Selected</Badge>}
                  </div>
                  <p className="text-2xs text-text-tertiary mt-1 leading-relaxed">
                    {OBJECTIVE_DESCRIPTIONS[obj]}
                  </p>
                </button>
              ))}
            </div>
          </Card>

          {apiError && <WarningBanner>{apiError}</WarningBanner>}

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-text-tertiary">
              Generates 3 candidate DBC configurations with simulation.
            </p>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              iconRight={<ArrowRight className="w-4 h-4" />}
            >
              Generate Market Designs
            </Button>
          </div>
        </form>
      </div>
    </PageLayout>
  );
}
