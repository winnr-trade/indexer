export enum EventModule {
    MARKET = "Market",
    ORDERBOOK = "Orderbook",
    SHIELDED_POOL = "ShieldedPool"
}

export enum MarketEventType {
  MARKET_CREATED = "MarketModule/MarketCreated",
  MARKET_STATUS_CHANGED = "MarketModule/MarketStatusChanged",
  MARKET_RESOLVED = "MarketModule/MarketResolved",
  SHARES_MINTED = "MarketModule/SharesMinted",
  SHARES_BURNED = "MarketModule/SharesBurned",
  SHARES_TRANSFERRED = "MarketModule/SharesTransferred",
  WINNINGS_CLAIMED = "MarketModule/WinningsClaimed",
  POSITION_UPDATED = "MarketModule/PositionUpdated"
}

export enum OrderbookEventType {
  BOOK_UPDATED = "OrderbookModule/BookUpdated",
  TRADE = "OrderbookModule/Trade",
  STEALTH_ORDER_MEMO = "OrderbookModule/StealthOrderMemo"
}

export enum ShieldedPoolEventType {
  NOTE = "ShieldedPoolModule/Note"
}