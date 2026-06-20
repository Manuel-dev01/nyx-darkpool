#!/usr/bin/env bash
# ============================================================================
# compile_circuit.sh — compile darkpool_match + run the Groth16 trusted setup
# ----------------------------------------------------------------------------
# End-to-end pipeline:
#   1. compile the circuit   (circom --r1cs --wasm --sym)
#   2. Powers of Tau         (universal/phase-1 setup, reused if present)
#   3. Groth16 setup         (circuit-specific/phase-2 setup -> proving key)
#   4. export verification_key.json
#   5. sample input -> witness -> proof.json/public.json
#   6. groth16 verify        (FAILS the script if the proof does not verify)
#
# Committed artifacts: verification_key.json, proof.json, public.json (kept by
# .gitignore). Everything under build/ (r1cs, sym, wasm, ptau, zkey, witness)
# is regenerated and git-ignored. Re-running regenerates the vkey+proof+public
# trio together, so the committed set is always mutually consistent.
#
# Usage:   bash scripts/compile_circuit.sh
# Env:     POW (Powers-of-Tau size, default 12), CIRCOM_BIN (path to circom)
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CIR="$ROOT/circuits"
BUILD="$CIR/build"
NAME="darkpool_match"
POW="${POW:-12}"
CIRCOM_BIN="${CIRCOM_BIN:-$ROOT/scripts/bin/circom.exe}"

# snarkjs is invoked through npx using the circuits/ local install.
snarkjs() { ( cd "$CIR" && npx --no-install snarkjs "$@" ); }

mkdir -p "$BUILD"

echo ">> circom: $("$CIRCOM_BIN" --version)"

# ---- 1. Compile -----------------------------------------------------------
echo ">> [1/6] compiling circuit"
"$CIRCOM_BIN" "$CIR/$NAME.circom" --r1cs --wasm --sym -l "$CIR/node_modules" -o "$BUILD"
snarkjs r1cs info "$BUILD/$NAME.r1cs"

# ---- 2. Powers of Tau (phase 1, universal) --------------------------------
PTAU="$BUILD/pot${POW}_final.ptau"
if [ ! -f "$PTAU" ]; then
    echo ">> [2/6] powers of tau (2^${POW})"
    snarkjs powersoftau new bn128 "$POW" "$BUILD/pot${POW}_0000.ptau" -v
    snarkjs powersoftau contribute "$BUILD/pot${POW}_0000.ptau" "$BUILD/pot${POW}_0001.ptau" \
        --name="nyx-phase1" -v -e="$(head -c 64 /dev/urandom | base64 | tr -d '\n')"
    snarkjs powersoftau prepare phase2 "$BUILD/pot${POW}_0001.ptau" "$PTAU" -v
else
    echo ">> [2/6] reusing existing $PTAU"
fi

# ---- 3. Groth16 setup (phase 2, circuit-specific) -------------------------
echo ">> [3/6] groth16 setup + zkey contribution"
snarkjs groth16 setup "$BUILD/$NAME.r1cs" "$PTAU" "$BUILD/${NAME}_0000.zkey"
snarkjs zkey contribute "$BUILD/${NAME}_0000.zkey" "$BUILD/${NAME}_final.zkey" \
    --name="nyx-phase2" -v -e="$(head -c 64 /dev/urandom | base64 | tr -d '\n')"

# ---- 4. Export verification key -------------------------------------------
echo ">> [4/6] exporting verification_key.json"
snarkjs zkey export verificationkey "$BUILD/${NAME}_final.zkey" "$CIR/verification_key.json"

# ---- 5. Sample input -> witness -> proof ----------------------------------
echo ">> [5/6] generating sample witness + proof"
node "$CIR/scripts/gen_input.js" valid > "$CIR/input.json"
snarkjs wtns calculate "$BUILD/${NAME}_js/$NAME.wasm" "$CIR/input.json" "$BUILD/witness.wtns"
snarkjs groth16 prove "$BUILD/${NAME}_final.zkey" "$BUILD/witness.wtns" \
    "$CIR/proof.json" "$CIR/public.json"

# ---- 6. Verify (gate) -----------------------------------------------------
echo ">> [6/6] verifying proof"
snarkjs groth16 verify "$CIR/verification_key.json" "$CIR/public.json" "$CIR/proof.json"

echo ""
echo "OK: circuit compiled, trusted setup complete, sample proof verified."
echo "    committed:  verification_key.json, proof.json, public.json, input.json"
echo "    build/:     r1cs, wasm, sym, ptau, zkey, witness (git-ignored)"
