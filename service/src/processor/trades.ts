import { EventSchema } from '@winnr-trade/common';
import { trades, markets } from '@winnr-trade/common';
import { logger } from '../logger';
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
        const timestamp = Number(payload.timestamp) || event.timestamp;
        const settlementKind = payload.settlement_kind?.toLowerCase();
        
        const sharesVolume = quantity;
        const yesNotionalInternal = Math.floor((price * quantity) / 10000);
        const noNotionalInternal = Math.floor(((10000 - price) * quantity) / 10000);
        
        let collateralVolumeInternal = 0;
        if (settlementKind === 'mint_pair') collateralVolumeInternal = quantity;
        else if (settlementKind === 'transfer_yes') collateralVolumeInternal = yesNotionalInternal;
        else if (settlementKind === 'transfer_no') collateralVolumeInternal = noNotionalInternal;
        
        const baseMultiplier = 1000000;
        const collateralVolumeBase = collateralVolumeInternal * baseMultiplier;

        await db.insert(trades).values({
          market_id: marketId,
          maker_order_id: makerOrderId,
          taker_order_id: takerOrderId,
          price,
          quantity,
          buyer: payload.buyer,
          seller: payload.seller,
          settlement_kind: settlementKind,
          timestamp,
          tx_hash: event.txHash,
        });

        // Update the counters on the market
        let sharesDelta = 0;
        if (settlementKind === 'mint_pair') sharesDelta = quantity;
        else if (settlementKind === 'merge_pair') sharesDelta = -quantity;

        await db.update(markets)
          .set({
            total_shares_volume: sql`${markets.total_shares_volume} + ${sharesVolume}`,
            total_volume: sql`${markets.total_volume} + ${collateralVolumeBase}`,
            total_shares: sql`${markets.total_shares} + ${sharesDelta}`,
            event_number: event.number,
            tx_hash: event.txHash,
          })
          .where(eq(markets.id, marketId));

        logger.debug(`Trade recorded for market ${marketId}: Quantity ${quantity} at Price ${price}`);
      } catch (err) {
        logger.error(`Failed to process trade event.`, err);
      }
    }
  }
}
