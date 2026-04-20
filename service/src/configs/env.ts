import "dotenv/config";
import { IndexerConfigError } from "@winnr-trade/common";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new IndexerConfigError("DATABASE_URL env var not set");
}

const rollupApiUrl = process.env.ROLLUP_API_URL;
if (!rollupApiUrl) {
  throw new IndexerConfigError("ROLLUP_API_URL env var not set");
}

export const env = {
  databaseUrl,
  rollupApiUrl,
  nodeEnv: process.env.NODE_ENV || 'development',
};
