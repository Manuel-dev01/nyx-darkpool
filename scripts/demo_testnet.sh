#!/usr/bin/env bash
# ============================================================================
# demo_testnet.sh — run the live demo engine with REAL on-chain settlement
# ----------------------------------------------------------------------------
# This is the "it's real" demo path. Unlike `docker compose up` (which runs the
# engine in a container that has NO `stellar` CLI, so on-chain settlement is
# off and the Proofs pipeline stops after the proof is stored), this script runs
# the engine ON THE HOST — where `scripts/bin/stellar.exe` and the funded
# `nyx-engine` testnet identity live — with NYX_SOROBAN_CONTRACT_ID set, so the
# matcher drives a genuine `verify_and_settle` on public Stellar testnet for
# every match. The Proofs screen then animates all four stages to DONE and the
# Settled screen shows a real, clickable stellar.expert transaction.
#
# It brings up Postgres (+ migrations) via docker compose, resolves/【re】deploys
# the verifier on testnet, exports the on-chain env, and runs `go run ./cmd/server`.
# The web app is started separately (printed at the end): `cd web && npm run dev`.
#
# Usage:
#   bash scripts/demo_testnet.sh                 # default everything
#   NYX_SOROBAN_CONTRACT_ID=C... bash scripts/demo_testnet.sh   # pin a CID
#   NYX_REDEPLOY=1 bash scripts/demo_testnet.sh  # force a fresh testnet deploy
#
# Prereqs: Docker Desktop running (for Postgres), Node + circuits built
# (scripts/compile_circuit.sh), the stellar CLI at scripts/bin/stellar.exe, and
# the Go toolchain on PATH.
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

log() { echo ">> $*" >&2; }

# ---------------------------------------------------------------------------
# Config (override via env).
# ---------------------------------------------------------------------------
# The verifier already deployed to public testnet (see contracts/README.md).
# We reuse it by default; redeploy only if it's unreachable or NYX_REDEPLOY=1.
DEFAULT_CID="CBAFC6W5IWQC5AB6LFMFI4KB4DZT23BU2O2AJ2H3B2727DO37DOJGJRV"
export NYX_SOROBAN_NETWORK="${NYX_SOROBAN_NETWORK:-testnet}"
export NYX_SOROBAN_SOURCE="${NYX_SOROBAN_SOURCE:-nyx-engine}"
export NYX_STELLAR_BIN="${NYX_STELLAR_BIN:-$ROOT/scripts/bin/stellar.exe}"
RPC_URL="${NYX_SOROBAN_RPC_URL:-https://soroban-testnet.stellar.org}"

# Postgres: the compose service, published on a dedicated IPv4 loopback port (5544)
# via docker-compose.demo.yml so the host engine connects unambiguously even when a
# native Postgres already occupies 5432 (common on Windows). Override NYX_DATABASE_URL
# to point at your own DB if you prefer.
export NYX_DATABASE_URL="${NYX_DATABASE_URL:-postgres://nyx:nyx@127.0.0.1:5544/nyx?sslmode=disable}"
export NYX_HTTP_ADDR="${NYX_HTTP_ADDR:-:8080}"
export NYX_CIRCUITS_ROOT="${NYX_CIRCUITS_ROOT:-$ROOT/circuits}"
export NYX_SCRIPTS_ROOT="${NYX_SCRIPTS_ROOT:-$ROOT/scripts}"
export NYX_LOG_LEVEL="${NYX_LOG_LEVEL:-info}"

# Persistent at-rest blob key for the demo so composed orders survive an engine
# restart mid-session. Passed via env only — NEVER written to disk. Demo default
# is an obvious throwaway; override with your own 64-hex key if you prefer.
export NYX_BLOB_KEY="${NYX_BLOB_KEY:-0000000000000000000000000000000000000000000000000000000000000001}"

# ---------------------------------------------------------------------------
# 1. Postgres + migrations (docker compose one-shots).
# ---------------------------------------------------------------------------
COMPOSE="${COMPOSE:-docker compose} -f docker-compose.yml -f docker-compose.demo.yml"
log "starting Postgres + applying migrations (docker compose)…"
$COMPOSE up -d postgres >&2
$COMPOSE up migrate >&2 || true   # one-shot; idempotent (no-op if already applied)

# ---------------------------------------------------------------------------
# 2. Resolve the contract id. Reuse the known CID if it is reachable on testnet;
#    otherwise (testnet reset / NYX_REDEPLOY=1) deploy a fresh one + fund the
#    identity via friendbot through deploy_contract.sh.
# ---------------------------------------------------------------------------
contract_alive() {
  local cid="$1"
  "$NYX_STELLAR_BIN" contract info interface --id "$cid" --network "$NYX_SOROBAN_NETWORK" \
    >/dev/null 2>&1
}

CID="${NYX_SOROBAN_CONTRACT_ID:-$DEFAULT_CID}"
if [ "${NYX_REDEPLOY:-0}" = "1" ]; then
  log "NYX_REDEPLOY=1 — forcing a fresh testnet deploy…"
  CID="$(NYX_SOROBAN_NETWORK=testnet bash "$ROOT/scripts/deploy_contract.sh")"
elif contract_alive "$CID"; then
  log "verifier $CID is live on $NYX_SOROBAN_NETWORK — reusing it."
else
  log "verifier $CID is NOT reachable (testnet may have reset) — redeploying…"
  CID="$(NYX_SOROBAN_NETWORK=testnet bash "$ROOT/scripts/deploy_contract.sh")"
fi
export NYX_SOROBAN_CONTRACT_ID="$CID"

# Make sure the signing identity is funded (friendbot is free testnet XLM).
log "ensuring identity '$NYX_SOROBAN_SOURCE' is funded on testnet…"
"$NYX_STELLAR_BIN" keys fund "$NYX_SOROBAN_SOURCE" --network "$NYX_SOROBAN_NETWORK" >&2 2>&1 || true

# ---------------------------------------------------------------------------
# 3. Run the engine on the host with on-chain settlement ENABLED.
# ---------------------------------------------------------------------------
cat >&2 <<EOF

  ───────────────────────────────────────────────────────────────────────────
  Nyx demo engine — REAL on-chain testnet settlement
  ───────────────────────────────────────────────────────────────────────────
  contract : $NYX_SOROBAN_CONTRACT_ID
  network  : $NYX_SOROBAN_NETWORK    submitter: $NYX_SOROBAN_SOURCE
  database : $NYX_DATABASE_URL
  api      : http://localhost${NYX_HTTP_ADDR}
  explorer : https://stellar.expert/explorer/testnet/contract/$NYX_SOROBAN_CONTRACT_ID

  NEXT: in a second terminal, start the web app —
      cd web && npm run dev          # http://localhost:3000
  then open http://localhost:3000 and run the flow: access -> compose -> pool -> proofs -> settled.
  ───────────────────────────────────────────────────────────────────────────

EOF

log "starting engine (go run ./cmd/server) — expect 'matcher started proving:true onchain:true'…"
cd "$ROOT/engine"
exec go run ./cmd/server
