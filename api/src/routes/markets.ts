import { Hono } from 'hono';
import { db } from '../db';
import { markets, bookUpdates, trades } from '@winnr-trade/common';
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
    status: z.enum(['active', 'halted', 'resolution_pending', 'resolved']).optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
  })),
  async (c) => {
    const { status, limit } = c.req.valid('query');
    
    // Build a WHERE clause fragment for optional status filtering
    const statusFilter = status ? sql`AND m.status = ${status}` : sql``;

    // Query markets with the latest mid_price from book_updates via a lateral join.
    // This gives us the probability (mid_price) without needing per-market requests.
    const result = await db.inner.execute(sql`
      SELECT 
        m.*,
        latest_bu.mid_price AS latest_mid_price
      FROM markets m
      LEFT JOIN LATERAL (
        SELECT mid_price
        FROM book_updates bu
        WHERE bu.market_id = m.id
        ORDER BY bu."timestamp" DESC
        LIMIT 1
      ) latest_bu ON true
      WHERE 1=1 ${statusFilter}
      ORDER BY m.created_at DESC
      LIMIT ${limit}
    `);

    return c.json({
      success: true,
      data: result.rows,
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
