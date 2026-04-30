import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { EventSchema } from '@winnr-trade/common';
import { processMarketEvents } from './market';
import { processOrderbookEvents } from './orderbook';
import { processTradeEvents } from './trades';
import { logger } from '../logger';
import { indexerState } from '@winnr-trade/common';

export class EventProcessor {
  constructor(private readonly db: NodePgDatabase) {}

  async process(events: EventSchema[]) {
    if (events.length === 0) return;

    if (events.length === 0) return;

    await this.db.transaction(async (tx) => {
      const marketEvents = events.filter((e) => e.module === 'Market');

      if (marketEvents.length > 0) {
        logger.debug(`Dispatching ${marketEvents.length} market events to handler`);
        await processMarketEvents(tx, marketEvents);
      }

      const orderbookEvents = events.filter((e) => e.module === 'Orderbook');
      
      if (orderbookEvents.length > 0) {
        logger.debug(`Dispatching ${orderbookEvents.length} orderbook events to handler`);
        logger.info(`Dispatching ${orderbookEvents.length} orderbook events to handler`);
        await processOrderbookEvents(tx, orderbookEvents);
      }

      const tradeEvents = events.filter((e) => 
        e.module === 'Orderbook' && 
        (e.key.includes('Trade') || (e.value as any)?.type?.toLowerCase() === 'trade')
      );
      
      if (tradeEvents.length > 0) {
        logger.debug(`Dispatching ${tradeEvents.length} trade events to handler`);
        await processTradeEvents(tx, tradeEvents);
      }

      // Update the indexer state with the latest processed event
      const lastEvent = events[events.length - 1];
      await tx.insert(indexerState)
        .values({
          id: 'main',
          lastEventNumber: lastEvent.number,
          lastTxHash: lastEvent.txHash,
          updatedAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: indexerState.id,
          set: {
            lastEventNumber: lastEvent.number,
            lastTxHash: lastEvent.txHash,
            updatedAt: Date.now(),
          }
        });
    });
  }
}
