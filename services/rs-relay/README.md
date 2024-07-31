# Signaller

> [!NOTE]
> You **do not** need to use this code. Please feel free to use any solution that is compatible with the [`circuit-relay-v2`](https://docs.libp2p.io/concepts/nat/circuit-relay/) specification from libp2p.

## Setup

1. Generate random `SECRET_KEY_SEED`: `openssl rand 32 | xxd -ps -u -c 32`
2. Set required environment variables: `SECRET_KEY_SEED`, `PORT`, `USE_IPV6`
3. Run with `cargo run --release` or `krypton/signaller:latest`
