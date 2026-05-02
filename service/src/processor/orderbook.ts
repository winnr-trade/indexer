import { EventSchema } from '@winnr-trade/common';
import { bookUpdates } from '@winnr-trade/common';
import { logger } from '../logger';
import { eq } from 'drizzle-orm';

export async function processOrderbookEvents(
  db: any,
  events: EventSchema[]
) {
  for (const event of events) {
    // Determine the event type from the payload or key
    const payload: any = event.value;
    const eventType = payload.type || event.key;

    if (eventType === 'book_updated') {
      try {
        const marketId = payload.market_id;
        // Rust Option<Price> comes through as null or a number
        const bestBid = payload.best_bid != null ? Number(payload.best_bid) : null;
        const bestAsk = payload.best_ask != null ? Number(payload.best_ask) : null;
        
        // Calculate the mid-market price
        let midPrice = null;
        if (bestBid !== null && bestAsk !== null) {
          midPrice = Math.floor((bestBid + bestAsk) / 2);
        } else if (bestBid !== null) {
          midPrice = bestBid;
        } else if (bestAsk !== null) {
          midPrice = bestAsk;
        }

        await db.insert(bookUpdates).values({
          market_id: marketId,
          best_bid: bestBid,
          best_ask: bestAsk,
          mid_price: midPrice,
          timestamp: event.timestamp, // Accurate timestamp for charting
        });
        
        logger.debug(`BookUpdated for market ${marketId}: midPrice recorded as ${midPrice}`);
      } catch (err) {
        logger.error(`Failed to process book update event.`, err);
      }
    }
  }
}
