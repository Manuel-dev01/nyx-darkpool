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
func (c Config) buildInvokeArgs(submitter string, p Proof) []string {
	args := []string{
		"contract", "invoke",
		"--id", c.ContractID,
		"--source", c.Source,
		"--network", c.Network,
		"--", // separates CLI flags from contract function + args
		"verify_and_settle",
		"--submitter", submitter,
		"--proof_a", p.A,
		"--proof_b", p.B,
		"--proof_c", p.C,
	}
	// Vec<BytesN<32>> is passed as repeated --public_inputs entries.
	for _, pub := range p.Public {
		args = append(args, "--public_inputs", pub)
	}
	return args
}

// parseTxHash extracts the settlement tx hash from the CLI output. The stellar
// CLI prints the transaction hash on invoke; we take the last non-empty token
// that looks like a 64-hex hash, falling back to the trimmed output.
func parseTxHash(out string) string {
	lines := strings.Split(strings.TrimSpace(out), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		tok := strings.Trim(strings.TrimSpace(lines[i]), `"`)
		if len(tok) == 64 && isHex(tok) {
			return tok
		}
	}
	return strings.TrimSpace(out)
}

func isHex(s string) bool {
	for _, r := range s {
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')) {
			return false
		}
	}
	return len(s) > 0
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
