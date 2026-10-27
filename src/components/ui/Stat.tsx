import * as React from 'react';
import { cn } from '@/lib/cn';

interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  label:   string;
  value:   React.ReactNode;
  sub?:    React.ReactNode;
  change?: number;
  size?:   'sm' | 'md' | 'lg';
}

export function Stat({
  label,
  value,
  sub,
  change,
  size = 'md',
  className,
  ...props
}: StatProps) {
  const valueSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-2xl';

  return (
    <div className={cn('flex flex-col gap-0.5', className)} {...props}>
      {/* Label — uppercase, widest tracking, tertiary color = hierarchy */}
      <span className="text-2xs text-text-tertiary uppercase tracking-[0.12em] font-medium leading-none mb-1.5">
        {label}
      </span>

      {/* Value — tabular-nums ensures digits don't jitter on update */}
      <span
        className={cn(
          'font-medium tabular-nums font-mono text-text-primary leading-none tracking-tight',
          valueSize
        )}
      >
        {value}
      </span>

      {/* Sub / change — baseline-aligned together */}
      {(sub !== undefined || change !== undefined) && (
        <div className="flex items-baseline gap-2 mt-1">
          {sub && (
            <span className="text-2xs text-text-tertiary leading-none">{sub}</span>
          )}
          {change !== undefined && (
            <span
              className={cn(
                'text-2xs font-medium tabular-nums font-mono leading-none',
                change > 0
                  ? 'text-success'
                  : change < 0
                  ? 'text-danger'
                  : 'text-text-tertiary'
              )}
            >
              {change > 0 ? '+' : ''}
              {change.toFixed(1)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── StatGrid ──────────────────────────────────────────────────────────────────

interface StatGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 2 | 3 | 4 | 5;
}

export function StatGrid({
  cols = 4,
  children,
  className,
  ...props
}: StatGridProps) {
  const colClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-5',
  }[cols];

  return (
    <div
      className={cn(
        'grid',
        // Dividers between columns only once the grid is in its wide layout
        'gap-y-5 md:gap-y-0',
        'md:[&>*:not(:first-child)]:border-l md:[&>*:not(:first-child)]:border-border',
        'md:[&>*]:px-5',
        'md:[&>*:first-child]:pl-0',
        colClass,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
