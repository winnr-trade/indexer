import { postgresDatabase, createLogger } from '@winnr-trade/common';
import { sql } from 'drizzle-orm';

const logger = createLogger(process.env.NODE_ENV || 'development');
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL not set");
const db = postgresDatabase(databaseUrl);

async function reset() {
  logger.info('Starting full database reset...');
  
  try {
    logger.info('Dropping all tables...');
    await db.inner.execute(sql`DROP TABLE IF EXISTS trades CASCADE`);
    await db.inner.execute(sql`DROP TABLE IF EXISTS book_updates CASCADE`);
    await db.inner.execute(sql`DROP TABLE IF EXISTS markets CASCADE`);
    await db.inner.execute(sql`DROP TABLE IF EXISTS positions CASCADE`);
    await db.inner.execute(sql`DROP TABLE IF EXISTS indexer_state CASCADE`);
    await db.inner.execute(sql`DROP TABLE IF EXISTS notes CASCADE`);
    
    logger.info('Dropping custom enum types...');
    await db.inner.execute(sql`DROP TYPE IF EXISTS market_status CASCADE`);
    await db.inner.execute(sql`DROP TYPE IF EXISTS market_outcome CASCADE`);
    await db.inner.execute(sql`DROP TYPE IF EXISTS resolver_type CASCADE`);
    await db.inner.execute(sql`DROP TYPE IF EXISTS settlement_kind CASCADE`);
    await db.inner.execute(sql`DROP TYPE IF EXISTS note_kind CASCADE`);

    logger.info('Database fully reset. Run "bun run db:push" to recreate schema.');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to reset the database:', error);
    process.exit(1);
  }
}

reset();
