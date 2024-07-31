import { SIGNALLERS, PROTOCOL_ID, type DappIdentity, type WalletIdentity } from "./common";
import { DappClient, newDappClient, type RequestOptions, type DappOptions } from "./dapp";
import { WalletClient, newWalletClient, type WalletCallbacks } from "./wallet";
import type { krMethods, krMethodArgs, krMethodReturn, krGetIdentitiesResponse } from "./protocol";

export {
  // Constants
  SIGNALLERS,
  PROTOCOL_ID,

  // Dapp
  DappClient,
  newDappClient,
  type DappIdentity,
  type DappOptions,
  type RequestOptions,

  // Wallet
  WalletClient,
  newWalletClient,
  type WalletIdentity,
  type WalletCallbacks,

  // Callback/Protocol Types
  type krMethods,
  type krMethodArgs,
  type krMethodReturn,
  type krGetIdentitiesResponse,
};
