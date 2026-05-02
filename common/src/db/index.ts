import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { indexerState } from "../db/schema";
import { eq } from "drizzle-orm";

export type EventSchema = {
  number: number;
  key: string;
  value: Record<string, unknown>;
  module: string;
  txHash: string;
  timestamp: number;
};

export type Database<T> = {
  get inner(): T;
  getLatestEventNumber(): Promise<number | null>;
  disconnect: () => Promise<void>;
};

export type PostgresDatabase = Database<NodePgDatabase>;

export function postgresDatabase(connectionString: string): PostgresDatabase {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  return {
    inner: db,
    async getLatestEventNumber(): Promise<number | null> {
      const result = await db
        .select({ last_event_number: indexerState.last_event_number })
        .from(indexerState)
        .where(eq(indexerState.id, "main"))
        .limit(1);
      return result[0]?.last_event_number ?? null;
    },
    disconnect() {
      return pool.end();
    },
  };
}
