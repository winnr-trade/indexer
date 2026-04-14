import { SovereignClient } from "@sovereign-sdk/web3";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Indexer } from "../src/services/indexer";

describe("Indexer", () => {
  beforeEach(() => {
    mock.restore();
  });

  describe("isRollupHealthy", () => {
    it("should be true by default", () => {
      const indexer = new Indexer({ database: { inner: {} } } as any);
      expect((indexer as any).isRollupHealthy).toBe(true);
    });
  });
  
  describe("getNextEventNumber", () => {
    it("should return 0 if there's no events in database", async () => {
      const indexer = new Indexer({
        database: {
          inner: {},
          getLatestEventNumber: mock().mockResolvedValueOnce(null),
        },
      } as any) as any;

      await expect(indexer.getNextEventNumber()).resolves.toBe(0);
    });
    it("should return database latest event number + 1", async () => {
      const indexer = new Indexer({
        database: {
          inner: {},
          getLatestEventNumber: mock().mockResolvedValueOnce(5),
        },
      } as any) as any;

      await expect(indexer.getNextEventNumber()).resolves.toBe(6);
    });
  });
  
  describe("setAndCheckHealth", () => {
    it("should set isRollupHealthy flag to false for connection error", () => {
      const indexer = new Indexer({ database: { inner: {} } } as any) as any;

      indexer.setAndCheckHealth(new SovereignClient.APIConnectionError({}));
      expect(indexer.isRollupHealthy).toBe(false);
    });
    it("should set isRollupHealthy flag to true if not connection error", () => {
      const indexer = new Indexer({ database: { inner: {} } } as any) as any;

      indexer.setAndCheckHealth(new Error());
      expect(indexer.isRollupHealthy).toBe(true);
    });
  });
  
  describe("handleRollupOffline", () => {
    it("should resolve when rollup comes online", async () => {
      const rollup = {
        healthcheck: mock()
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(true),
      };
      const indexer = new Indexer({ rollup: rollup as any, database: { inner: {} }, healthcheckIntervalMs: 1 } as any) as any;
      indexer.isRollupHealthy = false;

      const promise = indexer.handleRollupOffline();

      await Bun.sleep(10); // allow async ticks
      await promise;

      expect(indexer.rollup.healthcheck).toHaveBeenCalledTimes(2);
      expect(indexer.isRollupHealthy).toBe(true);
    });
    
    it("should continue checking until rollup is healthy", async () => {
      const rollup = {
        healthcheck: mock()
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(true),
      };
      const indexer = new Indexer({ rollup: rollup as any, database: { inner: {} }, healthcheckIntervalMs: 1 } as any) as any;
      indexer.isRollupHealthy = false;

      const promise = indexer.handleRollupOffline();

      await Bun.sleep(20);
      await promise;

      expect(indexer.rollup.healthcheck).toHaveBeenCalledTimes(5);
      expect(indexer.isRollupHealthy).toBe(true);
    });
  });
});
