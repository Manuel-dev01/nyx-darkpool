# scripts

Build, setup, and developer-workflow helpers. POSIX `bash`; fail-fast (`set -euo pipefail`);
paths are quoted (the repo root contains a space).

| Script | Phase | Purpose |
|--------|-------|---------|
| `install_circom.sh` | 3 | Download the prebuilt circom binary into `scripts/bin/` (no Rust). |
| `compile_circuit.sh` | 3 | Compile `circuits/darkpool_match.circom`, run the Powers-of-Tau + groth16 trusted setup, export `verification_key.json`, generate + verify a sample proof. |
| `e2e_offchain.sh` | 3 | Off-chain E2E: seed orders → match → witness → Groth16 proof → snarkjs verify (DB-asserted). |
| `proof_to_bytes.js` | 4 | Convert snarkjs decimal field elements → fixed BN254 bytes (G1 64B, G2 128B `c1‖c0`, Fr 32B). Emits `.bin` fixtures for the contract and hex for the Go bridge — the single source of truth for the byte layout. |
| `deploy_contract.sh` | 4 | Bring up a local Soroban network, fund an identity, build the wasm, and deploy → prints the contract id (CID). Testnet fallback. |
| `e2e_onchain.sh` | 4 | Full on-chain E2E: deploy (if needed) + run the Go bridge that invokes the deployed `verify_and_settle`. |

`scripts/bin/` holds downloaded toolchain binaries (`circom.exe`, `stellar.exe`) and is
git-ignored.

> Live on-chain runs require a Soroban network at **protocol ≥ 26** (soroban-sdk 26.1 + the
> BN254 `g1_msm` host function). Start it with
> `stellar container start local --protocol-version 26`.
