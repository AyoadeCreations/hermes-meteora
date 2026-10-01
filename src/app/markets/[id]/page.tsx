'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { PageLayout, MarketSubNav } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/States';
import { Stat, StatGrid } from '@/components/ui/Stat';
import type { MarketBrief, MarketObservation, Deployment } from '@/domain/types';
import { formatPrice, formatCompact, formatRelativeTime, formatAddress } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { ExternalLink, RefreshCw } from 'lucide-react';

const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet';
const EXPLORER_BASE = NETWORK === 'mainnet-beta'
  ? 'https://solscan.io'
  : 'https://solscan.io/?cluster=devnet';

export default function MarketMonitorPage() {
  const { id } = useParams<{ id: string }>();

  const [market,      setMarket]      = useState<MarketBrief | null>(null);
  const [deployment,  setDeployment]  = useState<Deployment | null>(null);
  const [observations,setObservations]= useState<MarketObservation[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const load = useCallback(async function load() {
    setLoading(true);
    try {
      const [mRes, depRes] = await Promise.all([
        fetch(`/api/markets/${id}`),
        fetch(`/api/markets/${id}/deploy`),
      ]);
      const { market }     = await mRes.json()   as { market: MarketBrief };
      const { deployment: dep } = await depRes.json() as { deployment: Deployment | null };
      setMarket(market);
      setDeployment(dep);

      // In a real app, we'd poll on-chain state here
      // For MVP, show observation history from DB
      const obsRes  = await fetch(`/api/markets/${id}/observations`);
      if (obsRes.ok) {
        const { observations: obs } = await obsRes.json() as { observations: MarketObservation[] };
        setObservations(obs);
      }
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <PageLayout><LoadingState /></PageLayout>;

  const latest    = observations[observations.length - 1];
  const isDeployed = deployment?.status === 'confirmed';

  // Build chart data from observations
  const priceChartData = observations.map((o) => ({
    time:  o.timestamp.slice(11, 16),
    price: o.price,
  }));

  const volumeChartData = observations.map((o) => ({
    time:      o.timestamp.slice(11, 16),
    buyVolume: o.buyVolume,
    sellVolume: o.sellVolume,
  }));

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Markets', href: '/' },
        { label: market?.tokenSymbol ?? id },
      ]}
      actions={
        <button
          onClick={load}
          className={cn(
            'flex items-center gap-1.5 text-xs text-text-tertiary',
            // Specific transitions — never `all`
            'transition-[color] duration-150',
            'hover:text-text-secondary',
            // Focus ring
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded'
          )}
        >
          <RefreshCw className="w-3 h-3" />
          Updated {formatRelativeTime(lastUpdated.toISOString())}
        </button>
      }
    >
      <MarketSubNav marketId={id} />

      <div className="mt-6 space-y-5">
        {/* Market header */}
        {market && (
          <div className="flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent-subtle border border-accent/20 flex items-center justify-center text-xs font-bold text-accent shrink-0">
                {market.tokenSymbol.slice(0, 2)}
              </div>
              <div>
                <h2 className="text-base font-semibold text-text-primary">{market.tokenName}</h2>
                <p className="text-xs text-text-tertiary font-mono">{market.tokenSymbol}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isDeployed ? (
                <Badge variant="success" dot>Live on {NETWORK}</Badge>
              ) : (
                <Badge variant="muted">Not Deployed</Badge>
              )}
              {deployment?.poolAddress && (
                <a
                  href={`${EXPLORER_BASE}/account/${deployment.poolAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    'flex items-center gap-1 text-xs text-text-tertiary',
                    // Specific transitions — never `all`
                    'transition-[color] duration-150',
                    'hover:text-accent'
                  )}
                >
                  {formatAddress(deployment.poolAddress, 4)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Metrics strip */}
        {latest ? (
          <div className="animate-slide-up">
            <StatGrid cols={5}>
              <Stat label="Current Price"  value={formatPrice(latest.price)} size="md" />
              <Stat label="Quote Reserve"  value={`${latest.quoteReserve.toFixed(2)} SOL`} size="md" />
              <Stat label="24h Volume"     value={`${formatCompact(latest.volume24h)} SOL`} size="md" />
              <Stat label="Graduation"     value={`${latest.graduationProgress.toFixed(1)}%`} size="md" />
              <Stat label="Active Traders" value={latest.traders.toString()} size="md" />
            </StatGrid>
          </div>
        ) : isDeployed ? (
          <div className="p-4 rounded-lg border border-border bg-bg-surface text-xs text-text-tertiary text-center">
            Waiting for first on-chain observation…
          </div>
        ) : (
          <div className="p-4 rounded-lg border border-border bg-bg-surface text-xs text-text-tertiary text-center">
            Market not yet deployed. Deploy first to see live data.
          </div>
        )}

        {/* Graduation progress bar */}
        {latest && (
          <Card>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-secondary">Graduation Progress</span>
              <span className="text-xs mono text-text-primary font-medium">
                {latest.graduationProgress.toFixed(1)}% of {market?.graduationQuoteAmount} SOL
              </span>
            </div>
            <div className="h-1.5 bg-bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  // Specific transition — only width changes
                  'transition-[width] duration-700 ease-cinema',
                  latest.graduationProgress >= 100 ? 'bg-success' : 'bg-accent'
                )}
                style={{ width: `${Math.min(100, latest.graduationProgress)}%` }}
              />
            </div>
            {latest.graduationProgress >= 100 && (
              <p className="mt-2 text-xs text-success">🎓 Graduation threshold reached — migration pending</p>
            )}
          </Card>
        )}

        {/* Charts */}
        {observations.length > 1 && (
          <div className="grid grid-cols-2 gap-4 animate-fade-in">
            <Card>
              <h4 className="text-2xs uppercase tracking-widest text-text-tertiary mb-3">Price</h4>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={priceChartData}>
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#5E6AD2" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#5E6AD2" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" tick={{ fill: '#5C5D6E', fontSize: 10 }} />
                  <YAxis tickFormatter={(v: number) => v.toFixed(6)} tick={{ fill: '#5C5D6E', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: '#111116', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}
                    formatter={(v: number) => [v.toFixed(8), 'Price']}
                  />
                  <Area type="monotone" dataKey="price" stroke="#5E6AD2" fill="url(#priceGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h4 className="text-2xs uppercase tracking-widest text-text-tertiary mb-3">Buy / Sell Volume</h4>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={volumeChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" tick={{ fill: '#5C5D6E', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#5C5D6E', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#111116', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }} />
                  <Area type="monotone" dataKey="buyVolume"  stroke="#2da44e" fill="rgba(45,164,78,0.12)"  strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="sellVolume" stroke="#e5534b" fill="rgba(229,83,75,0.12)"  strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* Deployment details */}
        {deployment && (
          <Card>
            <h4 className="text-2xs uppercase tracking-widest text-text-tertiary mb-3">Deployment</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: 'Status',    value: deployment.status },
                { label: 'Wallet',    value: deployment.walletAddress ? formatAddress(deployment.walletAddress) : '—' },
                { label: 'Pool',      value: deployment.poolAddress ? formatAddress(deployment.poolAddress, 6) : 'Pending' },
                { label: 'Signature', value: deployment.transactionSignature ? formatAddress(deployment.transactionSignature, 6) : 'Pending' },
              ].map((row, i) => (
                <div
                  key={row.label}
                  className="flex justify-between items-center p-2.5 rounded bg-bg-muted border border-border-subtle animate-slide-up"
                  style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}
                >
                  <span className="text-text-tertiary">{row.label}</span>
                  <span className="mono text-text-secondary">{row.value}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </PageLayout>
  );
}
