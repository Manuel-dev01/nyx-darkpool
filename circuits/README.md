# circuits

Zero-knowledge circuits for Nyx, written in **Circom 2.0** and proven with **snarkjs**
(Groth16 over BN254).

**Populated in Phase 3.** Planned contents:

- `darkpool_match.circom` — proves a maker and taker order legitimately intersect
  (`maker_price <= taker_price`, matching volume) and that the Poseidon commitments
  equal the public `maker_hash` / `taker_hash`, **without revealing** price or volume.
- `verification_key.json` — exported Groth16 verifying key (consumed by the Soroban
  verifier in `../contracts`).
- A WASM witness generator + a sample `proof.json` / `public.json`.

Build is driven by [`../scripts/compile_circuit.sh`](../scripts) (Powers-of-Tau setup,
circuit compile, key export). Large trusted-setup artifacts (`*.ptau`, `*.zkey`) and
generated `build/` output are git-ignored; verification keys and sample proofs are kept.

Toolchain (install before Phase 3): `circom` 2.x, Node.js + `snarkjs`, `circomlib`.
