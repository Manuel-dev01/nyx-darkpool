# scripts

Build, setup, and developer-workflow helper scripts.

**Populated across Phases 3–6.** Planned contents:

- `compile_circuit.sh` (Phase 3) — compiles `../circuits/darkpool_match.circom`
  (`--r1cs --wasm --sym`), runs the snarkjs Powers-of-Tau (Phase 1 & 2) trusted setup,
  exports `verification_key.json`, and generates a sample proof.
- Additional helpers for migrations, contract build/deploy, and local orchestration as
  later phases land (the root `Makefile` in Phase 6 wraps the common ones).

Scripts are POSIX `sh`/`bash`. Keep them idempotent and fail-fast (`set -euo pipefail`).
