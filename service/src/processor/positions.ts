import { eq, and, sql } from 'drizzle-orm';
import { positions, PositionUpdatedPayload } from '@winnr-trade/common';
import { logger } from '../logger';

/**
 * Processes the new PositionUpdated event.
 * This is now the SINGLE source of truth for the positions table.
 * 
 * Logic:
 * 1. Shares are added/subtracted directly via deltas.
 * 2. Cost basis:
 *    - For acquisitions (delta >= 0): add the explicit cost from event.
 *    - For disposals (delta < 0): reduce cost proportionally based on shares removed.
 * 3. Row is deleted if total shares reach zero.
 */
export async function updatePositionFromEvent(
  db: any,
  payload: PositionUpdatedPayload,
  timestamp: number
) {
  const { 
    user_address, 
    market_id, 
    yes_delta, 
    no_delta, 
    cost_yes_added, 
    cost_no_added 
  } = payload;

  const yesDelta = BigInt(yes_delta);
  const noDelta = BigInt(no_delta);
  const costYesAdded = BigInt(cost_yes_added);
  const costNoAdded = BigInt(cost_no_added);

  try {
    // 1. Fetch current position state
    const currentRows = await db.select()
      .from(positions)
      .where(and(
        eq(positions.user_address, user_address),
        eq(positions.market_id, market_id)
      ));

    const prev = currentRows[0] || {
      quantity_yes: 0,
      quantity_no: 0,
      total_cost_yes: 0,
      total_cost_no: 0
    };

    const prevYesShares = BigInt(prev.quantity_yes);
    const prevNoShares = BigInt(prev.quantity_no);
    const prevCostYes = BigInt(prev.total_cost_yes);
    const prevCostNo = BigInt(prev.total_cost_no);

    // 2. Apply share deltas
    const newYesShares = prevYesShares + yesDelta;
    const newNoShares = prevNoShares + noDelta;

    // 3. Calculate new cost basis with proportional disposal
    // Use 1e18 fixed-point precision for the division to avoid truncation
    const PRECISION = BigInt(10) ** BigInt(18);

    let newCostYes: bigint;
    if (yesDelta >= 0n) {
      newCostYes = prevCostYes + costYesAdded;
    } else {
      const absDelta = yesDelta < 0n ? -yesDelta : yesDelta;
      if (prevYesShares > 0n) {
        // reduction = (abs(delta) / prev_shares) * prev_cost
        const reduction = (absDelta * PRECISION / prevYesShares) * prevCostYes / PRECISION;
        newCostYes = prevCostYes - reduction;
      } else {
        newCostYes = 0n;
      }
    }

    let newCostNo: bigint;
    if (noDelta >= 0n) {
      newCostNo = prevCostNo + costNoAdded;
    } else {
      const absDelta = noDelta < 0n ? -noDelta : noDelta;
      if (prevNoShares > 0n) {
        const reduction = (absDelta * PRECISION / prevNoShares) * prevCostNo / PRECISION;
        newCostNo = prevCostNo - reduction;
      } else {
        newCostNo = 0n;
      }
    }

    // Clamp values to zero to prevent floating point/rounding underflows to negative
    const finalYesShares = newYesShares < 0n ? 0n : newYesShares;
    const finalNoShares = newNoShares < 0n ? 0n : newNoShares;
    const finalCostYes = newCostYes < 0n ? 0n : newCostYes;
    const finalCostNo = newCostNo < 0n ? 0n : newCostNo;

    // 4. Update Database
    if (finalYesShares === 0n && finalNoShares === 0n) {
      await db.delete(positions)
        .where(and(
          eq(positions.user_address, user_address),
          eq(positions.market_id, market_id)
        ));
      logger.debug(`Position closed: user=${user_address} market=${market_id}`);
    } else {
      await db.insert(positions)
        .values({
          user_address,
          market_id,
          quantity_yes: Number(finalYesShares),
          quantity_no: Number(finalNoShares),
          total_cost_yes: Number(finalCostYes),
          total_cost_no: Number(finalCostNo),
          updated_at: timestamp
        })
        .onConflictDoUpdate({
          target: [positions.user_address, positions.market_id],
          set: {
            quantity_yes: Number(finalYesShares),
            quantity_no: Number(finalNoShares),
            total_cost_yes: Number(finalCostYes),
            total_cost_no: Number(finalCostNo),
            updated_at: timestamp
          }
        });
      logger.debug(`Position updated: user=${user_address} market=${market_id} YES=${finalYesShares} NO=${finalNoShares}`);
    }
  } catch (err) {
    logger.error(`Failed to update position for user ${user_address} on market ${market_id}`, err);
    throw err;
  }
}

/** Legacy helper - no longer used but kept for type safety during migration */
export async function updatePosition() {
  logger.warn('Legacy updatePosition called - this should not happen with the new PositionUpdated event architecture.');
}
