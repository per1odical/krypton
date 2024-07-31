import { multiaddr } from "@multiformats/multiaddr"
import type { ConnectionGater } from "@libp2p/interface";

export const PROTOCOL_ID = "/krypton/1.0.0";

export const SIGNALLERS = [
  // multiaddr("Signaller Soon.") // @per1odical
];

export const GATER: ConnectionGater = {
  denyDialMultiaddr: () => false,
  denyDialPeer: () => false,
}

export type DappIdentity = {
  /// The name of the dapp
  name: string;
  /// The URI of the dapp, defaults to `window.location.origin`` if not provided and running in a browser.
  uri?: string;
  /// The logo of the dapp
  image_uri?: string;
  /// The chains the dapp is interested in
  requestedChains: { [key: number]: string[]; }
  /// Chains that are needed for a successful connection
  requiredChains?: number[];
};

export type WalletIdentity = {
  /// The name of the wallet
  name: string;
  /// The logo of the wallet
  image_uri?: string;
  /// The chains & methods that the wallet supports
  supportedChains: { [key: number]: string[] }
};
