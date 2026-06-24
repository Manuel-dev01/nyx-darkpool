#!/usr/bin/env bash
# ============================================================================
# e2e_onchain.sh — full on-chain end-to-end (Phase 4)
# ----------------------------------------------------------------------------
# Extends the off-chain pipeline (scripts/e2e_offchain.sh) with the deployed
# Soroban verifier: deploys the contract (if NYX_SOROBAN_CONTRACT_ID is unset),
# then runs the Go E2E which seeds a match, generates a proof, and invokes the
# on-chain verify_and_settle — recording onchain_status / settlement_tx.
#
# Prereqs: NYX_TEST_DB_URL (Postgres), Node + circuits built, Docker (for the
# local Soroban network), and the toolchain on PATH.
#
# Usage:
#   NYX_TEST_DB_URL="postgres://nyx:nyx@localhost:5433/nyx?sslmode=disable" \
#     bash scripts/e2e_onchain.sh
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export NYX_STELLAR_BIN="${NYX_STELLAR_BIN:-$ROOT/scripts/bin/stellar.exe}"
export NYX_SOROBAN_NETWORK="${NYX_SOROBAN_NETWORK:-local}"
export NYX_SOROBAN_SOURCE="${NYX_SOROBAN_SOURCE:-nyx-engine}"

if [ -z "${NYX_TEST_DB_URL:-}" ]; then
    echo "e2e_onchain: NYX_TEST_DB_URL is required" >&2
    exit 2
fi

# 1. Ensure a deployed contract id. Deploy if not provided.
if [ -z "${NYX_SOROBAN_CONTRACT_ID:-}" ]; then
    echo ">> deploying nyx-verifier (no NYX_SOROBAN_CONTRACT_ID set)…" >&2
    NYX_SOROBAN_CONTRACT_ID="$(bash "$ROOT/scripts/deploy_contract.sh")"
    export NYX_SOROBAN_CONTRACT_ID
fi
echo ">> using contract id: $NYX_SOROBAN_CONTRACT_ID" >&2

# 2. Run the Go E2E (the on-chain block activates because the CID is set).
echo ">> running on-chain e2e integration test" >&2
( cd "$ROOT/engine" && go test -tags=integration -v -run TestOffchainProofPipeline ./internal/e2e/... )

echo ""
echo "OK: on-chain end-to-end pipeline passed (verify_and_settle confirmed)."
