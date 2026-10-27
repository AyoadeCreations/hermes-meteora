'use client';

import React, { useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import type { MarketDesign } from '@/domain/types';
import {
  runStressTest,
  defaultStressConfig,
  type PresetResult,
  type StressConfig,
} from '@/services/simulation/stress';

interface Props {
  design: MarketDesign;
  /** Organic buy count and size come from the page's own assumptions. */
  organicCount: number;
  organicSizeQuote: number;
}

const sol = (n: number, d = 1) => `${n.toFixed(d)} SOL`;
const pct = (n: number, d = 1) => `${n.toFixed(d)}%`;
const feePct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;

function describe(id: PresetResult['id'], base: number, c: StressConfig): string {
  switch (id) {
    case 'none':
      return `Flat ${feePct(base)} fee`;
    case 'scheduler':
      return `${feePct(c.scheduler.startBps)} fee falling to ${feePct(base)} over ${c.scheduler.durationSeconds}s`;
    case 'limiter':
      return `Plus a surcharge on buys above ${c.limiter.referenceQuote.toFixed(1)} SOL`;
    case 'gated':
      return `Plus ${c.gate.seconds}s of whitelist only entry`;
  }
}

export function SniperStressTest({ design, organicCount, organicSizeQuote }: Props) {
  const [botCapitalPct, setBotCapitalPct] = useState(20);
  const [botCount, setBotCount]           = useState(5);

  const count = Math.min(300, Math.max(1, Math.round(organicCount)));
  const size  = organicSizeQuote > 0 ? organicSizeQuote : 1;

  const { result, config, error } = useMemo(() => {
    const config: StressConfig = {
      ...defaultStressConfig({ organicSizeQuote: size, organicCount: count }),
      botCapitalPct: botCapitalPct / 100,
      botCount,
    };
    try {
      const first = design.curve.segments[0];
      const result = runStressTest({
        segments:            design.curve.segments,
        startingPrice:       first?.priceStart ?? 0,
        graduationThreshold: design.graduation.quoteThreshold,
        fees:                design.fees,
        config,
      });
      return { result, config, error: null as string | null };
    } catch (e) {
      return { result: null, config, error: e instanceof Error ? e.message : 'Stress test failed' };
    }
  }, [design, count, size, botCapitalPct, botCount]);

  if (error || !result) {
    return (
      <Card>
        <p className="text-sm text-danger">{error ?? 'Stress test unavailable for this design.'}</p>
      </Card>
    );
  }

  const none = result.presets[0];
  if (!none) return null;

  const protectedPresets = result.presets.slice(1);
  const best = protectedPresets.reduce<PresetResult>(
    (a, b) => (b.withBots.botProfit < a.withBots.botProfit ? b : a),
    protectedPresets[0] ?? none,
  );
  const maxLeak = Math.max(1, ...result.presets.map((p) => p.leakagePer100));

  const limiter   = result.presets.find((p) => p.id === 'limiter');
  const scheduler = result.presets.find((p) => p.id === 'scheduler');
  const limiterIdle =
    !!limiter && !!scheduler && none.withBots.botProfit > 0 &&
    Math.abs(limiter.withBots.botProfit - scheduler.withBots.botProfit) < 1e-6;

  const botsProfit = none.withBots.botProfit > 0.005;

  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-accent" />
          <h4 className="eyebrow">Sniper stress test</h4>
        </div>
        <Badge variant="muted">Illustrative</Badge>
      </div>

      {/* Headline */}
      <div>
        <p className="display text-[clamp(1.6rem,2.8vw,2.4rem)] leading-[1.08]">
          {botsProfit ? (
            <>
              Unprotected, bots take <span className="serif-i">{pct(none.withBots.botSupplySharePct, 0)}</span> of
              supply and leave with <span className="serif-i">{sol(none.withBots.botProfit)}</span>.
            </>
          ) : (
            <>At this size, bots <span className="serif-i">don&rsquo;t profit</span> from this curve.</>
          )}
        </p>
        {botsProfit && best.id !== 'none' && (
          <p className="mt-3 text-sm text-text-secondary max-w-2xl">
            With <strong className="text-text-primary">{best.label.toLowerCase()}</strong>, that falls to{' '}
            <strong className="text-text-primary">{sol(Math.max(0, best.withBots.botProfit))}</strong>. Organic
            buyers still pay{' '}
            <strong className="text-text-primary">{pct(best.organicCostVsIdealPct)}</strong> more than in a bot free
            launch, {pct(best.protectionTaxPct)} of it from the protection&rsquo;s own fees.
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <label className="block">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs font-medium text-text-primary">Bot capital</span>
            <span className="font-mono text-xs text-text-secondary">
              {botCapitalPct}% of target · {sol((design.graduation.quoteThreshold * botCapitalPct) / 100)}
            </span>
          </div>
          <input
            type="range" min={5} max={50} step={5}
            value={botCapitalPct}
            onChange={(e) => setBotCapitalPct(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: '#6A3DF0' }}
            aria-label="Bot capital as a percentage of the graduation target"
          />
        </label>
        <label className="block">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs font-medium text-text-primary">Bot buys</span>
            <span className="font-mono text-xs text-text-secondary">
              {botCount} {botCount === 1 ? 'buy' : 'buys'} · {sol((design.graduation.quoteThreshold * botCapitalPct) / 100 / botCount, 2)} each
            </span>
          </div>
          <input
            type="range" min={1} max={30} step={1}
            value={botCount}
            onChange={(e) => setBotCount(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: '#6A3DF0' }}
            aria-label="Number of separate bot buys"
          />
        </label>
      </div>

      {/* Comparison */}
      <div className="space-y-3">
        <div className="hidden md:grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_90px_110px] gap-4 px-1 eyebrow">
          <span>Protection</span>
          <span>Bots extract per 100 SOL of organic buying</span>
          <span className="text-right">Bot supply</span>
          <span className="text-right">Organic pays</span>
        </div>

        {result.presets.map((p) => {
          const isBest = botsProfit && p.id === best.id && p.id !== 'none';
          const leak = p.leakagePer100;
          const width = leak > 0 ? Math.max(2, (leak / maxLeak) * 100) : 0;
          return (
            <div
              key={p.id}
              className={cn(
                'grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_90px_110px] gap-x-4 gap-y-2 items-center',
                'rounded-2xl px-4 py-3 border',
                isBest ? 'border-accent/30 bg-accent/[0.05]' : 'border-border-subtle bg-white/50'
              )}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{p.label}</span>
                  {isBest && <Badge variant="accent" className="whitespace-nowrap">Lowest leakage</Badge>}
                </div>
                <p className="text-2xs text-text-tertiary mt-0.5">{describe(p.id, design.fees.baseFeeBps, config)}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-2.5 flex-1 rounded-full bg-black/[0.05] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-cinema"
                    style={{
                      width: `${width}%`,
                      background: p.id === 'none'
                        ? '#0B0B10'
                        : 'linear-gradient(90deg,#FFB347,#F0368C 55%,#6A3DF0)',
                    }}
                  />
                </div>
                <span className="font-mono text-xs text-text-primary w-20 text-right">
                  {leak > 0 ? `${leak.toFixed(1)} SOL` : 'bots lose'}
                </span>
              </div>

              <div className="flex justify-between md:block md:text-right">
                <span className="md:hidden eyebrow">Bot supply</span>
                <span className="font-mono text-xs text-text-secondary">{pct(p.withBots.botSupplySharePct, 0)}</span>
              </div>

              <div className="flex justify-between md:block md:text-right">
                <span className="md:hidden eyebrow">Organic pays</span>
                <span className="font-mono text-xs text-text-secondary">
                  {p.organicCostVsIdealPct >= 0 ? '+' : ''}{pct(p.organicCostVsIdealPct)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {limiterIdle && (
        <p className="text-xs text-text-secondary rounded-xl bg-warning-muted/60 px-4 py-3">
          <strong className="text-text-primary">The rate limiter does nothing here.</strong> Each bot buy is
          smaller than the {config.limiter.referenceQuote.toFixed(1)} SOL threshold, so no surcharge applies.
          Bots that split their buys slip under it, which is why the fee scheduler and gated entry carry
          most of the protection.
        </p>
      )}

      <p className="text-2xs text-text-tertiary leading-relaxed">
        Organic flow: {count} buys of {size} SOL over {config.windowSeconds}s, from your assumptions. Bots buy
        first, hold, then exit into the curve when the window closes. &ldquo;Organic pays&rdquo; is the average
        price per token against a bot free, unprotected launch. Protection fees and bot activity are both in it.
        Parameters are assumptions modelled on Meteora&rsquo;s fee scheduler, rate limiter and gated early access,
        not Meteora&rsquo;s exact settings, and not a prediction of real bot behaviour.
      </p>
    </Card>
  );
}
