// Package config centralizes runtime configuration for the Nyx engine.
//
// Configuration is sourced exclusively from environment variables so the engine
// runs identically in local Docker, CI, and production without code changes
// (12-factor). Every value has a documented default except secrets, and the
// loader fails fast with a descriptive error rather than starting half-configured.
package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config is the fully-resolved, validated configuration for one engine process.
type Config struct {
	// DatabaseURL is the libpq/pgx connection string for PostgreSQL, e.g.
	// "postgres://nyx:nyx@localhost:5432/nyx?sslmode=disable".
	DatabaseURL string

	// HTTPAddr is the listen address for the API server, e.g. ":8080".
	HTTPAddr string

	// DBMaxConns bounds the pgx connection pool size.
	DBMaxConns int32

	// DBConnectTimeout caps how long startup waits for the first DB connection.
	DBConnectTimeout time.Duration

	// LogLevel controls slog verbosity: "debug", "info", "warn", "error".
	LogLevel string
}

// Load reads configuration from the environment, applies defaults, and
// validates required fields. It returns a descriptive error on any problem so
// the process can exit non-zero before doing partial work (Zero-Assumption).
func Load() (*Config, error) {
	cfg := &Config{
		DatabaseURL:      getenv("NYX_DATABASE_URL", "postgres://nyx:nyx@localhost:5432/nyx?sslmode=disable"),
		HTTPAddr:         getenv("NYX_HTTP_ADDR", ":8080"),
		LogLevel:         getenv("NYX_LOG_LEVEL", "info"),
		DBMaxConns:       10,
		DBConnectTimeout: 10 * time.Second,
	}

	if v := os.Getenv("NYX_DB_MAX_CONNS"); v != "" {
		n, err := strconv.ParseInt(v, 10, 32)
		if err != nil || n <= 0 {
			return nil, fmt.Errorf("config: NYX_DB_MAX_CONNS must be a positive integer, got %q", v)
		}
		cfg.DBMaxConns = int32(n)
	}

	if v := os.Getenv("NYX_DB_CONNECT_TIMEOUT"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil || d <= 0 {
			return nil, fmt.Errorf("config: NYX_DB_CONNECT_TIMEOUT must be a positive Go duration, got %q", v)
		}
		cfg.DBConnectTimeout = d
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("config: NYX_DATABASE_URL is required")
	}

	return cfg, nil
}

// getenv returns the environment value for key, or def when unset/empty.
func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
