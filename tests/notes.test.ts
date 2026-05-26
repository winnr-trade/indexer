import { describe, expect, it, mock, beforeEach } from "bun:test";
import { processNoteEvents } from "../service/src/processor/notes";
import { EventSchema } from "@winnr-trade/common";

describe("processNoteEvents", () => {
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
    key: "Note",
    module: "Note",
    txHash: "0xhash",
    timestamp: 1715000000000,
    value: {
      Note: {
        kind,
        commitment,
        nullifier,
        amount: amount.toString(),
        leaf_index: leaf_index.toString(),
        memo
      }
    }
  });

  it("successfully indexes a CreateAccount note with array memo", async () => {
    const event = createEvent("CreateAccount", [1, 2, 3]);
    await processNoteEvents(dbMock, [event]);

    expect(insertedNotes.length).toBe(1);
    const note = insertedNotes[0];
    expect(note.kind).toBe("create_account");
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
    const event = createEvent("Deposit", "0x0a0b0c", "0xabc", "0x123", 100, 100);
    await processNoteEvents(dbMock, [event]);

    expect(insertedNotes.length).toBe(1);
    const note = insertedNotes[0];
    expect(note.kind).toBe("deposit");
    expect(note.leaf_index).toBe(100);
    expect(note.memo).toBe("0x0a0b0c");
  });

  it("successfully indexes a Withdraw note with string memo", async () => {
    const event = createEvent("Withdraw", "hello", "0xabc", "0x123", 100, 0);
    await processNoteEvents(dbMock, [event]);

    expect(insertedNotes.length).toBe(1);
    const note = insertedNotes[0];
    expect(note.kind).toBe("withdraw");
    expect(note.leaf_index).toBe(0);
    expect(note.memo).toBe("0x68656c6c6f"); // "hello" in hex
  });

  it("handles object-based NoteKind if nested in enum representation", async () => {
    const event = createEvent({ CreateAccount: {} }, [42]);
    await processNoteEvents(dbMock, [event]);

    expect(insertedNotes.length).toBe(1);
    const note = insertedNotes[0];
    expect(note.kind).toBe("create_account");
    expect(note.leaf_index).toBe(42);
  });

  it("handles flat payload structures (no nested 'Note' wrapper)", async () => {
    const event: EventSchema = {
      number: 2,
      key: "Note",
      module: "Note",
      txHash: "0xhash2",
      timestamp: 1716000000000,
      value: {
        kind: "Deposit",
        commitment: "0xdef",
        nullifier: "0x456",
        amount: "500",
        leaf_index: "999",
        memo: "world"
      }
    };
    await processNoteEvents(dbMock, [event]);

    expect(insertedNotes.length).toBe(1);
    const note = insertedNotes[0];
    expect(note.kind).toBe("deposit");
    expect(note.commitment).toBe("0xdef");
    expect(note.amount).toBe(500);
    expect(note.leaf_index).toBe(999);
    expect(note.memo).toBe("0x776f726c64"); // "world" in hex
  });
});
