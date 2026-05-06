import { EventSchema } from '@winnr-trade/common';
import { trades, markets } from '@winnr-trade/common';
import { logger } from '../logger';

import { eq, sql } from 'drizzle-orm';

/**
 * Processes Trade events from the orderbook.
 *
 * Responsibilities:
 *   1. Record the trade in the `trades` table.
 *   2. Update market-level counters (volume, total_shares).
 *   3. Update position cost basis (shares are NOT touched here —
 *      they are handled by share-level events in market.ts).
 */
export async function processTradeEvents(
  db: any,
  events: EventSchema[]
) {
  for (const event of events) {
    const payload: any = event.value;
    const eventType = payload.type || event.key;

    if (eventType === 'Trade' || eventType === 'trade') {
      try {
        const marketId = Number(payload.market_id);
        const makerOrderId = Number(payload.maker_order_id);
        const takerOrderId = Number(payload.taker_order_id);
        const price = Number(payload.price);
        const quantity = Number(payload.quantity);
        const timestamp = Number(payload.timestamp) || event.timestamp;
        const settlementKind = payload.settlement_kind?.toLowerCase();
        const buyer = payload.buyer;
        const seller = payload.seller;

        // quantity is a share count; prices are bps (base 10000)
        // All stored costs/volumes are in USDC base units (6 decimals, 1 USDC = 1_000_000)
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
  }
}

