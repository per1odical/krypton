//! Derivative of https://github.com/libp2p/rust-libp2p/blob/df59f4f590b5d171e07cd7435f17bc7c1087ee5e/examples/relay-server/src/main.rs

use futures::{executor::block_on, StreamExt};
use libp2p::{
    core::{multiaddr::Protocol, Multiaddr},
    identify, identity, noise, ping, relay,
    swarm::{NetworkBehaviour, SwarmEvent},
    yamux,
};
use serde::Deserialize;
use std::net::{Ipv4Addr, Ipv6Addr};
use std::{borrow::Cow, error::Error};
use tracing_subscriber::EnvFilter;

#[derive(Deserialize)]
struct Opt {
    /// Determine if the relay listen on ipv6 or ipv4 loopback address. the default is ipv4
    use_ipv6: Option<bool>,

    /// Fixed value to generate deterministic peer id, hex encoded.
    secret_key_seed: String,

    /// The port used to listen on all interfaces
    port: u16,
}

impl Opt {
    fn secret_key_seed(&self) -> [u8; 32] {
        let mut seed = [0u8; 32];
        let bytes = hex::decode(&self.secret_key_seed).expect("Invalid hex string.");
        seed.copy_from_slice(&bytes);
        seed
    }
}

#[async_std::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .try_init();

    dotenv::dotenv().ok();
    let opt: Opt = envy::from_env()?;

    // Create a static known PeerId based on given secret
    let local_key: identity::Keypair = generate_ed25519(opt.secret_key_seed());

    println!("Peer ID: {}", local_key.public().to_peer_id().to_base58());

    let mut swarm = libp2p::SwarmBuilder::with_existing_identity(local_key)
        .with_async_std()
        .with_websocket(noise::Config::new, yamux::Config::default)
        .await?
        .with_behaviour(|key| Behaviour {
            relay: relay::Behaviour::new(key.public().to_peer_id(), Default::default()),
            ping: ping::Behaviour::new(ping::Config::new()),
            identify: identify::Behaviour::new(identify::Config::new(
                "/krypton-signaller/0.0.1".to_string(),
                key.public(),
            )),
        })?
        .build();

    let listen_addr_ws = Multiaddr::empty()
        .with(match opt.use_ipv6 {
            Some(true) => Protocol::from(Ipv6Addr::UNSPECIFIED),
            _ => Protocol::from(Ipv4Addr::UNSPECIFIED),
        })
        .with(Protocol::Tcp(opt.port))
        .with(Protocol::Ws(Cow::Borrowed("/")));
    swarm.listen_on(listen_addr_ws)?;

    block_on(async {
        loop {
            match swarm.next().await.expect("Infinite Stream.") {
                SwarmEvent::Behaviour(event) => {
                    if let BehaviourEvent::Identify(identify::Event::Received {
                        info: identify::Info { observed_addr, .. },
                        ..
                    }) = &event
                    {
                        swarm.add_external_address(observed_addr.clone());
                    }

                    println!("{event:?}")
                }
                SwarmEvent::NewListenAddr { address, .. } => {
                    println!("New listen address: {:?}", address);
                }
                _ => {}
            }
        }
    })
}

#[derive(NetworkBehaviour)]
struct Behaviour {
    relay: relay::Behaviour,
    ping: ping::Behaviour,
    identify: identify::Behaviour,
}

fn generate_ed25519(secret_key_seed: [u8; 32]) -> identity::Keypair {
    identity::Keypair::ed25519_from_bytes(secret_key_seed).expect("only errors on wrong length")
}
