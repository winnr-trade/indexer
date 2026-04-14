import { db } from '../services/db';
import { markets, indexerState, bookUpdates, trades } from '../db/schema';
import logger from '../utils/logger';

async function resync() {
  logger.info('Starting full database reset for re-sync...');
  
  try {
    logger.info('Dropping existing indexed data...');
    // Delete in an order that respects foreign keys (though none currently exist)
    await db.inner.delete(trades);
    await db.inner.delete(bookUpdates);
    await db.inner.delete(markets);
    
    logger.info('Resetting indexer cursor state to 0...');
    await db.inner.delete(indexerState);

    logger.info('Database successfully cleared! You can now restart the indexer to sync from Event 0.');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to reset the database:', error);
    process.exit(1);
  }
}

resync();
