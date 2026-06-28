# docs

Architecture notes, protocol specifications, and design records for Nyx.

## Contents

- [**deploy.md**](./deploy.md) — cloud deployment runbook. The live stack is **web → Vercel**,
  **engine + Postgres → Render** (`render.yaml` Blueprint); Railway/Fly are covered as host-agnostic
  alternatives. Topology, env tables, friendbot auto-fund, testnet-reset handling.
- [**demo-script.md**](./demo-script.md) — the **presenter** runbook (4 acts: solo settle,
  two-desk/two-tab manual cross, multi-pair, "how do I know it's real").
- [**test-checklist.md**](./test-checklist.md) — the **tester** QA sweep: walk every screen against the
  live site, with the validation rejects, multi-desk/cross-pair tests, API negative tests, known
  gotchas, and a bug-log template. (demo-script = show it works; test-checklist = try to break it.)
- [**key-custody.md**](./key-custody.md) — desk key custody for the demo (a Stellar keypair signs
  orders; the secret sits in `localStorage`) vs. production (the [Freighter](https://www.freighter.app/)
  wallet extension — the secret never leaves the wallet). Same signature scheme + engine verification
  either way.

**Further intended long-form records:** the protocol spec (order lifecycle, commitment scheme, match
constraint system), the ZK trust model + trusted-setup procedure, and the BN254 / Protocol 26
verification path.

The top-level [`../README.md`](../README.md) holds the project overview and architecture
diagram; [`../STATUS.md`](../STATUS.md) is the live build ledger.
