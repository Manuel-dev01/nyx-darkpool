package config

import (
	"testing"
	"time"
)

// clearEnv unsets every NYX_* variable Load reads, so each test starts from a
// known-empty environment. t.Setenv restores them automatically after the test.
func clearEnv(t *testing.T) {
	t.Helper()
	for _, k := range []string{
		"NYX_DATABASE_URL", "NYX_HTTP_ADDR", "NYX_LOG_LEVEL",
		"NYX_DB_MAX_CONNS", "NYX_DB_CONNECT_TIMEOUT", "NYX_BLOB_KEY",
	} {
		t.Setenv(k, "")
	}
}

func TestLoadDefaults(t *testing.T) {
	clearEnv(t)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() unexpected error: %v", err)
	}
	if cfg.DatabaseURL != "postgres://nyx:nyx@localhost:5432/nyx?sslmode=disable" {
		t.Errorf("DatabaseURL default = %q", cfg.DatabaseURL)
	}
	if cfg.HTTPAddr != ":8080" {
		t.Errorf("HTTPAddr default = %q", cfg.HTTPAddr)
	}
	if cfg.LogLevel != "info" {
		t.Errorf("LogLevel default = %q", cfg.LogLevel)
	}
	if cfg.DBMaxConns != 10 {
		t.Errorf("DBMaxConns default = %d", cfg.DBMaxConns)
	}
	if cfg.DBConnectTimeout != 10*time.Second {
		t.Errorf("DBConnectTimeout default = %s", cfg.DBConnectTimeout)
	}
}

func TestLoadOverrides(t *testing.T) {
	clearEnv(t)
	t.Setenv("NYX_DATABASE_URL", "postgres://u:p@db:5432/x")
	t.Setenv("NYX_HTTP_ADDR", ":9999")
	t.Setenv("NYX_LOG_LEVEL", "debug")
	t.Setenv("NYX_DB_MAX_CONNS", "42")
	t.Setenv("NYX_DB_CONNECT_TIMEOUT", "30s")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() unexpected error: %v", err)
	}
	if cfg.DatabaseURL != "postgres://u:p@db:5432/x" {
		t.Errorf("DatabaseURL = %q", cfg.DatabaseURL)
	}
	if cfg.HTTPAddr != ":9999" {
		t.Errorf("HTTPAddr = %q", cfg.HTTPAddr)
	}
	if cfg.LogLevel != "debug" {
		t.Errorf("LogLevel = %q", cfg.LogLevel)
	}
	if cfg.DBMaxConns != 42 {
		t.Errorf("DBMaxConns = %d", cfg.DBMaxConns)
	}
	if cfg.DBConnectTimeout != 30*time.Second {
		t.Errorf("DBConnectTimeout = %s", cfg.DBConnectTimeout)
	}
}

func TestLoadValidationErrors(t *testing.T) {
	tests := []struct {
		name string
		key  string
		val  string
	}{
		{"max_conns non-integer", "NYX_DB_MAX_CONNS", "abc"},
		{"max_conns zero", "NYX_DB_MAX_CONNS", "0"},
		{"max_conns negative", "NYX_DB_MAX_CONNS", "-3"},
		{"timeout bad string", "NYX_DB_CONNECT_TIMEOUT", "notaduration"},
		{"timeout zero", "NYX_DB_CONNECT_TIMEOUT", "0s"},
		{"timeout negative", "NYX_DB_CONNECT_TIMEOUT", "-1s"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			clearEnv(t)
			t.Setenv(tc.key, tc.val)
			if _, err := Load(); err == nil {
				t.Fatalf("Load() with %s=%q expected error, got nil", tc.key, tc.val)
			}
		})
	}
}

// TestLoadEmptyDatabaseURLFallsBack documents that an empty NYX_DATABASE_URL is
// treated as unset (getenv returns the default), so the defensive ==""
// guard inside Load is not reachable via the environment.
func TestLoadEmptyDatabaseURLFallsBack(t *testing.T) {
	clearEnv(t)
	t.Setenv("NYX_DATABASE_URL", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() unexpected error: %v", err)
	}
	if cfg.DatabaseURL == "" {
		t.Fatal("expected DatabaseURL to fall back to default, got empty")
	}
}
