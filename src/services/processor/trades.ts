import { EventSchema } from '../db';
import { trades, markets } from '../../db/schema';
import logger from '../../utils/logger';
import { eq, sql } from 'drizzle-orm';

export async function processTradeEvents(
  db: any,
  events: EventSchema[]
) {
  for (const event of events) {
    const payload: any = event.value;
    const eventType = payload.type || event.key;

    // Accounts for both strict variant name mapping and snake_case API mappings
    if (eventType === 'Trade' || eventType === 'trade') {
      try {
        const marketId = Number(payload.market_id);
        const makerOrderId = Number(payload.maker_order_id);
        const takerOrderId = Number(payload.taker_order_id);
        const price = Number(payload.price);
        const quantity = Number(payload.quantity);

        // 1. Log the execution chronologically to the `trades` table.
        await db.insert(trades).values({
          marketId,
          makerOrderId,
          takerOrderId,
          price,
          quantity,
          timestamp: Date.now(),
          txHash: event.txHash,
        });

        // 2. Increment the volume counter on the `markets` table instantly!
        await db.update(markets)
          .set({
            volume: sql`${markets.volume} + ${quantity}`,
            eventNumber: event.number,
            txHash: event.txHash,
          })
          .where(eq(markets.id, marketId));
          
        logger.debug(`Trade recorded for market ${marketId}: Quantity ${quantity} at Price ${price}`);
      } catch (err) {
        logger.error(`Failed to process trade event.`, err);
      }
    }
  }
}
