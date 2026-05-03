import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db';
import { trades, markets } from '@winnr-trade/common';
import { eq, or, desc } from 'drizzle-orm';

export const tradesRouter = new Hono();

// Get trade activity for a specific user address across all markets
tradesRouter.get('/', zValidator('query', z.object({
  userAddress: z.string(),
  page: z.coerce.number().min(0).default(0),
  limit: z.coerce.number().min(1).max(100).default(50),
})), async (c) => {
  const { userAddress: address, page, limit } = c.req.valid('query');
  const offset = page * limit;

  try {
    const data = await db.inner.select({
      id: trades.id,
      market_id: trades.market_id,
      question: markets.question,
      price: trades.price,
      quantity: trades.quantity,
      buyer: trades.buyer,
      seller: trades.seller,
      settlement_kind: trades.settlement_kind,
      timestamp: trades.timestamp,
      tx_hash: trades.tx_hash,
    })
    .from(trades)
    .innerJoin(markets, eq(trades.market_id, markets.id))
    .where(or(
      eq(trades.buyer, address),
      eq(trades.seller, address)
    ))
    .orderBy(desc(trades.timestamp))
    .limit(limit)
    .offset(offset);

    return c.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Failed to fetch user trades:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
    }, 500);
  }
});
