/**
 * Markets data access layer — Postgres implementation.
 *
 * All functions are async and use the pg pool.
 * Function signatures match those in markets.ts (SQLite) exactly,
 * so the router in index.ts can swap implementations transparently.
 *
 * SQL differences from SQLite:
 * - Positional params $1, $2, … instead of ?
 * - INSERT … ON CONFLICT DO UPDATE instead of INSERT OR REPLACE
 * - No db.prepare() — queries are strings passed to pool.query()
 * - Transactions use BEGIN / COMMIT / ROLLBACK
 * - COALESCE used same way for optional fields
 */
import { nanoid } from 'nanoid';
import { getPgPool, ensurePgSchema } from './pg-client';
import type {
  MarketBrief,
  MarketDesign,
  Deployment,
  DeploymentStatus,
  MarketObservation,
} from '@/domain/types';
import type { CreateMarketBriefInput } from '@/domain/schemas';

// ── Init guard ────────────────────────────────────────────────────────────────

async function db() {
  await ensurePgSchema();
  return getPgPool();
}

// ── Markets ───────────────────────────────────────────────────────────────────

export async function createMarket(input: CreateMarketBriefInput): Promise<MarketBrief> {
  const pool = await db();
  const id = nanoid(16);
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO markets (
       id, token_name, token_symbol, total_supply, quote_mint,
       starting_price, graduation_quote, demand_profile,
       demand_participants, demand_volume, objective, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
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
      now,
    ]
  );

  return getMarketOrThrow(id);
}

export async function getMarket(id: string): Promise<MarketBrief | null> {
  const pool = await db();
  const { rows } = await pool.query('SELECT * FROM markets WHERE id = $1', [id]);
  if (rows.length === 0) return null;
  return rowToMarketBrief(rows[0]);
}

export async function getMarketOrThrow(id: string): Promise<MarketBrief> {
  const market = await getMarket(id);
  if (!market) throw new Error(`Market not found: ${id}`);
  return market;
}

export async function listMarkets(): Promise<MarketBrief[]> {
  const pool = await db();
  const { rows } = await pool.query('SELECT * FROM markets ORDER BY created_at DESC');
  return rows.map(rowToMarketBrief);
}

function rowToMarketBrief(row: Record<string, unknown>): MarketBrief {
  return {
    id: row['id'] as string,
    tokenName: row['token_name'] as string,
    tokenSymbol: row['token_symbol'] as string,
    totalSupply: Number(row['total_supply']),
    quoteMint: row['quote_mint'] as string,
    startingPrice: Number(row['starting_price']),
    graduationQuoteAmount: Number(row['graduation_quote']),
    expectedDemand: {
      profile: row['demand_profile'] as 'low' | 'medium' | 'high',
      estimatedParticipants: row['demand_participants'] != null
        ? Number(row['demand_participants'])
        : undefined,
      estimatedVolume: row['demand_volume'] != null
        ? Number(row['demand_volume'])
        : undefined,
    },
    objective: row['objective'] as MarketBrief['objective'],
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  };
}

// ── Market Designs ────────────────────────────────────────────────────────────

export async function saveDesigns(designs: MarketDesign[]): Promise<void> {
  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const d of designs) {
      const { simulation, scoreBreakdown, warnings, ...config } = d;
      await client.query(
        `INSERT INTO market_designs (
           id, market_id, name, description, configuration,
           simulation_result, objective_score, score_breakdown, warnings, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET
           name             = EXCLUDED.name,
           description      = EXCLUDED.description,
           configuration    = EXCLUDED.configuration,
           simulation_result= EXCLUDED.simulation_result,
           objective_score  = EXCLUDED.objective_score,
           score_breakdown  = EXCLUDED.score_breakdown,
           warnings         = EXCLUDED.warnings`,
        [
          d.id,
          d.marketBriefId,
          d.name,
          d.description,
          JSON.stringify(config),
          JSON.stringify(simulation),
          d.objectiveScore,
          JSON.stringify(scoreBreakdown),
          JSON.stringify(warnings),
          d.createdAt,
        ]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getDesigns(marketId: string): Promise<MarketDesign[]> {
  const pool = await db();
  const { rows } = await pool.query(
    'SELECT * FROM market_designs WHERE market_id = $1 ORDER BY objective_score DESC',
    [marketId]
  );
  return rows.map(rowToMarketDesign);
}

export async function getDesign(designId: string): Promise<MarketDesign | null> {
  const pool = await db();
  const { rows } = await pool.query(
    'SELECT * FROM market_designs WHERE id = $1',
    [designId]
  );
  if (rows.length === 0) return null;
  return rowToMarketDesign(rows[0]);
}

function rowToMarketDesign(row: Record<string, unknown>): MarketDesign {
  const config: Omit<MarketDesign, 'simulation' | 'scoreBreakdown' | 'warnings' | 'objectiveScore' | 'id'> =
    JSON.parse(row['configuration'] as string);
  const simulation = JSON.parse(row['simulation_result'] as string);
  const scoreBreakdown = JSON.parse(row['score_breakdown'] as string);
  const warnings: string[] = JSON.parse(row['warnings'] as string);
  return {
    ...config,
    id: row['id'] as string,
    objectiveScore: Number(row['objective_score']),
    simulation,
    scoreBreakdown,
    warnings,
  };
}

// ── Deployments ───────────────────────────────────────────────────────────────

export async function createDeployment(params: {
  marketId: string;
  designId: string;
  walletAddress: string;
}): Promise<Deployment> {
  const pool = await db();
  const id = nanoid(16);
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO deployments
       (id, market_id, design_id, wallet_address, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'not_started',$5,$6)`,
    [id, params.marketId, params.designId, params.walletAddress, now, now]
  );

  return getDeploymentOrThrow(id);
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
  const pool = await db();
  const now = new Date().toISOString();

  await pool.query(
    `UPDATE deployments SET
       status                = $1,
       pool_address          = COALESCE($2, pool_address),
       config_address        = COALESCE($3, config_address),
       transaction_signature = COALESCE($4, transaction_signature),
       error_message         = COALESCE($5, error_message),
       updated_at            = $6
     WHERE id = $7`,
    [
      status,
      extra?.poolAddress ?? null,
      extra?.configAddress ?? null,
      extra?.transactionSignature ?? null,
      extra?.errorMessage ?? null,
      now,
      id,
    ]
  );
}

export async function getDeployment(id: string): Promise<Deployment | null> {
  const pool = await db();
  const { rows } = await pool.query('SELECT * FROM deployments WHERE id = $1', [id]);
  if (rows.length === 0) return null;
  return rowToDeployment(rows[0]);
}

export async function getDeploymentOrThrow(id: string): Promise<Deployment> {
  const d = await getDeployment(id);
  if (!d) throw new Error(`Deployment not found: ${id}`);
  return d;
}

export async function resetDeployment(id: string): Promise<void> {
  const pool = await db();
  const now = new Date().toISOString();

  await pool.query(
    `UPDATE deployments SET
       status                = 'not_started',
       pool_address          = NULL,
       config_address        = NULL,
       transaction_signature = NULL,
       error_message         = NULL,
       updated_at            = $1
     WHERE id = $2`,
    [now, id]
  );
}

export async function getDeploymentByMarket(marketId: string): Promise<Deployment | null> {
  const pool = await db();
  const { rows } = await pool.query(
    'SELECT * FROM deployments WHERE market_id = $1 ORDER BY created_at DESC LIMIT 1',
    [marketId]
  );
  if (rows.length === 0) return null;
  return rowToDeployment(rows[0]);
}

function rowToDeployment(row: Record<string, unknown>): Deployment {
  return {
    id: row['id'] as string,
    marketId: row['market_id'] as string,
    designId: row['design_id'] as string,
    walletAddress: row['wallet_address'] as string,
    poolAddress: (row['pool_address'] as string) || undefined,
    configAddress: (row['config_address'] as string) || undefined,
    transactionSignature: (row['transaction_signature'] as string) || undefined,
    status: row['status'] as DeploymentStatus,
    errorMessage: (row['error_message'] as string) || undefined,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  };
}

// ── Observations ──────────────────────────────────────────────────────────────

export async function saveObservation(
  obs: Omit<MarketObservation, 'id'>
): Promise<void> {
  const pool = await db();
  await pool.query(
    `INSERT INTO observations (
       id, market_id, timestamp, price, quote_reserve,
       volume_24h, traders, buy_volume, sell_volume, graduation_progress
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      nanoid(16),
      obs.marketId,
      obs.timestamp,
      obs.price,
      obs.quoteReserve,
      obs.volume24h,
      obs.traders,
      obs.buyVolume,
      obs.sellVolume,
      obs.graduationProgress,
    ]
  );
}

export async function getObservations(
  marketId: string,
  limit = 200
): Promise<MarketObservation[]> {
  const pool = await db();
  const { rows } = await pool.query(
    'SELECT * FROM observations WHERE market_id = $1 ORDER BY timestamp ASC LIMIT $2',
    [marketId, limit]
  );
  return rows.map(rowToObservation);
}

export async function getLatestObservation(
  marketId: string
): Promise<MarketObservation | null> {
  const pool = await db();
  const { rows } = await pool.query(
    'SELECT * FROM observations WHERE market_id = $1 ORDER BY timestamp DESC LIMIT 1',
    [marketId]
  );
  if (rows.length === 0) return null;
  return rowToObservation(rows[0]);
}

function rowToObservation(row: Record<string, unknown>): MarketObservation {
  return {
    id: row['id'] as string,
    marketId: row['market_id'] as string,
    timestamp: row['timestamp'] as string,
    price: Number(row['price']),
    quoteReserve: Number(row['quote_reserve']),
    volume24h: Number(row['volume_24h']),
    traders: Number(row['traders']),
    buyVolume: Number(row['buy_volume']),
    sellVolume: Number(row['sell_volume']),
    graduationProgress: Number(row['graduation_progress']),
  };
}


// ── Market Objectives ─────────────────────────────────────────────────────

export async function saveObjective(
  marketId: string,
  data: Record<string, unknown>
): Promise<void> {
  const pool = await db();
  const { rows } = await pool.query(
    'SELECT id FROM market_objectives WHERE market_id = $1',
    [marketId]
  );
  const now = new Date().toISOString();
  if (rows.length > 0) {
    await pool.query(
      'UPDATE market_objectives SET data = $1, updated_at = $2 WHERE market_id = $3',
      [JSON.stringify(data), now, marketId]
    );
  } else {
    await pool.query(
      'INSERT INTO market_objectives (id, market_id, data, created_at, updated_at) VALUES ($1,$2,$3,$4,$5)',
      [nanoid(16), marketId, JSON.stringify(data), now, now]
    );
  }
}

export async function getObjective(
  marketId: string
): Promise<Record<string, unknown> | null> {
  const pool = await db();
  const { rows } = await pool.query(
    'SELECT data FROM market_objectives WHERE market_id = $1',
    [marketId]
  );
  if (rows.length === 0) return null;
  return JSON.parse(rows[0].data as string) as Record<string, unknown>;
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
  const pool = await db();
  const now = new Date().toISOString();
  await pool.query(
    `INSERT INTO launch_outcomes (
      id, market_id, selected_plan_id, selected_plan_name, selected_design_id,
      transaction_signature, pool_address, config_address, launch_timestamp,
      configuration_snapshot, objective_snapshot, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
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
      now,
    ]
  );
}

export async function getLaunchOutcome(
  marketId: string
): Promise<Record<string, unknown> | null> {
  const pool = await db();
  const { rows } = await pool.query(
    'SELECT * FROM launch_outcomes WHERE market_id = $1 ORDER BY created_at DESC LIMIT 1',
    [marketId]
  );
  return rows[0] ?? null;
}
