'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Navbar } from '@/components/layout/Navbar';
import { MarketLab } from '@/components/landing/MarketLab';
import { Badge } from '@/components/ui/Badge';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import type { MarketBrief } from '@/domain/types';
import { OBJECTIVE_LABELS, DEMAND_LABELS } from '@/domain/types';
import { formatPrice, formatCompact, formatRelativeTime } from '@/lib/format';
import { ArrowRight, ArrowUpRight, Code2, Rocket } from 'lucide-react';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// ─────────────────────────────────────────────────────────────────────────────
// Scroll reveal
// ─────────────────────────────────────────────────────────────────────────────

function Reveal({
  children, className, delay = 0, as: Tag = 'div',
}: {
  children: React.ReactNode; className?: string; delay?: number; as?: React.ElementType;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e?.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        'transition-[opacity,transform] duration-[900ms] ease-cinema will-change-transform',
        shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6',
        className
      )}
    >
      {children}
    </Tag>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [markets, setMarkets] = useState<MarketBrief[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.dataset.page = 'home';
    return () => { delete document.documentElement.dataset.page; };
  }, []);

  useEffect(() => {
    fetch('/api/markets')
      .then(r => r.json())
      .then((d: { markets: MarketBrief[] }) => setMarkets(d.markets ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <DecisionLayer />
        <HowItWorks />
        <Infrastructure />
        <Audience />
        <FinalCTA />
        <MarketsSection markets={markets} loading={loading} />
      </main>
      <Footer />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative pt-32 md:pt-40 pb-16 md:pb-28 overflow-hidden">
      {/* The aurora band: wide, soft, slowly drifting */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 w-[160%] md:w-[120%] top-[640px] md:top-[700px] h-[560px] md:h-[720px]"
        style={{
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 28%, #000 62%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, #000 28%, #000 62%, transparent 100%)',
        }}
      >
        <div className="absolute inset-0 bg-aurora-band blur-[56px] animate-aurora opacity-95" />
      </div>

      <div className="relative max-w-screen-xl mx-auto px-5 md:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <p className="reveal serif-i text-[22px] md:text-[28px] text-text-secondary" style={{ ['--d' as string]: '0ms' }}>
            Market formation infrastructure
            {DEMO_MODE && <Badge variant="warning" className="ml-3 align-middle not-italic">Demo</Badge>}
          </p>

          <h1
            className="reveal display display-xl mt-5 md:mt-6 text-text-primary"
            style={{ ['--d' as string]: '90ms' }}
          >
            Build the market
            <br />
            before you{' '}
            <span className="serif-i whitespace-nowrap text-[1.1em] pr-[0.04em]">launch it.</span>
          </h1>

          <p
            className="reveal mt-7 md:mt-8 text-lg md:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed"
            style={{ ['--d' as string]: '190ms' }}
          >
            Launching an asset is easy.{' '}
            <span className="text-text-primary">Designing the market around it is not.</span>{' '}
            HERMES helps token creators and launch teams design, simulate, and validate their
            market formation strategy before deploying real capital.
          </p>

          <div
            className="reveal mt-9 flex flex-col sm:flex-row items-center justify-center gap-3"
            style={{ ['--d' as string]: '280ms' }}
          >
            <Link
              href="/markets/new"
              className="group inline-flex items-center gap-2 h-12 pl-7 pr-5 rounded-full bg-ink text-white text-[15px] font-medium
                         transition-[transform,box-shadow] duration-200 ease-cinema
                         hover:shadow-[0_14px_36px_-10px_rgba(11,11,16,0.6)] active:scale-[0.97]"
            >
              Start a market
              <ArrowUpRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-full text-[15px] font-medium text-text-primary hairline bg-white/40 backdrop-blur
                         transition-[background-color,color] duration-200 hover:bg-ink hover:text-white active:scale-[0.97]"
            >
              See how it works
            </Link>
          </div>

          <p className="reveal mt-6 text-xs text-text-tertiary" style={{ ['--d' as string]: '340ms' }}>
            Powered by{' '}
            <a href="https://meteora.ag" target="_blank" rel="noopener noreferrer"
               className="text-text-secondary underline decoration-border-strong underline-offset-4 hover:text-text-primary transition-colors">
              Meteora Dynamic Bonding Curve
            </a>
          </p>
        </div>

        {/* The instrument */}
        <div className="reveal relative mt-14 md:mt-20 max-w-5xl mx-auto" style={{ ['--d' as string]: '420ms' }}>
          <MarketLab />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// THE DECISION LAYER
// ─────────────────────────────────────────────────────────────────────────────

const DECISIONS = [
  { label: 'Initial Liquidity',      desc: 'How much capital seeds the bonding curve at launch and how it is distributed across the price range.' },
  { label: 'Price Discovery',        desc: 'How aggressively the curve moves with early trades, affecting initial price sensitivity and volatility.' },
  { label: 'Fee Structure',          desc: 'Trading fees collected during the bonding curve phase and how they flow to the creator.' },
  { label: 'Liquidity Distribution', desc: 'How liquidity is spread across the price range, concentrated near the start or distributed across a wider band.' },
  { label: 'Migration Conditions',   desc: 'The target market cap or liquidity threshold that triggers migration to a full AMM pool.' },
  { label: 'Creator Economics',      desc: 'The share of bonding curve proceeds that flow back to the token creator on graduation.' },
] as const;

function DecisionLayer() {
  return (
    <section className="relative py-24 md:py-36">
      <div className="max-w-screen-xl mx-auto px-5 md:px-8">
        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-10 lg:gap-24 items-end">
          <Reveal>
            <p className="eyebrow mb-6">The decision layer</p>
            <h2 className="display display-lg text-text-primary">
              Your launch parameters{' '}
              <span className="serif-i text-[1.1em]">shape the market.</span>
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="text-lg text-text-primary leading-relaxed">
              Initial liquidity. Price discovery. Fees. Liquidity distribution. Migration conditions.
              These decisions can influence how a market behaves before you&apos;ve even seen the first trade.
            </p>
            <p className="mt-4 text-base text-text-secondary leading-relaxed">
              HERMES turns those decisions into something you can model, compare, and understand before launch.
            </p>
          </Reveal>
        </div>

        <div className="mt-16 md:mt-24 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12">
          {DECISIONS.map((d, i) => (
            <Reveal key={d.label} delay={(i % 3) * 90} className="border-t border-border-strong pt-5">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-[17px] font-semibold text-text-primary" style={{ letterSpacing: '-0.025em' }}>{d.label}</h3>
                <span className="font-mono text-[11px] text-text-tertiary tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed max-w-sm">{d.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOW IT WORKS: full-bleed aurora block
// ─────────────────────────────────────────────────────────────────────────────

const STRATEGIES = [
  { name: 'Liquidity First',       color: '#B79CFF', desc: 'Prioritize stronger early liquidity conditions. Lower initial price sensitivity, deeper curve depth.' },
  { name: 'Balanced Formation',    color: '#FF8FC2', desc: 'Balance liquidity, price discovery, and graduation progression.' },
  { name: 'Price Discovery First', color: '#FFB48F', desc: 'Prioritize stronger price discovery dynamics. Higher initial sensitivity, faster price movement.' },
] as const;

const SCENARIO_COPY = [
  { label: 'Weak demand',           desc: 'What happens if early trading volume is lower than expected?' },
  { label: 'Strong demand',         desc: 'What if demand is much stronger than anticipated?' },
  { label: 'Concentrated activity', desc: 'What if a small number of large trades dominate early price action?' },
] as const;

const VERIFY_ITEMS = [
  'Liquidity distribution', 'Fee structure', 'Price formation curve',
  'Migration conditions', 'Locked liquidity', 'Creator economics',
] as const;

function HowItWorks() {
  return (
    <section id="how-it-works" className="relative px-3 md:px-6 scroll-mt-20">
      <div
        className="relative overflow-hidden rounded-[32px] md:rounded-[48px] text-white"
        style={{
          background:
            'radial-gradient(70% 90% at 100% 100%, rgba(255,201,61,0.95) 0%, rgba(255,201,61,0) 62%),' +
            'radial-gradient(60% 80% at 78% 30%, rgba(255,106,61,0.9) 0%, rgba(255,106,61,0) 66%),' +
            'radial-gradient(70% 90% at 35% 70%, rgba(214,32,122,0.95) 0%, rgba(214,32,122,0) 70%),' +
            'linear-gradient(100deg, #3A0C7A 0%, #6A1B9A 45%, #A3166B 100%)',
        }}
      >
        <div className="max-w-screen-xl mx-auto px-5 md:px-10 py-20 md:py-32">
          <Reveal className="max-w-3xl">
            <p className="eyebrow !text-white/70 mb-6">How it works</p>
            <h2 className="display display-lg">
              From launch configuration to{' '}
              <span className="serif-i text-[1.1em]">market formation.</span>
            </h2>
          </Reveal>

          <div className="mt-14 md:mt-20 grid md:grid-cols-2 gap-3 md:gap-4">
            <StepCard num="01" title="Define your objective" delay={0}>
              <p className="text-white/80 text-sm leading-relaxed">
                Tell HERMES what you are trying to achieve. The objective shapes which formation strategies are surfaced.
              </p>
              <ul className="mt-5 space-y-2.5 text-[15px]">
                {['Discover an initial market price', 'Bootstrap early liquidity', 'Test genuine demand', 'Reach a target market condition'].map(t => (
                  <li key={t} className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/80" />{t}
                  </li>
                ))}
              </ul>
            </StepCard>

            <StepCard num="02" title="Compare formation strategies" delay={90}>
              <div className="space-y-4">
                {STRATEGIES.map(s => (
                  <div key={s.name} className="flex gap-3">
                    <span className="mt-[7px] w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                    <div>
                      <p className="text-[15px] font-medium">{s.name}</p>
                      <p className="text-sm text-white/70 leading-relaxed mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </StepCard>

            <StepCard num="03" title="Stress-test the market" delay={0}>
              <div className="space-y-4">
                {SCENARIO_COPY.map(s => (
                  <div key={s.label}>
                    <p className="text-[15px] font-medium">{s.label}</p>
                    <p className="text-sm text-white/70 leading-relaxed mt-0.5">{s.desc}</p>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm text-white/80">Run different scenarios before putting real capital at risk.</p>
            </StepCard>

            <StepCard num="04" title="Verify before you deploy" delay={90}>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[15px]">
                {VERIFY_ITEMS.map(t => (
                  <li key={t} className="flex items-center gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/80 shrink-0" />{t}
                  </li>
                ))}
              </ul>
              <p className="mt-6 serif-i text-[26px] md:text-[30px] leading-tight text-white">
                No black box. Know what you&apos;re launching before you sign.
              </p>
            </StepCard>
          </div>
        </div>
      </div>
    </section>
  );
}

function StepCard({ num, title, delay, children }: { num: string; title: string; delay: number; children: React.ReactNode }) {
  return (
    <Reveal delay={delay}>
      <div className="h-full rounded-[28px] bg-[#14061F]/45 backdrop-blur-2xl ring-1 ring-inset ring-white/15 p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl md:text-2xl font-semibold" style={{ letterSpacing: '-0.035em' }}>{title}</h3>
          <span className="font-mono text-xs text-white/60 tabular-nums">{num}</span>
        </div>
        {children}
      </div>
    </Reveal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INFRASTRUCTURE
// ─────────────────────────────────────────────────────────────────────────────

const LIFECYCLE = [
  { stage: 'Design',   desc: 'Configure token parameters and market objective' },
  { stage: 'Simulate', desc: 'Run deterministic trade scenarios across strategies' },
  { stage: 'Verify',   desc: 'Inspect all parameters before signing' },
  { stage: 'Deploy',   desc: 'Submit to the official Meteora DBC program onchain' },
] as const;

function Infrastructure() {
  return (
    <section className="py-24 md:py-40">
      <div className="max-w-screen-xl mx-auto px-5 md:px-8 grid lg:grid-cols-2 gap-14 lg:gap-24 items-center">
        <Reveal>
          <p className="eyebrow mb-6">Infrastructure</p>
          <h2 className="display display-col text-text-primary">
            Built on Meteora&apos;s{' '}
            <span className="serif-i text-[1.1em]">Dynamic Bonding Curve.</span>
          </h2>
          <p className="mt-7 text-lg text-text-secondary leading-relaxed max-w-lg">
            HERMES uses Meteora&apos;s Dynamic Bonding Curve infrastructure to turn market-formation
            decisions into an executable onchain market.
          </p>

          <div className="mt-10 max-w-lg">
            <div className="glass rounded-3xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-ink text-white grid place-items-center shrink-0"><Code2 className="w-[18px] h-[18px]" /></div>
              <div>
                <p className="font-semibold text-text-primary" style={{ letterSpacing: '-0.02em' }}>HERMES</p>
                <p className="text-sm text-text-secondary mt-0.5">Market formation decision layer: design, simulate, compare, and verify.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 py-2.5 pl-[19px]">
              <span className="w-px h-6 bg-border-strong" />
              <span className="eyebrow">executes via</span>
            </div>
            <div className="glass rounded-3xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-aurora-amber via-aurora-rose to-aurora-violet text-white grid place-items-center shrink-0"><Rocket className="w-[18px] h-[18px]" /></div>
              <div>
                <p className="font-semibold text-text-primary" style={{ letterSpacing: '-0.02em' }}>Meteora DBC</p>
                <p className="text-sm text-text-secondary mt-0.5">Execution and infrastructure layer: official onchain bonding curve program.</p>
              </div>
            </div>
          </div>

          <a
            href="https://meteora.ag" target="_blank" rel="noopener noreferrer"
            className="group mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-text-primary"
          >
            <span className="underline decoration-border-strong underline-offset-4 group-hover:decoration-ink transition-colors">meteora.ag</span>
            <ArrowUpRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </Reveal>

        <Reveal delay={120}>
          <ol className="relative">
            <span aria-hidden className="absolute left-[27px] top-8 bottom-8 w-px bg-gradient-to-b from-aurora-amber via-aurora-rose to-aurora-violet opacity-60" />
            {LIFECYCLE.map((l, i) => (
              <li key={l.stage} className="relative flex gap-6 py-6">
                <span className="relative z-10 w-14 h-14 rounded-full bg-white ring-1 ring-inset ring-border-strong shadow-card grid place-items-center font-mono text-sm text-text-primary tabular-nums shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="pt-2.5">
                  <p className="text-2xl md:text-[28px] font-semibold text-text-primary" style={{ letterSpacing: '-0.04em' }}>{l.stage}</p>
                  <p className="text-sm text-text-secondary mt-1">{l.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIENCE
// ─────────────────────────────────────────────────────────────────────────────

const PERSONAS = [
  { title: 'Token Creators', desc: 'Understand the market you\'re creating before launch. Make deliberate decisions about how your token\'s market will form, not guesses.' },
  { title: 'Protocol Teams', desc: 'Test different formation strategies around your token\'s objectives. Validate assumptions before real capital and real users are involved.' },
  { title: 'Launch Teams',   desc: 'Move beyond copying presets. Use HERMES to explore the tradeoffs between formation strategies and arrive at a deliberate market design.' },
] as const;

function Audience() {
  return (
    <section className="pb-12 md:pb-16">
      <div className="max-w-screen-xl mx-auto px-5 md:px-8">
        <Reveal className="max-w-3xl">
          <p className="eyebrow mb-6">Who it&apos;s for</p>
          <h2 className="display display-lg text-text-primary">
            Built for teams{' '}
            <span className="serif-i text-[1.1em]">launching new markets.</span>
          </h2>
        </Reveal>

        <div className="mt-14 md:mt-20 grid md:grid-cols-3 gap-3 md:gap-4">
          {PERSONAS.map((p, i) => (
            <Reveal key={p.title} delay={i * 90}>
              <div className="group h-full glass rounded-[28px] p-7 md:p-8 transition-[transform,box-shadow] duration-500 ease-cinema hover:-translate-y-1 hover:shadow-elevated">
                <span className="serif-i text-[64px] leading-none text-text-disabled group-hover:text-aurora-rose transition-colors duration-500">
                  {i + 1}
                </span>
                <h3 className="mt-8 text-2xl font-semibold text-text-primary" style={{ letterSpacing: '-0.04em' }}>{p.title}</h3>
                <p className="mt-3 text-sm text-text-secondary leading-relaxed">{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FINAL CTA
// ─────────────────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-28 md:py-44">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[140%] h-[420px]"
        style={{
          WebkitMaskImage: 'radial-gradient(closest-side, #000 40%, transparent 100%)',
          maskImage: 'radial-gradient(closest-side, #000 40%, transparent 100%)',
        }}
      >
        <div className="absolute inset-0 bg-aurora-band blur-[60px] opacity-70 animate-aurora" />
      </div>

      <Reveal className="relative max-w-screen-xl mx-auto px-5 md:px-8 text-center">
        <h2 className="display display-lg text-text-primary">
          Don&apos;t just launch a token.
          <br />
          Understand the market{' '}
          <span className="serif-i text-[1.1em]">you&apos;re creating.</span>
        </h2>
        <p className="mt-7 text-lg text-text-secondary max-w-xl mx-auto leading-relaxed">
          HERMES gives you a way to explore the tradeoffs before real users and real capital do it for you.
        </p>
        <div className="mt-10 flex justify-center">
          <Link
            href="/markets/new"
            className="group inline-flex items-center gap-2 h-14 pl-8 pr-6 rounded-full bg-ink text-white text-base font-medium
                       transition-[transform,box-shadow] duration-200 ease-cinema
                       hover:shadow-[0_18px_44px_-12px_rgba(11,11,16,0.65)] active:scale-[0.97]"
          >
            Start a market
            <ArrowUpRight className="w-[18px] h-[18px] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
        <p className="mt-6 text-xs text-text-tertiary">Powered by Meteora DBC</p>
      </Reveal>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKETS LIST (existing functionality preserved)
// ─────────────────────────────────────────────────────────────────────────────

function MarketsSection({ markets, loading }: { markets: MarketBrief[]; loading: boolean }) {
  return (
    <section id="markets" className="pb-24 md:pb-32 scroll-mt-20">
      <div className="max-w-screen-xl mx-auto px-5 md:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="eyebrow mb-3">
              {loading ? 'Loading' : `${markets.length} market${markets.length !== 1 ? 's' : ''}`}
            </p>
            <h2 className="display display-md text-text-primary">
              Your <span className="serif-i text-[1.1em]">markets.</span>
            </h2>
          </div>
          <Link
            href="/markets/new"
            className="group inline-flex items-center gap-1.5 h-10 px-5 rounded-full text-sm font-medium text-text-primary hairline bg-white/50
                       transition-[background-color,color] duration-200 hover:bg-ink hover:text-white"
          >
            New market
            <ArrowUpRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        {loading ? (
          <LoadingState />
        ) : markets.length === 0 ? (
          <EmptyState
            title="No markets yet"
            description="Create your first market brief to start designing and simulating DBC configurations."
            action={
              <Link href="/markets/new"
                className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-ink text-white text-sm font-medium">
                Start a market <ArrowUpRight className="w-4 h-4" />
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {markets.map(m => <MarketRow key={m.id} market={m} />)}
          </div>
        )}
      </div>
    </section>
  );
}

function MarketRow({ market }: { market: MarketBrief }) {
  return (
    <Link href={`/markets/${market.id}/design`} className="block group">
      <div className={cn(
        'flex items-center gap-4 md:gap-5 px-4 md:px-5 py-4 rounded-[24px] glass',
        'transition-[transform,box-shadow,background-color] duration-300 ease-cinema',
        'hover:bg-white hover:shadow-elevated hover:-translate-y-0.5 active:scale-[0.995]'
      )}>
        <div className="w-11 h-11 rounded-full bg-ink text-white grid place-items-center text-xs font-semibold shrink-0 font-mono">
          {market.tokenSymbol.slice(0, 2)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold text-text-primary" style={{ letterSpacing: '-0.025em' }}>{market.tokenName}</span>
            <span className="text-xs text-text-tertiary font-mono">{market.tokenSymbol}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-text-tertiary font-mono">
            <span>{formatCompact(market.totalSupply)} supply</span>
            <span className="text-border-strong">/</span>
            <span>{formatPrice(market.startingPrice)}</span>
            <span className="text-border-strong">/</span>
            <span>{market.graduationQuoteAmount} SOL grad</span>
            <span className="text-border-strong">/</span>
            <span>{DEMAND_LABELS[market.expectedDemand.profile]} demand</span>
          </div>
        </div>

        <Badge variant="accent" className="hidden sm:inline-flex">{OBJECTIVE_LABELS[market.objective]}</Badge>
        <span className="hidden md:block text-xs text-text-tertiary shrink-0">{formatRelativeTime(market.createdAt)}</span>
        <span className="w-9 h-9 rounded-full grid place-items-center bg-bg-muted text-text-secondary shrink-0 transition-[background-color,color,transform] duration-300 group-hover:bg-ink group-hover:text-white group-hover:translate-x-0.5">
          <ArrowRight className="w-4 h-4" />
        </span>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-screen-xl mx-auto px-5 md:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Image src="/hermes-logo.png" alt="" width={28} height={28} className="h-7 w-7" />
          <span className="font-semibold text-[15px]" style={{ letterSpacing: '-0.04em' }}>HERMES</span>
        </div>
        <p className="text-xs text-text-tertiary max-w-md md:text-right leading-relaxed">
          Design the market before you launch. Simulations are deterministic models, not forecasts of real market performance.
        </p>
      </div>
    </footer>
  );
}
