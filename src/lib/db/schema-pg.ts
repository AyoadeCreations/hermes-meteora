/**
 * Postgres schema — translated from the SQLite schema in schema.ts.
 *
 * Key differences from SQLite:
 * - No PRAGMA statements
 * - TEXT JSON columns → TEXT (stored as JSON strings, same as SQLite)
 * - datetime('now') default → CURRENT_TIMESTAMP
 * - CHECK constraints use standard SQL syntax (same semantics)
 * - Foreign keys are enforced by default in Postgres (no PRAGMA needed)
 */
export const SCHEMA_SQL_PG = `
-- ── Markets ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS markets (
  id               TEXT        PRIMARY KEY,
  token_name       TEXT        NOT NULL,
  token_symbol     TEXT        NOT NULL,
  total_supply     DOUBLE PRECISION NOT NULL,
  quote_mint       TEXT        NOT NULL,
  starting_price   DOUBLE PRECISION NOT NULL,
  graduation_quote DOUBLE PRECISION NOT NULL,
  demand_profile   TEXT        NOT NULL CHECK(demand_profile IN ('low','medium','high')),
  demand_participants INTEGER,
  demand_volume    DOUBLE PRECISION,
  objective        TEXT        NOT NULL,
  created_at       TEXT        NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  updated_at       TEXT        NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);

CREATE INDEX IF NOT EXISTS idx_markets_created_at ON markets(created_at DESC);

-- ── Market Designs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_designs (
  id               TEXT        PRIMARY KEY,
  market_id        TEXT        NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  configuration    TEXT        NOT NULL,
  simulation_result TEXT       NOT NULL,
  objective_score  DOUBLE PRECISION NOT NULL,
  score_breakdown  TEXT        NOT NULL,
  warnings         TEXT        NOT NULL DEFAULT '[]',
  created_at       TEXT        NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);

CREATE INDEX IF NOT EXISTS idx_designs_market_id ON market_designs(market_id);

-- ── Deployments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deployments (
  id                    TEXT PRIMARY KEY,
  market_id             TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  design_id             TEXT NOT NULL REFERENCES market_designs(id),
  wallet_address        TEXT NOT NULL,
  pool_address          TEXT,
  config_address        TEXT,
  transaction_signature TEXT,
  status                TEXT NOT NULL DEFAULT 'not_started'
                          CHECK(status IN (
                            'not_started','preparing','awaiting_signature',
                            'submitted','confirmed','failed'
                          )),
  error_message         TEXT,
  created_at            TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  updated_at            TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);

CREATE INDEX IF NOT EXISTS idx_deployments_market_id ON deployments(market_id);

-- ── Market Observations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS observations (
  id                  TEXT             PRIMARY KEY,
  market_id           TEXT             NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  timestamp           TEXT             NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  price               DOUBLE PRECISION NOT NULL,
  quote_reserve       DOUBLE PRECISION NOT NULL,
  volume_24h          DOUBLE PRECISION NOT NULL DEFAULT 0,
  traders             INTEGER          NOT NULL DEFAULT 0,
  buy_volume          DOUBLE PRECISION NOT NULL DEFAULT 0,
  sell_volume         DOUBLE PRECISION NOT NULL DEFAULT 0,
  graduation_progress DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_observations_market_id_ts ON observations(market_id, timestamp DESC);

-- ── Market Objectives ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_objectives (
  id          TEXT             PRIMARY KEY,
  market_id   TEXT             NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  data        TEXT             NOT NULL,
  created_at  TEXT             NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  updated_at  TEXT             NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);

CREATE INDEX IF NOT EXISTS idx_objectives_market_id ON market_objectives(market_id);

-- ── Launch Outcomes ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS launch_outcomes (
  id                     TEXT PRIMARY KEY,
  market_id              TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  selected_plan_id       TEXT,
  selected_plan_name     TEXT,
  selected_design_id     TEXT NOT NULL,
  transaction_signature  TEXT,
  pool_address           TEXT,
  config_address         TEXT,
  launch_timestamp       TEXT NOT NULL,
  configuration_snapshot TEXT NOT NULL,
  objective_snapshot     TEXT,
  created_at             TEXT NOT NULL DEFAULT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
);

CREATE INDEX IF NOT EXISTS idx_outcomes_market_id ON launch_outcomes(market_id);
`;
