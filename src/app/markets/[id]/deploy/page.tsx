'use client';

/**
 * HERMES — Deploy Page
 *
 * Deployment flow:
 *  1. User reviews the selected DBC configuration
 *  2. User connects wallet (Phantom / Solflare)
 *  3. On "Deploy":
 *     a. POST /api/markets/:id/deploy        → create/reset deployment record
 *     b. Fetch fresh blockhash client-side   → pass to execute route
 *     c. POST /api/markets/:id/deploy/execute → server builds tx, partial-signs with config keypair
 *     d. wallet.sendTransaction()            → wallet adds payer sig + submits
 *     e. connection.confirmTransaction()     → wait for on-chain confirmation
 *     f. PATCH /api/markets/:id/deploy       → save signature + confirmed status
 *  4. On success, redirect to market overview
 *
 * Blockhash protocol:
 *   Client fetches blockhash BEFORE calling execute. Server uses that exact
 *   value to set recentBlockhash and partial-sign. Client never overwrites
 *   recentBlockhash after deserialization — doing so invalidates the config
 *   keypair's signature (recentBlockhash is part of the signed message bytes).
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { PageLayout, MarketSubNav } from '@/components/layout/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingState, WarningBanner } from '@/components/ui/States';
import { Stat, StatGrid } from '@/components/ui/Stat';
import { WalletButton } from '@/components/ui/WalletButton';
import type { MarketBrief, MarketDesign, Deployment, DeploymentStatus } from '@/domain/types';
import { OBJECTIVE_LABELS } from '@/domain/types';
import { formatPrice, formatBps, formatAddress } from '@/lib/format';
import { cn } from '@/lib/cn';
import { track, safeWallet, safeId } from '@/lib/telemetry';
import { Shield, ExternalLink, CheckCircle, AlertCircle, Loader2, Wallet, XCircle } from 'lucide-react';

const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet';

// ── Status display labels ────────────────────────────────────────────────────

const STATUS_LABELS: Record<DeploymentStatus, string> = {
  not_started:        'Not Started',
  preparing:          'Preparing Transaction',
  awaiting_signature: 'Awaiting Wallet Approval',
  submitted:          'Transaction Submitted',
  confirmed:          'Confirmed On-Chain',
  failed:             'Failed',
};

// ── Explorer URLs ────────────────────────────────────────────────────────────

function explorerTxUrl(sig: string) {
  return NETWORK === 'mainnet-beta'
    ? `https://solscan.io/tx/${sig}`
    : `https://solscan.io/tx/${sig}?cluster=devnet`;
}

function explorerAccountUrl(addr: string) {
  return NETWORK === 'mainnet-beta'
    ? `https://solscan.io/account/${addr}`
    : `https://solscan.io/account/${addr}?cluster=devnet`;
}

// ── Friendly error messages ──────────────────────────────────────────────────

function friendlyError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes('user rejected') || msg.includes('rejected the request') || msg.includes('wallet.sign')) {
    return 'Transaction rejected in wallet. Click Deploy to try again.';
  }
  if (msg.includes('blockhash not found') || msg.includes('blockhash')) {
    return 'Transaction expired before it could be submitted. Click Deploy to try again.';
  }
  if (msg.includes('insufficient funds') || msg.includes('insufficient lamports')) {
    return 'Insufficient SOL balance to pay transaction fees. Add SOL to your wallet and try again.';
  }
  if (msg.includes('already in use') || msg.includes('account already exists')) {
    return 'A config account for this market already exists on-chain. This market may have been deployed already.';
  }
  if (msg.includes('transaction too large')) {
    return 'Transaction is too large. This is unexpected — please contact support.';
  }
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('timeout')) {
    return 'Network error. Check your connection and try again.';
  }
  // Return the raw message if it's meaningful, otherwise a generic fallback
  if (raw.length > 10 && raw.length < 200) return raw;
  return 'Deployment failed. See browser console for details.';
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DeployPage() {
  const { id }         = useParams<{ id: string }>();
  const searchParams   = useSearchParams();
  const router         = useRouter();
  const designId       = searchParams.get('design');

  const { connection }                    = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [market,     setMarket]     = useState<MarketBrief | null>(null);
  const [design,     setDesign]     = useState<MarketDesign | null>(null);
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [deploying,  setDeploying]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [statusMsg,  setStatusMsg]  = useState<string>('');

  useEffect(() => { void load(); }, [id, designId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Telemetry: market configuration viewed
  useEffect(() => {
    if (design && market) {
      track('market_configuration_viewed', {
        marketId: safeId(id),
        network:  NETWORK,
      });
    }
  }, [design, market, id]);

  async function load() {
    setLoading(true);
    try {
      const [mRes, dRes, depRes] = await Promise.all([
        fetch(`/api/markets/${id}`),
        fetch(`/api/markets/${id}/designs`),
        fetch(`/api/markets/${id}/deploy`),
      ]);
      const { market }          = await mRes.json()   as { market: MarketBrief };
      const { designs }         = await dRes.json()   as { designs: MarketDesign[] };
      const { deployment: dep } = await depRes.json() as { deployment: Deployment | null };

      setMarket(market);
      setDesign(designs.find((d) => d.id === designId) ?? designs[0] ?? null);
      setDeployment(dep);
    } finally {
      setLoading(false);
    }
  }

  const patchDeployment = useCallback(async (
    deploymentId: string,
    status: DeploymentStatus,
    extra?: Record<string, string>
  ) => {
    const res = await fetch(`/api/markets/${id}/deploy`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deploymentId, status, ...extra }),
    });
    const data = await res.json() as { deployment?: Deployment };
    if (data.deployment) setDeployment(data.deployment);
  }, [id]);

  async function handleDeploy() {
    if (!design || !publicKey) return;

    // Reset stale state from any prior attempt
    setDeploying(true);
    setError(null);
    setStatusMsg('');
    setDeployment(null);

    const deployStart = Date.now();
    track('deployment_started', {
      marketId: safeId(id),
      wallet:   safeWallet(publicKey.toString()),
      network:  NETWORK,
    });

    let depId: string | null = null;

    try {
      // ── Step 1: Create / reset deployment record ───────────────────────
      setStatusMsg('Creating deployment record…');

      const createRes = await fetch(`/api/markets/${id}/deploy`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designId:      design.id,
          walletAddress: publicKey.toString(),
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json() as { error?: string };
        throw new Error(err.error ?? 'Failed to create deployment record');
      }

      const { deployment: dep } = await createRes.json() as { deployment: Deployment };
      depId = dep.id;
      setDeployment(dep);

      // ── Step 2: Fetch fresh blockhash then build transaction ───────────
      // Blockhash is fetched HERE — before the server signs — so the server
      // can sign over it. Client must not overwrite recentBlockhash after
      // deserialization (it's part of the signed message bytes).
      setStatusMsg('Building Meteora DBC transaction…');
      await patchDeployment(dep.id, 'preparing');

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');

      const execRes = await fetch(`/api/markets/${id}/deploy/execute`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deploymentId:    dep.id,
          walletAddress:   publicKey.toString(),
          network:         NETWORK,
          clientBlockhash: blockhash,
        }),
      });

      const execData = await execRes.json() as {
        createConfigTxBase64?: string;
        configAddress?: string;
        blockhash?: string;
        lastValidBlockHeight?: number;
        error?: string;
      };

      if (!execRes.ok || !execData.createConfigTxBase64) {
        throw new Error(execData.error ?? 'Server failed to build the transaction. Check market parameters.');
      }

      const { createConfigTxBase64, configAddress } = execData;

      // ── Step 3: Deserialize and send ───────────────────────────────────
      setStatusMsg('Approve the transaction in your wallet…');
      await patchDeployment(dep.id, 'awaiting_signature');

      const txBytes = Buffer.from(createConfigTxBase64, 'base64');
      const tx      = Transaction.from(txBytes);
      tx.feePayer   = publicKey;
      // DO NOT set tx.recentBlockhash — server already set and signed it.
      // Overwriting invalidates the config keypair partial signature.

      const signature = await sendTransaction(tx, connection, {
        skipPreflight:       true,   // avoids stale-blockhash simulation errors
        preflightCommitment: 'confirmed',
        maxRetries:          3,
      });

      track('deployment_transaction_signed', {
        marketId: safeId(id),
        network:  NETWORK,
      });

      setStatusMsg('Transaction submitted — confirming on-chain…');
      await patchDeployment(dep.id, 'submitted', { signature });

      track('deployment_submitted', {
        marketId:  safeId(id),
        network:   NETWORK,
        durationMs: Date.now() - deployStart,
      });

      // ── Step 4: Confirm ────────────────────────────────────────────────
      const confirmResult = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed'
      );

      if (confirmResult.value.err) {
        const errDetail = JSON.stringify(confirmResult.value.err);
        throw new Error(`Transaction rejected on-chain: ${errDetail}`);
      }

      // ── Step 5: Save confirmed state ───────────────────────────────────
      await patchDeployment(dep.id, 'confirmed', {
        signature,
        configAddress: configAddress ?? '',
      });

      track('deployment_confirmed', {
        marketId:   safeId(id),
        network:    NETWORK,
        durationMs: Date.now() - deployStart,
      });

      setStatusMsg('');
      setTimeout(() => router.push(`/markets/${id}`), 1500);

    } catch (err) {
      const raw     = err instanceof Error ? err.message : 'Deployment failed';
      const display = friendlyError(raw);
      console.error('[HERMES deploy] Deployment failed:', err);

      // Classify user rejection vs technical failure for telemetry
      const isUserRejection = raw.toLowerCase().includes('user rejected') ||
                              raw.toLowerCase().includes('rejected the request');
      track(isUserRejection ? 'deployment_cancelled' : 'deployment_failed', {
        marketId:   safeId(id),
        network:    NETWORK,
        errorMsg:   raw.slice(0, 120),
        durationMs: Date.now() - deployStart,
      });

      setError(display);
      setStatusMsg('');
      if (depId) {
        try { await patchDeployment(depId, 'failed', { errorMessage: raw }); }
        catch { /* best-effort */ }
      }
    } finally {
      setDeploying(false);
    }
  }

  if (loading) return <PageLayout><LoadingState /></PageLayout>;

  const alreadyDeployed = deployment?.status === 'confirmed';
  const isDeploying     = deploying || ['preparing', 'awaiting_signature', 'submitted'].includes(deployment?.status ?? '');

  return (
    <PageLayout
      breadcrumbs={[
        { label: 'Markets', href: '/' },
        { label: market?.tokenSymbol ?? id, href: `/markets/${id}` },
        { label: 'Deploy' },
      ]}
    >
      <MarketSubNav marketId={id} />

      <div className="mt-6 max-w-2xl mx-auto space-y-4">

        {/* Deployment status stepper */}
        {deployment && deployment.status !== 'not_started' && (
          <DeploymentStatusBar status={deployment.status} />
        )}

        {/* Selected configuration */}
        {design && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-text-primary">Selected Configuration</h3>
              <Badge variant="accent">{design.name}</Badge>
            </div>

            <StatGrid cols={4} className="mb-4">
              <Stat label="Objective"      value={OBJECTIVE_LABELS[design.objective]}            size="sm" />
              <Stat label="Base Fee"       value={formatBps(design.fees.baseFeeBps)}             size="sm" />
              <Stat label="Curve Segments" value={design.curve.segments.length.toString()}        size="sm" />
              <Stat label="Grad Target"    value={`${design.graduation.quoteThreshold.toFixed(1)} SOL`} size="sm" />
            </StatGrid>

            <div className="p-3 rounded bg-bg-muted border border-border-subtle font-mono text-2xs text-text-secondary space-y-1">
              <p className="text-text-tertiary mb-2 uppercase tracking-widest text-2xs font-sans">DBC Config Parameters</p>
              <p>migrationOption: MET_DAMM_V2</p>
              <p>activationType: Timestamp</p>
              <p>tokenType: SPLToken</p>
              <p>baseFeeBps: {design.fees.baseFeeBps}</p>
              <p>dynamicFeeEnabled: {String(design.fees.dynamicFeeEnabled)}</p>
              <p>collectFeeMode: QuoteToken</p>
              <p>creatorTradingFeePercentage: {design.fees.creatorTradingFeePercentage}</p>
              <p>migrationQuoteThreshold: {design.graduation.quoteThreshold.toFixed(4)}</p>
              <p>curveSegments: {design.curve.segments.length}</p>
              <p>initialMarketCap: {design.curve.initialMarketCap.toFixed(4)} SOL</p>
              <p>migrationMarketCap: {design.curve.migrationMarketCap.toFixed(4)} SOL</p>
            </div>

            {design.warnings.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {design.warnings.map((w, i) => <WarningBanner key={i}>{w}</WarningBanner>)}
              </div>
            )}
          </Card>
        )}

        {/* Simulation summary */}
        {design && (
          <Card>
            <h3 className="text-2xs uppercase tracking-widest text-text-tertiary mb-3">
              Simulation Summary (Scenario B — Medium buys)
            </h3>
            <StatGrid cols={3}>
              <Stat label="Expected Final Price" value={formatPrice(design.simulation.finalPrice)}                size="sm" />
              <Stat label="Avg Price Impact"     value={`${design.simulation.averagePriceImpact.toFixed(2)}%`}   size="sm" />
              <Stat label="Capital to Graduate"  value={`${design.simulation.capitalRequired.toFixed(2)} SOL`}   size="sm" />
            </StatGrid>
          </Card>
        )}

        {/* Wallet + deploy */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-text-tertiary" />
            <h3 className="text-sm font-medium text-text-primary">Wallet & Deployment</h3>
          </div>

          {/* Network */}
          <div className="flex items-center justify-between p-2.5 rounded border border-border bg-bg-base mb-3">
            <span className="text-xs text-text-tertiary">Network</span>
            <Badge variant={NETWORK === 'mainnet-beta' ? 'success' : 'warning'} dot>
              {NETWORK === 'mainnet-beta' ? 'Mainnet Beta' : 'Devnet'}
            </Badge>
          </div>

          {/* Wallet */}
          <div className="flex items-center justify-between p-2.5 rounded border border-border bg-bg-base mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5 text-text-tertiary" />
              <span className="text-xs text-text-tertiary">Wallet</span>
            </div>
            {connected && publicKey
              ? <span className="text-xs mono text-text-secondary">{formatAddress(publicKey.toString())}</span>
              : <WalletButton />
            }
          </div>

          {/* What this transaction does */}
          <div className="p-3 rounded border border-border-subtle bg-bg-muted text-2xs text-text-tertiary leading-relaxed mb-4">
            <strong className="text-text-secondary">What this transaction does:</strong>{' '}
            Creates a Meteora DBC config account and pool with the parameters shown above.
            No tokens are bought or sold. Your wallet pays the Solana account rent (~0.01–0.05 SOL).
            No private keys are stored by HERMES.
          </div>

          {/* Status message */}
          {statusMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded bg-accent/10 border border-accent/20 mb-3 text-xs text-accent animate-fade-in">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              {statusMsg}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded border border-danger/25 bg-danger-muted mb-3 animate-fade-in">
              <XCircle className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-danger">Deployment failed</p>
                <p className="text-2xs text-danger/80 mt-0.5 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* Deploy button — shown when not confirmed (allows retry after failure) */}
          {!alreadyDeployed && (
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              loading={isDeploying}
              disabled={!connected || !publicKey || !design || isDeploying}
              onClick={handleDeploy}
            >
              {!connected
                ? 'Connect Wallet to Deploy'
                : isDeploying
                  ? deployingLabel(deployment?.status)
                  : `Deploy to Meteora DBC (${NETWORK === 'mainnet-beta' ? 'Mainnet' : 'Devnet'})`
              }
            </Button>
          )}

          {/* Success state */}
          {alreadyDeployed && deployment && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-success text-sm">
                <CheckCircle className="w-4 h-4" />
                <span>Pool deployed successfully on {NETWORK}</span>
              </div>

              {deployment.transactionSignature && (
                <a
                  href={explorerTxUrl(deployment.transactionSignature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-accent hover:underline"
                >
                  View transaction on Solscan
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              {deployment.configAddress && (
                <a
                  href={explorerAccountUrl(deployment.configAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary"
                >
                  Config: {formatAddress(deployment.configAddress, 8)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              <Button
                variant="secondary"
                size="md"
                iconRight={<ExternalLink className="w-3.5 h-3.5" />}
                onClick={() => router.push(`/markets/${id}`)}
              >
                View Market Overview
              </Button>
            </div>
          )}
        </Card>
      </div>
    </PageLayout>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deployingLabel(status: DeploymentStatus | undefined): string {
  switch (status) {
    case 'preparing':          return 'Preparing Transaction…';
    case 'awaiting_signature': return 'Waiting for Wallet Approval…';
    case 'submitted':          return 'Confirming On-Chain…';
    default:                   return 'Deploying…';
  }
}

// ── Deployment status stepper ─────────────────────────────────────────────────

function DeploymentStatusBar({ status }: { status: DeploymentStatus }) {
  const steps: DeploymentStatus[] = [
    'preparing',
    'awaiting_signature',
    'submitted',
    'confirmed',
  ];
  const currentIdx = steps.indexOf(status);
  const isFailed   = status === 'failed';

  return (
    <div className={cn(
      'flex items-center gap-2 px-4 py-3 rounded-lg border bg-bg-surface animate-fade-in',
      isFailed ? 'border-danger/30 bg-danger-muted' : 'border-border'
    )}>
      {isFailed ? (
        <div className="flex items-center gap-2 text-danger text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>Deployment failed — see error below</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 w-full overflow-x-auto">
          {steps.map((step, i) => {
            const done   = i < currentIdx;
            const active = i === currentIdx;
            return (
              <React.Fragment key={step}>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-2xs',
                    'transition-[background-color,color,border-color] duration-300',
                    done   ? 'bg-success text-white' :
                    active ? 'bg-accent text-white' :
                             'bg-bg-muted text-text-tertiary border border-border'
                  )}>
                    {done   ? '✓' :
                     active ? <Loader2 className="w-3 h-3 animate-spin" /> :
                              i + 1}
                  </div>
                  <span className={cn(
                    'text-2xs whitespace-nowrap transition-[color] duration-300',
                    active ? 'text-text-primary font-medium' :
                    done   ? 'text-success' :
                             'text-text-tertiary'
                  )}>
                    {STATUS_LABELS[step]}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={cn(
                    'flex-1 h-px min-w-[16px] transition-[background-color] duration-300',
                    done ? 'bg-success' : 'bg-border'
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
