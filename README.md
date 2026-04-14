# @sovereign-sdk/indexer

An extendable indexer for Sovereign SDK rollups written in TypeScript.

## Running

With your database accessible & rollup running the indexer can be started like so:

```bash
DATABASE_URL="postgres://YOUR_DB_STRING" npx @sovereign-sdk/indexer --rollup-url http://localhost:12346
```

## Database Setup

The indexer now uses **Drizzle ORM** for its schema. To setup your tables automatically, simply push the schema to your database:

```bash
bun run db:push
```

This will create necessary tables including `markets`, `indexer_state`, and `book_updates`.

#### Local development

For local development of your rollup+application you might want to have the indexer run against a local postgres database, the following section provides instructions on how to do this.

#### Prerequisites

- Docker installed on your system
- Docker daemon running

#### Setup Steps

1. Pull the official Postgres Docker image:

```bash
docker pull postgres
```

2. Create and start a Postgres container:

```bash
docker run --name sov-indexer-db \
  -e POSTGRES_PASSWORD=admin123 \
  -d \
  -p 5432:5432 \
  postgres
```

> **Note**: If you change the password, make sure to update it in the `dev` npm script connection string as well.

3. Verify the container is running:

```bash
docker ps
```

4. If you need to start an existing container later:

```bash
docker start sov-indexer-db
```

6. Initialize the database schema:

```bash
bun run db:push
```

### Connection Details

- Host: `localhost`
- Port: `5432`
- Username: `postgres`
- Password: `admin123`
- Database: `postgres`

### Useful Docker Commands

Stop the container:

```bash
docker stop sov-indexer-db
```

Remove the container (will delete all data):

```bash
docker rm sov-indexer-db
```

View container logs:

```bash
docker logs sov-indexer-db
```

## API Layer

The indexer includes a high-performance **Hono API** that serves read-only queries against the database (optimized for Edge runtimes like Bun). You can run this alongside the indexer without blocking the ingestion pipeline.

To start the API on `http://localhost:3000`:
```bash
bun run dev:api
```

*(You can run `bun run dev` in one terminal for ingestion, and `bun run dev:api` in another for serving reads).*

### API Routes

#### 1. List Markets
`GET /api/v1/markets`

Returns the most recently created prediction markets.

**Query Parameters:**
- `status` (Optional): Filter by `Active`, `Halted`, `ResolutionPending`, or `Resolved`.
- `limit` (Optional): Maximum number of records to return (default: 50, max: 100).

#### 2. Get Single Market
`GET /api/v1/markets/:id`

Returns the exact market schema for the ID provided. Returns `404` if not found.

#### 3. Chart Data (Time Series)
`GET /api/v1/markets/:id/chart?resolution={bucket}`

Generates continuous line-graph probability data (`time` and `price`) on the fly from the `book_updates` table using native Postgres aggregations.

**Query Parameters:**
- `resolution`: The bucketing timeframe (`1m`, `15m`, `1h`, `1d`, `1w`). Defaults to `1h`.
- `limit`: Number of historical data points to return.

#### 4. Recent Trades
`GET /api/v1/markets/:id/trades`

Returns the most recent chronological trades executed on the market. Contains exact pricing, quantities, and order details.

**Query Parameters:**
- `limit` (Optional): Maximum number of trades to return (default: 50, max: 500).
