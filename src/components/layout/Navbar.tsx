'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { WalletButton } from '@/components/ui/WalletButton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { ChevronRight, Menu, X, Plus } from 'lucide-react';

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

// ── Logo — uses the actual /public/logo.svg asset ────────────────────────────
// Falls back to inline H-mark only if the Image fails to load (should never happen).

function HermesLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.svg"
      alt="HERMES"
      width={112}
      height={28}
      priority
      className={className}
    />
  );
}

// ── Navbar ──────────────────────────────────────────────────────────────────

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className={cn(
        'fixed top-0 left-0 right-0 z-40 h-14',
        'flex items-center',
        'bg-bg-base/90 backdrop-blur-xl',
        'border-b border-border'
      )}>
        <div className="w-full max-w-screen-xl mx-auto px-5 flex items-center justify-between gap-6">

          {/* ── Brand ── */}
          <Link
            href="/"
            className="flex items-center gap-0 shrink-0 group"
            aria-label="HERMES — home"
          >
            <HermesLogo className="h-7 w-auto transition-opacity duration-150 group-hover:opacity-90" />
            {DEMO_MODE && <Badge variant="warning" className="ml-2">Demo</Badge>}
          </Link>

          {/* ── Desktop nav ── */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1" aria-label="Primary navigation">
            <NavLink href="/#how-it-works" label="How It Works" active={false} />
            <NavLink href="/"             label="Markets"      active={pathname === '/'} />
            <NavLink href="https://docs.meteora.ag/dynamic-bonding-curve/dbc-integration/overview" label="Docs" active={false} external />
          </nav>

          {/* ── Right side ── */}
          <div className="hidden md:flex items-center gap-3">
            <NetworkIndicator />
            <WalletButton />
            <Link href="/markets/new">
              <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                Start a Market
              </Button>
            </Link>
          </div>

          {/* ── Mobile: wallet + hamburger ── */}
          <div className="flex md:hidden items-center gap-2">
            <WalletButton />
            <button
              type="button"
              onClick={() => setMobileOpen(v => !v)}
              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMobileOpen(false)}>
          <div
            className={cn(
              'absolute top-14 left-0 right-0',
              'bg-bg-base/95 backdrop-blur-xl border-b border-border',
              'py-3 px-5 space-y-1 animate-slide-up'
            )}
            onClick={e => e.stopPropagation()}
          >
            <MobileNavLink href="/#how-it-works" label="How It Works"  onClick={() => setMobileOpen(false)} />
            <MobileNavLink href="/"              label="Markets"       onClick={() => setMobileOpen(false)} />
            <MobileNavLink href="https://docs.meteora.ag/dynamic-bonding-curve/dbc-integration/overview" label="Docs" onClick={() => setMobileOpen(false)} external />
            <div className="pt-2 border-t border-border">
              <Link href="/markets/new" onClick={() => setMobileOpen(false)}>
                <Button variant="primary" size="md" className="w-full justify-center" icon={<Plus className="w-4 h-4" />}>
                  Start a Market
                </Button>
              </Link>
            </div>
            <div className="pt-1">
              <NetworkIndicator />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Desktop NavLink ──────────────────────────────────────────────────────────

function NavLink({ href, active, label, external }: {
  href: string; active: boolean; label: string; external?: boolean;
}) {
  const cls = cn(
    'px-3 py-1.5 rounded-lg text-sm',
    'transition-[background-color,color] duration-150',
    active
      ? 'text-text-primary bg-bg-elevated'
      : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={cls}>
      {label}
    </Link>
  );
}

// ── Mobile NavLink ───────────────────────────────────────────────────────────

function MobileNavLink({ href, label, onClick, external }: {
  href: string; label: string; onClick: () => void; external?: boolean;
}) {
  const cls = 'flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors';

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} onClick={onClick}>
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={cls} onClick={onClick}>
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

export function PageLayout({ children, breadcrumbs, title, subtitle, actions }: {
  children:     React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  title?:       string;
  subtitle?:    string;
  actions?:     React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg-base">
      <Navbar />
      <main className="pt-14">
        {(breadcrumbs || title) && (
          <div className="border-b border-border bg-bg-surface/40 backdrop-blur-sm">
            <div className="max-w-screen-xl mx-auto px-5 py-2.5 flex items-center justify-between">
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
              {subtitle && (
                <p className="text-xs text-text-tertiary mt-0.5 truncate max-w-lg">{subtitle}</p>
              )}
              {actions && (
                <div className="flex items-center gap-2 shrink-0 ml-4">{actions}</div>
              )}
            </div>
          </div>
        )}
        <div className="max-w-screen-xl mx-auto px-5 py-6 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}

// ── Market sub-nav ──────────────────────────────────────────────────────────

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

export function MarketSubNav({ marketId }: { marketId: string }) {
  const pathname = usePathname();

  return (
    <div className="border-b border-border bg-bg-surface/30">
      <div className="max-w-screen-xl mx-auto px-5">
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
