'use client';

import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { reportPath } from '@/lib/report';
import { cn } from '@/lib/cn';

/**
 * Copies the public report link for a design. The report is unlisted: anyone
 * with the link can view it, so the button says so.
 */
export function ShareReportButton({ designId, className }: { designId: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const path = reportPath(designId);

  async function share() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 2500);
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <button
        type="button"
        onClick={share}
        disabled={!designId}
        className={cn(
          'w-full h-11 rounded-full hairline text-sm font-medium text-text-primary',
          'inline-flex items-center justify-center gap-2',
          'hover:bg-white/80 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed',
          'transition-[background-color,transform] duration-200'
        )}
      >
        {state === 'copied' ? <Check className="w-4 h-4 text-success" /> : <Share2 className="w-4 h-4" />}
        {state === 'copied' ? 'Link copied' : state === 'failed' ? 'Copy failed' : 'Share launch report'}
      </button>
      <p className="text-2xs text-text-tertiary text-center">
        Anyone with the link can view it.{' '}
        <a href={path} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-text-primary">
          Preview
        </a>
      </p>
    </div>
  );
}
