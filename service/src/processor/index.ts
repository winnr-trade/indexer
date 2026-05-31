import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { EventSchema } from '@winnr-trade/common';
import { processMarketEvents } from './market';
import { processOrderbookEvents } from './orderbook';
import { processShieldedPoolEvents } from './shieldedPool';
import { logger } from '../logger';
import { indexerState } from '@winnr-trade/common';
import { EventModule } from '../configs/constants';

export class EventProcessor {
  constructor(private readonly db: NodePgDatabase) { }

  async dispatchModuleEvents(tx: any, module: EventModule, events: EventSchema[]) {
    logger.debug(`Dispatching ${events.length} ${module} module events`);
    switch (module) {
      case EventModule.MARKET:
        await processMarketEvents(tx, events);
        break;
      case EventModule.ORDERBOOK:
        await processOrderbookEvents(tx, events);
        break;
      case EventModule.SHIELDED_POOL:
        await processShieldedPoolEvents(tx, events);
        break;
      default:
        throw new Error(`Unknown module: ${module}`);
    }
  }

  async process(events: EventSchema[]) {
    if (events.length === 0) { return; }
    
    const marketEvents = events.filter((e) => e.module === EventModule.MARKET);
    const orderbookEvents = events.filter((e) => e.module === EventModule.ORDERBOOK);
    const shieldedPoolEvents = events.filter((e) => e.module === EventModule.SHIELDED_POOL);

    await this.db.transaction(async (tx) => {
      if (marketEvents.length > 0) {
        await this.dispatchModuleEvents(tx, EventModule.MARKET, marketEvents);
      }

      if (orderbookEvents.length > 0) {
        await this.dispatchModuleEvents(tx, EventModule.ORDERBOOK, orderbookEvents);
      }

      if (shieldedPoolEvents.length > 0) {
        await this.dispatchModuleEvents(tx, EventModule.SHIELDED_POOL, shieldedPoolEvents);
      }

      // Update the indexer state with the latest processed event
      const lastEvent = events[events.length - 1];
      await tx.insert(indexerState)
        .values({
          id: 'main',
          last_event_number: lastEvent.number,
          last_tx_hash: lastEvent.txHash,
          updated_at: Date.now(),
        })
        .onConflictDoUpdate({
          target: indexerState.id,
          set: {
            last_event_number: lastEvent.number,
            last_tx_hash: lastEvent.txHash,
            updated_at: Date.now(),
          }
        });
    });
  }
}
