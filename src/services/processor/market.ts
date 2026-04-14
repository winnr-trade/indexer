import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { markets } from '../../db/schema';
import { EventSchema } from '../db';
import { MarketEventPayload } from '../../types/events';
import logger from '../../utils/logger';

export async function processMarketEvents(
  db: any,
  events: EventSchema[]
) {
  for (const event of events) {
    if (event.module !== 'Market') continue;

    const payload = event.value as unknown as MarketEventPayload;

    try {
      switch (payload.type) {
        case 'market_created': {
          // Clean the Rust debug artifacting from the token ID
          let token = payload.collateral_token;
          const match = token.match(/TokenIdBech32\("([^"]+)"\)/);
          if (match && match[1]) {
            token = match[1];
          }

          await db.insert(markets)
            .values({
              id: payload.market_id,
              question: payload.question,
              creator: payload.creator,
              collateralToken: token,
              resolutionTime: payload.resolution_time,
              resolver: payload.resolver,
              status: 'Active',
              createdAt: Date.now(),
              eventNumber: event.number,
              txHash: event.txHash,
            })
            .onConflictDoNothing();
          
          logger.info(`Market created: ${payload.market_id}`);
          break;
        }
        case 'market_status_changed': {
          await db.update(markets)
            // Note: Enum mappings cast if the rust status strings differ structurally
            .set({ 
              status: payload.new_status as any,
              eventNumber: event.number,
              txHash: event.txHash
            })
            .where(eq(markets.id, payload.market_id));

          logger.info(`Market status changed: ${payload.market_id} to ${payload.new_status}`);
          break;
        }
        case 'market_resolved': {
          await db.update(markets)
            .set({ 
              status: 'Resolved', 
              outcome: payload.outcome as any,
              eventNumber: event.number,
              txHash: event.txHash
            })
            .where(eq(markets.id, payload.market_id));

          logger.info(`Market resolved: ${payload.market_id} with outcome ${payload.outcome}`);
          break;
        }
      }
    } catch (err) {
      logger.error(`Failed to process market event: ${event.key}`, err);
    }
  }
}
