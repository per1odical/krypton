import { useState, useEffect } from 'react'
import './App.css'
import { DappClient, newDappClient } from '@krypton-js/sdk'
// TODO: Use this when using a custom signaller
// import { multiaddr } from "@multiformats/multiaddr"

function App() {
  const [dapp, setdapp] = useState<DappClient | undefined>()
  const [connected, setConnected] = useState<boolean>(false)
  const [addresses, setAddresses] = useState<string[] | undefined>()
  const [connectionURI, setConnectionURI] = useState<string>("No connector URI");

  useEffect(() => {
    (async () => {
      const d = await newDappClient({
        name: "Simple DApp",
        requestedChains: {
          1: ["kr_identities", "kr_sign"]
        }
      }, {
        // signaller: multiaddr("/ip4/.../tcp/.../ws"),
        onConnect: () => {
          setConnected(true);
        },
      });
      setdapp(d);
    })()
  }, [])

  return (
    <>
      {dapp && !connected ? (
        <div>
          <p>{connectionURI}</p>
          <button onClick={() => setConnectionURI((dapp.getConnectionMultiaddr()?.toString()) ?? "No connector URI")}>Refresh URI</button>
          <button onClick={() => console.debug(dapp)}>Debug</button>
        </div>
      )
        : dapp && connected ? (
          <div>
            <h1>Connected to {dapp.getConnectedWallet()?.name}</h1>
            {(!addresses || addresses.length < 1) && <button onClick={async () => {
              const addresses = await dapp.req("kr_getIdentities", []);
              // Just show mainnet addresses
              setAddresses(addresses[1]);
            }}>Get Addresses</button>}
            {addresses && addresses.map((address, i) => (
              <p key={i}>{address}</p>
            ))}
            {addresses && addresses.length >= 1 && <button onClick={async () => {
              const signature: string = await dapp.req("kr_sign", [addresses[0], "Hello from Krypton!"]);
              alert(`Signature: ${signature}`);
              console.log(`Address: ${addresses[0]}\nMessage: Hello from Krypton!\nSignature: ${signature}`);
            }}>Sign Message</button>}
          </div>
        ) : (<p>Loading...</p>)}
    </>
  )
}

export default App
