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

export interface SharesRedeemedPayload {
  type: "shares_redeemed";
  market_id: number;
  user: string;
  amount: number;
}

export interface WinningsClaimedPayload {
  type: "winnings_claimed";
  market_id: number;
  user: string;
  winning_shares: number;
  payout: number;
}

export type MarketEventPayload =
  | MarketCreatedPayload
  | MarketStatusChangedPayload
  | MarketResolvedPayload
  | SharesMintedPayload
  | SharesRedeemedPayload
  | WinningsClaimedPayload;
