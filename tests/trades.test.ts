import { describe, expect, it, mock, beforeEach } from "bun:test";
import { processTradeEvents } from "../service/src/processor/trades";
import { EventSchema } from "@winnr-trade/common";

// Mock sql tagged template
mock.module("drizzle-orm", () => {
  return {
    eq: (a: any, b: any) => ({ eq: true, a, b }),
    sql: (strings: TemplateStringsArray, ...values: any[]) => {
      // Just return the raw value that was added, assuming it's `sql\`... + ${value}\``
      // The value we care about is the last value injected.
      return values[values.length - 1];
    }
  };
});

describe("processTradeEvents", () => {
  let dbMock: any;
  let insertedTrades: any[] = [];
  let updatedMarkets: any[] = [];

  beforeEach(() => {
    insertedTrades = [];
    updatedMarkets = [];

    dbMock = {
      insert: mock().mockImplementation((table: any) => {
        return {
          values: mock().mockImplementation((args: any) => {
            insertedTrades.push(args);
          })
        };
      }),
      update: mock().mockImplementation((table: any) => {
        return {
          set: mock().mockImplementation((args: any) => {
            updatedMarkets.push(args);
            return {
              where: mock().mockResolvedValue({})
            };
          })
        };
      })
    };
  });

  const createEvent = (price: number, quantity: number, settlementKind: string): EventSchema => ({
    number: 1,
    key: "Trade",
    module: "market",
    txHash: "0x123",
    timestamp: 1715000000000,
    value: {
      type: "Trade",
      market_id: "1",
      maker_order_id: "10",
      taker_order_id: "11",
      price: price.toString(),
      quantity: quantity.toString(),
      buyer: "0xabc",
      seller: "0xdef",
      settlement_kind: settlementKind,
      timestamp: "1715000000000"
    }
  });

  it("mint_pair trade at any price adds shares quantity and collateral quantity", async () => {
    const events = [createEvent(6000, 50, "mint_pair")];
    await processTradeEvents(dbMock, events);

    expect(updatedMarkets.length).toBe(1);
    const update = updatedMarkets[0];
    
    expect(update.total_shares_volume).toBe(50);
    expect(update.total_volume).toBe(50 * 1000000); // 50 * 10^6
    expect(update.total_shares).toBe(50);
  });

  it("transfer_yes uses price-side notional", async () => {
    // price = 6000, qty = 50 -> notional = 6000 * 50 / 10000 = 30
    const events = [createEvent(6000, 50, "transfer_yes")];
    await processTradeEvents(dbMock, events);

    const update = updatedMarkets[0];
    expect(update.total_volume).toBe(30 * 1000000);
  });

  it("transfer_no uses complement-side notional", async () => {
    // price = 6000, qty = 50 -> no_notional = (10000 - 6000) * 50 / 10000 = 20
    const events = [createEvent(6000, 50, "transfer_no")];
    await processTradeEvents(dbMock, events);

    const update = updatedMarkets[0];
    expect(update.total_volume).toBe(20 * 1000000);
  });

  it("merge_pair contributes zero to collateral volume", async () => {
    const events = [createEvent(6000, 50, "merge_pair")];
    await processTradeEvents(dbMock, events);

    const update = updatedMarkets[0];
    expect(update.total_volume).toBe(0);
    expect(update.total_shares_volume).toBe(50);
    expect(update.total_shares).toBe(-50);
  });

  it("base unit conversion uses token decimals correctly", async () => {
    const events = [createEvent(5000, 10, "mint_pair")];
    await processTradeEvents(dbMock, events);

    const update = updatedMarkets[0];
    expect(update.total_volume).toBe(10 * 1000000);
  });
});
