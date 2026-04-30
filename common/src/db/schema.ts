import { 
  pgTable, 
  text, 
  bigint, 
  integer,
  pgEnum,
  serial,
  jsonb
} from 'drizzle-orm/pg-core';

export const marketStatusEnum = pgEnum('market_status', ['active', 'halted', 'resolution_pending', 'resolved']);
export const marketOutcomeEnum = pgEnum('market_outcome', ['yes', 'no']);
export const resolverTypeEnum = pgEnum('resolver_type', ['address', 'pyth', 'optimistic']);
export const settlementKindEnum = pgEnum('settlement_kind', ['mint_pair', 'transfer_yes', 'transfer_no', 'merge_pair']);

export const markets = pgTable('markets', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  question: text('question').notNull(),
  creator: text('creator').notNull(),
  collateralToken: text('collateral_token').notNull(),
  resolutionTime: bigint('resolution_time', { mode: 'number' }).notNull(),
  resolverType: resolverTypeEnum('resolver_type').notNull(),
  resolverConfig: jsonb('resolver_config').$type<Record<string, unknown>>().default({}).notNull(),
  status: marketStatusEnum('status').default('active').notNull(),
  outcome: marketOutcomeEnum('outcome'),
  totalYesShares: bigint('total_yes_shares', { mode: 'number' }).default(0).notNull(),
  totalNoShares: bigint('total_no_shares', { mode: 'number' }).default(0).notNull(),
  volume: bigint('volume', { mode: 'number' }).default(0).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  eventNumber: integer('event_number').notNull(),
  txHash: text('tx_hash').notNull(),
});

export const indexerState = pgTable('indexer_state', {
  id: text('id').primaryKey(),
  lastEventNumber: integer('last_event_number').notNull(),
  lastTxHash: text('last_tx_hash').notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const bookUpdates = pgTable('book_updates', {
  id: serial('id').primaryKey(),
  marketId: bigint('market_id', { mode: 'number' }).notNull(),
  bestBid: bigint('best_bid', { mode: 'number' }),
  bestAsk: bigint('best_ask', { mode: 'number' }),
  midPrice: bigint('mid_price', { mode: 'number' }),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
});

export const trades = pgTable('trades', {
  id: serial('id').primaryKey(),
  marketId: bigint('market_id', { mode: 'number' }).notNull(),
  makerOrderId: bigint('maker_order_id', { mode: 'number' }).notNull(),
  takerOrderId: bigint('taker_order_id', { mode: 'number' }).notNull(),
  price: bigint('price', { mode: 'number' }).notNull(),
  quantity: bigint('quantity', { mode: 'number' }).notNull(),
  buyer: text('buyer').notNull(),
  seller: text('seller').notNull(),
  settlementKind: settlementKindEnum('settlement_kind').notNull(),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
  txHash: text('tx_hash').notNull(),
});
