import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { positions } from '@winnr-trade/common';

export async function updatePosition(
  db: any,
  userAddress: string,
  marketId: number,
  yesDelta: number,
  noDelta: number,
  costYesDelta: number,
  costNoDelta: number
) {
  const now = Date.now();

  // Upsert the position
  await db.insert(positions)
    .values({
      user_address: userAddress,
      market_id: marketId,
      yes_shares: yesDelta,
      no_shares: noDelta,
      total_cost_yes: costYesDelta,
      total_cost_no: costNoDelta,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: [positions.user_address, positions.market_id],
      set: {
        yes_shares: sql`${positions.yes_shares} + ${yesDelta}`,
        no_shares: sql`${positions.no_shares} + ${noDelta}`,
        total_cost_yes: sql`${positions.total_cost_yes} + ${costYesDelta}`,
        total_cost_no: sql`${positions.total_cost_no} + ${costNoDelta}`,
        updated_at: now,
      }
    });

  // Prune empty positions
  await db.execute(sql`
    DELETE FROM positions 
    WHERE user_address = ${userAddress} 
      AND market_id = ${marketId} 
      AND yes_shares <= 0 
      AND no_shares <= 0
  `);
}
