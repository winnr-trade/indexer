import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db';
import { positions, markets } from '@winnr-trade/common';
import { eq, desc, and } from 'drizzle-orm';

export const positionsRouter = new Hono();

// Get active positions for a user
positionsRouter.get('/', zValidator('query', z.object({
  user_address: z.string(),
  page: z.coerce.number().min(0).default(0),
  limit: z.coerce.number().min(1).max(100).default(50),
})), async (c) => {
  const { user_address, page, limit } = c.req.valid('query');
  const offset = page * limit;

  try {
    const data = await db.inner.select({
      id: positions.id,
      user_address: positions.user_address,
      market_id: positions.market_id,
      question: markets.question,
      outcome: markets.outcome,
      yes_shares: positions.yes_shares,
      no_shares: positions.no_shares,
      total_cost_yes: positions.total_cost_yes,
      total_cost_no: positions.total_cost_no,
      best_bid: markets.best_bid,
      best_ask: markets.best_ask,
      updated_at: positions.updated_at,
    })
    .from(positions)
    .innerJoin(markets, eq(positions.market_id, markets.id))
    .where(
      and(
        eq(positions.user_address, user_address),
        eq(markets.status, 'active') // Only active markets (per requirement)
      )
    )
    .orderBy(desc(positions.updated_at))
    .limit(limit)
    .offset(offset);

    // Compute derived fields for the frontend
    const enrichedData = data.map((pos) => {
      const avgPriceYes = pos.yes_shares > 0 ? Number(pos.total_cost_yes) / Number(pos.yes_shares) : 0;
      const avgPriceNo = pos.no_shares > 0 ? Number(pos.total_cost_no) / Number(pos.no_shares) : 0;
      
      const bestBid = pos.best_bid !== null ? Number(pos.best_bid) : null;
      const bestAsk = pos.best_ask !== null ? Number(pos.best_ask) : null;
      
      let latestMidPrice = 5000;
      if (bestBid !== null && bestAsk !== null) {
        latestMidPrice = Math.floor((bestBid + bestAsk) / 2);
      } else if (bestBid !== null) {
        latestMidPrice = bestBid;
      } else if (bestAsk !== null) {
        latestMidPrice = bestAsk;
      }

      return {
        ...pos,
        avg_price_yes: Math.floor(avgPriceYes),
        avg_price_no: Math.floor(avgPriceNo),
        latest_mid_price: latestMidPrice,
      };
    });

    return c.json({
      success: true,
      data: enrichedData,
    });
  } catch (error) {
    console.error('Failed to fetch user positions:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
    }, 500);
  }
});
