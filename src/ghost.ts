import { BigNumber, parseFixed } from "@ethersproject/bignumber";
import { divToNumber, mulDec } from "./bignumber";
import { Denom } from "./denom";
import { LOCALNET, MAINNET, NETWORK, TESTNET } from "./network";
import contracts from "./resources/contracts.json";

export type OracleDenom = { live: string } | { static: BigNumber };

export type Market = {
  address: string;
  owner: string;
  collateralDenom: Denom;
  collateralOracleDenom: string;
  collateralDecimals: number;
  maxLtv: number;
  vault: Vault;
};

export type MarketState = {
  deposited: BigNumber;
  borrowed: BigNumber;
};

export type VaultState = {
  deposited: BigNumber;
  lent: BigNumber;
  available: BigNumber;
  interestRate: number;
  apr: number;
  redemptionRate: BigNumber;
  debtShareRatio: BigNumber;
};

export const castVaultState = (res: {
  deposited: string;
  borrowed: string;
  rate: string;
  apr: number;
  deposit_redemption_ratio: string;
  debt_share_ratio: string;
}): VaultState => {
  const deposited = BigNumber.from(res.deposited);
  const lent = BigNumber.from(res.borrowed);
  const interestRate = parseFloat(res.rate);

  return {
    deposited,
    lent,
    available: deposited.sub(lent),
    interestRate,
    apr: divToNumber(mulDec(lent, interestRate), deposited),
    redemptionRate: parseFixed(res.deposit_redemption_ratio, 18),
    debtShareRatio: parseFixed(res.debt_share_ratio, 18),
  };
};

export const DEFAULT_MARKET_STATE: MarketState = {
  deposited: BigNumber.from(0),
  borrowed: BigNumber.from(0),
};

export const DEFAULT_VAULT_STATE: VaultState = {
  deposited: BigNumber.from(0),
  lent: BigNumber.from(0),
  available: BigNumber.from(0),
  interestRate: 0,
  apr: 0,
  redemptionRate: parseFixed("1", 18),
  debtShareRatio: parseFixed("1", 18),
};

export type Position = {
  collateralAmount: BigNumber;
  debtShares: BigNumber;
};

export const castPosition = (res: {
  debt_shares: number;
  collateral_amount: number;
}): Position => ({
  debtShares: BigNumber.from(res.debt_shares),
  collateralAmount: BigNumber.from(res.collateral_amount),
});

export type Vault = {
  address: string;
  owner: string;
  denom: Denom;
  oracle: OracleDenom;
  decimals: number;
  receiptDenom: Denom;
  debtTokenDenom: Denom;
  markets: {
    addr: string;
    borrowLimit: null | BigNumber;
    // currentBorrows: BigNumber;
  }[];
};

export const castMarket = (
  address: string,
  raw: {
    owner: string;
    collateral_denom: string;
    collateral_oracle_denom: string;
    collateral_decimals: number;
    max_ltv: string;
    vault_addr: string;
  },
  vault: Vault
): Market => ({
  address,
  owner: raw.owner,
  collateralDenom: Denom.from(raw.collateral_denom),
  collateralOracleDenom: raw.collateral_oracle_denom,
  collateralDecimals: raw.collateral_decimals,
  maxLtv: parseFloat(raw.max_ltv),
  vault,
});

export const castVault = (
  address: string,
  raw: {
    owner: string;
    denom: string;
    oracle: { live: string } | { static: string };
    decimals: number;
    receipt_denom: string;
    debt_token_denom: string;
  },
  markets: {
    addr: string;
    borrow_limit: null | string;
    current_borrows: string;
  }[]
): Vault => ({
  address,
  owner: raw.owner,
  denom: Denom.from(raw.denom),
  oracle:
    "static" in raw.oracle
      ? { static: parseFixed(raw.oracle.static, 18) }
      : raw.oracle,
  decimals: raw.decimals,
  receiptDenom: Denom.from(raw.receipt_denom),
  debtTokenDenom: Denom.from(raw.debt_token_denom),
  markets: markets.map((m) => ({
    addr: m.addr,
    borrowLimit: m.borrow_limit ? BigNumber.from(m.borrow_limit) : null,
  })),
});

export const VAULTS: Record<NETWORK, Record<string, Vault>> = {
  [MAINNET]: {},
  [TESTNET]: contracts[TESTNET].ghostVault.reduce(
    (a, v) =>
      v.markets
        ? {
            ...a,
            [v.address]: castVault(v.address, v.config, v.markets),
          }
        : {
            ...a,
            [v.address]: castVault(v.address, v.config, []),
          },
    {}
  ),
  [LOCALNET]: {},
};

export const MARKETS: Record<NETWORK, Record<string, Market>> = {
  [MAINNET]: {},
  [TESTNET]: contracts[TESTNET].ghostMarket.reduce(
    (a, v) =>
      VAULTS[TESTNET][v.config.vault_addr]
        ? {
            ...a,
            [v.address]: castMarket(
              v.address,
              v.config,
              VAULTS[TESTNET][v.config.vault_addr]
            ),
          }
        : a,
    {}
  ),
  [LOCALNET]: {},
};