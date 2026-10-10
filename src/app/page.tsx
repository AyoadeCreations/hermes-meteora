'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageLayout } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingState, EmptyState } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import type { MarketBrief } from '@/domain/types';
import { OBJECTIVE_LABELS, DEMAND_LABELS } from '@/domain/types';
import { formatPrice, formatCompact, formatRelativeTime } from '@/lib/format';
import {
  ArrowRight, Plus, ChevronRight,
  Target, GitBranch, FlaskConical, ShieldCheck,
  Layers, Coins, Percent, BarChart2, Lock, TrendingUp,
  Rocket, Code2, Users,
} from 'lucide-react';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// ─────────────────────────────────────────────────────────────────────────────
// HOMEPAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [markets, setMarkets]   = useState<MarketBrief[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch('/api/markets')
      .then(r => r.json())
      .then((d: { markets: MarketBrief[] }) => setMarkets(d.markets ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageLayout>
      <div className="space-y-0">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <HeroSection />

        {/* ── Section 2: Market-design decisions ──────────────────────────── */}
        <Section2 />

        {/* ── Section 3: 4-step workflow ───────────────────────────────────── */}
        <Section3 id="how-it-works" />

        {/* ── Section 4: Meteora DBC ───────────────────────────────────────── */}
        <Section4 />

        {/* ── Section 5: Who it's for ──────────────────────────────────────── */}
        <Section5 />

        {/* ── Final CTA ────────────────────────────────────────────────────── */}
        <FinalCTA />

        {/* ── Markets list ─────────────────────────────────────────────────── */}
        <MarketsSection markets={markets} loading={loading} />

      </div>
    </PageLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO SECTION
// ─────────────────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">

      {/* Ambient background — restrained, not neon */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-accent opacity-[0.055] blur-[100px]" />
      </div>

      <div className="relative max-w-screen-xl mx-auto px-5">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* ── Left: copy ── */}
          <div>
            {/* Eyebrow */}
            <div className="flex items-center gap-2.5 mb-5">
              <div className="h-px w-6 bg-accent opacity-60" />
              <span className="text-2xs font-medium text-accent uppercase tracking-[0.18em]">
                Market Formation Infrastructure
              </span>
              {DEMO_MODE && <Badge variant="warning">Demo</Badge>}
            </div>

            {/* Headline */}
            <h1 className="text-[2.25rem] md:text-[2.75rem] font-bold text-text-primary leading-[1.08] tracking-tight">
              Build the market<br />
              <span className="text-gradient-accent">before you launch it.</span>
            </h1>

            {/* Subhead */}
            <p className="mt-5 text-base text-text-secondary leading-relaxed max-w-lg">
              Launching an asset is easy.{' '}
              <span className="text-text-primary">Designing the market around it is not.</span>
            </p>
            <p className="mt-3 text-sm text-text-tertiary leading-relaxed max-w-lg">
              HERMES helps token creators and launch teams design, simulate, and validate
              their market formation strategy before deploying real capital.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <Link href="/markets/new">
                <Button variant="primary" size="lg" icon={<Plus className="w-4 h-4" />}>
                  Start a Market
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button variant="ghost" size="lg" iconRight={<ChevronRight className="w-4 h-4" />}>
                  See How It Works
                </Button>
              </Link>
            </div>

            {/* Supporting line */}
            <p className="mt-5 text-2xs text-text-tertiary tracking-wide">
              Powered by{' '}
              <a
                href="https://meteora.ag"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                Meteora Dynamic Bonding Curve
              </a>
            </p>
          </div>

          {/* ── Right: workflow diagram ── */}
          <div className="hidden lg:block">
            <WorkflowDiagram />
          </div>
        </div>

        {/* Mobile workflow */}
        <div className="lg:hidden mt-12">
          <WorkflowDiagramMobile />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO VISUAL — workflow diagram
// ─────────────────────────────────────────────────────────────────────────────

const WORKFLOW_NODES = [
  {
    step:  'OBJECTIVE',
    label: 'Define your goal',
    desc:  'Price discovery, liquidity bootstrap, demand validation',
    icon:  Target,
    color: 'text-accent',
    bg:    'bg-accent-subtle border-accent/20',
  },
  {
    step:  'FORMATION STRATEGIES',
    label: 'Compare strategies',
    desc:  'Liquidity First · Balanced · Price Discovery',
    icon:  GitBranch,
    color: 'text-chart-b',
    bg:    'bg-success/[0.08] border-success/20',
  },
  {
    step:  'SCENARIO TESTING',
    label: 'Stress-test the market',
    desc:  'Weak demand, strong demand, whale concentration',
    icon:  FlaskConical,
    color: 'text-chart-c',
    bg:    'bg-warning/[0.08] border-warning/20',
  },
  {
    step:  'VERIFICATION',
    label: 'Verify before you deploy',
    desc:  'Liquidity, fees, migration conditions, creator economics',
    icon:  ShieldCheck,
    color: 'text-chart-e',
    bg:    'bg-[rgba(163,113,247,0.08)] border-[rgba(163,113,247,0.2)]',
  },
  {
    step:  'METEORA',
    label: 'Deploy on-chain',
    desc:  'Official Meteora DBC program — one wallet signature',
    icon:  Rocket,
    color: 'text-text-secondary',
    bg:    'bg-bg-elevated border-border-strong',
  },
] as const;

function WorkflowDiagram() {
  return (
    <div className="relative flex flex-col gap-2">
      {WORKFLOW_NODES.map((node, i) => {
        const Icon = node.icon;
        return (
          <div key={node.step} className="relative">
            <div className={cn(
              'relative flex items-start gap-3.5 p-4 rounded-xl border',
              'transition-[border-color,background-color] duration-200',
              'hover:border-border-strong',
              node.bg,
              '[background-image:linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_100%)]'
            )}>
              {/* Icon */}
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                'bg-bg-base/60 border border-white/[0.06]'
              )}>
                <Icon className={cn('w-4 h-4', node.color)} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <span className={cn('text-2xs font-medium uppercase tracking-[0.12em]', node.color)}>
                  {node.step}
                </span>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{node.label}</p>
                <p className="text-2xs text-text-tertiary mt-0.5 leading-relaxed">{node.desc}</p>
              </div>

              {/* Step number */}
              <span className="text-2xs text-text-disabled font-mono shrink-0">
                0{i + 1}
              </span>
            </div>

            {/* Connector arrow */}
            {i < WORKFLOW_NODES.length - 1 && (
              <div className="absolute left-8 -bottom-2 w-px h-2 bg-border-strong z-10" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function WorkflowDiagramMobile() {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {WORKFLOW_NODES.map((node, i) => {
        const Icon = node.icon;
        return (
          <React.Fragment key={node.step}>
            <div className={cn(
              'flex-shrink-0 flex flex-col items-center gap-1.5 p-3 rounded-xl border min-w-[110px]',
              node.bg
            )}>
              <Icon className={cn('w-4 h-4', node.color)} />
              <span className="text-2xs font-medium text-text-primary text-center leading-tight">
                {node.step}
              </span>
            </div>
            {i < WORKFLOW_NODES.length - 1 && (
              <ChevronRight className="w-3 h-3 text-text-disabled shrink-0" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Market-design decisions
// ─────────────────────────────────────────────────────────────────────────────

const DECISION_CARDS = [
  {
    icon:  Layers,
    label: 'Initial Liquidity',
    desc:  'How much capital seeds the bonding curve at launch and how it is distributed across the price range.',
  },
  {
    icon:  TrendingUp,
    label: 'Price Discovery',
    desc:  'How aggressively the curve moves with early trades — affecting initial price sensitivity and volatility.',
  },
  {
    icon:  Percent,
    label: 'Fee Structure',
    desc:  'Trading fees collected during the bonding curve phase and how they flow to the creator.',
  },
  {
    icon:  BarChart2,
    label: 'Liquidity Distribution',
    desc:  'How liquidity is spread across the price range — concentrated near the start or distributed across a wider band.',
  },
  {
    icon:  Lock,
    label: 'Migration Conditions',
    desc:  'The target market cap or liquidity threshold that triggers migration to a full AMM pool.',
  },
  {
    icon:  Coins,
    label: 'Creator Economics',
    desc:  'The share of bonding curve proceeds that flow back to the token creator on graduation.',
  },
] as const;

function Section2() {
  return (
    <section className="py-20 md:py-28 border-t border-border">
      <div className="max-w-screen-xl mx-auto px-5">

        {/* Header */}
        <div className="max-w-2xl mb-12">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-px w-6 bg-border-strong" />
            <span className="text-2xs font-medium text-text-tertiary uppercase tracking-[0.15em]">
              The Decision Layer
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary tracking-tight leading-[1.1]">
            Your launch parameters<br />shape the market.
          </h2>
          <p className="mt-5 text-sm text-text-secondary leading-relaxed max-w-xl">
            Initial liquidity. Price discovery. Fees. Liquidity distribution. Migration conditions.
            These decisions can influence how a market behaves before you&apos;ve even seen the first trade.
          </p>
          <p className="mt-3 text-sm text-text-tertiary leading-relaxed max-w-xl">
            HERMES turns those decisions into something you can model, compare, and understand before launch.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {DECISION_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={cn(
                  'p-5 rounded-xl border border-border bg-bg-surface',
                  '[background-image:linear-gradient(180deg,rgba(255,255,255,0.03)_0%,transparent_100%)]',
                  'hover:border-border-strong hover:bg-bg-elevated',
                  'transition-[border-color,background-color] duration-200'
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-accent-subtle border border-accent/15 flex items-center justify-center mb-3.5">
                  <Icon className="w-4 h-4 text-accent" />
                </div>
                <p className="text-sm font-semibold text-text-primary mb-1.5">{card.label}</p>
                <p className="text-xs text-text-tertiary leading-relaxed">{card.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — 4-step workflow
// ─────────────────────────────────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  {
    num:   '01',
    title: 'Define Your Objective',
    items: [
      'Discover an initial market price',
      'Bootstrap early liquidity',
      'Test genuine demand',
      'Reach a target market condition',
    ],
    desc:  'Tell HERMES what you are trying to achieve. The objective shapes which formation strategies are surfaced.',
    icon:  Target,
  },
  {
    num:   '02',
    title: 'Compare Formation Strategies',
    icon:  GitBranch,
    strategies: [
      {
        name:  'Liquidity First',
        desc:  'Prioritize stronger early liquidity conditions. Lower initial price sensitivity, deeper curve depth.',
        color: 'text-chart-b',
        bg:    'bg-success/[0.07] border-success/20',
      },
      {
        name:  'Balanced Formation',
        desc:  'Balance liquidity, price discovery, and graduation progression.',
        color: 'text-accent',
        bg:    'bg-accent-subtle border-accent/20',
      },
      {
        name:  'Price Discovery First',
        desc:  'Prioritize stronger price discovery dynamics. Higher initial sensitivity, faster price movement.',
        color: 'text-chart-c',
        bg:    'bg-warning/[0.07] border-warning/20',
      },
    ],
  },
  {
    num:   '03',
    title: 'Stress-Test the Market',
    icon:  FlaskConical,
    scenarios: [
      { label: 'Weak demand',            desc: 'What happens if early trading volume is lower than expected?' },
      { label: 'Strong demand',          desc: 'What if demand is much stronger than anticipated?' },
      { label: 'Concentrated activity',  desc: 'What if a small number of large trades dominate early price action?' },
    ],
    desc: 'Run different scenarios before putting real capital at risk.',
  },
  {
    num:   '04',
    title: 'Verify Before You Deploy',
    icon:  ShieldCheck,
    verifyItems: [
      'Liquidity distribution',
      'Fee structure',
      'Price formation curve',
      'Migration conditions',
      'Locked liquidity',
      'Creator economics',
    ],
    tagline: 'No black box. Know what you\'re launching before you sign.',
  },
] as const;

function Section3({ id }: { id?: string }) {
  return (
    <section id={id} className="py-20 md:py-28 border-t border-border">
      <div className="max-w-screen-xl mx-auto px-5">

        {/* Header */}
        <div className="max-w-2xl mb-14">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-px w-6 bg-border-strong" />
            <span className="text-2xs font-medium text-text-tertiary uppercase tracking-[0.15em]">
              How It Works
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary tracking-tight leading-[1.1]">
            From launch configuration<br />to market formation.
          </h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Step 01 */}
          <StepCard step={WORKFLOW_STEPS[0]}>
            <ul className="mt-4 space-y-2">
              {WORKFLOW_STEPS[0].items.map(item => (
                <li key={item} className="flex items-start gap-2.5 text-xs text-text-secondary">
                  <span className="w-1 h-1 rounded-full bg-accent mt-1.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </StepCard>

          {/* Step 02 */}
          <StepCard step={WORKFLOW_STEPS[1]}>
            <div className="mt-4 space-y-2">
              {WORKFLOW_STEPS[1].strategies.map((s) => (
                <div key={s.name} className={cn('p-3 rounded-lg border text-xs', s.bg)}>
                  <p className={cn('font-semibold mb-0.5', s.color)}>{s.name}</p>
                  <p className="text-text-tertiary leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </StepCard>

          {/* Step 03 */}
          <StepCard step={WORKFLOW_STEPS[2]}>
            <div className="mt-4 space-y-2.5">
              {WORKFLOW_STEPS[2].scenarios.map((s) => (
                <div key={s.label} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-text-primary">{s.label}</p>
                    <p className="text-2xs text-text-tertiary mt-0.5 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
              <p className="text-xs text-text-tertiary pt-1 border-t border-border">
                {WORKFLOW_STEPS[2].desc}
              </p>
            </div>
          </StepCard>

          {/* Step 04 */}
          <StepCard step={WORKFLOW_STEPS[3]}>
            <div className="mt-4 grid grid-cols-2 gap-1.5">
              {WORKFLOW_STEPS[3].verifyItems.map(item => (
                <div key={item} className="flex items-center gap-1.5 text-2xs text-text-secondary">
                  <span className="w-1 h-1 rounded-full bg-chart-e shrink-0" />
                  {item}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-text-secondary border-t border-border pt-3 leading-relaxed">
              {WORKFLOW_STEPS[3].tagline}
            </p>
          </StepCard>

        </div>
      </div>
    </section>
  );
}

function StepCard({ step, children }: {
  step: { num: string; title: string; icon: React.ElementType; desc?: string };
  children: React.ReactNode;
}) {
  const Icon = step.icon;
  return (
    <div className={cn(
      'p-6 rounded-xl border border-border bg-bg-surface',
      '[background-image:linear-gradient(180deg,rgba(255,255,255,0.025)_0%,transparent_100%)]'
    )}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xs text-text-disabled font-mono">{step.num}</span>
        <div className="w-8 h-8 rounded-lg bg-bg-elevated border border-border flex items-center justify-center">
          <Icon className="w-4 h-4 text-text-tertiary" />
        </div>
      </div>
      <h3 className="text-base font-semibold text-text-primary">{step.title}</h3>
      {step.desc && (
        <p className="text-xs text-text-tertiary mt-1.5 leading-relaxed">{step.desc}</p>
      )}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Meteora DBC
// ─────────────────────────────────────────────────────────────────────────────

const LIFECYCLE = ['Design', 'Simulate', 'Verify', 'Deploy'] as const;

function Section4() {
  return (
    <section className="py-20 md:py-28 border-t border-border">
      <div className="max-w-screen-xl mx-auto px-5">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left: copy */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-px w-6 bg-border-strong" />
              <span className="text-2xs font-medium text-text-tertiary uppercase tracking-[0.15em]">
                Infrastructure
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary tracking-tight leading-[1.1]">
              Built on Meteora&apos;s<br />
              Dynamic Bonding Curve.
            </h2>
            <p className="mt-5 text-sm text-text-secondary leading-relaxed max-w-lg">
              HERMES uses Meteora&apos;s Dynamic Bonding Curve infrastructure to turn
              market-formation decisions into an executable onchain market.
            </p>

            {/* Layer clarification */}
            <div className="mt-8 space-y-3">
              <div className="flex items-start gap-3 p-4 rounded-xl border border-accent/25 bg-accent-subtle">
                <Code2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-accent uppercase tracking-wide">HERMES</p>
                  <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                    Market formation decision layer — design, simulate, compare, and verify.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="flex items-center gap-1.5 text-2xs text-text-disabled">
                  <div className="h-px w-6 bg-border" />
                  <span>executes via</span>
                  <div className="h-px w-6 bg-border" />
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-bg-elevated">
                <Rocket className="w-4 h-4 text-text-tertiary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-text-primary uppercase tracking-wide">Meteora DBC</p>
                  <p className="text-xs text-text-tertiary mt-0.5 leading-relaxed">
                    Execution and infrastructure layer — official onchain bonding curve program.
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-6 text-xs text-text-disabled">
              <a
                href="https://meteora.ag"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-text-secondary transition-colors"
              >
                meteora.ag →
              </a>
            </p>
          </div>

          {/* Right: lifecycle */}
          <div>
            <div className="relative">
              {LIFECYCLE.map((stage, i) => (
                <div key={stage} className="relative">
                  <div className={cn(
                    'flex items-center gap-4 p-5 rounded-xl border',
                    'bg-bg-surface border-border',
                    '[background-image:linear-gradient(180deg,rgba(255,255,255,0.025)_0%,transparent_100%)]',
                    'hover:border-border-strong hover:bg-bg-elevated',
                    'transition-[border-color,background-color] duration-200'
                  )}>
                    {/* Step indicator */}
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-mono text-xs font-semibold',
                      i === LIFECYCLE.length - 1
                        ? 'bg-accent text-white shadow-glow-sm'
                        : 'bg-bg-elevated border border-border text-text-tertiary'
                    )}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{stage}</p>
                      <p className="text-2xs text-text-tertiary mt-0.5">
                        {stage === 'Design'   && 'Configure token parameters and market objective'}
                        {stage === 'Simulate' && 'Run deterministic trade scenarios across strategies'}
                        {stage === 'Verify'   && 'Inspect all parameters before signing'}
                        {stage === 'Deploy'   && 'Submit to the official Meteora DBC program onchain'}
                      </p>
                    </div>
                  </div>
                  {/* Connector */}
                  {i < LIFECYCLE.length - 1 && (
                    <div className="flex justify-center py-1.5">
                      <div className="w-px h-5 bg-border-strong" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Who it's for
// ─────────────────────────────────────────────────────────────────────────────

const PERSONAS = [
  {
    icon:  Coins,
    title: 'Token Creators',
    desc:  'Understand the market you\'re creating before launch. Make deliberate decisions about how your token\'s market will form — not guesses.',
  },
  {
    icon:  Code2,
    title: 'Protocol Teams',
    desc:  'Test different formation strategies around your token\'s objectives. Validate assumptions before real capital and real users are involved.',
  },
  {
    icon:  Users,
    title: 'Launch Teams',
    desc:  'Move beyond copying presets. Use HERMES to explore the tradeoffs between formation strategies and arrive at a deliberate market design.',
  },
] as const;

function Section5() {
  return (
    <section className="py-20 md:py-28 border-t border-border">
      <div className="max-w-screen-xl mx-auto px-5">

        {/* Header */}
        <div className="max-w-2xl mb-12">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-px w-6 bg-border-strong" />
            <span className="text-2xs font-medium text-text-tertiary uppercase tracking-[0.15em]">
              Who It&apos;s For
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary tracking-tight leading-[1.1]">
            Built for teams<br />launching new markets.
          </h2>
        </div>

        {/* Persona cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PERSONAS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className={cn(
                  'p-6 rounded-xl border border-border bg-bg-surface',
                  '[background-image:linear-gradient(180deg,rgba(255,255,255,0.025)_0%,transparent_100%)]',
                  'hover:border-border-strong hover:bg-bg-elevated',
                  'transition-[border-color,background-color] duration-200'
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-accent-subtle border border-accent/15 flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-2">{p.title}</h3>
                <p className="text-sm text-text-tertiary leading-relaxed">{p.desc}</p>
              </div>
            );
          })}
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
    <section className="py-20 md:py-28 border-t border-border">
      <div className="max-w-screen-xl mx-auto px-5">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-bg-surface p-10 md:p-16 text-center">

          {/* Ambient glow — subtle */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[200px] rounded-full bg-accent opacity-[0.06] blur-[80px]" />
          </div>

          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary tracking-tight leading-[1.1] mb-2">
              Don&apos;t just launch a token.
            </h2>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-[1.1] mb-6">
              <span className="text-gradient-accent">Understand the market you&apos;re creating.</span>
            </h2>
            <p className="text-sm text-text-secondary max-w-xl mx-auto leading-relaxed mb-8">
              HERMES gives you a way to explore the tradeoffs before real users and real capital do it for you.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/markets/new">
                <Button variant="primary" size="lg" icon={<Plus className="w-4 h-4" />}>
                  Start a Market
                </Button>
              </Link>
            </div>
            <p className="mt-5 text-2xs text-text-disabled">
              Powered by Meteora DBC
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKETS LIST (existing functionality — preserved)
// ─────────────────────────────────────────────────────────────────────────────

function MarketsSection({ markets, loading }: { markets: MarketBrief[]; loading: boolean }) {
  return (
    <section className="py-12 border-t border-border">
      <div className="max-w-screen-xl mx-auto px-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Your Markets</h2>
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
            description="Create your first market brief to start designing and simulating DBC configurations."
            action={
              <Link href="/markets/new">
                <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
                  Start a Market
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
    </section>
  );
}

function MarketRow({ market }: { market: MarketBrief }) {
  return (
    <Link href={`/markets/${market.id}/design`} className="block group">
      <div className={cn(
        'flex items-center gap-4 px-4 py-3 rounded-xl',
        'border border-border bg-bg-surface',
        'hover:bg-bg-elevated hover:border-border-strong',
        'active:scale-[0.995] active:brightness-95',
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

        {/* Arrow */}
        <ArrowRight className="w-3.5 h-3.5 text-text-tertiary shrink-0 group-hover:text-accent transition-colors duration-150" />
      </div>
    </Link>
  );
}
