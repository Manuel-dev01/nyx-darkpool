package config

import (
	"testing"
	"time"
)

// clearMatcherEnv unsets the Phase-5 matcher vars so defaults apply.
func clearMatcherEnv(t *testing.T) {
	t.Helper()
	for _, k := range []string{
		"NYX_MATCHER_WORKERS", "NYX_MATCHER_POLL_INTERVAL",
		"NYX_CIRCUITS_ROOT", "NYX_SCRIPTS_ROOT", "NYX_NODE_BIN",
	} {
		t.Setenv(k, "")
	}
}

func TestMatcherDefaults(t *testing.T) {
	clearEnv(t)
	clearMatcherEnv(t)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.MatcherWorkers < 1 {
		t.Errorf("MatcherWorkers default = %d, want >= 1", cfg.MatcherWorkers)
	}
	if cfg.MatcherWorkers > maxDefaultWorkers {
		t.Errorf("MatcherWorkers default = %d, want <= %d", cfg.MatcherWorkers, maxDefaultWorkers)
	}
	if cfg.MatcherPollInterval != time.Second {
		t.Errorf("MatcherPollInterval default = %s", cfg.MatcherPollInterval)
	}
	if cfg.CircuitsRoot != "../circuits" {
		t.Errorf("CircuitsRoot default = %q", cfg.CircuitsRoot)
	}
	if cfg.NodeBin != "node" {
		t.Errorf("NodeBin default = %q", cfg.NodeBin)
	}
}

func TestMatcherOverrides(t *testing.T) {
	clearEnv(t)
	clearMatcherEnv(t)
	t.Setenv("NYX_MATCHER_WORKERS", "3")
	t.Setenv("NYX_MATCHER_POLL_INTERVAL", "250ms")
	t.Setenv("NYX_CIRCUITS_ROOT", "/srv/circuits")
	t.Setenv("NYX_NODE_BIN", "/usr/bin/node")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.MatcherWorkers != 3 {
		t.Errorf("MatcherWorkers = %d, want 3", cfg.MatcherWorkers)
	}
	if cfg.MatcherPollInterval != 250*time.Millisecond {
		t.Errorf("MatcherPollInterval = %s", cfg.MatcherPollInterval)
	}
	if cfg.CircuitsRoot != "/srv/circuits" {
		t.Errorf("CircuitsRoot = %q", cfg.CircuitsRoot)
	}
	if cfg.NodeBin != "/usr/bin/node" {
		t.Errorf("NodeBin = %q", cfg.NodeBin)
	}
}

func TestMatcherValidationErrors(t *testing.T) {
	cases := []struct{ key, val string }{
		{"NYX_MATCHER_WORKERS", "abc"},
		{"NYX_MATCHER_WORKERS", "0"},
		{"NYX_MATCHER_WORKERS", "-2"},
		{"NYX_MATCHER_POLL_INTERVAL", "notaduration"},
		{"NYX_MATCHER_POLL_INTERVAL", "0s"},
		{"NYX_MATCHER_POLL_INTERVAL", "-1s"},
	}
	for _, tc := range cases {
		t.Run(tc.key+"="+tc.val, func(t *testing.T) {
			clearEnv(t)
			clearMatcherEnv(t)
			t.Setenv(tc.key, tc.val)
			if _, err := Load(); err == nil {
				t.Fatalf("Load with %s=%q expected error", tc.key, tc.val)
			}
		})
	}
}
