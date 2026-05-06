import { Hono } from 'hono';
import { db } from '../db';
import { markets, bookUpdates, trades } from '@winnr-trade/common';
import { eq, desc, sql, and, gte, lte } from 'drizzle-orm';
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
    
    const whereClause = status ? eq(markets.status, status) : undefined;

    const data = await db.inner.select()
      .from(markets)
      .where(whereClause)
      .orderBy(desc(markets.created_at))
      .limit(limit);

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
  startTime: z.coerce.number().optional(),
  endTime: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(5000).default(1000)
})), async (c) => {
  const idValue = Number(c.req.param('id'));
  const { startTime, endTime, limit } = c.req.valid('query');

  if (isNaN(idValue)) {
    return c.json({ success: false, error: 'Invalid Market ID' }, 400);
  }

  const conditions = [eq(bookUpdates.market_id, idValue as any)];
  if (startTime) conditions.push(gte(bookUpdates.timestamp, startTime));
  if (endTime) conditions.push(lte(bookUpdates.timestamp, endTime));

  const result = await db.inner.select({
      timestamp: bookUpdates.timestamp,
      best_bid: bookUpdates.best_bid,
      best_ask: bookUpdates.best_ask,
    })
    .from(bookUpdates)
    .where(and(...conditions))
    .orderBy(desc(bookUpdates.timestamp))
    .limit(limit);

  return c.json({
    success: true,
    data: result.reverse(),
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
    .where(eq(trades.market_id, idValue as any))
    .orderBy(desc(trades.timestamp), desc(trades.id))
    .limit(limit);

  return c.json({
    success: true,
    data,
  });
});
