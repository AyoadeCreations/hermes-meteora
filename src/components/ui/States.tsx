import * as React from 'react';
import { cn } from '@/lib/cn';
import { AlertTriangle, Loader2, SearchX } from 'lucide-react';

// ── Spinner ─────────────────────────────────────────────────────────────────

export function Spinner({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const s = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' }[size];
  return <Loader2 className={cn('animate-spin text-text-tertiary', s, className)} />;
}

// ── Skeleton primitive ────────────────────────────────────────────────────────
// Use this to build content-shaped skeletons that match the real layout.

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg bg-bg-elevated animate-pulse',
        // Shimmer overlay
        'relative overflow-hidden',
        'after:absolute after:inset-0',
        'after:bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.04)_50%,transparent_100%)]',
        'after:animate-[shimmer_1.8s_ease-in-out_infinite]',
        className
      )}
    />
  );
}

// ── Loading ──────────────────────────────────────────────────────────────────
// Shows a content-shaped skeleton for lists of market rows.

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <div aria-label={message}>
      {/* Market-row shaped skeletons — match the MarketRow layout */}
      <div className="space-y-1.5">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-bg-surface"
            style={{ opacity: 1 - i * 0.2 }}
          >
            {/* Token icon */}
            <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
            {/* Main info */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-2.5 w-56 opacity-60" />
            </div>
            {/* Badge */}
            <Skeleton className="h-5 w-20 rounded-full" />
            {/* Timestamp */}
            <Skeleton className="h-2.5 w-12 shrink-0 opacity-50" />
          </div>
        ))}
      </div>
      {/* Screen reader announcement */}
      <p className="sr-only">{message}</p>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  title:        string;
  description?: string;
  action?:      React.ReactNode;
  className?:   string;
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-20 text-center',
        className
      )}
    >
      <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border flex items-center justify-center">
        <SearchX className="w-5 h-5 text-text-tertiary" />
      </div>
      <div>
        {/* Active voice, sentence-case */}
        <p className="text-sm font-medium text-text-secondary">{title}</p>
        {description && (
          <p className="text-xs text-text-tertiary mt-1 max-w-xs mx-auto leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

interface ErrorStateProps {
  title?:     string;
  message:    string;
  action?:    React.ReactNode;
  className?: string;
}

export function ErrorState({
  title   = 'Something went wrong',
  message,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-20 text-center',
        className
      )}
    >
      <div className="w-12 h-12 rounded-xl bg-danger-muted border border-danger/20 flex items-center justify-center">
        <AlertTriangle className="w-5 h-5 text-danger" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-secondary">{title}</p>
        {/* Error detail in mono — makes it scannable */}
        <p className="text-xs text-text-tertiary mt-1 max-w-sm mx-auto font-mono leading-relaxed">
          {message}
        </p>
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

// ── Warning banner ────────────────────────────────────────────────────────────

export function WarningBanner({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg',
        'border border-warning/25 bg-warning-muted text-warning text-xs',
        className
      )}
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

// ── Demo mode banner ──────────────────────────────────────────────────────────

export function DemoModeBanner() {
  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-warning/90 backdrop-blur-sm text-bg-base text-2xs font-semibold text-center py-1 tracking-wide">
      DEMO MODE — Simulated scenarios only. No live blockchain transactions.
    </div>
  );
}
