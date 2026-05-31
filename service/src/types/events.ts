export interface MarketCreatedPayload {
  type: "market_created";
  market_id: number;
  question: string;
  creator: string;
  collateral_token: string;
  resolution_time: number;
  resolver: string;
  timestamp: string | number;
}

export interface MarketStatusChangedPayload {
  type: "market_status_changed";
  market_id: number;
  old_status: string;
  new_status: string;
  timestamp: string | number;
}

export interface MarketResolvedPayload {
  type: "market_resolved";
  market_id: number;
  outcome: string;
  resolver: string;
  timestamp: string | number;
}

export interface SharesMintedPayload {
  type: "shares_minted";
  market_id: number;
  user: string;
  amount: number;
  timestamp: string | number;
}

export interface SharesBurnedPayload {
  type: "shares_burned";
  market_id: number;
  user: string;
  amount: number;
  timestamp: string | number;
}

export interface SharesTransferredPayload {
  type: "shares_transferred";
  market_id: number;
  from: string;
  to: string;
  yes_amount: number;
  no_amount: number;
  timestamp: string | number;
}

export interface WinningsClaimedPayload {
  type: "winnings_claimed";
  market_id: number;
  user: string;
  winning_shares: number;
  payout: number;
  timestamp: string | number;
}

export interface PositionUpdatedPayload {
  type: "position_updated";
  market_id: number;
  user_address: string;
  yes_delta: string; // i64 as string for safety with big numbers
  no_delta: string;  // i64 as string
  cost_yes_added: string; // Amount as string
  cost_no_added: string;  // Amount as string
  update_source: string;
  timestamp: string | number;
}

export type MarketEventPayload =
  | MarketCreatedPayload
  | MarketStatusChangedPayload
  | MarketResolvedPayload
  | SharesMintedPayload
  | SharesBurnedPayload
  | SharesTransferredPayload
  | WinningsClaimedPayload
  | PositionUpdatedPayload;

export interface NoteEventPayload {
  kind: 'register_account' | 'deposit' | 'withdraw';
  commitment: string;
  nullifier: string;
  amount: string | number;
  leaf_index: string | number;
  memo: number[] | string;
  timestamp: string | number;
}

export interface TradeEventPayload {
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

export interface StealthOrderMemoPayload {
  commitment: string;
  stealth_address: string;
  detection_tag: string;
  timestamp: string | number;
}
