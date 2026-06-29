package config

import (
	"strings"
	"testing"
)

const validHexKey = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f" // 32 bytes

func TestBlobKey_UnsetIsOptional(t *testing.T) {
	clearEnv(t)
	clearMatcherEnv(t)
	t.Setenv("NYX_BLOB_KEY", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load with unset NYX_BLOB_KEY should succeed: %v", err)
	}
	if cfg.BlobKey != "" {
		t.Errorf("BlobKey = %q, want empty", cfg.BlobKey)
	}
	if cfg.BlobKeyBytes() != nil {
		t.Errorf("BlobKeyBytes() = %v, want nil when unset", cfg.BlobKeyBytes())
	}
}

func TestBlobKey_ValidHex(t *testing.T) {
	clearEnv(t)
	clearMatcherEnv(t)
	t.Setenv("NYX_BLOB_KEY", validHexKey)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load with valid NYX_BLOB_KEY: %v", err)
	}
	if got := cfg.BlobKeyBytes(); len(got) != 32 {
		t.Fatalf("BlobKeyBytes() len = %d, want 32", len(got))
	}
}

// TestBlobKey_TrimsWhitespace guards the common dashboard paste mistake: a
// trailing newline (U+000A) or surrounding spaces on the hex value. Load must
// trim it rather than fail hex decoding.
func TestBlobKey_TrimsWhitespace(t *testing.T) {
	cases := []struct{ name, val string }{
		{"trailing newline", validHexKey + "\n"},
		{"leading+trailing spaces", "  " + validHexKey + "  "},
		{"crlf", validHexKey + "\r\n"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			clearEnv(t)
			clearMatcherEnv(t)
			t.Setenv("NYX_BLOB_KEY", tc.val)

			cfg, err := Load()
			if err != nil {
				t.Fatalf("Load with padded NYX_BLOB_KEY should succeed after trim: %v", err)
			}
			if cfg.BlobKey != validHexKey {
				t.Errorf("BlobKey = %q, want trimmed %q", cfg.BlobKey, validHexKey)
			}
			if got := cfg.BlobKeyBytes(); len(got) != 32 {
				t.Fatalf("BlobKeyBytes() len = %d, want 32", len(got))
			}
		})
	}
}

func TestBlobKey_Invalid(t *testing.T) {
	cases := []struct{ name, val string }{
		{"not hex", "zzzz"},
		{"too short", strings.Repeat("ab", 16)}, // 16 bytes
		{"too long", strings.Repeat("ab", 40)},  // 40 bytes
		{"odd length", "00010203040"},           // not valid hex (odd)
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			clearEnv(t)
			clearMatcherEnv(t)
			t.Setenv("NYX_BLOB_KEY", tc.val)
			if _, err := Load(); err == nil {
				t.Fatalf("Load with NYX_BLOB_KEY=%q expected error", tc.val)
			}
		})
	}
}
