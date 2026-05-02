# winnr.trade Indexer

This monorepo powers the core indexing infrastructure and data querying API for the Winnr prediction market platform. It is built using Bun Workspaces, Turborepo, Drizzle ORM, and PostgreSQL.

## Architecture

The project is split into independent workspaces:

* **`@winnr-trade/service`** (`/service`)
  A persistent background worker (daemon) that subscribes to on-chain Rollup events. It processes state transitions (like market creations, orderbook updates, and trades) and synchronizes them to the database.
* **`@winnr-trade/api`** (`/api`)
  A lightweight Hono.js REST API providing fast, read-only HTTP endpoints for consumers to query market statuses, price probability charts, and historical trades.
* **`@winnr-trade/common`** (`/common`)
  The shared backbone containing database schemas, TypeScript definitions, logging factories, and utility functions decoupled across the stack.

## Development

### 1. Installation
Install all workspace dependencies from the project root:
```bash
bun install
```

### 2. Database Setup
Make sure you have variables specified in a root `.env` files, then prepare the schema:
```bash
# Drops all tables completely to give you a clean slate
bun run db:reset

# Pushes the latest @winnr-trade/common drizzle schema to Postgres
bun run db:push
```

### 3. Local Development
Run the full monorepo concurrently via Turborepo:
```bash
bun dev
```

Or you can run the individual services in isolation:
```bash
bun dev:api
bun dev:service
```

### 4. Build
To compile the source code into optimized bundle files (`dist/index.js`) for server execution:
```bash
bun run build
```

## Volume Metrics

The indexer computes deterministic volume metrics from `Trade` events to prevent double counting.

- **Shares Volume**: The raw number of outcome shares traded.
- **Collateral Base Volume**: The actual capital transferred or minted in the market's collateral token (normalized to 10^6 decimals for exact math). It calculates true value based on the settlement kind:
  - `mint_pair`: The raw quantity (cost of minting).
  - `transfer_yes`: `(price * quantity) / 10000`
  - `transfer_no`: `((10000 - price) * quantity) / 10000`
  - `merge_pair`: Zero contribution to capital volume under our policy.

> **Note**: `Trade` events are the sole source of truth for these metrics. Events like `OrderFilled`, `OrderPlaced`, `SharesMinted`, or `SharesRedeemed` are deliberately excluded to enforce strict anti-double-counting guarantees.
