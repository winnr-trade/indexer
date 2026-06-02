import { eq, sql } from 'drizzle-orm';
import { EventSchema } from '@winnr-trade/common';
import { bookUpdates, markets, trades, stealthOrderMemos } from '@winnr-trade/common';
import { logger } from '../logger';
import { EventModule, OrderbookEventType } from '../configs/constants';
import type { StealthOrderMemoPayload } from '../types/events';

export interface BookUpdatedPayload {
  type: "book_updated";
  market_id: number;
  best_bid: string | number | null;
  best_ask: string | number | null;
  timestamp: string | number | null;
}

export interface TradePayload {
  type: "Trade" | "trade";
  market_id: string | number;
  maker_order_id: string | number;
  taker_order_id: string | number;
  price: string | number;
  quantity: string | number;
  buyer: string;
  seller: string;
  settlement_kind: string;
  timestamp: string | number;
}

export async function processOrderbookEvents(
  db: any,
  events: EventSchema[]
) {
  for (const event of events) {
    if (event.module !== EventModule.ORDERBOOK) { continue; }

    const payload = event.value as any;

    if (event.key === OrderbookEventType.BOOK_UPDATED) {
      await processBookUpdatedEvent(db, payload as BookUpdatedPayload, event);
    } else if (event.key === OrderbookEventType.TRADE) {
      await processTradeEvent(db, payload as TradePayload, event);
    } else if (event.key === OrderbookEventType.STEALTH_ORDER_MEMO) {
      await processStealthOrderMemoEvent(db, payload as StealthOrderMemoPayload, event);
    } else {
      logger.warn(`Unknown orderbook event type: ${event.key}`);
    }
  }
}

async function processBookUpdatedEvent(
  db: any,
  payload: BookUpdatedPayload,
  event: EventSchema
) {
  try {
    const marketId = payload.market_id;
    const bestBid = payload.best_bid ? Number(payload.best_bid) : null;
    const bestAsk = payload.best_ask ? Number(payload.best_ask) : null;
    const timestamp = payload.timestamp ? Number(payload.timestamp) : null;

    await db.insert(bookUpdates).values({
      market_id: marketId,
      best_bid: bestBid,
      best_ask: bestAsk,
      timestamp,
    });

    await db.update(markets)
      .set({
        best_bid: bestBid,
        best_ask: bestAsk,
        event_number: event.number,
        tx_hash: event.txHash,
      })
      .where(eq(markets.id, marketId));

    logger.debug(`BookUpdated for market ${marketId}: best_bid=${bestBid}, best_ask=${bestAsk}`);
  } catch (err) {
    logger.error(`Failed to process book update event.`, err);
  }
}

async function processTradeEvent(
  db: any,
  payload: TradePayload,
  event: EventSchema
) {
  try {
    const marketId = Number(payload.market_id);
    const makerOrderId = Number(payload.maker_order_id);
    const takerOrderId = Number(payload.taker_order_id);
    const price = Number(payload.price);
    const quantity = Number(payload.quantity);
    const timestamp = Number(payload.timestamp) || Date.now();
    const settlementKind = payload.settlement_kind?.toLowerCase();
    const buyer = payload.buyer;
    const seller = payload.seller;

    const USDC_DECIMALS = 1_000_000;

    // --- 1. Record the trade row ---
    await db.insert(trades).values({
      market_id: marketId,
      maker_order_id: makerOrderId,
      taker_order_id: takerOrderId,
      price,
      quantity,
      buyer,
      seller,
      settlement_kind: settlementKind,
      timestamp,
      tx_hash: event.txHash,
    });

    // --- 2. Update market-level counters ---
    let collateralVolume = 0;
    if (settlementKind === 'mint_pair') {
      collateralVolume = quantity * USDC_DECIMALS;
    } else if (settlementKind === 'transfer_yes') {
      collateralVolume = Math.floor((price * quantity * USDC_DECIMALS) / 10000);
    } else if (settlementKind === 'transfer_no') {
      collateralVolume = Math.floor(((10000 - price) * quantity * USDC_DECIMALS) / 10000);
    }

    let sharesDelta = 0;
    if (settlementKind === 'mint_pair') sharesDelta = quantity;
    else if (settlementKind === 'merge_pair') sharesDelta = -quantity;

    await db.update(markets)
      .set({
        total_shares_volume: sql`${markets.total_shares_volume} + ${quantity}`,
        total_volume: sql`${markets.total_volume} + ${collateralVolume}`,
        total_shares: sql`${markets.total_shares} + ${sharesDelta}`,
        event_number: event.number,
        tx_hash: event.txHash,
      })
      .where(eq(markets.id, marketId));

    logger.debug(`Trade recorded: market=${marketId} qty=${quantity} price=${price} settlement=${settlementKind}`);
  } catch (err) {
    logger.error(`Failed to process trade event.`, err);
  }
}

async function processStealthOrderMemoEvent(
  db: any,
  payload: StealthOrderMemoPayload,
  event: EventSchema
) {
  try {
    const commitment = payload.commitment.toLowerCase();
    const stealthAddress = payload.stealth_address;
    const detectionTag = payload.detection_tag.toLowerCase();
    const timestamp = Number(payload.timestamp) || Date.now();

    await db.insert(stealthOrderMemos).values({
      commitment,
      stealth_address: stealthAddress,
      detection_tag: detectionTag,
      timestamp,
      tx_hash: event.txHash,
    });

    logger.debug(
      `StealthOrderMemo indexed: commitment=${commitment} stealth_address=${stealthAddress} detection_tag=${detectionTag}`
    );
  } catch (err) {
    logger.error(`Failed to process stealth order memo event.`, err);
  }
}
