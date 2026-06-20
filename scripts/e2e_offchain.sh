#!/usr/bin/env bash
# ============================================================================
# e2e_offchain.sh — off-chain end-to-end proof pipeline
# ----------------------------------------------------------------------------
# Orchestrates the full off-chain flow across every prior phase:
#   1. ensure the circuit is compiled (scripts/compile_circuit.sh)
#   2. run the Go E2E integration test, which:
#        - applies migrations 000001 + 000002 to NYX_TEST_DB_URL
#        - seeds a maker/taker order pair with Poseidon order_commitments
#        - pairs them inline under a SERIALIZABLE transaction (Phase-5 stand-in)
#        - generates a Groth16 witness + proof (snarkjs) from the matched pair
#        - stores proof_blob and runs groth16 verify (off-chain gate)
#        - asserts DB state + rejects a duplicate match + rejects a bad cross
#
# The on-chain Soroban verify is deferred to Phase 4 — see the PHASE-4 HOOK
# marker in engine/internal/e2e/e2e_integration_test.go.
#
# Prereqs:
#   - NYX_TEST_DB_URL pointing at a reachable Postgres (e.g. a Docker container)
#   - circuits/node_modules installed (npm install) and circom downloaded
#
# Usage:
#   NYX_TEST_DB_URL="postgres://nyx:nyx@localhost:5433/nyx?sslmode=disable" \
#     bash scripts/e2e_offchain.sh
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CIR="$ROOT/circuits"

if [ -z "${NYX_TEST_DB_URL:-}" ]; then
    echo "e2e_offchain: NYX_TEST_DB_URL is required (point it at a running Postgres)" >&2
    exit 2
fi

# 1. Ensure the circuit is built (idempotent; reuses ptau).
if [ ! -f "$CIR/build/darkpool_match_final.zkey" ]; then
    echo ">> circuit not built — running compile_circuit.sh"
    bash "$ROOT/scripts/compile_circuit.sh"
else
    echo ">> circuit artifacts present — skipping compile"
fi

# 2. Run the Go E2E integration test (verbose so assertions are visible).
echo ">> running off-chain e2e integration test"
( cd "$ROOT/engine" && go test -tags=integration -v ./internal/e2e/... )

echo ""
echo "OK: off-chain end-to-end pipeline passed."
echo "    # PHASE-4 HOOK: wire Soroban verify_and_settle at the verify step."
