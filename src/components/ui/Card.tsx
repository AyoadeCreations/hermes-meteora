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
    'rounded-xl border backdrop-blur-xl',
    // Surface
    elevated
      ? 'bg-white/90 border-border-strong shadow-elevated'
      : 'bg-white/75 border-white/80 shadow-card ring-1 ring-inset ring-border-subtle',
    accent && 'border-border-accent shadow-glow',
    !noPad && 'p-5',
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
          'hover:bg-white hover:shadow-elevated hover:-translate-y-0.5',
          // Pressed: slight scale + dim
          'active:scale-[0.995]',
          'transition-[transform,box-shadow,background-color] duration-300 ease-cinema',
          'focus-visible:outline-none'
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
