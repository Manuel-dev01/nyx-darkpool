package db

import (
	"context"
	"strings"
	"testing"
	"time"
)

// TestConnectBadDSN verifies a malformed connection string is rejected at parse
// time with a descriptive, wrapped error — before any network I/O.
func TestConnectBadDSN(t *testing.T) {
	_, err := Connect(context.Background(), "://not-a-valid-dsn", 4, nil)
	if err == nil {
		t.Fatal("Connect with malformed DSN expected error, got nil")
	}
	if !strings.Contains(err.Error(), "parse connection string") {
		t.Fatalf("expected parse error, got: %v", err)
	}
}

// TestConnectUnreachable verifies that a well-formed DSN pointing at a port with
// no server fails fast at the Ping step within the supplied context deadline.
// No database is required: the connection simply cannot be established.
func TestConnectUnreachable(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// 127.0.0.1:1 is a privileged port with nothing listening.
	_, err := Connect(ctx, "postgres://nyx:nyx@127.0.0.1:1/nyx?sslmode=disable&connect_timeout=1", 2, nil)
	if err == nil {
		t.Fatal("Connect to unreachable server expected error, got nil")
	}
	if !strings.Contains(err.Error(), "ping failed") {
		t.Fatalf("expected ping failure, got: %v", err)
	}
}
