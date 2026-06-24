package onchain

import "testing"

// TestFromEnvDisabledByDefault: with no contract id, the bridge is disabled and
// callers skip the on-chain step (preserving offline go test ./...).
func TestFromEnvDisabledByDefault(t *testing.T) {
	t.Setenv("NYX_SOROBAN_CONTRACT_ID", "")
	c := FromEnv()
	if c.Enabled {
		t.Fatal("expected Enabled=false when NYX_SOROBAN_CONTRACT_ID is unset")
	}
	if c.Bin != "stellar" || c.Network != "local" || c.Source != "nyx-engine" {
		t.Fatalf("unexpected defaults: %+v", c)
	}
}

// TestFromEnvEnabledWithOverrides: a set contract id enables the bridge and the
// other knobs honor their env overrides.
func TestFromEnvEnabledWithOverrides(t *testing.T) {
	t.Setenv("NYX_SOROBAN_CONTRACT_ID", "CDEADBEEF")
	t.Setenv("NYX_SOROBAN_NETWORK", "testnet")
	t.Setenv("NYX_SOROBAN_SOURCE", "alice")
	t.Setenv("NYX_STELLAR_BIN", "/opt/stellar")

	c := FromEnv()
	if !c.Enabled {
		t.Fatal("expected Enabled=true")
	}
	if c.ContractID != "CDEADBEEF" || c.Network != "testnet" || c.Source != "alice" || c.Bin != "/opt/stellar" {
		t.Fatalf("overrides not applied: %+v", c)
	}
}

func TestBuildInvokeArgs(t *testing.T) {
	c := Config{Bin: "stellar", ContractID: "CID1", Network: "local", Source: "nyx-engine", Enabled: true}
	p := Proof{A: "0xaa", B: "0xbb", C: "0xcc", Public: []string{"0x01", "0x02"}}
	args := c.buildInvokeArgs("GSUBMITTER", p)

	joined := join(args)
	for _, want := range []string{
		"contract invoke", "--id CID1", "--source nyx-engine", "--network local",
		"verify_and_settle", "--submitter GSUBMITTER",
		"--proof_a 0xaa", "--proof_b 0xbb", "--proof_c 0xcc",
		"--public_inputs 0x01", "--public_inputs 0x02",
	} {
		if !contains(joined, want) {
			t.Errorf("invoke args missing %q; got: %s", want, joined)
		}
	}
}

func TestParseTxHash(t *testing.T) {
	hash := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	out := "some log line\n\"" + hash + "\"\n"
	if got := parseTxHash(out); got != hash {
		t.Fatalf("parseTxHash = %q, want %q", got, hash)
	}
	// no hash present -> trimmed fallback
	if got := parseTxHash("  result  \n"); got != "result" {
		t.Fatalf("fallback parseTxHash = %q", got)
	}
}

// small string helpers (avoid importing strings just for tests)
func join(a []string) string {
	out := ""
	for i, s := range a {
		if i > 0 {
			out += " "
		}
		out += s
	}
	return out
}

func contains(haystack, needle string) bool {
	return len(needle) == 0 || indexOf(haystack, needle) >= 0
}

func indexOf(h, n string) int {
	for i := 0; i+len(n) <= len(h); i++ {
		if h[i:i+len(n)] == n {
			return i
		}
	}
	return -1
}
