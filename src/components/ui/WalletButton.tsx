'use client';

/**
 * WalletButton — connection lifecycle
 *
 *  1. User clicks "Connect Wallet" → modal opens
 *  2. User clicks a wallet row → handleSelect()
 *  3. select(walletName) updates adapter context (stores in localStorage)
 *  4. We yield one microtask tick so the adapter state settles, then call connect()
 *  5. Modal shows "Connecting…" and disables all controls while connecting
 *  6. On success: WalletButton re-renders as the connected state (modal closes via useEffect)
 *  7. On error: error message shown, controls re-enabled for retry
 *
 * Why this approach (select + async connect) instead of watching currentWallet:
 *   - Re-selecting the same wallet (e.g. Phantom from a prior session) does NOT change
 *     the `wallet` object reference → useEffect on `currentWallet` would never fire.
 *   - Calling connect() directly after select() works even for the same wallet.
 *   - connectingRef prevents concurrent connection attempts from double-clicks.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import type { Wallet } from '@solana/wallet-adapter-react';
import { X, Wallet as WalletIcon, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { track, safeWallet } from '@/lib/telemetry';

const IS_DEV = process.env.NODE_ENV === 'development';

function devLog(...args: unknown[]) {
  if (IS_DEV) console.log('[wallet]', ...args);
}

function shortenAddress(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

// ── Main button ─────────────────────────────────────────────────────────────

export function WalletButton() {
  const { publicKey, disconnect, connected, connecting } = useWallet();
  const [mounted,   setMounted]   = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Close modal once wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      devLog('connected → closing modal, publicKey =', publicKey?.toString().slice(0, 8) + '…');
      track('wallet_connected', { wallet: safeWallet(publicKey.toString()) });
      setModalOpen(false);
    }
  }, [connected, publicKey]);

  if (!mounted) {
    return (
      <button disabled className="h-7 px-3 rounded-lg border border-border text-2xs text-text-tertiary opacity-40 cursor-not-allowed">
        Connect Wallet
      </button>
    );
  }

  if (connected && publicKey) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-success/25 bg-success-muted text-2xs font-medium text-success">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-slow" />
          <span className="font-mono">{shortenAddress(publicKey.toString())}</span>
        </div>
        <button
          onClick={() => {
            devLog('disconnect clicked');
            track('wallet_disconnected', { wallet: safeWallet(publicKey.toString()) });
            void disconnect();
          }}
          className={cn(
            'h-7 px-2.5 rounded-lg border text-2xs text-text-tertiary',
            'border-border',
            'transition-[background-color,border-color,color] duration-150',
            'hover:text-danger hover:border-danger/30 hover:bg-danger-muted',
            'active:scale-[0.97]'
          )}
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (connecting) {
    return (
      <button disabled className="h-7 px-3 rounded-lg border border-accent/40 bg-accent-subtle text-2xs font-semibold text-accent flex items-center gap-1.5 opacity-80 cursor-wait">
        <Loader2 className="w-3 h-3 animate-spin" />
        Connecting…
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => {
          devLog('CLICK: opening wallet modal');
          setModalOpen(true);
        }}
        className={cn(
          'h-7 px-3 rounded-lg text-2xs font-semibold active:scale-[0.97]',
          'border border-accent/40 bg-accent-subtle text-accent',
          'transition-[background-color,border-color,color] duration-150',
          'hover:bg-accent-muted hover:border-accent/60'
        )}
      >
        Connect Wallet
      </button>
      {modalOpen && <WalletModal onClose={() => setModalOpen(false)} />}
    </>
  );
}

// ── Wallet modal ─────────────────────────────────────────────────────────────

function WalletModal({ onClose }: { onClose: () => void }) {
  const { wallets, select, connect, connecting } = useWallet();
  const overlayRef    = useRef<HTMLDivElement>(null);
  const connectingRef = useRef(false);   // guard against concurrent/duplicate attempts
  const [connectError, setConnectError] = useState<string | null>(null);

  // Escape to close (only when not mid-connection)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !connecting && !connectingRef.current) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, connecting]);

  // Reset guard once adapter reports connecting=false (covers both success and error paths)
  useEffect(() => {
    if (!connecting) {
      connectingRef.current = false;
    }
  }, [connecting]);

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && !connecting && !connectingRef.current) onClose();
  };

  const handleSelect = useCallback((w: Wallet) => {
    // Single-flight guard — ignore repeated clicks while a connection is in progress
    if (connectingRef.current || connecting) {
      devLog('handleSelect: ignored (already connecting)');
      return;
    }

    setConnectError(null);
    connectingRef.current = true;
    devLog('wallet selected:', w.adapter.name, '| readyState:', w.readyState);
    track('wallet_connect_started', { walletName: w.adapter.name });

    // select() updates localStorage and the adapter context.
    // Yield one microtask so the adapter settles before we call connect().
    select(w.adapter.name);

    void Promise.resolve().then(async () => {
      devLog('connect() called');
      try {
        await connect();
        devLog('connect() resolved — awaiting wallet adapter connected state');
        // Modal auto-closes via WalletButton's `connected` useEffect
      } catch (err) {
        connectingRef.current = false;
        const msg = err instanceof Error ? err.message : 'Connection rejected';
        devLog('connect() error:', err);
        console.warn('[wallet] Connection failed:', err);
        track('wallet_connect_failed', { errorMsg: msg.slice(0, 120) });
        setConnectError(msg.length > 120 ? msg.slice(0, 120) + '…' : msg);
      }
    });
  }, [select, connect, connecting]);

  const detected    = wallets.filter(w => w.readyState === 'Installed' || w.readyState === 'Loadable');
  const notDetected = wallets.filter(w => w.readyState !== 'Installed' && w.readyState !== 'Loadable');

  const modal = (
    <div
      ref={overlayRef}
      onClick={handleOverlay}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md"
    >
      <div className={cn(
        'relative w-full max-w-sm mx-4 rounded-2xl animate-slide-up',
        'bg-bg-overlay border border-border shadow-elevated',
        '[background-image:linear-gradient(180deg,rgba(255,255,255,0.04)_0%,transparent_50%)]'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent-subtle border border-accent/25 flex items-center justify-center">
              <WalletIcon className="w-3.5 h-3.5 text-accent" />
            </div>
            <h2 className="text-sm font-semibold text-text-primary">
              {connecting ? 'Connecting…' : 'Connect Wallet'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={connecting}
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center',
              'text-text-tertiary',
              'transition-[background-color,color] duration-150',
              'hover:text-text-primary hover:bg-bg-elevated',
              'disabled:opacity-30 disabled:cursor-wait'
            )}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Connecting state */}
        {connecting && (
          <div className="flex flex-col items-center gap-3 py-8 px-5">
            <Loader2 className="w-7 h-7 text-accent animate-spin" />
            <p className="text-sm text-text-secondary text-center">
              Approve the connection in your wallet extension.
            </p>
            <p className="text-2xs text-text-tertiary text-center">
              A popup should appear in your wallet. If it doesn&apos;t, check your browser extensions.
            </p>
          </div>
        )}

        {/* Error state */}
        {connectError && !connecting && (
          <div className="mx-3 mt-3 flex items-start gap-2 p-3 rounded-lg border border-danger/25 bg-danger-muted">
            <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-danger">Connection failed</p>
              <p className="text-2xs text-danger/70 mt-0.5">{connectError}</p>
              <p className="text-2xs text-danger/50 mt-1">Click a wallet below to retry.</p>
            </div>
          </div>
        )}

        {/* Wallet list — hidden while connecting */}
        {!connecting && (
          <div className="p-3 space-y-0.5">
            {wallets.length === 0 && (
              <p className="px-3 py-8 text-sm text-text-tertiary text-center">No wallet adapters found.</p>
            )}
            {detected.length > 0 && (
              <>
                <p className="px-3 pt-1 pb-2 text-2xs text-text-tertiary uppercase tracking-widest">Detected</p>
                {detected.map(w => (
                  <WalletRow key={w.adapter.name} wallet={w} connecting={connecting} onSelect={handleSelect} />
                ))}
              </>
            )}
            {notDetected.length > 0 && (
              <>
                <p className="px-3 pt-3 pb-2 text-2xs text-text-tertiary uppercase tracking-widest">Not installed</p>
                {notDetected.map(w => (
                  <WalletRow key={w.adapter.name} wallet={w} connecting={connecting} onSelect={handleSelect} dimmed />
                ))}
              </>
            )}
          </div>
        )}

        {/* Footer */}
        {!connecting && (
          <div className="px-5 py-3 border-t border-border">
            <p className="text-2xs text-text-tertiary leading-relaxed">
              Your private key never leaves your wallet. Transactions require your explicit approval.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}

// ── Wallet row ────────────────────────────────────────────────────────────────

function WalletRow({ wallet, connecting, onSelect, dimmed = false }: {
  wallet: Wallet; connecting: boolean; onSelect: (w: Wallet) => void; dimmed?: boolean;
}) {
  const isInstalled = wallet.readyState === 'Installed';
  return (
    <button
      type="button"
      disabled={connecting}
      onClick={() => onSelect(wallet)}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left',
        'border border-transparent',
        'transition-[background-color,border-color,opacity] duration-150',
        dimmed ? 'opacity-45 hover:opacity-70 hover:bg-bg-elevated' : 'hover:bg-bg-elevated hover:border-border',
        connecting && 'cursor-wait'
      )}
    >
      {wallet.adapter.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={wallet.adapter.icon} alt={wallet.adapter.name} width={28} height={28} className="rounded-lg shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded-lg bg-bg-muted shrink-0" />
      )}
      <span className="flex-1 text-sm font-medium text-text-primary">{wallet.adapter.name}</span>
      {isInstalled && (
        <span className="flex items-center gap-1 text-2xs text-success font-medium">
          <CheckCircle2 className="w-3 h-3" />
          Detected
        </span>
      )}
    </button>
  );
}
