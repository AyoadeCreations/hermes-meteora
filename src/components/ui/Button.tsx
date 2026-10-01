'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize    = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant;
  size?:     ButtonSize;
  loading?:  boolean;
  icon?:     React.ReactNode;
  iconRight?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white font-semibold ' +
    'hover:bg-accent-hover ' +
    'active:scale-[0.96] active:brightness-90 ' +
    'shadow-glow-sm hover:shadow-glow',
  secondary:
    'bg-bg-elevated border border-border text-text-primary ' +
    'hover:bg-bg-overlay hover:border-border-strong ' +
    'active:scale-[0.97] active:brightness-90',
  ghost:
    'bg-transparent text-text-secondary ' +
    'hover:text-text-primary hover:bg-bg-elevated ' +
    'active:scale-[0.97]',
  danger:
    'bg-danger-muted border border-danger/40 text-danger ' +
    'hover:bg-danger hover:text-white hover:border-danger ' +
    'active:scale-[0.97]',
  outline:
    'bg-transparent border border-border text-text-primary ' +
    'hover:border-border-strong hover:bg-bg-elevated ' +
    'active:scale-[0.97]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-7  px-2.5 text-xs  gap-1.5 rounded-md',
  md: 'h-8  px-3.5 text-sm  gap-2   rounded-lg',
  lg: 'h-10 px-5   text-sm  gap-2   rounded-lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading = false, icon, iconRight,
     children, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        // Layout — items-center baseline-aligns icon + text correctly
        'inline-flex items-center justify-center font-medium',
        // Transitions — never `all`: only the properties we care about
        'transition-[transform,box-shadow,background-color,border-color,color,opacity]',
        'duration-150 ease-cinema',
        // Disabled — no scale, reduced opacity
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:!scale-100 disabled:!brightness-100',
        // Focus ring
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-offset-1',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {loading ? (
        // Keep the layout stable while loading: spinner + hidden children keep width
        <Spinner className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      ) : (
        icon && <span className="shrink-0 flex items-center">{icon}</span>
      )}
      {/* Wrap text so it stays centered and doesn't shift on icon changes */}
      {children && (
        <span className="leading-none">{children}</span>
      )}
      {iconRight && !loading && (
        <span className="shrink-0 flex items-center">{iconRight}</span>
      )}
    </button>
  )
);
Button.displayName = 'Button';

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
