import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import { webRTC } from '@libp2p/webrtc'
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import { createLibp2p, type Libp2p } from 'libp2p'
import { multiaddr, type Multiaddr } from '@multiformats/multiaddr'
import { DappIdentity, GATER, PROTOCOL_ID, WalletIdentity } from './common'
import { pipe } from 'it-pipe'

export type krGetIdentitiesResponse = {
  [key: number]: string[];
};

export type WalletCallbacks = {
  'kr_connected'?: (dapp: DappIdentity) => WalletIdentity;
  'kr_getIdentities'?: () => krGetIdentitiesResponse;
  'kr_unkown'?: (...args: any[]) => null;
  [key: string]: ((...args: any[]) => any) | undefined;
};

export const newWalletClient = async (connectionUri: string): Promise<WalletClient> => {
  const dialer = await createLibp2p({
    transports: [
      webSockets({ filter: filters.all }),
      webRTC(),
      circuitRelayTransport()
    ],
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify()
    },
    connectionGater: GATER
  });

  return new WalletClient(multiaddr(connectionUri), dialer);
}

export class WalletClient {
  dialer: Libp2p;
  connectionUri: Multiaddr;

  _sender_queue: Uint8Array[];

  constructor(connectionUri: Multiaddr, dialer: Libp2p) {
    this.connectionUri = connectionUri;
    this.dialer = dialer;
    this._sender_queue = [];
  }

  async connect(callbacks: WalletCallbacks) {
    const safeCallbacks: WalletCallbacks = {
      'kr_unkown': (...args) => {
        console.error('Unknown method called with arguments:', args);
        return null;
      },
      ...(callbacks ?? {})
    };
    try {
      // Dial the protocol and get the stream
      const stream = await this.dialer.dialProtocol(this.connectionUri, PROTOCOL_ID, {
        signal: AbortSignal.timeout(50_000) // Optional timeout for dialing
      });

      await Promise.all([
        // Recieve requests from dapp
        pipe(stream, async reader => {
          for await (const chunk of reader) {
            const decoder = new TextDecoder();
            let receivedMessage = "";
            for (const value of chunk) {
              receivedMessage += decoder.decode(value);
            }

            try {
              const payload = JSON.parse(receivedMessage);
              if (Object.keys(safeCallbacks).includes(payload.method ?? "kr_unknown")) {
                const response = safeCallbacks[payload.method ?? "kr_unknown"];
                const result = await (async () => {
                  try {
                    return await response?.(...payload.params);
                  } catch (e) {
                    console.error('Error while calling method:', payload.method, e);
                    return undefined;
                  }
                })();
                if (result !== undefined) {
                  const encoded = new TextEncoder().encode(JSON.stringify({ jsonrpc: "2.0", result, id: payload.id }));
                  this._sender_queue.push(encoded);
                } else {
                  console.error('Method did not return a valid result:', payload.method);
                  const encoded = new TextEncoder().encode(JSON.stringify({ jsonrpc: "2.0", result: null, id: payload.id }));
                  this._sender_queue.push(encoded);
                }
              }
            } catch (error) {
              console.error('Error:', error);
              console.error('Received invalid JSON:', receivedMessage);
              continue;
            }
          }
        }),
        // Send responses to dapp
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
    } catch (error) {
      console.error('Error while dialing protocol:', error);
    }
  }
}
