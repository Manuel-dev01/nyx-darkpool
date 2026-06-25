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
# -- local (ephemeral Docker quickstart):
stellar container start local --protocol-version 26
bash ../../scripts/deploy_contract.sh        # prints the contract id (CID)
# -- public testnet (friendbot-funded, browsable on stellar.expert; no key/funds needed):
NYX_SOROBAN_NETWORK=testnet bash ../../scripts/deploy_contract.sh
```

The off-chain engine reaches this contract through `engine/internal/onchain` (env-gated by
`NYX_SOROBAN_CONTRACT_ID`, `_NETWORK`, `_SOURCE`); `scripts/e2e_onchain.sh` runs the full
Postgres→proof→on-chain flow.

### Live public-testnet deployment (Phase 5.1, protocol 27)

- **Contract id:** `CBAFC6W5IWQC5AB6LFMFI4KB4DZT23BU2O2AJ2H3B2727DO37DOJGJRV`
- **Deployer / submitter:** `GAW2WLHI5YHCE7FMB4TB7MLE2RIKQGOTPMC2NV66KKFTX6LGYMNT3YRK` (friendbot-funded)
- **A real `verify_and_settle` tx:** `b78e514e0f2b4078218ab12627a5d260f9895943ef64b60e5040b55df1d4a10e` (SUCCESS)
- Explorer: <https://stellar.expert/explorer/testnet/contract/CBAFC6W5IWQC5AB6LFMFI4KB4DZT23BU2O2AJ2H3B2727DO37DOJGJRV>
  · tx <https://stellar.expert/explorer/testnet/tx/b78e514e0f2b4078218ab12627a5d260f9895943ef64b60e5040b55df1d4a10e>

Toolchain: Rust stable (`wasm32v1-none` target), `stellar` CLI, soroban-sdk 26.1.
