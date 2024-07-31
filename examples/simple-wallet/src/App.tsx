import { useState } from 'react'
import './App.css'
import { DappIdentity, newWalletClient } from '@krypton-js/sdk';
import { Wallet } from 'ethers';

const wallet = Wallet.createRandom();

function App() {
  const [connectonURI, setConnectionURI] = useState('');
  const [dapp, setDapp] = useState<DappIdentity | null>(null);

  return (
    <>
      {dapp && (
        <div>
          <h1>Connected to Dapp</h1>
          <pre>{JSON.stringify(dapp, null, 2)}</pre>
        </div>
      )}
      <input onChange={(v) => setConnectionURI(v.target.value)} />
      <button onClick={async () => {
        const w = await newWalletClient(connectonURI);
        await w.connect({
          "kr_connected": (dapp: DappIdentity) => {
            setDapp(dapp);
            const methods = ["kr_getIdentities", "kr_sign"];
            const supportedChains: { [key: number]: string[] } = {};
            Object.keys(dapp.requestedChains).forEach((chainId) => {
              supportedChains[chainId as unknown as number] = methods;
            });

            return {
              name: "Sample Wallet",
              supportedChains
            }
          },
          "kr_getIdentities": () => {
            return {
              1: [wallet.address]
            };
          },
          "kr_sign": async (_addr, message) => {
            // Note: Address should be taken into account here in prod.

            // cast message to Uint8Array
            let uint8Msg;
            if (typeof message === 'string') {
              uint8Msg = new TextEncoder().encode(message);
            } else if (message instanceof Uint8Array) {
              uint8Msg = message;
            } else {
              throw new Error('Invalid message type');
            }

            const signature = await wallet.signMessage(uint8Msg);

            return signature;
          }
        });
      }}>Connect</button>
    </>
  )
}

export default App
