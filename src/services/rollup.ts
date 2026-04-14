import { Rollup, SovereignClient } from "@sovereign-sdk/web3";
import { rollupApi } from "../config/env";

export const rollup = new Rollup(
  {
    client: new SovereignClient.SovereignSDK({ baseURL: rollupApi }),
    // biome-ignore lint/suspicious/noExplicitAny: types arent used
    serializer: {} as any,
    context: {},
  },
  // biome-ignore lint/suspicious/noExplicitAny: types arent used
  {} as any,
);

