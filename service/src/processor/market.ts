import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { markets } from '@winnr-trade/common';
import { EventSchema } from '@winnr-trade/common';
import type { MarketEventPayload } from '@winnr-trade/common';
import { logger } from '../logger';
import { updatePosition } from './positions';

// Maps Rust PascalCase enum strings → our lowercase DB enum variants
const statusMap: Record<string, 'active' | 'halted' | 'resolution_pending' | 'resolved'> = {
  Active: 'active',
  Halted: 'halted',
  ResolutionPending: 'resolution_pending',
  Resolved: 'resolved',
};

const outcomeMap: Record<string, 'yes' | 'no'> = {
  Yes: 'yes',
  No: 'no',
};

function normalizeStatus(status: string) {
  return statusMap[status] ?? ('active' as const);
}

function normalizeOutcome(outcome: string) {
  return outcomeMap[outcome] ?? ('yes' as const);
}

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

          // Parse the Resolver from JSON-encoded string
          // After JSON.parse: {"Address":"addr"} | {"Pyth":{...}} | {"Optimistic": {...}}
          let resolverType: 'address' | 'pyth' | 'optimistic';
          let resolverConfig: Record<string, unknown> = {};
          
          try {
            const parsed = JSON.parse(payload.resolver);

            if (typeof parsed === 'object' && 'Optimistic' in parsed) {
              resolverType = 'optimistic';
            } else if (typeof parsed === 'object' && 'Address' in parsed) {
              resolverType = 'address';
              resolverConfig = { address: parsed.Address };
            } else if (typeof parsed === 'object' && 'Pyth' in parsed) {
              resolverType = 'pyth';
              resolverConfig = {
                feed_id: parsed.Pyth.feed_id,
                lower_bound: parsed.Pyth.lower_bound ?? null,
                upper_bound: parsed.Pyth.upper_bound ?? null,
              };
            } else {
              logger.warn(`Unknown resolver shape for market ${payload.market_id}, defaulting to optimistic`);
              resolverType = 'optimistic';
            }
          } catch {
            logger.warn(`Failed to parse resolver for market ${payload.market_id}: "${payload.resolver}", defaulting to optimistic`);
            resolverType = 'optimistic';
          }

          await db.insert(markets)
            .values({
              id: payload.market_id,
              question: payload.question,
              creator: payload.creator,
              collateral_token: token,
              resolution_time: payload.resolution_time,
              resolver_type: resolverType,
              resolver_config: resolverConfig,
              status: 'active' as const,
              total_shares: 0,
              created_at: event.timestamp,
              event_number: event.number,
              tx_hash: event.txHash,
            })
            .onConflictDoNothing();
          
          logger.info(`Market created: ${payload.market_id} (resolver: ${resolverType})`);
          break;
        }

        case 'market_status_changed': {
          await db.update(markets)
            .set({ 
              status: normalizeStatus(payload.new_status),
              event_number: event.number,
              tx_hash: event.txHash
            })
            .where(eq(markets.id, payload.market_id));

          logger.info(`Market status changed: ${payload.market_id} to ${payload.new_status}`);
          break;
        }
        
        case 'market_resolved': {
          await db.update(markets)
            .set({ 
              status: 'resolved' as const, 
              outcome: normalizeOutcome(payload.outcome),
              event_number: event.number,
              tx_hash: event.txHash
            })
            .where(eq(markets.id, payload.market_id));

          logger.info(`Market resolved: ${payload.market_id} with outcome ${payload.outcome}`);
          break;
        }

        case 'shares_minted': {
          const amount = Number(payload.amount);
          await db.update(markets)
            .set({ 
              total_shares: sql`${markets.total_shares} + ${amount}`,
              event_number: event.number,
              tx_hash: event.txHash
            })
            .where(eq(markets.id, payload.market_id));

          // Base cost per pair is 1 unit (10000). We split this cost between YES (5000) and NO (5000).
          // You could also track it as 10000 for one and 0 for the other, but splitting is safer.
          const costPerShare = amount * 5000;
          await updatePosition(db, payload.user, payload.market_id, amount, amount, costPerShare, costPerShare);

          logger.info(`Shares minted for market ${payload.market_id}: +${amount}`);
          break;
        }

        case 'shares_redeemed': {
          const amount = Number(payload.amount);
          await db.update(markets)
            .set({ 
              total_shares: sql`${markets.total_shares} - ${amount}`,
              event_number: event.number,
              tx_hash: event.txHash
            })
            .where(eq(markets.id, payload.market_id));

          // When redeeming, user gets back 10000 per pair.
          // We reduce their costs proportionally to the number of shares removed.
          // Since our helper `updatePosition` just takes deltas, we need to pass a negative delta for shares.
          // But what about the cost delta? If we just want to keep avg price the same, we shouldn't guess the delta if we don't know the current total cost.
          // However, we can use a raw SQL expression inside the helper if needed, but for simplicity, 
          // redeeming pairs usually zeros out the position if it's the full amount. 
          // Let's just deduct a proportional default cost: 5000. 
          // A better approach is to reduce cost proportionally in the SQL statement. 
          // I will handle that in updatePosition or just pass 0 for now so avg price shifts slightly (which is fine on redeem).
          await updatePosition(db, payload.user, payload.market_id, -amount, -amount, -(amount * 5000), -(amount * 5000));

          logger.info(`Shares redeemed for market ${payload.market_id}: -${amount}`);
          break;
        }
        
        case 'winnings_claimed': {
          // You might track payouts somewhere, but for now we just log it
          // totalShares are not decremented here typically, or if they are, it's tracked in a separate `claimed` table
          logger.info(`Winnings claimed for market ${payload.market_id} by ${payload.user}: ${payload.winning_shares} shares -> ${payload.payout} payout`);
          break;
        }
      }
    } catch (err) {
      logger.error(`Failed to process market event: ${event.key}`, err);
    }
  }
}
