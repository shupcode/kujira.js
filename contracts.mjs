import { HttpBatchClient, Tendermint34Client } from "@cosmjs/tendermint-rpc";
import fs from "fs";
import { kujiraQueryClient, MAINNET, RPCS, TESTNET } from "./lib/cjs/index.js";

const IDS = {
  [MAINNET]: {
    fin: [63, 56],
    bow: [36, 54],
    bowStaking: [61, 88],
    orca: [59],
    uskMarket: [73],
    uskMarginSwap: [72, 74],
    uskMarginLimit: [],
    calc: [82],
  },
  [TESTNET]: {
    fin: [31, 129],
    bow: [468, 858],
    bowStaking: [439, 855],
    orca: [994],
    uskMarket: [66],
    uskMarginSwap: [131],
    uskMarginLimit: [1271],
  },
};

const res = await Promise.all(
  Object.entries(IDS).map(async ([chain, protocols]) => {
    const rpc = RPCS[chain][0];
    const tm = await Tendermint34Client.create(
      new HttpBatchClient(rpc, {
        dispatchInterval: 100,
        batchSizeLimit: 200,
      })
    );
    const client = kujiraQueryClient({ client: tm });
    return {
      chain,
      protocols: await Promise.all(
        Object.entries(protocols).map(async ([protocol, ids]) => {
          return {
            protocol,
            ids: await Promise.all(
              ids.map(async (id) => ({
                id,
                contracts: await client.wasm
                  .listContractsByCodeId(id)
                  .then((x) =>
                    Promise.all(
                      x.contracts.map(async (address) => ({
                        address,
                        config: await client.wasm
                          .queryContractSmart(address, {
                            config: {},
                          })
                          .catch(() => null),
                        pairs:
                          protocol === "calc" &&
                          (await client.wasm.queryContractSmart(address, {
                            get_pairs: {},
                          })),
                      }))
                    )
                  ),
              }))
            ),
          };
        })
      ),
    };
  })
);

const flattened = res.reduce(
  (a, m) => ({
    ...a,
    [m.chain]: m.protocols.reduce(
      (b, n) => ({
        ...b,
        [n.protocol]: n.ids.flatMap((id) =>
          id.contracts.map((contract) => ({
            id: id.id,
            ...contract,
          }))
        ),
      }),
      {}
    ),
  }),
  {}
);

fs.writeFileSync(
  "./src/resources/contracts.json",
  JSON.stringify(flattened, null, 2)
);