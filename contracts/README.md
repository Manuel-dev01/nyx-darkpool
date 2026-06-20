# contracts

On-chain settlement layer for Nyx — a **Soroban** smart contract (Rust, `#![no_std]`) that
acts as a pure **Groth16 verifier** and asset-settlement layer on Stellar.

**Populated in Phase 4.** Planned contents:

- `nyx-verifier/` — Soroban contract crate exposing:
  `verify_and_settle(env, proof_a, proof_b, proof_c, public_inputs) -> Result<(), Error>`.
- Verification uses Stellar **Protocol 26 BN254 host functions** (pairing check,
  multi-scalar multiplication, scalar-field arithmetic) against the verifying key
  exported from [`../circuits`](../circuits).
- On a valid proof the contract executes the token swap; invalid proofs are rejected
  gracefully. Strict `require_auth` on all state-changing entry points.
- Rust unit tests covering valid and invalid proof payloads.

Toolchain (install before Phase 4): Rust stable + `wasm32-unknown-unknown` target,
`stellar` CLI.
