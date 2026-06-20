// Package db owns the PostgreSQL connection pool for the Nyx engine.
//
// It wraps pgxpool (the pure-Go pgx driver's pooling layer) and enforces the
// transactional discipline the matching engine depends on:
//
//   - Connect() builds a validated, health-checked pool with bounded size and
//     a startup ping so the process fails fast if the database is unreachable
//     (Zero-Assumption: never start half-connected).
//   - WithSerializableTx() runs a function inside a SERIALIZABLE transaction —
//     the isolation level required by the matcher to prevent two workers from
//     pairing the same resting order (latency-arbitrage / double-match races).
//
// All entry points take a context.Context so cancellation and deadlines
// propagate end-to-end.
package db

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DB is a thin, safe wrapper around a pgx connection pool.
type DB struct {
	Pool   *pgxpool.Pool
	logger *slog.Logger
}

// Connect parses the connection string, configures pool limits, establishes the
// pool, and verifies connectivity with a Ping bounded by ctx. The caller owns
// the returned *DB and must call Close() during shutdown.
func Connect(ctx context.Context, databaseURL string, maxConns int32, logger *slog.Logger) (*DB, error) {
	if logger == nil {
		logger = slog.Default()
	}

	poolCfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("db: parse connection string: %w", err)
	}
	if maxConns > 0 {
		poolCfg.MaxConns = maxConns
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("db: create pool: %w", err)
	}

	// Ping verifies the database is actually reachable, not just that a pool
	// struct was allocated. Bounded by the caller's context.
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("db: ping failed: %w", err)
	}

	logger.Info("database connected",
		"host", poolCfg.ConnConfig.Host,
		"database", poolCfg.ConnConfig.Database,
		"max_conns", poolCfg.MaxConns,
	)

	return &DB{Pool: pool, logger: logger}, nil
}

// Close releases all pooled connections. Safe to call once during shutdown.
func (d *DB) Close() {
	if d.Pool != nil {
		d.Pool.Close()
		d.logger.Info("database pool closed")
	}
}

// Ping re-checks connectivity (used by health endpoints / readiness probes).
func (d *DB) Ping(ctx context.Context) error {
	return d.Pool.Ping(ctx)
}

// WithSerializableTx runs fn inside a SERIALIZABLE transaction.
//
// On a clean return it commits; on any error (or panic) it rolls back. The
// matcher MUST use this for order-pairing so concurrent workers cannot both
// claim the same OPEN order. Serialization failures (SQLSTATE 40001) surface to
// the caller, which is expected to retry the unit of work.
func (d *DB) WithSerializableTx(ctx context.Context, fn func(pgx.Tx) error) (err error) {
	tx, err := d.Pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
	if err != nil {
		return fmt.Errorf("db: begin serializable tx: %w", err)
	}

	// Guarantee the transaction is always finalized, even on panic.
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback(ctx)
			panic(p) // re-raise after cleanup
		}
		if err != nil {
			if rbErr := tx.Rollback(ctx); rbErr != nil && !errors.Is(rbErr, pgx.ErrTxClosed) {
				d.logger.Error("rollback failed", "error", rbErr, "cause", err)
			}
		}
	}()

	if err = fn(tx); err != nil {
		return err // deferred rollback handles cleanup
	}

	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("db: commit: %w", err)
	}
	return nil
}
