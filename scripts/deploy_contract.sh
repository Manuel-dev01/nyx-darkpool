#!/usr/bin/env bash
# ============================================================================
# deploy_contract.sh — build + deploy the Nyx verifier to a Soroban network
# ----------------------------------------------------------------------------
# Brings up a local Soroban network (Docker quickstart), provisions a funded
# identity, builds the contract wasm, deploys it, and prints the contract id
# (CID). Export that CID as NYX_SOROBAN_CONTRACT_ID to enable the on-chain leg
# of the engine's E2E.
#
# Networks:
#   local  (default)  -> `stellar container start local` (Docker quickstart)
#   testnet           -> public testnet; identity funded via friendbot
#
# Env:
#   NYX_SOROBAN_NETWORK   local | testnet         (default local)
#   NYX_SOROBAN_SOURCE    identity name           (default nyx-engine)
#   NYX_STELLAR_BIN       path to stellar binary  (default scripts/bin/stellar.exe)
#
# Usage:
#   bash scripts/deploy_contract.sh
#   NYX_SOROBAN_NETWORK=testnet bash scripts/deploy_contract.sh
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NETWORK="${NYX_SOROBAN_NETWORK:-local}"
SOURCE="${NYX_SOROBAN_SOURCE:-nyx-engine}"
STELLAR="${NYX_STELLAR_BIN:-$ROOT/scripts/bin/stellar.exe}"
CRATE="$ROOT/contracts/nyx-verifier"
WASM="$CRATE/target/wasm32v1-none/release/nyx_verifier.wasm"

log() { echo ">> $*" >&2; }

# 1. Network: for local, start the Docker quickstart container (idempotent).
if [ "$NETWORK" = "local" ]; then
    log "starting local Soroban network (Docker quickstart)…"
    "$STELLAR" container start local >&2 2>&1 || log "container already running (continuing)"
fi

# 2. Identity: create + fund if absent.
if ! "$STELLAR" keys address "$SOURCE" >/dev/null 2>&1; then
    log "generating + funding identity '$SOURCE' on $NETWORK"
    "$STELLAR" keys generate "$SOURCE" --network "$NETWORK" --fund >&2
else
    log "identity '$SOURCE' exists; ensuring funded"
    "$STELLAR" keys fund "$SOURCE" --network "$NETWORK" >&2 2>&1 || true
fi

# 3. Build the wasm.
log "building contract wasm…"
( cd "$CRATE" && "$STELLAR" contract build >&2 )

# 4. Deploy → capture the contract id on stdout.
log "deploying $WASM …"
CID="$("$STELLAR" contract deploy \
    --wasm "$WASM" \
    --source-account "$SOURCE" \
    --network "$NETWORK" 2>/dev/null | tr -d '\r')"

log "deployed."
log "export NYX_SOROBAN_CONTRACT_ID=$CID"
echo "$CID"
