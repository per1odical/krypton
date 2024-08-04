# Krypton
<img src="/assets/kr_blue.png" width="256px" height="256px" />
P2P solution for accessing mobile wallets from desktop applications.

## Why?
Current solutions have reliance on external services for the full communication flow, don't offer flexibility for transport layer or are not open source. While Krypton does need a signaling server for the initial handshake, the rest of the communication is done directly between the two peers and using Libp2p allows for the transport layer to be easily changed.

## How?
Krypton uses Libp2p's WebRTC transport to establish a direct connection between the two peers. The signaling server is used to exchange the necessary information to establish the connection. The protocol is then defined in [PROTOCOL.md](./PROTOCOL.md) and trys to be as flexible as possible.

### Proposed Changes/Ideas
- We could use [WebRTC Direct](https://github.com/libp2p/js-libp2p/tree/main/packages/transport-webrtc#example---webrtc-direct) to remove the need for a signaling server. However, this limits us to only browsers.

## Want to Help?
There are currently 3 ways to help:
1. Contribute to the codebase & help test!
2. Run a signaling server, and make a PR to add it to the [`common.ts`](./packages/browser-sdk/src/common.ts)
3. Help make the protocol an EIP.

### Known Issues
While testing I ran into some issues or points that need to be addressed, they are documented below to be fixed after the basic idea actually works:
- [ ] No hosted relay/signalling server.
- [ ] Logic to handle connection loss needs to be added.

## Running the Example
1. Clone the repository and have node + yarn installed.
2. Run `yarn` in the root directory.
3. cd into `services/ts-relay`, run `yarn build` and then `yarn start`.
4. cd into `examples/simple-dapp` and run `yarn start`.
5. cd into `examples/simple-wallet` and run `yarn start`.
6. have fun using a P2P connection between the wallet and dapp! 🎉

## Contact
@per1odical on [X](https://x.com/per1odical)

## License
Mozilla Public License 2.0, see [LICENSE](LICENSE) for more details.
