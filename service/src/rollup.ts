import { Rollup, SovereignClient } from "@sovereign-sdk/web3";
import { env } from "./configs/env";

export const rollup = new Rollup(
  {
    client: new SovereignClient.SovereignSDK({ baseURL: env.rollupApiUrl }),
    // biome-ignore lint/suspicious/noExplicitAny: types arent used
    serializer: {} as any,
    context: {},
  },
  // biome-ignore lint/suspicious/noExplicitAny: types arent used
  {} as any,
);

