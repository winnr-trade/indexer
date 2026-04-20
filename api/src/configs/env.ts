import "dotenv/config";
import { IndexerConfigError } from "@winnr-trade/common";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new IndexerConfigError("DATABASE_URL env var not set");
}

export const env = {
  databaseUrl,
  port: process.env.API_PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
};
