# docs

Architecture notes, protocol specifications, and design records for Nyx.

## Records

- [**key-custody.md**](./key-custody.md) — desk key custody for the demo (a Stellar keypair signs
  orders; the secret sits in `localStorage`) vs. production (the [Freighter](https://www.freighter.app/)
  wallet extension — the secret never leaves the wallet). Same signature scheme + engine verification
  either way.

**Populated as the system matures.** Further intended contents:

- Protocol spec: order lifecycle, commitment scheme, and the match constraint system.
- The ZK trust model and trusted-setup procedure.
- On-chain settlement flow and the BN254 / Protocol 26 verification path.
- Operational runbooks.

The top-level [`../README.md`](../README.md) holds the project overview and architecture
diagram; [`../STATUS.md`](../STATUS.md) is the live build ledger. Deeper, longer-form
documents live here.
