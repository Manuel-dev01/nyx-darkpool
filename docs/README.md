# docs

Architecture notes, deployment, and design records for Nyx.

## Contents

- [**deploy.md**](./deploy.md) — cloud deployment runbook. The live stack is **web → Vercel**,
  **engine + Postgres → Render** (`render.yaml` Blueprint); Railway/Fly are covered as host-agnostic
  alternatives. Topology, env tables, friendbot auto-fund, and testnet-reset handling.
- [**key-custody.md**](./key-custody.md) — desk key custody: a Stellar keypair signs every order; the
  secret sits in `localStorage` for the demo vs. the [Freighter](https://www.freighter.app/) wallet in
  production (the secret never leaves the wallet). Same signature scheme + engine verification either way.

The top-level [`../README.md`](../README.md) holds the project overview, the architecture diagram, and
the live deployment + on-chain (testnet) evidence.

> **Planned long-form records:** the protocol spec (order lifecycle, commitment scheme, match
> constraint system), the ZK trust model + trusted-setup procedure, and the BN254 / Protocol 26
> verification path.
