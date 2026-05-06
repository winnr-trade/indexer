import { 
  pgTable, 
  text, 
  bigint, 
  integer,
  pgEnum,
  serial,
  jsonb,
  primaryKey
} from 'drizzle-orm/pg-core';

export const marketStatusEnum = pgEnum('market_status', ['active', 'halted', 'resolution_pending', 'resolved']);
export const marketOutcomeEnum = pgEnum('market_outcome', ['yes', 'no']);
export const resolverTypeEnum = pgEnum('resolver_type', ['address', 'pyth', 'optimistic']);
export const settlementKindEnum = pgEnum('settlement_kind', ['mint_pair', 'transfer_yes', 'transfer_no', 'merge_pair']);

export const markets = pgTable('markets', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  question: text('question').notNull(),
  creator: text('creator').notNull(),
  collateral_token: text('collateral_token').notNull(),
  resolution_time: bigint('resolution_time', { mode: 'number' }).notNull(),
  resolver_type: resolverTypeEnum('resolver_type').notNull(),
  resolver_config: jsonb('resolver_config').$type<Record<string, unknown>>().default({}).notNull(),
  status: marketStatusEnum('status').default('active').notNull(),
  outcome: marketOutcomeEnum('outcome'),
  total_shares: bigint('total_shares', { mode: 'number' }).default(0).notNull(),
  total_shares_volume: bigint('total_shares_volume', { mode: 'number' }).default(0).notNull(),
  total_volume: bigint('total_volume', { mode: 'number' }).default(0).notNull(),
  best_bid: integer('best_bid'),
  best_ask: integer('best_ask'),
  created_at: bigint('created_at', { mode: 'number' }).notNull(),
  event_number: integer('event_number').notNull(),
  tx_hash: text('tx_hash').notNull(),
});

export const indexerState = pgTable('indexer_state', {
  id: text('id').primaryKey(),
  last_event_number: integer('last_event_number').notNull(),
  last_tx_hash: text('last_tx_hash').notNull(),
  updated_at: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const bookUpdates = pgTable('book_updates', {
  id: serial('id').primaryKey(),
  market_id: bigint('market_id', { mode: 'number' }).notNull(),
  best_bid: integer('best_bid'),
  best_ask: integer('best_ask'),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
});

export const trades = pgTable('trades', {
  id: serial('id').primaryKey(),
  market_id: bigint('market_id', { mode: 'number' }).notNull(),
  maker_order_id: bigint('maker_order_id', { mode: 'number' }).notNull(),
  taker_order_id: bigint('taker_order_id', { mode: 'number' }).notNull(),
  price: integer('price').notNull(),
  quantity: bigint('quantity', { mode: 'number' }).notNull(),
  buyer: text('buyer').notNull(),
  seller: text('seller').notNull(),
  settlement_kind: settlementKindEnum('settlement_kind').notNull(),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
  tx_hash: text('tx_hash').notNull(),
});



export const positions = pgTable('positions', {
  user_address: text('user_address').notNull(),
  market_id: bigint('market_id', { mode: 'number' }).notNull(),
  quantity_yes: bigint('quantity_yes', { mode: 'number' }).default(0).notNull(),
  quantity_no: bigint('quantity_no', { mode: 'number' }).default(0).notNull(),
  total_cost_yes: bigint('total_cost_yes', { mode: 'number' }).default(0).notNull(),
  total_cost_no: bigint('total_cost_no', { mode: 'number' }).default(0).notNull(),
  updated_at: bigint('updated_at', { mode: 'number' }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.user_address, t.market_id] }),
]);
