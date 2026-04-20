import { db } from './db';
import { logger } from './logger';;
import { Indexer } from "./indexer";
import { rollup } from './rollup';

const indexer = new Indexer({
  rollup,
  database: db,
  pollIntervalMs: 3000
});

let isShuttingDown = false;
async function onExit() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info("Exit signal received, shutting down indexer");
  await indexer.stop();
  process.exit(0);
}

process.on("SIGINT", onExit);
process.on("SIGTERM", onExit);
process.on("SIGHUP", onExit);

indexer.run().catch(console.error);
