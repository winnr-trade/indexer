import { Hono } from 'hono';
import { db } from '../../services/db';
import { markets, bookUpdates, trades } from '../../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

export const marketsRouter = new Hono();

// Middleware to inject lightweight read-caching
const readOnlyCache = async (c: any, next: any) => {
  await next();
  c.header('Cache-Control', 'public, max-age=5, stale-while-revalidate=10');
};

marketsRouter.get(
  '/',
  readOnlyCache,
  zValidator('query', z.object({
    status: z.enum(['Active', 'Halted', 'ResolutionPending', 'Resolved']).optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
  })),
  async (c) => {
    const { status, limit } = c.req.valid('query');
    
    // Construct query to the read replica / connection pool
    let queryArgs: any = db.inner.select().from(markets);
    
    if (status) {
      // Drizzle ORM typing doesn't always automatically align with strings easily, 
      // coercing to any just ensures we don't trip up its strict enum type locally.
      queryArgs = queryArgs.where(eq(markets.status, status as any));
    }
    
    // Retrieve latest created markets first
    const data = await queryArgs.orderBy(desc(markets.createdAt)).limit(limit);

    return c.json({
      success: true,
      data,
    });
  }
);

marketsRouter.get('/:id', readOnlyCache, async (c) => {
  const idValue = Number(c.req.param('id'));

  if (isNaN(idValue)) {
    return c.json({ success: false, error: 'Invalid Market ID' }, 400);
  }

  const result = await db.inner.select()
    .from(markets)
    .where(eq(markets.id, idValue as any))
    .limit(1);

  if (result.length === 0) {
    return c.json({ success: false, error: 'Market not found' }, 404);
  }

  return c.json({
    success: true,
    data: result[0],
  });
});

marketsRouter.get('/:id/chart', readOnlyCache, zValidator('query', z.object({
  resolution: z.enum(['1m', '15m', '1h', '1d', '1w', 'all']).default('1d'),
  limit: z.coerce.number().min(1).max(5000).default(1000)
})), async (c) => {
  const idValue = Number(c.req.param('id'));
  const { resolution, limit } = c.req.valid('query');

  if (isNaN(idValue)) {
    return c.json({ success: false, error: 'Invalid Market ID' }, 400);
  }

  // Define the timespan in milliseconds for the "lookback" window
  const lookbackMap: Record<string, number> = {
    '1m': 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
    'all': Number.MAX_SAFE_INTEGER,
  };
  const windowMs = lookbackMap[resolution] || lookbackMap['1d'];
  const startTimeMs = resolution === 'all' ? 0 : Date.now() - windowMs;

  // For prediction markets, we don't bucket - we just fetch chronological raw line data from the lookback window.
  // We grab the most recent data (DESC), then reverse arrays locally to ensure chronological (left to right) rendering.
  const result = await db.inner.execute(sql`
    SELECT 
      "timestamp" AS time,
      mid_price AS price
    FROM book_updates
    WHERE market_id = ${idValue} AND "timestamp" >= ${startTimeMs}
    ORDER BY "timestamp" DESC
    LIMIT ${limit}
  `);

  return c.json({
    success: true,
    resolution,
    data: result.rows.reverse(),
  });
});

marketsRouter.get('/:id/trades', readOnlyCache, zValidator('query', z.object({
  limit: z.coerce.number().min(1).max(500).default(50)
})), async (c) => {
  const idValue = Number(c.req.param('id'));
  const { limit } = c.req.valid('query');

  if (isNaN(idValue)) {
    return c.json({ success: false, error: 'Invalid Market ID' }, 400);
  }

  const data = await db.inner.select()
    .from(trades)
    .where(eq(trades.marketId, idValue as any))
    .orderBy(desc(trades.timestamp), desc(trades.id))
    .limit(limit);

  return c.json({
    success: true,
    data,
  });
});
