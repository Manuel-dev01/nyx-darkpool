# circuits

Zero-knowledge circuits for Nyx, written in **Circom 2.x** and proven with **snarkjs**
(Groth16 over BN254).

## Contents

- `darkpool_match.circom` — proves a maker and taker order legitimately cross
  (`maker_price <= taker_price`, equal volume) and that the Poseidon commitments equal the
  public `maker_hash` / `taker_hash`, **without revealing** price or volume.
- `scripts/gen_input.js` — computes the sample order pair's Poseidon commitments off-chain
  (via `circomlibjs`) so the witness input is satisfiable. Modes: `valid`, `bad-cross`,
  `bad-volume`. Emits decimal-string field values (snarkjs-native; byte-identical to the
  Postgres `orders.order_commitment`).
- `verification_key.json` — exported Groth16 verifying key (consumed by the Soroban
  verifier in `../contracts`).
- `proof.json` / `public.json` — a sample proof and its public inputs.

## Circuit I/O

| Signal | Visibility | Meaning |
|--------|-----------|---------|
| `maker_hash`, `taker_hash` | **public** | `Poseidon(price, volume, salt)` per order — the on-book commitment |
| `maker_price`, `taker_price` | private | scaled-integer prices (≤ 64 bits) |
| `maker_volume`, `taker_volume` | private | scaled-integer volumes (≤ 64 bits) |
| `maker_salt`, `taker_salt` | private | commitment blinding factors |

Constraints: range-check (`Num2Bits(64)`) on all four price/volume operands (anti
comparator-wraparound), `LessEqThan(64)` asserting the cross, volume equality, and Poseidon
commitment binding. ~820–900 R1CS constraints.

## Build

Driven by [`../scripts/compile_circuit.sh`](../scripts/compile_circuit.sh): circom compile
(`--r1cs --wasm --sym`) → Powers-of-Tau (2^12) → groth16 setup → export `verification_key.json`
→ sample witness/proof → `groth16 verify`. Large trusted-setup artifacts (`*.ptau`, `*.zkey`)
and everything under `build/` are git-ignored; `verification_key.json`, `proof.json`,
`public.json`, and `input.json` are committed.

Toolchain: `circom` 2.x (installed via [`../scripts/install_circom.sh`](../scripts/install_circom.sh)
as a prebuilt binary — no Rust needed), Node.js, and the pinned deps in `package.json`
(`circomlib`, `circomlibjs`, `snarkjs`). `circomlib`/`circomlibjs` are pinned so the in-circuit
Poseidon and the off-chain Poseidon use identical constants.

## Future extension — `DarkpoolMatchV2` (nullifiers)

The current circuit keeps double-match prevention at the database layer
(`orders.nullifier UNIQUE`, `matches` UNIQUE(maker)/UNIQUE(taker)) and exposes only the two
commitments as public signals. A future `DarkpoolMatchV2` may add a public **nullifier output**
per order (e.g. `maker_nullifier <== Poseidon(maker_salt, order_id)`) so the on-chain Soroban
verifier (Phase 4) can enforce no-double-settle directly from the proof. Adding public signals
changes `verification_key.json` and the on-chain calldata layout, so Phase 4 calldata design
should anticipate this v2 seam.
