// Package matcher contains the off-chain order-matching engine.
//
// Phase 2 defines only the type skeleton and lifecycle contract; the concurrent
// worker-pool implementation (querying OPEN orders under SERIALIZABLE
// transactions, pairing compatible bids/asks, and routing ZK proof generation)
// lands in Phase 5.
package matcher

import (
	"context"
	"log/slog"

	"github.com/nyx-darkpool/engine/internal/db"
)

// Matcher pairs compatible resting orders into matches.
type Matcher struct {
	db     *db.DB
	logger *slog.Logger
}

// New constructs a Matcher bound to the database and logger.
func New(database *db.DB, logger *slog.Logger) *Matcher {
	return &Matcher{db: database, logger: logger}
}

// Run starts the matcher's worker loop and blocks until ctx is cancelled.
// Phase 2 stub: it simply waits for cancellation so the process lifecycle and
// graceful shutdown can be exercised end-to-end before the matching logic exists.
func (m *Matcher) Run(ctx context.Context) error {
	m.logger.Info("matcher started (phase 2 stub — pairing logic arrives in phase 5)")
	<-ctx.Done()
	m.logger.Info("matcher stopped", "reason", ctx.Err())
	return nil
}
