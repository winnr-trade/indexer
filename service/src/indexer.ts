import { type Rollup, SovereignClient } from "@sovereign-sdk/web3";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { type Database, type EventSchema } from "@winnr-trade/common";
import { logger } from './logger';
import { EventProcessor } from "./processor";

export type IndexerOpts = {
  database: Database<unknown>;
  // biome-ignore lint/suspicious/noExplicitAny: types arent used
  rollup: Rollup<any, any>;
  pollIntervalMs?: number;
  healthcheckIntervalMs?: number;
  pollPageSize?: number;
};

export class Indexer {
  private readonly database: Database<unknown>;
  // biome-ignore lint/suspicious/noExplicitAny: types arent used
  private readonly rollup: Rollup<any, any>;
  private readonly pollIntervalMs: number;
  private readonly pollPageSize: number;
  private readonly healthcheckIntervalMs: number;
  private indexingHandle?: ReturnType<typeof setTimeout>;
  private healthcheckHandle?: ReturnType<typeof setTimeout>;
  private isRollupHealthy = true;
  private eventProcessor: EventProcessor;

  constructor(opts: IndexerOpts) {
    this.pollIntervalMs = opts.pollIntervalMs ?? 500;
    this.pollPageSize = opts.pollPageSize ?? 75;
    this.healthcheckIntervalMs = opts.healthcheckIntervalMs ?? 5000;
    this.database = opts.database;
    this.rollup = opts.rollup;
    this.eventProcessor = new EventProcessor(opts.database.inner as NodePgDatabase);
  }

  async run(): Promise<void> {
    logger.info("Indexer started");

    this.isRollupHealthy = await this.rollup.healthcheck();

    if (!this.isRollupHealthy) {
      logger.info("Rollup offline on initial healthcheck");
      await this.handleRollupOffline();
    }

    logger.info("Rollup is healthy, indexing beginning");
    this.doIndexing();
  }

  async stop(): Promise<void> {
    logger.info("Indexer is shutting down");

    logger.info("Clearing background tasks");
    clearTimeout(this.indexingHandle);
    clearTimeout(this.healthcheckHandle);

    logger.info("Disconnecting from database");
    await this.database.disconnect();

    logger.info("Shutdown complete");
  }

  private onError(err: Error): void {
    logger.error("An error occurred", err);
  }

  private async doIndexing(): Promise<void> {
    if (!this.isRollupHealthy) {
      // blocks until rollup is back online
      await this.handleRollupOffline();
    }

    const eventOffset = await this.getNextEventNumber();
    const events = await this.fetchEvents(eventOffset);

    logger.info(`Polling rollup: offset=${eventOffset}, fetched=${events.length} events`);
    await this.eventProcessor.process(events).catch((e) => this.onError(e));

    this.indexingHandle = setTimeout(
      () => this.doIndexing(),
      this.pollIntervalMs,
    );
  }

  private async getNextEventNumber(): Promise<number> {
    const currentEventNum = (await this.database.getLatestEventNumber()) ?? -1;
    return currentEventNum + 1;
  }

  private async fetchEvents(currentEventNum: number): Promise<EventSchema[]> {
    try {
      const response = await this.rollup.sequencer.events.list({
        page: "next",
        "page[cursor]": String(currentEventNum),
        "page[size]": this.pollPageSize,
      });

      return response.items.map((event) => ({
        number: event.number,
        key: event.key,
        value: event.value,
        module: event.module.name,
        txHash: event.tx_hash,
      })) as EventSchema[];
    } catch (err) {
      this.setAndCheckHealth(err);
      return [];
    }
  }

  private handleRollupOffline(): Promise<void> {
    logger.info(
      "Rollup appears to be offline, entering monitoring mode until it's healthy",
    );

    return new Promise((resolve, reject) => {
      const doHealthcheck = async () => {
        try {
          this.isRollupHealthy = await this.rollup.healthcheck();

          if (this.isRollupHealthy) {
            logger.info("Rollup is back online, resuming indexing");

            return resolve();
          }
          this.healthcheckHandle = setTimeout(
            doHealthcheck,
            this.healthcheckIntervalMs,
          );
        } catch (err) {
          console.error("Error occurred during health check", err);
          return reject(err);
        }
      };

      doHealthcheck();
    });
  }

  private setAndCheckHealth(e: unknown): boolean {
    this.isRollupHealthy = !(e instanceof SovereignClient.APIConnectionError);
    return this.isRollupHealthy;
  }
}
