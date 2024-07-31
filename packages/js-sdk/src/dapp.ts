import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import { webRTC } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import type { IncomingStreamData } from '@libp2p/interface';
import { WebRTC } from '@multiformats/multiaddr-matcher'
import { createLibp2p, type Libp2p } from 'libp2p'
import type { Multiaddr } from '@multiformats/multiaddr'
import { SIGNALLERS, PROTOCOL_ID, GATER, type DappIdentity, type WalletIdentity } from './common'
import type { krMethodArgs, krMethodReturn, krMethods } from './protocol'
import { pipe } from 'it-pipe'

export type RequestOptions = {
  timeout_ms?: number;
};

export type DappOptions = {
  signaller?: Multiaddr;
  onConnect?: (wallet: WalletIdentity) => void;
};

export const newDappClient = async (identity: DappIdentity, opts?: DappOptions): Promise<DappClient> => {
  const selectedSignaller = opts?.signaller ?? SIGNALLERS[Math.floor(Math.random() * SIGNALLERS.length)];

  const listener = await createLibp2p({
    addresses: {
      listen: ['/webrtc']
    },
    transports: [
      webSockets({ filter: filters.all }),
      webRTC(),
      circuitRelayTransport({
        discoverRelays: 1
      })
    ],
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
    },
    connectionGater: GATER
  })

  await listener.dial(selectedSignaller, {
    signal: AbortSignal.timeout(5_000)
  })

  return new DappClient(identity, selectedSignaller, listener, opts);
}

export class DappClient {
  identity: DappIdentity;
  listener: Libp2p;

  // Internal State
  _connected_wallet?: WalletIdentity;
  _id: number = 2;
  _sender_queue: Uint8Array[];
  _responses: { [key: number]: any } = {};

  // Internal Hooks
  _onConnect: (wallet: WalletIdentity) => void;

  constructor(identity: DappIdentity, signaller: Multiaddr, listener: Libp2p, opts?: DappOptions) {
    this.identity = identity;
    this.listener = listener;

    this._onConnect = opts?.onConnect ?? ((_wallet) => { });

    this._responses = {};
    this._sender_queue = [
      new TextEncoder().encode(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "kr_connected",
        params: [this.identity]
      }))
    ];

    this.listener.handle(PROTOCOL_ID, this._handleProtocol)
  }

  getConnectionMultiaddr(): Multiaddr | undefined {
    return this.listener.getMultiaddrs().find(ma => WebRTC.matches(ma))
  }

  async req<M extends keyof krMethods>(method: M, args: krMethodArgs<M>, options?: RequestOptions): Promise<krMethodReturn<M>>;
  async req(method: string, args: any[], options?: RequestOptions): Promise<any>;

  async req(method: string, args: any[], options?: RequestOptions): Promise<any> {
    const packetId = this._fetchPacketId();

    const jsonrpc = {
      jsonrpc: "2.0",
      id: packetId,
      method,
      params: args
    };
    const uint8 = new TextEncoder().encode(JSON.stringify(jsonrpc));

    this._sender_queue.push(uint8);

    return this._waitForResponse(packetId, options?.timeout_ms ?? 5_000)
  }

  getConnectedWallet(): WalletIdentity | undefined {
    return this._connected_wallet;
  }

  async _handleProtocol({ stream }: IncomingStreamData): Promise<void> {
    const [_reader, _writer] = await Promise.all([
      // Take responses from the wallet and store them in the responses map
      pipe(stream.source, async reader => {
        for await (const message of reader) {
          let msg = "";
          for (const m of message) {
            msg += new TextDecoder().decode(m);
          }

          const jsonrpc = JSON.parse(msg);
          if (Object.keys(jsonrpc).includes("id") && Object.keys(jsonrpc).includes("result")) {
            if (jsonrpc.id == 1) {
              // 1 is the reserved id for the wallet to send back its identity
              this._connected_wallet = jsonrpc.result;
              this._onConnect(this._connected_wallet!);
              // we don't need to keep this saved, since nothing is listening for it.
              continue;
            }

            this._responses[jsonrpc.id] = jsonrpc.result;
          } else {
            console.warn("wallet is sending invalid data. data requires id to be matched to request")
          }
        }
      }),
      // Send requests to the wallet
      stream.sink({
        [Symbol.asyncIterator]: () => ({
          next: async () => {
            const fetchAndEncodeNext = () => {
              return this._sender_queue.shift();
            }

            let data = fetchAndEncodeNext();
            while (data === undefined) {
              await new Promise(resolve => setTimeout(resolve, 50));
              data = fetchAndEncodeNext();
            }

            return { done: false, value: data }
          }
        })
      })
    ]);

    console.warn("Connection to wallet was closed.")
  }

  _fetchPacketId(): number {
    if (this._id < 65_536) {
      this._id = this._id + 1;
      return this._id;
    }

    this._id = 3;
    return this._id;
  }

  _waitForResponse(packetId: number, timeout_ms: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout waiting for response"));
      }, timeout_ms);

      const interval = setInterval(() => {
        if (this._responses[packetId]) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve(this._responses[packetId]);
        }
      }, 10);
    });
  }
}
