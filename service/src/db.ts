import { postgresDatabase } from "@winnr-trade/common";
import { env } from "./configs/env";

export const db = postgresDatabase(env.databaseUrl);
