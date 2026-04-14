import { db } from "./services/db";
import { Indexer } from "./services/indexer";
import {rollup} from './services/rollup';
import logger from "./utils/logger";

const indexer = new Indexer({
  rollup,
  database: db,
  pollIntervalMs: 3000
});

async function onExit() {
  logger.info("Exit signal received, shutting down indexer");
  await indexer.stop();
}

process.on("SIGINT", onExit);
process.on("SIGTERM", onExit);
process.on("SIGHUP", onExit);

indexer.run().catch(console.error);
