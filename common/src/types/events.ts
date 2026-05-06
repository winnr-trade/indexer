export interface MarketCreatedPayload {
  type: "market_created";
  market_id: number;
  question: string;
  creator: string;
  collateral_token: string;
  resolution_time: number;
  resolver: string;
}

export interface MarketStatusChangedPayload {
  type: "market_status_changed";
  market_id: number;
  old_status: string;
  new_status: string;
}

export interface MarketResolvedPayload {
  type: "market_resolved";
  market_id: number;
  outcome: string;
  resolver: string;
}

export interface SharesMintedPayload {
  type: "shares_minted";
  market_id: number;
  user: string;
  amount: number;
}

export interface SharesBurnedPayload {
  type: "shares_burned";
  market_id: number;
  user: string;
  amount: number;
}

export interface SharesTransferredPayload {
  type: "shares_transferred";
  market_id: number;
  from: string;
  to: string;
  yes_amount: number;
  no_amount: number;
}

export interface WinningsClaimedPayload {
  type: "winnings_claimed";
  market_id: number;
  user: string;
  winning_shares: number;
  payout: number;
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
