#!/usr/bin/env bash
# ============================================================================
# install_circom.sh — fetch a prebuilt circom binary (no Rust toolchain needed)
# ----------------------------------------------------------------------------
# Downloads the official iden3 circom release binary into scripts/bin/ and
# verifies it runs. We use the prebuilt binary so Phase 3 does not require a
# Rust toolchain (Rust is installed later for Phase 4 / Soroban).
#
# Usage:   bash scripts/install_circom.sh
# Override version:  CIRCOM_VERSION=v2.2.3 bash scripts/install_circom.sh
#
# The downloaded binary lives in scripts/bin/ and is git-ignored (it is a
# platform-specific build artifact, also caught by the global *.exe rule).
# ============================================================================
set -euo pipefail

CIRCOM_VERSION="${CIRCOM_VERSION:-v2.2.3}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$SCRIPT_DIR/bin"
mkdir -p "$BIN_DIR"

# Select the release asset for this platform. We primarily target Windows
# (this repo's dev host); linux/macos assets are mapped for portability/CI.
case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*|Windows_NT) ASSET="circom-windows-amd64.exe"; OUT="circom.exe" ;;
    Linux*)                          ASSET="circom-linux-amd64";        OUT="circom"     ;;
    Darwin*)                         ASSET="circom-macos-amd64";        OUT="circom"     ;;
    *) echo "install_circom: unsupported platform $(uname -s)" >&2; exit 1 ;;
esac

URL="https://github.com/iden3/circom/releases/download/${CIRCOM_VERSION}/${ASSET}"
DEST="$BIN_DIR/$OUT"

if [ -x "$DEST" ] && "$DEST" --version >/dev/null 2>&1; then
    echo "circom already present: $("$DEST" --version)"
    exit 0
fi

echo "Downloading circom ${CIRCOM_VERSION} (${ASSET})..."
curl -fL --retry 3 "$URL" -o "$DEST"
chmod +x "$DEST" 2>/dev/null || true

# Fail fast if the binary does not actually run.
echo "Installed: $("$DEST" --version)"
echo "Path: $DEST"
