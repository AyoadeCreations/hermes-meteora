/**
 * Formatting utilities for numbers, prices, addresses, and percentages.
 * All functions are pure and deterministic.
 */

// ── Number formatters ──────────────────────────────────────────────────────

export function formatNumber(n: number, decimals = 2): string {
  if (!isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function formatCompact(n: number): string {
  if (!isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(2)}B`;
  }
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(n) >= 1_000) {
    return `${(n / 1_000).toFixed(2)}K`;
  }
  return formatNumber(n);
}

export function formatSupply(n: number): string {
  if (!isFinite(n)) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(0)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('en-US');
}

// ── Price formatters ───────────────────────────────────────────────────────

export function formatPrice(price: number, quote = 'SOL'): string {
  if (!isFinite(price)) return '—';
  if (price === 0) return `0 ${quote}`;
  if (price < 0.000001) {
    return `${price.toExponential(3)} ${quote}`;
  }
  if (price < 0.001) {
    return `${price.toFixed(8)} ${quote}`;
  }
  if (price < 1) {
    return `${price.toFixed(6)} ${quote}`;
  }
  return `${price.toFixed(4)} ${quote}`;
}

export function formatUSD(n: number): string {
  if (!isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// ── Percent formatter ──────────────────────────────────────────────────────

export function formatPercent(n: number, decimals = 2): string {
  if (!isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(decimals)}%`;
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

// ── Address formatter ──────────────────────────────────────────────────────

export function formatAddress(
  address: string,
  chars = 4
): string {
  if (!address || address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

// ── Date formatter ─────────────────────────────────────────────────────────

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Score formatter ────────────────────────────────────────────────────────

export function formatScore(score: number): string {
  return (score * 100).toFixed(1);
}

// ── SOL/lamport conversion ─────────────────────────────────────────────────

export const LAMPORTS_PER_SOL = 1_000_000_000;

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}
