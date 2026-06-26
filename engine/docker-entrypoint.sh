#!/usr/bin/env bash
# ============================================================================
# Nyx engine container entrypoint — self-bootstrapping for cloud deploy.
#
# Makes the engine image need NOTHING from the host:
#   1. applies DB migrations (idempotent) — replaces the compose one-shot migrator
#      so Railway/Render/Fly need no separate migrate step;
#   2. if on-chain settlement is enabled (NYX_SOROBAN_CONTRACT_ID set), provisions
#      a funded Stellar testnet identity in the container's CLI keystore:
#        - if NYX_SOROBAN_SECRET is set, import that seed (stable address), else
#        - generate a fresh keypair and friendbot-fund it (zero secrets — the
#          contract accepts any funded submitter);
#   3. execs the engine.
#
# All steps are best-effort and logged; the engine still starts (and matches +
# proves) even if the on-chain bootstrap fails — it just won't settle on-chain.
# ============================================================================
set -u

log() { echo "[entrypoint] $*" >&2; }

# --- 0. Port: honour a platform-injected $PORT (Render/Heroku/Fly) -----------
# Hosts that assign a port expect the app to listen on $PORT. Bind it when set;
# otherwise keep NYX_HTTP_ADDR (defaults to :8080 in config).
if [ -n "${PORT:-}" ]; then
  export NYX_HTTP_ADDR=":${PORT}"
  log "binding platform port: NYX_HTTP_ADDR=$NYX_HTTP_ADDR"
fi

# --- 1. DB migrations -------------------------------------------------------
if [ -n "${NYX_DATABASE_URL:-}" ] && [ -d /migrations ]; then
  log "applying DB migrations…"
  if migrate -path /migrations -database "$NYX_DATABASE_URL" up; then
    log "migrations OK"
  else
    # 'no change' exits non-zero on some versions; don't abort on it.
    log "migrate returned non-zero (often 'no change') — continuing"
  fi
fi

# --- 2. On-chain identity (only when the bridge is enabled) -----------------
if [ -n "${NYX_SOROBAN_CONTRACT_ID:-}" ]; then
  SRC="${NYX_SOROBAN_SOURCE:-nyx-engine}"
  NET="${NYX_SOROBAN_NETWORK:-testnet}"
  BIN="${NYX_STELLAR_BIN:-stellar}"

  if "$BIN" keys address "$SRC" >/dev/null 2>&1; then
    log "stellar identity '$SRC' already present"
  elif [ -n "${NYX_SOROBAN_SECRET:-}" ]; then
    log "importing stellar identity '$SRC' from NYX_SOROBAN_SECRET"
    # Non-interactive seed import (CLI reads the secret from stdin).
    printf '%s\n' "$NYX_SOROBAN_SECRET" | "$BIN" keys add "$SRC" --secret-key 2>/dev/null \
      || log "WARN: secret import failed — on-chain settle may be disabled"
  else
    log "generating + friendbot-funding stellar identity '$SRC' on $NET"
    "$BIN" keys generate "$SRC" --network "$NET" --fund \
      || log "WARN: keys generate --fund failed — on-chain settle may be disabled"
  fi

  # Top up (no-op if already funded); never fatal.
  "$BIN" keys fund "$SRC" --network "$NET" >/dev/null 2>&1 || true

  if ADDR="$("$BIN" keys address "$SRC" 2>/dev/null)"; then
    log "on-chain submitter: $ADDR ($NET, contract ${NYX_SOROBAN_CONTRACT_ID})"
  fi
fi

# --- 3. Run the engine ------------------------------------------------------
log "starting nyx engine"
exec nyx-engine "$@"
