import { describe, expect, it, mock, beforeEach } from "bun:test";
import { processShieldedPoolEvents } from "../service/src/processor/shieldedPool";
import { EventSchema } from "@winnr-trade/common";

describe("processShieldedPoolEvents", () => {
  let dbMock: any;
  let insertedNotes: any[] = [];

  beforeEach(() => {
    insertedNotes = [];

    dbMock = {
      insert: mock().mockImplementation((table: any) => {
        return {
          values: mock().mockImplementation((args: any) => {
            insertedNotes.push(args);
          })
        };
      })
    };
  });

  const createEvent = (
    kind: any,
    memo: any,
    commitment = "0xabc",
    nullifier = "0x123",
    amount = 100,
    leaf_index = 42
  ): EventSchema => ({
    number: 1,
    key: "ShieldedPoolModule/Note",
    module: "ShieldedPool",
    txHash: "0xhash",
    value: {
      Note: {
        kind,
        commitment,
        nullifier,
        amount: amount.toString(),
        leaf_index: leaf_index.toString(),
        memo,
        timestamp: "1715000000000"
      }
    }
  });

  it("successfully indexes a RegisterAccount note with array memo", async () => {
    const event = createEvent("register_account", [1, 2, 3]);
    await processShieldedPoolEvents(dbMock, [event]);

    expect(insertedNotes.length).toBe(1);
    const note = insertedNotes[0];
    expect(note.kind).toBe("register_account");
    expect(note.commitment).toBe("0xabc");
    expect(note.nullifier).toBe("0x123");
    expect(note.amount).toBe(100);
    expect(note.leaf_index).toBe(42);
    expect(typeof note.memo).toBe("string");
    expect(note.memo).toBe("0x010203");
    expect(note.timestamp).toBe(1715000000000);
    expect(note.tx_hash).toBe("0xhash");
  });

  it("successfully indexes a Deposit note with hex memo", async () => {
    const event = createEvent("deposit", "0x0a0b0c", "0xabc", "0x123", 100, 100);
    await processShieldedPoolEvents(dbMock, [event]);

    expect(insertedNotes.length).toBe(1);
    const note = insertedNotes[0];
    expect(note.kind).toBe("deposit");
    expect(note.leaf_index).toBe(100);
    expect(note.memo).toBe("0x0a0b0c");
    expect(note.timestamp).toBe(1715000000000);
  });

  it("successfully indexes a Withdraw note with string memo", async () => {
    const event = createEvent("withdraw", "hello", "0xabc", "0x123", 100, 0);
    await processShieldedPoolEvents(dbMock, [event]);

    expect(insertedNotes.length).toBe(1);
    const note = insertedNotes[0];
    expect(note.kind).toBe("withdraw");
    expect(note.leaf_index).toBe(0);
    expect(note.memo).toBe("0x68656c6c6f"); // "hello" in hex
    expect(note.timestamp).toBe(1715000000000);
  });

  it("handles flat payload structures (no nested 'Note' wrapper)", async () => {
    const event: EventSchema = {
      number: 2,
      key: "ShieldedPoolModule/Note",
      module: "ShieldedPool",
      txHash: "0xhash2",
      value: {
        kind: "deposit",
        commitment: "0xdef",
        nullifier: "0x456",
        amount: "500",
        leaf_index: "999",
        memo: "world",
        timestamp: "1715000000000"
      }
    };
    await processShieldedPoolEvents(dbMock, [event]);

    expect(insertedNotes.length).toBe(1);
    const note = insertedNotes[0];
    expect(note.kind).toBe("deposit");
    expect(note.commitment).toBe("0xdef");
    expect(note.amount).toBe(500);
    expect(note.leaf_index).toBe(999);
    expect(note.memo).toBe("0x776f726c64"); // "world" in hex
    expect(note.timestamp).toBe(1715000000000);
  });

  it("handles event type containing module prefix (e.g. ShieldedPoolModule/Note)", async () => {
    const event: EventSchema = {
      number: 3,
      key: "ShieldedPoolModule/Note",
      module: "ShieldedPool",
      txHash: "0xhash3",
      value: {
        type: "ShieldedPoolModule/Note",
        kind: "deposit",
        commitment: "0xdef",
        nullifier: "0x456",
        amount: "500",
        leaf_index: "999",
        memo: "world",
        timestamp: "1715000000000"
      }
    };
    await processShieldedPoolEvents(dbMock, [event]);

    expect(insertedNotes.length).toBe(1);
    const note = insertedNotes[0];
    expect(note.kind).toBe("deposit");
    expect(note.commitment).toBe("0xdef");
    expect(note.amount).toBe(500);
    expect(note.leaf_index).toBe(999);
    expect(note.memo).toBe("0x776f726c64");
    expect(note.timestamp).toBe(1715000000000);
  });
});
