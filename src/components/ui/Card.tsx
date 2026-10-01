import * as React from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  accent?:   boolean;
  noPad?:    boolean;
  /** When true, renders as a <button> with pressed-state feedback */
  interactive?: boolean;
}

export function Card({
  elevated = false,
  accent   = false,
  noPad    = false,
  interactive = false,
  children,
  className,
  ...props
}: CardProps) {
  const base = cn(
    'rounded-xl border',
    // Surface
    elevated
      ? 'bg-bg-elevated border-border-strong shadow-elevated'
      : 'bg-bg-surface border-border shadow-card',
    accent && 'border-border-accent shadow-glow',
    // Top-edge shimmer — layered on top of any bg-image callers supply
    '[background-image:linear-gradient(180deg,rgba(255,255,255,0.05)_0%,transparent_50%)]',
    !noPad && 'p-4',
    className
  );

  if (interactive) {
    return (
      <button
        type="button"
        className={cn(
          base,
          'w-full text-left',
          // Hover elevates the surface
          'hover:border-border-strong hover:bg-bg-elevated',
          // Pressed: slight scale + dim
          'active:scale-[0.995] active:brightness-95',
          'transition-[transform,box-shadow,background-color,border-color,filter] duration-150 ease-cinema',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-offset-1'
        )}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={base} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between mb-4 pb-3 border-b border-border',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'text-xs font-semibold text-text-secondary uppercase tracking-widest',
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardFooter({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mt-4 pt-3 border-t border-border flex items-center justify-between',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
