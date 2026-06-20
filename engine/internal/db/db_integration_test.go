//go:build integration

// Integration tests for the database layer. These require a live PostgreSQL
// reachable via NYX_TEST_DB_URL and are excluded from the default unit build.
//
//	docker run -d --name nyx-test-pg -e POSTGRES_USER=nyx -e POSTGRES_PASSWORD=nyx \
//	    -e POSTGRES_DB=nyx -p 5433:5432 postgres:16
//	export NYX_TEST_DB_URL="postgres://nyx:nyx@localhost:5433/nyx?sslmode=disable"
//	go test -tags=integration ./internal/db/...
package db

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// testDB connects to the database named by NYX_TEST_DB_URL, applies the schema
// migrations, and registers cleanup that tears the schema back down. The test is
// skipped (not failed) when the env var is absent, so offline `go test ./...`
// stays green.
func testDB(t *testing.T) *DB {
	t.Helper()
	url := os.Getenv("NYX_TEST_DB_URL")
	if url == "" {
		t.Skip("NYX_TEST_DB_URL not set; skipping DB integration test")
	}

	ctx := context.Background()
	d, err := Connect(ctx, url, 8, nil)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(d.Close)

	migDir := filepath.Join("..", "..", "db", "migrations")
	// Clean slate, apply up, schedule teardown.
	execFile(d, filepath.Join(migDir, "000001_init_schema.down.sql")) // best-effort
	mustExecFile(t, d, filepath.Join(migDir, "000001_init_schema.up.sql"))
	t.Cleanup(func() {
		execFile(d, filepath.Join(migDir, "000001_init_schema.down.sql"))
	})
	return d
}

func mustExecFile(t *testing.T, d *DB, path string) {
	t.Helper()
	sql, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	if _, err := d.Pool.Exec(context.Background(), string(sql)); err != nil {
		t.Fatalf("exec %s: %v", path, err)
	}
}

// execFile runs a SQL file best-effort (used for idempotent teardown).
func execFile(d *DB, path string) {
	sql, err := os.ReadFile(path)
	if err != nil {
		return
	}
	_, _ = d.Pool.Exec(context.Background(), string(sql))
}

// seedOrder inserts a minimal open order and returns its id.
func seedOrder(t *testing.T, d *DB, nullifier string) string {
	t.Helper()
	var id string
	err := d.Pool.QueryRow(context.Background(),
		`INSERT INTO orders (pubkey, asset_pair, side, encrypted_blob, price_hash, volume_hash, nullifier)
		 VALUES ('GTEST','USDC/TBILL','ask','\x01','ph','vh',$1) RETURNING id`, nullifier).Scan(&id)
	if err != nil {
		t.Fatalf("seed order: %v", err)
	}
	return id
}

// TestWithSerializableTxCommit: a successful fn commits its writes.
func TestWithSerializableTxCommit(t *testing.T) {
	d := testDB(t)
	ctx := context.Background()
	id := seedOrder(t, d, "nf-commit")

	err := d.WithSerializableTx(ctx, func(tx pgx.Tx) error {
		_, e := tx.Exec(ctx, `UPDATE orders SET status='matched' WHERE id=$1`, id)
		return e
	})
	if err != nil {
		t.Fatalf("tx: %v", err)
	}

	var status string
	if err := d.Pool.QueryRow(ctx, `SELECT status FROM orders WHERE id=$1`, id).Scan(&status); err != nil {
		t.Fatalf("read back: %v", err)
	}
	if status != "matched" {
		t.Fatalf("status = %q, want matched (commit did not persist)", status)
	}
}

// TestWithSerializableTxRollback: an fn that returns an error rolls back.
func TestWithSerializableTxRollback(t *testing.T) {
	d := testDB(t)
	ctx := context.Background()
	id := seedOrder(t, d, "nf-rollback")

	sentinel := errors.New("boom")
	err := d.WithSerializableTx(ctx, func(tx pgx.Tx) error {
		if _, e := tx.Exec(ctx, `UPDATE orders SET status='matched' WHERE id=$1`, id); e != nil {
			return e
		}
		return sentinel
	})
	if !errors.Is(err, sentinel) {
		t.Fatalf("err = %v, want sentinel", err)
	}

	var status string
	_ = d.Pool.QueryRow(ctx, `SELECT status FROM orders WHERE id=$1`, id).Scan(&status)
	if status != "open" {
		t.Fatalf("status = %q, want open (rollback failed)", status)
	}
}

// TestWithSerializableTxPanicRollsBack: a panic inside fn rolls back and the
// panic is re-raised to the caller.
func TestWithSerializableTxPanicRollsBack(t *testing.T) {
	d := testDB(t)
	ctx := context.Background()
	id := seedOrder(t, d, "nf-panic")

	func() {
		defer func() {
			if r := recover(); r == nil {
				t.Fatal("expected panic to propagate")
			}
		}()
		_ = d.WithSerializableTx(ctx, func(tx pgx.Tx) error {
			_, _ = tx.Exec(ctx, `UPDATE orders SET status='matched' WHERE id=$1`, id)
			panic("kaboom")
		})
	}()

	var status string
	_ = d.Pool.QueryRow(ctx, `SELECT status FROM orders WHERE id=$1`, id).Scan(&status)
	if status != "open" {
		t.Fatalf("status = %q, want open (panic did not roll back)", status)
	}
}

// TestSerializationConflict40001 is the key hardening test: two transactions
// both read the same open order then update it. Under SERIALIZABLE isolation
// exactly one must commit; the other must fail with SQLSTATE 40001. This proves
// the matcher's transaction discipline actually prevents double-matching.
func TestSerializationConflict40001(t *testing.T) {
	d := testDB(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	id := seedOrder(t, d, "nf-conflict")

	var readWg sync.WaitGroup
	readWg.Add(2)

	worker := func() error {
		return d.WithSerializableTx(ctx, func(tx pgx.Tx) error {
			// Read the row inside the transaction's snapshot.
			var status string
			if e := tx.QueryRow(ctx, `SELECT status FROM orders WHERE id=$1`, id).Scan(&status); e != nil {
				return e
			}
			// Barrier: ensure BOTH transactions have read before either writes.
			readWg.Done()
			readWg.Wait()
			// Both now attempt to claim the same order.
			_, e := tx.Exec(ctx, `UPDATE orders SET status='matched' WHERE id=$1`, id)
			return e
		})
	}

	errs := make([]error, 2)
	var runWg sync.WaitGroup
	runWg.Add(2)
	for i := 0; i < 2; i++ {
		go func(i int) { defer runWg.Done(); errs[i] = worker() }(i)
	}
	runWg.Wait()

	var nNil, n40001 int
	for _, e := range errs {
		if e == nil {
			nNil++
			continue
		}
		var pgErr *pgconn.PgError
		if errors.As(e, &pgErr) && pgErr.Code == "40001" {
			n40001++
		} else {
			t.Fatalf("unexpected error: %v", e)
		}
	}
	if nNil != 1 || n40001 != 1 {
		t.Fatalf("expected exactly 1 commit + 1 serialization failure (40001); got nil=%d 40001=%d", nNil, n40001)
	}
}
