import { 
  pgTable, 
  text, 
  bigint, 
  integer,
  pgEnum,
  serial
} from 'drizzle-orm/pg-core';

export const marketStatusEnum = pgEnum('market_status', ['Active', 'Halted', 'ResolutionPending', 'Resolved']);
export const marketOutcomeEnum = pgEnum('market_outcome', ['Yes', 'No']);

export const markets = pgTable('markets', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  question: text('question').notNull(),
  creator: text('creator').notNull(),
  collateralToken: text('collateral_token').notNull(),
  resolutionTime: bigint('resolution_time', { mode: 'number' }).notNull(),
  resolver: text('resolver').notNull(),
  status: marketStatusEnum('status').default('Active').notNull(),
  outcome: marketOutcomeEnum('outcome'),
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
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
  txHash: text('tx_hash').notNull(),
});
