import * as React from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'accent' | 'muted' | 'outline';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?:     boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-bg-muted    text-text-secondary border border-border-subtle',
  success: 'bg-success-muted text-success      border border-success/15',
  warning: 'bg-warning-muted text-warning      border border-warning/15',
  danger:  'bg-danger-muted  text-danger        border border-danger/15',
  accent:  'bg-accent-muted  text-accent        border border-accent/15',
  muted:   'bg-bg-elevated   text-text-tertiary border border-border-subtle',
  outline: 'bg-transparent   text-text-secondary border border-border',
};

const dotStyles: Record<BadgeVariant, string> = {
  default: 'bg-text-secondary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger:  'bg-danger',
  accent:  'bg-accent',
  muted:   'bg-text-tertiary',
  outline: 'bg-text-secondary',
};

export function Badge({ variant = 'default', dot = false, children, className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'text-2xs font-medium uppercase tracking-[0.08em]',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 animate-pulse-slow', dotStyles[variant])} />
      )}
      {children}
    </span>
  );
}
