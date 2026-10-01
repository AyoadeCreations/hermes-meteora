'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageLayout } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingState, EmptyState } from '@/components/ui/States';
import type { MarketBrief } from '@/domain/types';
import { OBJECTIVE_LABELS, DEMAND_LABELS } from '@/domain/types';
import { formatPrice, formatCompact, formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  Plus, BarChart3, ArrowRight, ChevronRight,
  TrendingUp, Layers, Zap, Target,
} from 'lucide-react';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// ── Flow steps ───────────────────────────────────────────────────────────────

const FLOW_STEPS = [
  { step: '01', label: 'Define',   desc: 'Token parameters & objective',   icon: Target     },
  { step: '02', label: 'Design',   desc: '3 candidate DBC configurations', icon: Layers     },
  { step: '03', label: 'Simulate', desc: 'Deterministic trade scenarios',  icon: TrendingUp },
  { step: '04', label: 'Deploy',   desc: 'Official Meteora DBC program',   icon: Zap        },
  { step: '05', label: 'Observe',  desc: 'Designed vs actual behavior',    icon: BarChart3  },
] as const;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [markets, setMarkets] = useState<MarketBrief[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/markets')
      .then(r => r.json())
      .then((d: { markets: MarketBrief[] }) => setMarkets(d.markets ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageLayout>
      <div className="space-y-8">

        {/* ── Hero ── */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-bg-surface px-8 py-10
                        [background-image:linear-gradient(135deg,rgba(94,106,210,0.08)_0%,transparent_60%)]">
          {/* Ambient glow */}
          <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-accent opacity-[0.06] blur-[64px] pointer-events-none" />

          <div className="relative max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shadow-glow-sm">
                <BarChart3 className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-2xs font-medium text-text-tertiary uppercase tracking-widest">
                HERMES
              </span>
              {DEMO_MODE && <Badge variant="warning">Demo Mode</Badge>}
            </div>

            <h1 className="text-4xl font-bold text-text-primary tracking-tight leading-[1.1]">
              Design the market<br />
              <span className="text-gradient-accent">before you launch.</span>
            </h1>

            <p className="mt-3 text-sm text-text-secondary leading-relaxed max-w-lg">
              Turn a market objective and token parameters into candidate Meteora DBC
              configurations. Simulate their behavior, compare them side-by-side,
              and deploy the one that fits your goals.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <Link href="/markets/new">
                <Button variant="primary" size="lg" icon={<Plus className="w-4 h-4" />}>
                  Create Market Brief
                </Button>
              </Link>
              <span className="text-2xs text-text-tertiary font-mono tracking-wider">
                DESIGN → SIMULATE → DEPLOY
              </span>
            </div>
          </div>
        </div>

        {/* ── Flow steps ── */}
        <div className="grid grid-cols-5 gap-2">
          {FLOW_STEPS.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={item.step} className="relative">
                <div className={cn(
                  'p-3.5 rounded-xl border border-border bg-bg-surface h-full',
                  // Specific transitions — no transition-all
                  'transition-[background-color,border-color] duration-150',
                  'hover:border-border-strong hover:bg-bg-elevated',
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xs text-text-tertiary font-mono">{item.step}</span>
                    <Icon className="w-3.5 h-3.5 text-accent opacity-60" />
                  </div>
                  <p className="text-xs font-semibold text-text-primary">{item.label}</p>
                  <p className="text-2xs text-text-tertiary mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
                {i < 4 && (
                  <ChevronRight className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-tertiary z-10 hidden lg:block" />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Markets list ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Markets</h2>
              <p className="text-2xs text-text-tertiary mt-0.5">
                {loading
                  ? 'Loading…'
                  : `${markets.length} market${markets.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <Link href="/markets/new">
              <Button variant="secondary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                New Market
              </Button>
            </Link>
          </div>

          {loading ? (
            <LoadingState />
          ) : markets.length === 0 ? (
            <EmptyState
              title="No markets yet"
              description="Create your first market brief to start designing objective-driven DBC configurations."
              action={
                <Link href="/markets/new">
                  <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
                    Create Market Brief
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-1.5">
              {markets.map(market => (
                <MarketRow key={market.id} market={market} />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

// ── Market row ────────────────────────────────────────────────────────────────

function MarketRow({ market }: { market: MarketBrief }) {
  return (
    <Link href={`/markets/${market.id}/design`} className="block group">
      <div className={cn(
        'flex items-center gap-4 px-4 py-3 rounded-xl',
        'border border-border bg-bg-surface',
        // Hover: elevate surface + strengthen border
        'hover:bg-bg-elevated hover:border-border-strong',
        // Pressed: scale + dim
        'active:scale-[0.995] active:brightness-95',
        // Specific transitions — no transition-all
        'transition-[transform,background-color,border-color,filter] duration-150',
        '[background-image:linear-gradient(180deg,rgba(255,255,255,0.02)_0%,transparent_100%)]'
      )}>
        {/* Token icon */}
        <div className="w-9 h-9 rounded-xl bg-accent-subtle border border-accent/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">
          {market.tokenSymbol.slice(0, 2)}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">{market.tokenName}</span>
            <span className="text-xs text-text-tertiary font-mono">{market.tokenSymbol}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-2xs text-text-tertiary font-mono">
            <span>{formatCompact(market.totalSupply)} supply</span>
            <span className="text-border-strong">·</span>
            <span>{formatPrice(market.startingPrice)}</span>
            <span className="text-border-strong">·</span>
            <span>{market.graduationQuoteAmount} SOL grad</span>
            <span className="text-border-strong">·</span>
            <span>{DEMAND_LABELS[market.expectedDemand.profile]} demand</span>
          </div>
        </div>

        {/* Objective */}
        <Badge variant="accent">{OBJECTIVE_LABELS[market.objective]}</Badge>

        {/* Timestamp */}
        <span className="text-2xs text-text-tertiary shrink-0">
          {formatRelativeTime(market.createdAt)}
        </span>

        {/* Arrow — brightens on group-hover */}
        <ArrowRight className="w-3.5 h-3.5 text-text-tertiary shrink-0 group-hover:text-accent transition-colors duration-150" />
      </div>
    </Link>
  );
}
