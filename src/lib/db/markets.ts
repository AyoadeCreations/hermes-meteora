/**
 * Markets data access layer.
 * All DB operations are synchronous (better-sqlite3).
 * Validates data at the boundary.
 */

import { nanoid } from 'nanoid';
import { getDb } from './client';
import type {
  MarketBrief,
  MarketDesign,
  Deployment,
  DeploymentStatus,
  MarketObservation,
} from '@/domain/types';
import type { CreateMarketBriefInput } from '@/domain/schemas';

// ── Markets ────────────────────────────────────────────────────────────────

export function createMarket(input: CreateMarketBriefInput): MarketBrief {
  const db = getDb();
  const id = nanoid(16);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO markets (
      id, token_name, token_symbol, total_supply, quote_mint,
      starting_price, graduation_quote, demand_profile,
      demand_participants, demand_volume, objective, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    id,
    input.tokenName,
    input.tokenSymbol,
    input.totalSupply,
    input.quoteMint,
    input.startingPrice,
    input.graduationQuoteAmount,
    input.expectedDemand.profile,
    input.expectedDemand.estimatedParticipants ?? null,
    input.expectedDemand.estimatedVolume ?? null,
    input.objective,
    now,
    now
  );

  return getMarketOrThrow(id);
}

export function getMarket(id: string): MarketBrief | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM markets WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToMarketBrief(row);
}

export function getMarketOrThrow(id: string): MarketBrief {
  const market = getMarket(id);
  if (!market) throw new Error(`Market not found: ${id}`);
  return market;
}

export function listMarkets(): MarketBrief[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM markets ORDER BY created_at DESC').all() as Record<string, unknown>[];
  return rows.map(rowToMarketBrief);
}

function rowToMarketBrief(row: Record<string, unknown>): MarketBrief {
  return {
    id:            row['id'] as string,
    tokenName:     row['token_name'] as string,
    tokenSymbol:   row['token_symbol'] as string,
    totalSupply:   row['total_supply'] as number,
    quoteMint:     row['quote_mint'] as string,
    startingPrice: row['starting_price'] as number,
    graduationQuoteAmount: row['graduation_quote'] as number,
    expectedDemand: {
      profile:               row['demand_profile'] as 'low' | 'medium' | 'high',
      estimatedParticipants: row['demand_participants'] as number | undefined,
      estimatedVolume:       row['demand_volume'] as number | undefined,
    },
    objective:  row['objective'] as MarketBrief['objective'],
    createdAt:  row['created_at'] as string,
    updatedAt:  row['updated_at'] as string,
  };
}

// ── Market Designs ─────────────────────────────────────────────────────────

export function saveDesigns(designs: MarketDesign[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO market_designs (
      id, market_id, name, description, configuration,
      simulation_result, objective_score, score_breakdown, warnings, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insert = db.transaction((designs: MarketDesign[]) => {
    for (const d of designs) {
      // Store full design config without the simulation (separate column)
      const { simulation, scoreBreakdown, warnings, ...config } = d;
      stmt.run(
        d.id,
        d.marketBriefId,
        d.name,
        d.description,
        JSON.stringify(config),
        JSON.stringify(simulation),
        d.objectiveScore,
        JSON.stringify(scoreBreakdown),
        JSON.stringify(warnings),
        d.createdAt
      );
    }
  });

  insert(designs);
}

export function getDesigns(marketId: string): MarketDesign[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM market_designs WHERE market_id = ? ORDER BY objective_score DESC')
    .all(marketId) as Record<string, unknown>[];

  return rows.map(rowToMarketDesign);
}

export function getDesign(designId: string): MarketDesign | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM market_designs WHERE id = ?')
    .get(designId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToMarketDesign(row);
}

function rowToMarketDesign(row: Record<string, unknown>): MarketDesign {
  const config: Omit<MarketDesign, 'simulation' | 'scoreBreakdown' | 'warnings'> =
    JSON.parse(row['configuration'] as string);
  const simulation = JSON.parse(row['simulation_result'] as string);
  const scoreBreakdown = JSON.parse(row['score_breakdown'] as string);
  const warnings: string[] = JSON.parse(row['warnings'] as string);

  return {
    ...config,
    id:            row['id'] as string,
    objectiveScore: row['objective_score'] as number,
    simulation,
    scoreBreakdown,
    warnings,
  };
}

// ── Deployments ────────────────────────────────────────────────────────────

export function createDeployment(params: {
  marketId:      string;
  designId:      string;
  walletAddress: string;
}): Deployment {
  const db  = getDb();
  const id  = nanoid(16);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO deployments (id, market_id, design_id, wallet_address, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'not_started', ?, ?)
  `).run(id, params.marketId, params.designId, params.walletAddress, now, now);

  return getDeploymentOrThrow(id);
}

export function updateDeploymentStatus(
  id: string,
  status: DeploymentStatus,
  extra?: {
    poolAddress?:          string;
    configAddress?:        string;
    transactionSignature?: string;
    errorMessage?:         string;
  }
): void {
  const db  = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE deployments SET
      status = ?,
      pool_address = COALESCE(?, pool_address),
      config_address = COALESCE(?, config_address),
      transaction_signature = COALESCE(?, transaction_signature),
      error_message = COALESCE(?, error_message),
      updated_at = ?
    WHERE id = ?
  `).run(
    status,
    extra?.poolAddress ?? null,
    extra?.configAddress ?? null,
    extra?.transactionSignature ?? null,
    extra?.errorMessage ?? null,
    now,
    id
  );
}

export function getDeployment(id: string): Deployment | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM deployments WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToDeployment(row);
}

export function getDeploymentOrThrow(id: string): Deployment {
  const d = getDeployment(id);
  if (!d) throw new Error(`Deployment not found: ${id}`);
  return d;
}

/**
 * Fully reset a deployment record for a clean retry.
 * Clears all transient fields (signature, addresses, error) and resets status to not_started.
 * Used when a user retries after a failed or stuck deployment.
 */
export function resetDeployment(id: string): void {
  const db  = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE deployments SET
      status = 'not_started',
      pool_address = NULL,
      config_address = NULL,
      transaction_signature = NULL,
      error_message = NULL,
      updated_at = ?
    WHERE id = ?
  `).run(now, id);
}

export function getDeploymentByMarket(marketId: string): Deployment | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM deployments WHERE market_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(marketId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToDeployment(row);
}

function rowToDeployment(row: Record<string, unknown>): Deployment {
  return {
    id:                   row['id'] as string,
    marketId:             row['market_id'] as string,
    designId:             row['design_id'] as string,
    walletAddress:        row['wallet_address'] as string,
    poolAddress:          (row['pool_address'] as string) || undefined,
    configAddress:        (row['config_address'] as string) || undefined,
    transactionSignature: (row['transaction_signature'] as string) || undefined,
    status:               row['status'] as DeploymentStatus,
    errorMessage:         (row['error_message'] as string) || undefined,
    createdAt:            row['created_at'] as string,
    updatedAt:            row['updated_at'] as string,
  };
}

// ── Observations ───────────────────────────────────────────────────────────

export function saveObservation(obs: Omit<MarketObservation, 'id'>): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO observations (
      id, market_id, timestamp, price, quote_reserve,
      volume_24h, traders, buy_volume, sell_volume, graduation_progress
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    nanoid(16),
    obs.marketId,
    obs.timestamp,
    obs.price,
    obs.quoteReserve,
    obs.volume24h,
    obs.traders,
    obs.buyVolume,
    obs.sellVolume,
    obs.graduationProgress
  );
}

export function getObservations(
  marketId: string,
  limit = 200
): MarketObservation[] {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT * FROM observations WHERE market_id = ? ORDER BY timestamp ASC LIMIT ?'
    )
    .all(marketId, limit) as Record<string, unknown>[];

  return rows.map((row) => ({
    id:                  row['id'] as string,
    marketId:            row['market_id'] as string,
    timestamp:           row['timestamp'] as string,
    price:               row['price'] as number,
    quoteReserve:        row['quote_reserve'] as number,
    volume24h:           row['volume_24h'] as number,
    traders:             row['traders'] as number,
    buyVolume:           row['buy_volume'] as number,
    sellVolume:          row['sell_volume'] as number,
    graduationProgress:  row['graduation_progress'] as number,
  }));
}

export function getLatestObservation(marketId: string): MarketObservation | null {
  const db = getDb();
  const row = db
    .prepare(
      'SELECT * FROM observations WHERE market_id = ? ORDER BY timestamp DESC LIMIT 1'
    )
    .get(marketId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id:                 row['id'] as string,
    marketId:           row['market_id'] as string,
    timestamp:          row['timestamp'] as string,
    price:              row['price'] as number,
    quoteReserve:       row['quote_reserve'] as number,
    volume24h:          row['volume_24h'] as number,
    traders:            row['traders'] as number,
    buyVolume:          row['buy_volume'] as number,
    sellVolume:         row['sell_volume'] as number,
    graduationProgress: row['graduation_progress'] as number,
  };
}

// ── Market Objectives ─────────────────────────────────────────────────────

export function saveObjective(
  marketId: string,
  data: Record<string, unknown>
): void {
  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM market_objectives WHERE market_id = ?')
    .get(marketId) as { id: string } | undefined;

  const now = new Date().toISOString();
  if (existing) {
    db.prepare(
      'UPDATE market_objectives SET data = ?, updated_at = ? WHERE market_id = ?'
    ).run(JSON.stringify(data), now, marketId);
  } else {
    const nid = nanoid;
    db.prepare(
      'INSERT INTO market_objectives (id, market_id, data, created_at, updated_at) VALUES (?,?,?,?,?)'
    ).run(nanoid(16), marketId, JSON.stringify(data), now, now);
  }
}

export function getObjective(marketId: string): Record<string, unknown> | null {
  const db = getDb();
  const row = db
    .prepare('SELECT data FROM market_objectives WHERE market_id = ?')
    .get(marketId) as { data: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.data) as Record<string, unknown>;
}

// ── Launch Outcomes ───────────────────────────────────────────────────────

export function saveLaunchOutcome(params: {
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
}): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO launch_outcomes (
      id, market_id, selected_plan_id, selected_plan_name, selected_design_id,
      transaction_signature, pool_address, config_address, launch_timestamp,
      configuration_snapshot, objective_snapshot, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    nanoid(16),
    params.marketId,
    params.selectedPlanId,
    params.selectedPlanName,
    params.selectedDesignId,
    params.transactionSignature,
    params.poolAddress,
    params.configAddress,
    params.launchTimestamp,
    params.configurationSnapshot,
    params.objectiveSnapshot,
    now
  );
}

export function getLaunchOutcome(marketId: string): Record<string, unknown> | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM launch_outcomes WHERE market_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(marketId) as Record<string, unknown> | undefined;
  return row ?? null;
}
