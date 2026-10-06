/**
 * Database abstraction layer — environment-aware router.
 *
 * LOCAL DEVELOPMENT  (DATABASE_URL not set):
 *   → Uses better-sqlite3 via ./markets.ts (synchronous, file-based)
 *
 * PRODUCTION / VERCEL (DATABASE_URL is set):
 *   → Uses pg (Postgres) via ./pg-markets.ts (async, hosted)
 *
 * All exported functions are async regardless of the underlying driver.
 * SQLite functions are wrapped in Promise.resolve() to provide a uniform
 * async interface for callers.
 *
 * Route handlers import from '@/lib/db' (this file), never from the
 * driver-specific files directly.
 */

import type {
  MarketBrief,
  MarketDesign,
  Deployment,
  DeploymentStatus,
  MarketObservation,
} from '@/domain/types';
import type { CreateMarketBriefInput } from '@/domain/schemas';

const USE_POSTGRES = Boolean(process.env.DATABASE_URL);

// ── Dynamic imports keep the unused driver out of the bundle ─────────────────
// (Next.js tree-shakes unused dynamic imports in serverless builds)

async function getSqlite() {
  const m = await import('./markets');
  return m;
}

async function getPg() {
  const m = await import('./pg-markets');
  return m;
}

// ── Markets ───────────────────────────────────────────────────────────────────

export async function createMarket(input: CreateMarketBriefInput): Promise<MarketBrief> {
  if (USE_POSTGRES) {
    return (await getPg()).createMarket(input);
  }
  return Promise.resolve((await getSqlite()).createMarket(input));
}

export async function getMarket(id: string): Promise<MarketBrief | null> {
  if (USE_POSTGRES) {
    return (await getPg()).getMarket(id);
  }
  return Promise.resolve((await getSqlite()).getMarket(id));
}

export async function getMarketOrThrow(id: string): Promise<MarketBrief> {
  if (USE_POSTGRES) {
    return (await getPg()).getMarketOrThrow(id);
  }
  return Promise.resolve((await getSqlite()).getMarketOrThrow(id));
}

export async function listMarkets(): Promise<MarketBrief[]> {
  if (USE_POSTGRES) {
    return (await getPg()).listMarkets();
  }
  return Promise.resolve((await getSqlite()).listMarkets());
}

// ── Market Designs ────────────────────────────────────────────────────────────

export async function saveDesigns(designs: MarketDesign[]): Promise<void> {
  if (USE_POSTGRES) {
    return (await getPg()).saveDesigns(designs);
  }
  return Promise.resolve((await getSqlite()).saveDesigns(designs));
}

export async function getDesigns(marketId: string): Promise<MarketDesign[]> {
  if (USE_POSTGRES) {
    return (await getPg()).getDesigns(marketId);
  }
  return Promise.resolve((await getSqlite()).getDesigns(marketId));
}

export async function getDesign(designId: string): Promise<MarketDesign | null> {
  if (USE_POSTGRES) {
    return (await getPg()).getDesign(designId);
  }
  return Promise.resolve((await getSqlite()).getDesign(designId));
}

// ── Deployments ───────────────────────────────────────────────────────────────

export async function createDeployment(params: {
  marketId: string;
  designId: string;
  walletAddress: string;
}): Promise<Deployment> {
  if (USE_POSTGRES) {
    return (await getPg()).createDeployment(params);
  }
  return Promise.resolve((await getSqlite()).createDeployment(params));
}

export async function updateDeploymentStatus(
  id: string,
  status: DeploymentStatus,
  extra?: {
    poolAddress?: string;
    configAddress?: string;
    transactionSignature?: string;
    errorMessage?: string;
  }
): Promise<void> {
  if (USE_POSTGRES) {
    return (await getPg()).updateDeploymentStatus(id, status, extra);
  }
  return Promise.resolve((await getSqlite()).updateDeploymentStatus(id, status, extra));
}

export async function getDeployment(id: string): Promise<Deployment | null> {
  if (USE_POSTGRES) {
    return (await getPg()).getDeployment(id);
  }
  return Promise.resolve((await getSqlite()).getDeployment(id));
}

export async function getDeploymentOrThrow(id: string): Promise<Deployment> {
  if (USE_POSTGRES) {
    return (await getPg()).getDeploymentOrThrow(id);
  }
  return Promise.resolve((await getSqlite()).getDeploymentOrThrow(id));
}

export async function resetDeployment(id: string): Promise<void> {
  if (USE_POSTGRES) {
    return (await getPg()).resetDeployment(id);
  }
  return Promise.resolve((await getSqlite()).resetDeployment(id));
}

export async function getDeploymentByMarket(marketId: string): Promise<Deployment | null> {
  if (USE_POSTGRES) {
    return (await getPg()).getDeploymentByMarket(marketId);
  }
  return Promise.resolve((await getSqlite()).getDeploymentByMarket(marketId));
}

// ── Observations ──────────────────────────────────────────────────────────────

export async function saveObservation(
  obs: Omit<MarketObservation, 'id'>
): Promise<void> {
  if (USE_POSTGRES) {
    return (await getPg()).saveObservation(obs);
  }
  return Promise.resolve((await getSqlite()).saveObservation(obs));
}

export async function getObservations(
  marketId: string,
  limit = 200
): Promise<MarketObservation[]> {
  if (USE_POSTGRES) {
    return (await getPg()).getObservations(marketId, limit);
  }
  return Promise.resolve((await getSqlite()).getObservations(marketId, limit));
}

export async function getLatestObservation(
  marketId: string
): Promise<MarketObservation | null> {
  if (USE_POSTGRES) {
    return (await getPg()).getLatestObservation(marketId);
  }
  return Promise.resolve((await getSqlite()).getLatestObservation(marketId));
}


// ── Market Objectives ─────────────────────────────────────────────────────

export async function saveObjective(
  marketId: string,
  data: Record<string, unknown>
): Promise<void> {
  if (USE_POSTGRES) return (await getPg()).saveObjective(marketId, data);
  return Promise.resolve((await getSqlite()).saveObjective(marketId, data));
}

export async function getObjective(
  marketId: string
): Promise<Record<string, unknown> | null> {
  if (USE_POSTGRES) return (await getPg()).getObjective(marketId);
  return Promise.resolve((await getSqlite()).getObjective(marketId));
}

// ── Launch Outcomes ───────────────────────────────────────────────────────

export async function saveLaunchOutcome(params: {
  marketId: string;
  selectedPlanId: string | null;
  selectedPlanName: string | null;
  selectedDesignId: string;
  transactionSignature: string | null;
  poolAddress: string | null;
  configAddress: string | null;
  launchTimestamp: string;
  configurationSnapshot: string;
  objectiveSnapshot: string | null;
}): Promise<void> {
  if (USE_POSTGRES) return (await getPg()).saveLaunchOutcome(params);
  return Promise.resolve((await getSqlite()).saveLaunchOutcome(params));
}

export async function getLaunchOutcome(
  marketId: string
): Promise<Record<string, unknown> | null> {
  if (USE_POSTGRES) return (await getPg()).getLaunchOutcome(marketId);
  return Promise.resolve((await getSqlite()).getLaunchOutcome(marketId));
}
