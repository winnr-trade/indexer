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

export type MarketEventPayload =
  | MarketCreatedPayload
  | MarketStatusChangedPayload
  | MarketResolvedPayload;
