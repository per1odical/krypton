import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import { identify } from '@libp2p/identify'
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import { createLibp2p } from 'libp2p'

(async () => {
  const relay = await createLibp2p({
    addresses: {
      listen: ['/ip4/0.0.0.0/tcp/3000/ws']
    },
    transports: [
      webSockets({ filter: filters.all })
    ],
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      relay: circuitRelayServer()
    }
  })

  relay.getMultiaddrs().forEach((ma) => {
    console.log(`Listening on ${ma.toString()}`);
  })
})()
