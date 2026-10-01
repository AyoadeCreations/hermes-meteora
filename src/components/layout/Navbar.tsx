'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletButton } from '@/components/ui/WalletButton';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { BarChart3, Plus, ChevronRight } from 'lucide-react';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// ── Navbar ──────────────────────────────────────────────────────────────────

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className={cn(
      'fixed top-0 left-0 right-0 z-40 h-12',
      'flex items-center',
      'bg-bg-base/80 backdrop-blur-xl',
      'border-b border-border'
    )}>
      <div className="w-full max-w-screen-2xl mx-auto px-5 flex items-center justify-between">

        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 shrink-0 group"
        >
          <div className="w-6 h-6 rounded-lg bg-accent flex items-center justify-center shadow-glow-sm
                          transition-[box-shadow] duration-150 group-hover:shadow-glow">
            <BarChart3 className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-text-primary tracking-tight">
            HERMES
          </span>
          {DEMO_MODE && <Badge variant="warning" className="ml-0.5">Demo</Badge>}
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-0.5">
          <NavLink href="/"            active={pathname === '/'}            label="Markets" />
          <NavLink href="/markets/new" active={pathname === '/markets/new'} label="New Market" highlight />
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <NetworkIndicator />
          <WalletButton />
        </div>
      </div>
    </header>
  );
}

// ── NavLink ─────────────────────────────────────────────────────────────────

function NavLink({ href, active, label, highlight }: {
  href: string; active: boolean; label: string; highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'px-3 py-1.5 rounded-lg text-sm',
        // Specific transitions — never `all`
        'transition-[background-color,color] duration-150',
        active
          ? 'text-text-primary bg-bg-elevated'
          : highlight
          ? 'text-accent hover:text-accent-hover hover:bg-accent-subtle'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
      )}
    >
      {highlight && <Plus className="inline w-3 h-3 mr-1 -mt-0.5" />}
      {label}
    </Link>
  );
}

// ── Network indicator ───────────────────────────────────────────────────────

function NetworkIndicator() {
  const network   = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet';
  const isMainnet = network === 'mainnet-beta';

  return (
    <div className={cn(
      'flex items-center gap-1.5 px-2.5 py-1 rounded-lg',
      'border text-2xs font-medium',
      isMainnet
        ? 'border-success/25 bg-success-muted text-success'
        : 'border-warning/25 bg-warning-muted text-warning'
    )}>
      <span className={cn(
        'w-1.5 h-1.5 rounded-full',
        isMainnet ? 'bg-success animate-pulse-slow' : 'bg-warning'
      )} />
      {isMainnet ? 'Mainnet' : 'Devnet'}
    </div>
  );
}

// ── PageLayout ──────────────────────────────────────────────────────────────

interface BreadcrumbItem { label: string; href?: string; }

export function PageLayout({ children, breadcrumbs, title, actions }: {
  children:     React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  title?:       string;
  actions?:     React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg-base">
      <Navbar />
      <main className="pt-12">
        {(breadcrumbs || title) && (
          <div className="border-b border-border bg-bg-surface/40 backdrop-blur-sm">
            <div className="max-w-screen-2xl mx-auto px-5 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                {breadcrumbs?.map((b, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && (
                      <ChevronRight className="w-3 h-3 text-text-disabled shrink-0" />
                    )}
                    {b.href ? (
                      <Link
                        href={b.href}
                        className="text-xs text-text-tertiary hover:text-text-secondary
                                   transition-colors duration-100 truncate"
                      >
                        {b.label}
                      </Link>
                    ) : (
                      /* Current page — high-contrast */
                      <span className="text-xs text-text-primary font-medium truncate">
                        {b.label}
                      </span>
                    )}
                  </React.Fragment>
                ))}
                {title && !breadcrumbs && (
                  <span className="text-sm font-semibold text-text-primary">{title}</span>
                )}
              </div>
              {actions && (
                <div className="flex items-center gap-2 shrink-0 ml-4">{actions}</div>
              )}
            </div>
          </div>
        )}
        {/* Page entrance animation */}
        <div className="max-w-screen-2xl mx-auto px-5 py-6 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}

// ── Market sub-nav ──────────────────────────────────────────────────────────

const MARKET_TABS = [
  { label: 'Design',   href: (id: string) => `/markets/${id}/design`   },
  { label: 'Simulate', href: (id: string) => `/markets/${id}/simulate` },
  { label: 'Compare',  href: (id: string) => `/markets/${id}/compare`  },
  { label: 'Deploy',   href: (id: string) => `/markets/${id}/deploy`   },
  { label: 'Monitor',  href: (id: string) => `/markets/${id}`          },
  { label: 'Analysis', href: (id: string) => `/markets/${id}/analysis` },
] as const;

export function MarketSubNav({ marketId }: { marketId: string }) {
  const pathname = usePathname();

  return (
    <div className="border-b border-border bg-bg-surface/30">
      <div className="max-w-screen-2xl mx-auto px-5">
        <nav className="flex -mb-px gap-0">
          {MARKET_TABS.map((tab) => {
            const href   = tab.href(marketId);
            const active = tab.label === 'Monitor'
              ? pathname === href
              : pathname.startsWith(href);

            return (
              <Link
                key={tab.label}
                href={href}
                className={cn(
                  'px-4 py-3 text-xs font-medium border-b-2',
                  // Specific transitions — never `all`
                  'transition-[color,border-color] duration-150',
                  active
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-tertiary hover:text-text-secondary hover:border-border-strong'
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
