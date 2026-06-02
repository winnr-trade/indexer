import { eq, sql } from 'drizzle-orm';
import { markets } from '@winnr-trade/common';
import { EventSchema } from '@winnr-trade/common';
import type { 
  MarketEventPayload,
  MarketCreatedPayload,
  MarketStatusChangedPayload,
  MarketResolvedPayload,
  SharesMintedPayload,
  SharesBurnedPayload,
  SharesTransferredPayload,
  WinningsClaimedPayload,
  PositionUpdatedPayload
} from '../types/events';
import { logger } from '../logger';
import { EventModule, MarketEventType } from '../configs/constants';

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
    if (event.module !== EventModule.MARKET) { continue; }

    const payload = event.value as unknown as MarketEventPayload;
    
    try {
      switch (event.key) {
        case MarketEventType.MARKET_CREATED:
          await processMarketCreated(db, payload as MarketCreatedPayload, event);
          break;
        case MarketEventType.MARKET_STATUS_CHANGED:
          await processMarketStatusChanged(db, payload as MarketStatusChangedPayload, event);
          break;
        case MarketEventType.MARKET_RESOLVED:
          await processMarketResolved(db, payload as MarketResolvedPayload, event);
          break;
        case MarketEventType.SHARES_MINTED:
          await processSharesMinted(db, payload as SharesMintedPayload, event);
          break;
        case MarketEventType.SHARES_BURNED:
          await processSharesBurned(db, payload as SharesBurnedPayload, event);
          break;
        case MarketEventType.SHARES_TRANSFERRED:
          await processSharesTransferred(db, payload as SharesTransferredPayload, event);
          break;
        case MarketEventType.WINNINGS_CLAIMED:
          await processWinningsClaimed(db, payload as WinningsClaimedPayload, event);
          break;
        case MarketEventType.POSITION_UPDATED:
          await processPositionUpdated(db, payload as PositionUpdatedPayload, event);
          break;
        default:
          logger.warn(`Unknown market event type: ${event.key}`);
      }
    } catch (err) {
      logger.error(`Failed to process market event: ${event.key}`, err);
    }
  }
}

async function processMarketCreated(
  db: any,
  payload: MarketCreatedPayload,
  event: EventSchema
) {
  // Clean the Rust debug artifacting from the token ID
  let token = payload.collateral_token;
  const match = token.match(/TokenIdBech32\("([^"]+)"\)/);
  if (match && match[1]) {
    token = match[1];
  }

  // Parse the Resolver from JSON-encoded string
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
      created_at: Number(payload.timestamp),
      event_number: event.number,
      tx_hash: event.txHash,
    })
    .onConflictDoNothing();
  
  logger.info(`Market created: ${payload.market_id} (resolver: ${resolverType})`);
}

async function processMarketStatusChanged(
  db: any,
  payload: MarketStatusChangedPayload,
  event: EventSchema
) {
  await db.update(markets)
    .set({ 
      status: normalizeStatus(payload.new_status),
      event_number: event.number,
      tx_hash: event.txHash
    })
    .where(eq(markets.id, payload.market_id));

  logger.info(`Market status changed: ${payload.market_id} to ${payload.new_status}`);
}

async function processMarketResolved(
  db: any,
  payload: MarketResolvedPayload,
  event: EventSchema
) {
  await db.update(markets)
    .set({ 
      status: 'resolved' as const, 
      outcome: normalizeOutcome(payload.outcome),
      event_number: event.number,
      tx_hash: event.txHash
    })
    .where(eq(markets.id, payload.market_id));

  logger.info(`Market resolved: ${payload.market_id} with outcome ${payload.outcome}`);
}

async function processSharesMinted(
  db: any,
  payload: SharesMintedPayload,
  event: EventSchema
) {
  const amount = Number(payload.amount);
  await db.update(markets)
    .set({ 
      total_shares: sql`${markets.total_shares} + ${amount}`,
      event_number: event.number,
      tx_hash: event.txHash
    })
    .where(eq(markets.id, payload.market_id));

  logger.info(`Shares minted for market ${payload.market_id}: +${amount}`);
}

async function processSharesBurned(
  db: any,
  payload: SharesBurnedPayload,
  event: EventSchema
) {
  const amount = Number(payload.amount);
  await db.update(markets)
    .set({ 
      total_shares: sql`${markets.total_shares} - ${amount}`,
      event_number: event.number,
      tx_hash: event.txHash
    })
    .where(eq(markets.id, payload.market_id));

  logger.info(`Shares burned for market ${payload.market_id}: -${amount}`);
}

async function processSharesTransferred(
  db: any,
  payload: SharesTransferredPayload,
  event: EventSchema
) {
  const yesAmount = Number(payload.yes_amount);
  const noAmount = Number(payload.no_amount);
  logger.info(`Shares transferred market=${payload.market_id}: ${payload.from} → ${payload.to} (YES=${yesAmount}, NO=${noAmount})`);
}

async function processWinningsClaimed(
  db: any,
  payload: WinningsClaimedPayload,
  event: EventSchema
) {
  logger.info(`Winnings claimed for market ${payload.market_id} by ${payload.user}: ${payload.winning_shares} shares -> ${payload.payout} payout`);
}

async function processPositionUpdated(
  db: any,
  payload: PositionUpdatedPayload,
  event: EventSchema
) {
  const { updatePositionFromEvent } = await import('./positions');
  await updatePositionFromEvent(db, payload, Number(payload.timestamp));
}
