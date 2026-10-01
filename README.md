# HERMES

Design the market before you launch.

HERMES is an objective-driven market formation tool built on [Meteora DBC](https://meteora.ag). It turns token parameters and a launch objective into candidate DBC configurations, simulates their behavior deterministically, and deploys the chosen configuration on-chain.

---

## What it does

**Define** — Describe your token (supply, quote mint, objective).

**Design** — HERMES generates three candidate Meteora DBC configurations tuned to your objective (growth, stability, or liquidity depth).

**Simulate** — Each configuration is run through deterministic trade scenarios. Price curves, graduation progress, and capital requirements are computed before any money moves.

**Compare** — View all three side-by-side. Choose the one that fits your goals.

**Deploy** — HERMES constructs the Meteora DBC `createConfig` transaction server-side, partially signs with the config keypair, and hands it to your wallet for final approval. The transaction is submitted to Solana and confirmed on-chain.

**Observe** — After deployment, HERMES retains the config address, transaction signature, and deployment parameters for review.

---

## Current status

- Devnet deployment is working end-to-end
- Wallet connection: Phantom and Solflare
- Deployment flow: tested and confirmed on Solscan
- Round 3 customer validation in progress

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Solana SDK | `@solana/web3.js` 1.98.4 |
| Wallet adapters | Phantom, Solflare |
| DBC SDK | `@meteora-ag/dynamic-bonding-curve-sdk` |
| Database | SQLite via `better-sqlite3` |
| Styling | Tailwind CSS |
| Language | TypeScript |

---

## Getting started

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env.local

# Seed the database with example markets
node scripts/seed.js

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SOLANA_NETWORK` | `devnet` or `mainnet-beta` |
| `NEXT_PUBLIC_SOLANA_RPC_DEVNET` | Devnet RPC endpoint |
| `NEXT_PUBLIC_SOLANA_RPC_MAINNET` | Mainnet RPC endpoint |
| `NEXT_PUBLIC_DEMO_MODE` | Set `true` to use stub transactions (no on-chain calls) |
| `DB_PATH` | SQLite database file path (default: `./data/meteora-mfe.db`) |

---

## Development commands

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run typecheck    # TypeScript type check
npm run lint         # ESLint
npm run test         # Vitest unit tests
```

---

## Repository structure

```
src/
  app/                  # Next.js App Router pages and API routes
    api/markets/        # REST API for markets, designs, deployments
    markets/[id]/       # Market detail pages (design, simulate, deploy, etc.)
  components/
    layout/             # Navbar, PageLayout
    ui/                 # Shared UI components
  domain/               # Types and schemas
  lib/
    db/                 # SQLite data access layer
    telemetry.ts        # Validation funnel instrumentation
  services/
    meteora/            # Meteora DBC parameter builders
    simulation/         # Deterministic trade scenario engine
```

---

## Notes

- The git repository root is the user home directory. The root `.gitignore` is intentionally configured to track only `meteora-mfe/`.
- `.env.local`, `data/*.db`, `node_modules/`, and `.next/` are excluded from version control.
- No private keys, seed phrases, or secrets are stored by HERMES. Wallet signatures happen entirely inside the user's wallet extension.
