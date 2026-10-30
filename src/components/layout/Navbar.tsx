'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { WalletButton } from '@/components/ui/WalletButton';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { ArrowUpRight, ChevronRight, Menu, X } from 'lucide-react';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const DOCS_URL = 'https://docs.meteora.ag/dynamic-bonding-curve/dbc-integration/overview';

// ── Logo ─────────────────────────────────────────────────────────────────────

function HermesLogo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Image
        src="/hermes-logo.png"
        alt=""
        width={36}
        height={36}
        priority
        className="h-9 w-9 shrink-0"
      />
      <span className="text-text-primary font-semibold text-[17px] leading-none" style={{ letterSpacing: '-0.04em' }}>
        HERMES
      </span>
    </span>
  );
}

// ── Navbar ──────────────────────────────────────────────────────────────────

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-40 h-16 flex items-center',
          'transition-[background-color,box-shadow,backdrop-filter] duration-300 ease-cinema',
          scrolled
            ? 'bg-white/70 backdrop-blur-2xl saturate-150 shadow-[0_1px_0_rgba(12,12,20,0.06)]'
            : 'bg-transparent'
        )}
      >
        <div className="relative w-full max-w-screen-xl mx-auto px-5 md:px-8 flex items-center justify-between gap-6">
          {/* Brand */}
          <Link href="/" className="flex items-center shrink-0 group" aria-label="HERMES — home">
            <HermesLogo className="transition-opacity duration-200 group-hover:opacity-80" />
            {DEMO_MODE && <Badge variant="warning" className="ml-2">Demo</Badge>}
          </Link>

          {/* Centered link group */}
          <nav
            className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-0.5 p-1 rounded-full bg-white/60 backdrop-blur-xl ring-1 ring-inset ring-border-subtle"
            aria-label="Primary navigation"
          >
            <NavLink href="/#how-it-works" label="How it works" active={false} />
            <NavLink href="/#markets" label="Markets" active={pathname === '/'} />
            <NavLink href={DOCS_URL} label="Docs" active={false} external />
          </nav>

          {/* Right */}
          <div className="hidden md:flex items-center gap-2.5">
            <NetworkIndicator />
            <WalletButton />
            <Link
              href="/markets/new"
              className={cn(
                'group inline-flex items-center gap-1.5 h-9 pl-4 pr-3 rounded-full',
                'bg-ink text-white text-sm font-medium',
                'transition-[transform,box-shadow] duration-200 ease-cinema',
                'hover:shadow-[0_10px_28px_-8px_rgba(11,11,16,0.55)] active:scale-[0.97]'
              )}
            >
              Start a market
              <ArrowUpRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>

          {/* Mobile */}
          <div className="flex md:hidden items-center gap-2">
            <WalletButton />
            <button
              type="button"
              onClick={() => setMobileOpen(v => !v)}
              className="h-9 w-9 grid place-items-center rounded-full bg-white/70 ring-1 ring-inset ring-border text-text-primary"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-ink/20 backdrop-blur-sm" />
          <div
            className="absolute top-16 left-3 right-3 glass rounded-2xl p-2 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <MobileNavLink href="/#how-it-works" label="How it works" onClick={() => setMobileOpen(false)} />
            <MobileNavLink href="/#markets" label="Markets" onClick={() => setMobileOpen(false)} />
            <MobileNavLink href={DOCS_URL} label="Docs" onClick={() => setMobileOpen(false)} external />
            <Link
              href="/markets/new"
              onClick={() => setMobileOpen(false)}
              className="mt-2 flex items-center justify-center gap-1.5 h-12 rounded-full bg-ink text-white text-sm font-medium"
            >
              Start a market <ArrowUpRight className="w-4 h-4" />
            </Link>
            {pathname !== '/' && <div className="pt-3 pb-1 flex justify-center"><NetworkIndicator /></div>}
          </div>
        </div>
      )}
    </>
  );
}

function NavLink({ href, active, label, external }: {
  href: string; active: boolean; label: string; external?: boolean;
}) {
  const cls = cn(
    'px-4 h-8 inline-flex items-center rounded-full text-sm',
    'transition-[background-color,color] duration-200',
    active
      ? 'text-text-primary bg-white shadow-sm'
      : 'text-text-secondary hover:text-text-primary hover:bg-white/70'
  );
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{label}</a>
    : <Link href={href} className={cls}>{label}</Link>;
}

function MobileNavLink({ href, label, onClick, external }: {
  href: string; label: string; onClick: () => void; external?: boolean;
}) {
  const cls = 'flex items-center justify-between px-4 py-3 rounded-xl text-base text-text-primary hover:bg-white/80 transition-colors';
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls} onClick={onClick}>{label}</a>
    : <Link href={href} className={cls} onClick={onClick}>{label}</Link>;
}

// ── Network indicator ───────────────────────────────────────────────────────

export function NetworkIndicator() {
  // The landing page is marketing, not a place to transact: no network pill there.
  // Everywhere else it stays, because users should always know which network they are on.
  const pathname = usePathname();
  if (pathname === '/') return null;
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet';
  const isMainnet = network === 'mainnet-beta';
  return (
    <div className="flex items-center gap-2 px-3 h-9 rounded-full text-xs font-medium text-text-secondary">
      <span className="relative flex h-2 w-2">
        <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-50 animate-ping', isMainnet ? 'bg-success' : 'bg-warning')} />
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', isMainnet ? 'bg-success' : 'bg-warning')} />
      </span>
      {isMainnet ? 'Mainnet' : 'Devnet'}
    </div>
  );
}

// ── PageLayout ──────────────────────────────────────────────────────────────

interface BreadcrumbItem { label: string; href?: string; }

export function PageLayout({ children, breadcrumbs, title, subtitle, actions }: {
  children:     React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  title?:       string;
  subtitle?:    string;
  actions?:     React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-16">
        {(breadcrumbs || title) && (
          <div>
            <div className="max-w-screen-xl mx-auto px-5 md:px-8 pt-6 flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                {breadcrumbs?.map((b, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <ChevronRight className="w-3 h-3 text-text-disabled shrink-0" />}
                    {b.href ? (
                      <Link href={b.href} className="text-xs text-text-tertiary hover:text-text-primary transition-colors truncate max-w-[9rem] md:max-w-none">
                        {b.label}
                      </Link>
                    ) : (
                      <span className="text-xs text-text-primary font-medium truncate max-w-[9rem] md:max-w-none">{b.label}</span>
                    )}
                  </React.Fragment>
                ))}
                {title && !breadcrumbs && <span className="text-sm font-semibold text-text-primary">{title}</span>}
              </div>
              {subtitle && <p className="text-xs text-text-tertiary max-w-sm text-left md:text-right leading-snug">{subtitle}</p>}
              {actions && <div className="flex items-center gap-2 shrink-0 ml-4">{actions}</div>}
            </div>
          </div>
        )}
        <div className="max-w-screen-xl mx-auto px-5 md:px-8 py-6 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}

// ── Market step rail ────────────────────────────────────────────────────────

const MARKET_TABS = [
  { label: 'Objective', href: (id: string) => `/markets/${id}/objective` },
  { label: 'Plans',     href: (id: string) => `/markets/${id}/plans`     },
  { label: 'Verify',    href: (id: string) => `/markets/${id}/verify`    },
  { label: 'Design',    href: (id: string) => `/markets/${id}/design`    },
  { label: 'Simulate',  href: (id: string) => `/markets/${id}/simulate`  },
  { label: 'Compare',   href: (id: string) => `/markets/${id}/compare`   },
  { label: 'Deploy',    href: (id: string) => `/markets/${id}/deploy`    },
  { label: 'Monitor',   href: (id: string) => `/markets/${id}`           },
  { label: 'Analysis',  href: (id: string) => `/markets/${id}/analysis`  },
] as const;

const STEP_TITLES: Record<string, [string, string]> = {
  Objective: ['Define the',   'objective.'],
  Plans:     ['Choose a',     'plan.'],
  Verify:    ['Verify the',   'design.'],
  Design:    ['Compare',      'candidates.'],
  Simulate:  ['Stress-test the', 'market.'],
  Compare:   ['Side by',      'side.'],
  Deploy:    ['Deploy',       'on-chain.'],
  Monitor:   ['Watch it',     'form.'],
  Analysis:  ['Designed vs.', 'actual.'],
};

export function MarketSubNav({ marketId }: { marketId: string }) {
  const pathname = usePathname();
  const current = MARKET_TABS.find(t =>
    t.label === 'Monitor' ? pathname === t.href(marketId) : pathname.startsWith(t.href(marketId))
  );
  const title = current ? STEP_TITLES[current.label] : undefined;

  return (
    <>
    {title && (
      <h1 className="display display-md text-text-primary mt-2 mb-6 animate-slide-up">
        {title[0]} <span className="serif-i text-[1.12em]">{title[1]}</span>
      </h1>
    )}
    <div className="mb-8 -mx-1 overflow-x-auto no-scrollbar">
      <nav className="inline-flex items-center gap-0.5 p-1 rounded-full glass min-w-max">
        {MARKET_TABS.map((tab, i) => {
          const href   = tab.href(marketId);
          const active = tab.label === 'Monitor' ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={tab.label}
              href={href}
              className={cn(
                'group inline-flex items-center gap-2 h-9 pl-2.5 pr-4 rounded-full text-sm',
                'transition-[background-color,color,box-shadow] duration-300 ease-cinema',
                active
                  ? 'bg-ink text-white shadow-[0_8px_20px_-8px_rgba(11,11,16,0.6)]'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/80'
              )}
            >
              <span
                className={cn(
                  'font-mono text-[10px] w-5 h-5 grid place-items-center rounded-full tabular-nums',
                  active ? 'bg-white/15 text-white' : 'bg-bg-muted text-text-tertiary group-hover:text-text-primary'
                )}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
    </>
  );
}
