# contracts

On-chain settlement layer for Nyx — a **Soroban** smart contract (Rust, `#![no_std]`) that
re-verifies the off-chain Groth16/BN254 match proof natively and records settlement.

## `nyx-verifier/`

Built in Phase 4. Exposes:

- `verify_and_settle(submitter, proof_a: BytesN<64>, proof_b: BytesN<128>, proof_c: BytesN<64>,
  public_inputs: Vec<BytesN<32>>) -> Result<(), Error>` — BN254 Groth16 verification using
  soroban-sdk 26.1 host functions (`g1_msm`, `g1_add`, `pairing_check`); `submitter.require_auth`
  gates the settlement write; anti-replay keyed by `(maker_hash, taker_hash)`; emits `Settled`.
- `is_settled(maker_hash, taker_hash) -> bool`.
- `settle_transfer(maker_hash, taker_hash, sac, from, to, amount)` — SAC token-transfer seam,
  guarded by a prior verification (revealed amounts; full confidential swap deferred).

The verifying key is embedded from `../circuits/verification_key.json` (via
`scripts/proof_to_bytes.js` → `test_vectors/vk_*.bin`). If the circuit is recompiled, re-run the
script and rebuild/redeploy.

### Build / test / deploy

```bash
export PATH="$HOME/.cargo/bin:/c/mingw64/bin:$PATH"     # see STATUS.md toolchain note

cd contracts/nyx-verifier
cargo test                       # 6/6 incl. the REAL proof verifying on-chain (testutils)
stellar contract build           # -> target/wasm32v1-none/release/nyx_verifier.wasm (6.4 KB)

# Live deploy (network MUST be protocol >= 26 for soroban-sdk 26.1 + g1_msm):
stellar container start local --protocol-version 26
bash ../../scripts/deploy_contract.sh        # prints the contract id (CID)
```

The off-chain engine reaches this contract through `engine/internal/onchain` (env-gated by
`NYX_SOROBAN_CONTRACT_ID`); `scripts/e2e_onchain.sh` runs the full Postgres→proof→on-chain flow.

Toolchain: Rust stable (`wasm32v1-none` target), `stellar` CLI, soroban-sdk 26.1.
