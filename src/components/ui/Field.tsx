import * as React from 'react';
import { cn } from '@/lib/cn';

// ── Field wrapper ───────────────────────────────────────────────────────────

interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?:    string;
  hint?:     string;
  error?:    string;
  required?: boolean;
}

export function Field({ label, hint, error, required, children, className, ...props }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} {...props}>
      {label && (
        <label className="text-xs font-medium text-text-secondary">
          {label}
          {required && <span className="text-accent ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-2xs text-danger flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-danger shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-2xs text-text-tertiary leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}

// ── Input ───────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?:  boolean;
  suffix?: string;
  prefix?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error, suffix, prefix, className, ...props }, ref) => {
    const base = cn(
      'w-full bg-bg-muted border rounded-lg px-3 py-2 text-sm text-text-primary',
      'placeholder:text-text-tertiary',
      'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
      'transition-all duration-150',
      'disabled:opacity-40 disabled:cursor-not-allowed',
      error ? 'border-danger/60 focus:border-danger focus:ring-danger' : 'border-border'
    );

    if (prefix || suffix) {
      return (
        <div className={cn(
          'flex items-center bg-bg-muted border rounded-lg overflow-hidden',
          'transition-all duration-150',
          error
            ? 'border-danger/60 focus-within:border-danger focus-within:ring-1 focus-within:ring-danger'
            : 'border-border focus-within:border-accent focus-within:ring-1 focus-within:ring-accent'
        )}>
          {prefix && (
            <span className="px-3 py-2 text-sm text-text-tertiary border-r border-border bg-bg-surface shrink-0">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            className={cn('flex-1 bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none', className)}
            {...props}
          />
          {suffix && (
            <span className="px-3 py-2 text-sm text-text-tertiary border-l border-border bg-bg-surface shrink-0">
              {suffix}
            </span>
          )}
        </div>
      );
    }

    return <input ref={ref} className={cn(base, className)} {...props} />;
  }
);
Input.displayName = 'Input';

// ── Select ───────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full bg-bg-muted border rounded-lg px-3 py-2 text-sm text-text-primary',
        'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
        'transition-all duration-150 appearance-none cursor-pointer',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        error ? 'border-danger/60' : 'border-border',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = 'Select';

// ── Textarea ─────────────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full bg-bg-muted border rounded-lg px-3 py-2 text-sm text-text-primary',
        'placeholder:text-text-tertiary resize-y min-h-[80px]',
        'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent',
        'transition-all duration-150',
        error ? 'border-danger/60' : 'border-border',
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';
