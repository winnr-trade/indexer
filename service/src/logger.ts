import { createLogger, type Logger } from "@winnr-trade/common";
import { env } from "./configs/env";

export const logger: Logger = createLogger(env.nodeEnv);
