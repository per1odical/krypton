import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import { webRTC } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import { WebRTC } from '@multiformats/multiaddr-matcher'
import { createLibp2p, type Libp2p } from 'libp2p'
import type { Multiaddr } from '@multiformats/multiaddr'
import { SIGNALLERS, PROTOCOL_ID, GATER, type DappIdentity, type WalletIdentity } from './common'
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
  signaller_uri: Multiaddr;
  id: number;
  connected_wallet?: WalletIdentity;

  req: (method: string, args: any[], options?: RequestOptions) => Promise<any>;

  _sender_queue: Uint8Array[];
  _responses: { [key: number]: any };

  _onConnect: (wallet: WalletIdentity) => void;

  constructor(identity: DappIdentity, signaller: Multiaddr, listener: Libp2p, opts?: DappOptions) {
    this.identity = identity;
    this.signaller_uri = signaller;
    this.listener = listener;

    this._onConnect = opts?.onConnect ?? ((_wallet) => { });

    this.id = 2; // first id will be 3, since 1 & 2 are reserved.
    this.req = async (method, args, options) => {
      throw new Error("Connection has not been established yet.")
    }
    this._responses = {};
    this._sender_queue = [
      new TextEncoder().encode(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "kr_connected",
        params: [this.identity]
      }))
    ];
  }

  connectorUri(): Multiaddr | undefined {
    return this.listener.getMultiaddrs().find(ma => WebRTC.matches(ma))
  }

  peer(): WalletIdentity | undefined {
    return this.connected_wallet;
  }

  _fetchPacketId(): number {
    if (this.id < 65_536) {
      this.id = this.id + 1;
      return this.id;
    }

    this.id = 3;
    return this.id;
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

  /// Start listening for an incoming connection using the Krypton protocol, pass in callbacks to handle events.
  async listen() {
    this.listener.handle(PROTOCOL_ID, async ({ stream }) => {
      try {
        this.req = async (method, args, options) => {
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

        await Promise.all([
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
                  this.connected_wallet = jsonrpc.result;
                  this._onConnect(this.connected_wallet!);
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
        ])

        console.log("all promises exited!!!!!!")
      } catch (err) {
        console.error('Stream handling error:', err);
      }
    })
  }
}
