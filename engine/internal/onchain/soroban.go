// Package onchain bridges the off-chain engine to the on-chain Soroban
// verifier. It invokes the deployed nyx-verifier contract's verify_and_settle
// entrypoint via the `stellar` CLI and returns the settlement transaction hash.
//
// The bridge is ENV-GATED: when NYX_SOROBAN_CONTRACT_ID is unset, FromEnv
// returns a Config with Enabled=false and callers skip the on-chain step. This
// preserves the project invariant that offline `go test ./...` stays green
// without a deployed contract or a running network.
package onchain

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
)

// Config holds the resolved Soroban invocation settings.
type Config struct {
	Bin        string // stellar CLI binary (default "stellar")
	ContractID string // deployed contract id (CID); empty => disabled
	Network    string // network name passed to --network (default "local")
	Source     string // source identity/key passed to --source (default "nyx-engine")
	Enabled    bool   // true iff ContractID is set
}

// FromEnv resolves the bridge configuration from the environment.
//
//	NYX_SOROBAN_CONTRACT_ID  required to enable; the deployed CID
//	NYX_SOROBAN_NETWORK      default "local"
//	NYX_SOROBAN_SOURCE       default "nyx-engine"
//	NYX_STELLAR_BIN          default "stellar"
func FromEnv() Config {
	cid := os.Getenv("NYX_SOROBAN_CONTRACT_ID")
	return Config{
		Bin:        getenv("NYX_STELLAR_BIN", "stellar"),
		ContractID: cid,
		Network:    getenv("NYX_SOROBAN_NETWORK", "local"),
		Source:     getenv("NYX_SOROBAN_SOURCE", "nyx-engine"),
		Enabled:    cid != "",
	}
}

// Proof carries the 0x-hex encoded Groth16 proof and public inputs, exactly as
// emitted by scripts/proof_to_bytes.js (the single source of truth for the
// snarkjs-decimal -> BN254 byte conversion).
type Proof struct {
	A      string   // proof_a  (G1, 64 bytes hex)
	B      string   // proof_b  (G2, 128 bytes hex)
	C      string   // proof_c  (G1, 64 bytes hex)
	Public []string // public inputs (each 32 bytes hex)
}

// VerifyAndSettle invokes the on-chain contract's verify_and_settle entrypoint
// with the given submitter identity and proof. It returns the settlement
// transaction hash on success.
//
// NOTE: the exact `stellar contract invoke` argument syntax (flag names, how a
// Vec<BytesN<32>> is passed) is confirmed against the installed CLI during
// execution; adjust buildInvokeArgs accordingly.
func (c Config) VerifyAndSettle(ctx context.Context, submitter string, p Proof) (string, error) {
	if !c.Enabled {
		return "", errors.New("onchain: bridge disabled (NYX_SOROBAN_CONTRACT_ID unset)")
	}
	if submitter == "" {
		return "", errors.New("onchain: empty submitter")
	}

	args := c.buildInvokeArgs(submitter, p)
	cmd := exec.CommandContext(ctx, c.Bin, args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("onchain: stellar invoke failed: %w\n%s", err, string(out))
	}
	return parseTxHash(string(out)), nil
}

// buildInvokeArgs assembles the `stellar contract invoke` argument vector.
//
// The CLI wants raw hex (no 0x prefix) for BytesN, and a Vec<BytesN<32>> as a
// SINGLE JSON array argument (e.g. --public_inputs '["aa..","bb.."]'), not
// repeated flags.
func (c Config) buildInvokeArgs(submitter string, p Proof) []string {
	quoted := make([]string, len(p.Public))
	for i, pub := range p.Public {
		quoted[i] = `"` + strip0x(pub) + `"`
	}
	publicJSON := "[" + strings.Join(quoted, ",") + "]"

	return []string{
		"contract", "invoke",
		"--id", c.ContractID,
		"--source-account", c.Source,
		"--network", c.Network,
		"--", // separates CLI flags from contract function + args
		"verify_and_settle",
		"--submitter", submitter,
		"--proof_a", strip0x(p.A),
		"--proof_b", strip0x(p.B),
		"--proof_c", strip0x(p.C),
		"--public_inputs", publicJSON,
	}
}

// ResolveAddress returns the G... address for the configured Source identity by
// asking the CLI (`stellar keys address <name>`). The matcher uses it as the
// verify_and_settle submitter.
func (c Config) ResolveAddress(ctx context.Context) (string, error) {
	out, err := exec.CommandContext(ctx, c.Bin, "keys", "address", c.Source).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("onchain: resolve address for %q: %w\n%s", c.Source, err, string(out))
	}
	return strings.TrimSpace(string(out)), nil
}

// IsSettled queries the deployed verifier's read-only is_settled(maker_hash,
// taker_hash) — true iff this match's two public commitments were already
// verified + settled on-chain. The matcher uses it to make settlement
// idempotent: if a prior attempt's tx landed but the engine crashed before
// recording it, re-settlement is skipped (a re-submit would hit the contract's
// AlreadySettled anti-replay). makerHash/takerHash are the 0x-hex public inputs.
func (c Config) IsSettled(ctx context.Context, makerHash, takerHash string) (bool, error) {
	if !c.Enabled {
		return false, errors.New("onchain: bridge disabled (NYX_SOROBAN_CONTRACT_ID unset)")
	}
	args := []string{
		"contract", "invoke",
		"--id", c.ContractID,
		"--source-account", c.Source,
		"--network", c.Network,
		"--",
		"is_settled",
		"--maker_hash", strip0x(makerHash),
		"--taker_hash", strip0x(takerHash),
	}
	out, err := exec.CommandContext(ctx, c.Bin, args...).CombinedOutput()
	if err != nil {
		return false, fmt.Errorf("onchain: is_settled: %w\n%s", err, string(out))
	}
	// A read-only invoke prints the bool result (e.g. "true"); be lenient on whitespace.
	return strings.Contains(strings.ToLower(string(out)), "true"), nil
}

func strip0x(s string) string { return strings.TrimPrefix(s, "0x") }

// txHashRe matches a 64-hex-character Stellar transaction hash. The stellar CLI
// prints it on invoke (e.g. "Signing transaction: <hash>").
var txHashRe = regexp.MustCompile(`[0-9a-fA-F]{64}`)

// parseTxHash extracts the settlement tx hash from the CLI output — the first
// 64-hex run (the contract id is a C... strkey, not hex, so it won't match).
// Returns "" if none is found.
func parseTxHash(out string) string {
	return txHashRe.FindString(out)
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
