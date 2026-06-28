// Package matcher contains the off-chain order-matching engine (Phase 5).
//
// Architecture (CLAUDE.md §2.2: "worker pools with Go channels to batch
// executions"):
//
//	┌── poll loop (ticker) ──────────────────────────────────────────────┐
//	│  matchOnce: per asset pair, pair crossing ask/bid under a           │
//	│  SERIALIZABLE tx (store.CreateMatch) — 40001/unique races are safe  │
//	│  dispatch: enqueue every unproven match id (new + crash-recovered)  │
//	└──────────────────────────────┬─────────────────────────────────────┘
//	                                ▼ jobs channel
//	   worker pool ×N : prove.Generate → store.SetProof
//	                    → (if on-chain enabled) verify_and_settle → SetOnchain
//
// Correctness under concurrency rests on the database, not in-memory locks: two
// workers (or two engine processes) that race the same resting order both try to
// flip it open→matched inside a SERIALIZABLE transaction, and the
// UNIQUE(maker_order_id)/UNIQUE(taker_order_id) constraints are the backstop — at
// most one wins; the loser gets ErrAlreadyMatched/ErrSerialization and skips.
//
// Crash-safety: matches are dispatched for proving by scanning the DB for
// proof_blob IS NULL, so a proof interrupted by shutdown is simply retried on the
// next tick (or next process start) — nothing is lost to an in-memory queue.
package matcher

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/nyx-darkpool/engine/internal/onchain"
	"github.com/nyx-darkpool/engine/internal/order"
	"github.com/nyx-darkpool/engine/internal/prove"
	"github.com/nyx-darkpool/engine/internal/store"
)

// maxProofAttempts bounds retries for a match whose witness never satisfies the
// circuit (e.g. a client whose sealed commitment != Poseidon(price,volume,salt)).
// After this many failures the match is abandoned rather than hot-looped.
const maxProofAttempts = 3

// Config tunes the matcher's concurrency and cadence.
type Config struct {
	Workers      int
	PollInterval time.Duration
	BatchSize    int // max unproven matches dispatched per tick
}

// Prover is the proof-generation dependency (satisfied by *prove.Prover). It is
// an interface so the matcher can run with proving disabled (nil) and so tests
// can inject a fake.
type Prover interface {
	Generate(ctx context.Context, in prove.Input) (prove.Result, error)
	ToHexProof(ctx context.Context, r prove.Result) (onchain.Proof, error)
}

// Matcher pairs compatible resting orders and routes their proofs.
type Matcher struct {
	store   *store.Store
	prover  Prover // nil => proving disabled (matches still form)
	onchain onchain.Config
	cfg     Config
	logger  *slog.Logger

	inflight  sync.Map // match id -> struct{}{} : dispatched, not yet finished
	failures  sync.Map // match id -> int        : consecutive prove/settle failures
	abandoned sync.Map // match id -> struct{}{} : abandon already logged (log once)
}

// proofTimeout bounds a single snarkjs proof generation so a hung/pathological
// witness calc can't pin a worker forever.
const proofTimeout = 120 * time.Second

// New constructs a Matcher. prover may be nil to disable proof generation.
func New(st *store.Store, prover Prover, oc onchain.Config, cfg Config, logger *slog.Logger) *Matcher {
	if logger == nil {
		logger = slog.Default()
	}
	if cfg.Workers < 1 {
		cfg.Workers = 1
	}
	if cfg.PollInterval <= 0 {
		cfg.PollInterval = time.Second
	}
	if cfg.BatchSize < 1 {
		cfg.BatchSize = 64
	}
	return &Matcher{store: st, prover: prover, onchain: oc, cfg: cfg, logger: logger}
}

// Run starts the worker pool and poll loop, blocking until ctx is cancelled. On
// shutdown it stops enqueuing, closes the jobs channel, and waits for workers to
// drain (an in-flight proof is aborted via ctx and retried next start).
func (m *Matcher) Run(ctx context.Context) error {
	m.logger.Info("matcher started",
		"workers", m.cfg.Workers,
		"poll_interval", m.cfg.PollInterval,
		"proving", m.prover != nil,
		"onchain", m.onchain.Enabled,
	)

	jobs := make(chan string, m.cfg.Workers*2+1)
	var wg sync.WaitGroup
	for i := 0; i < m.cfg.Workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for id := range jobs {
				m.proveAndSettle(ctx, id)
				m.inflight.Delete(id)
			}
		}()
	}

	ticker := time.NewTicker(m.cfg.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			close(jobs)
			wg.Wait()
			m.logger.Info("matcher stopped", "reason", ctx.Err())
			return nil
		case <-ticker.C:
			m.tick(ctx, jobs)
		}
	}
}

// tick runs one match cycle and dispatches unproven matches to the workers.
func (m *Matcher) tick(ctx context.Context, jobs chan<- string) {
	if n := m.matchOnce(ctx); n > 0 {
		m.logger.Debug("matched orders this cycle", "count", n)
	}

	// With on-chain settlement on, dispatch every match not yet CONFIRMED so a
	// proven-but-unsettled match (engine restarted mid-settle, or a transient
	// settle failure) is retried — not stuck "verifying on-chain" forever. With
	// on-chain off, proving is the terminal step, so scan unproven matches only.
	var ids []string
	var err error
	if m.onchain.Enabled {
		ids, err = m.store.UnsettledMatchIDs(ctx, m.cfg.BatchSize)
	} else {
		ids, err = m.store.UnprovenMatchIDs(ctx, m.cfg.BatchSize)
	}
	if err != nil {
		m.logger.Error("scan matches to process", "error", err)
		return
	}
	for _, id := range ids {
		if m.attempts(id) >= maxProofAttempts {
			if _, seen := m.abandoned.LoadOrStore(id, struct{}{}); !seen {
				m.logger.Error("match abandoned after repeated failures", "match_id", id, "attempts", m.attempts(id))
			}
			continue // abandoned (until restart resets the counter)
		}
		if _, loaded := m.inflight.LoadOrStore(id, struct{}{}); loaded {
			continue // already dispatched
		}
		select {
		case jobs <- id:
		case <-ctx.Done():
			m.inflight.Delete(id)
			return
		}
	}
}

// matchOnce pairs all crossing ask/bid orders it can find, returning the number
// of new matches created.
func (m *Matcher) matchOnce(ctx context.Context) int {
	pairs, err := m.store.OpenPairs(ctx)
	if err != nil {
		m.logger.Error("list open pairs", "error", err)
		return 0
	}
	created := 0
	for _, pair := range pairs {
		orders, err := m.store.OpenOrdersByPair(ctx, pair)
		if err != nil {
			m.logger.Error("load open orders", "pair", pair, "error", err)
			continue
		}
		for _, mp := range pairOrders(orders) {
			id, err := m.store.CreateMatch(ctx, mp.MakerID, mp.TakerID)
			switch {
			case err == nil:
				created++
				m.logger.Info("match created", "match_id", id, "pair", pair, "maker", mp.MakerID, "taker", mp.TakerID)
			case errors.Is(err, store.ErrAlreadyMatched), errors.Is(err, store.ErrSerialization):
				// Lost a race / transient conflict — fine, retried next cycle.
			default:
				m.logger.Error("create match", "error", err)
			}
		}
	}
	return created
}

// proveAndSettle generates the proof for a match and, when configured, settles it
// on-chain. Failures are logged and counted; the match stays unproven and is
// retried until maxProofAttempts.
func (m *Matcher) proveAndSettle(ctx context.Context, matchID string) {
	if m.prover == nil {
		return // proving disabled; match remains unproven
	}

	maker, taker, err := m.store.MatchOrders(ctx, matchID)
	if err != nil {
		// Most likely an undecodable blob (lost ephemeral key on restart). Count
		// it so a permanently un-loadable match is abandoned, not hot-looped every
		// tick — and so the abandon is surfaced.
		n := m.bumpFailure(matchID)
		m.logger.Log(ctx, failLevel(n), "load match orders failed", "match_id", matchID, "attempt", n, "error", err)
		return
	}

	// Bound a single proof so a hung snarkjs can't pin this worker indefinitely.
	genCtx, cancel := context.WithTimeout(ctx, proofTimeout)
	res, err := m.prover.Generate(genCtx, prove.InputFor(maker, taker))
	cancel()
	if err != nil {
		n := m.bumpFailure(matchID)
		m.logger.Log(ctx, failLevel(n), "proof generation failed", "match_id", matchID, "attempt", n, "error", err)
		return
	}

	if err := m.store.SetProof(ctx, matchID, res.ProofJSON); err != nil {
		m.logger.Error("store proof", "match_id", matchID, "error", err)
		return
	}
	m.logger.Info("proof generated", "match_id", matchID, "bytes", len(res.ProofJSON))

	if !m.onchain.Enabled {
		m.failures.Delete(matchID) // proof is the terminal success when on-chain is off
		return
	}
	// On-chain is the terminal step: keep the failure counter until confirmed, so
	// settle retries are bounded across ticks (settleOnchain clears it on success).
	m.settleOnchain(ctx, matchID, res)
}

// failLevel escalates a retry log from warn to error once the attempt cap is hit.
func failLevel(attempt int) slog.Level {
	if attempt >= maxProofAttempts {
		return slog.LevelError
	}
	return slog.LevelWarn
}

// settleOnchain converts the proof to BN254 bytes and invokes the deployed
// Soroban verify_and_settle, recording the outcome. It is idempotent and
// retry-safe: it first checks the contract's is_settled (so a prior attempt's
// landed tx isn't double-submitted), marks 'submitted' only just before the call,
// and on failure bumps the shared attempt counter so retries are bounded.
func (m *Matcher) settleOnchain(ctx context.Context, matchID string, res prove.Result) {
	fail := func(stage string, err error) {
		n := m.bumpFailure(matchID)
		m.logger.Log(ctx, failLevel(n), "on-chain settle failed", "match_id", matchID, "stage", stage, "attempt", n, "error", err)
		_ = m.store.SetOnchain(ctx, matchID, "failed", "")
	}

	submitter, err := m.onchain.ResolveAddress(ctx)
	if err != nil {
		fail("resolve-address", err)
		return
	}
	hexProof, err := m.prover.ToHexProof(ctx, res)
	if err != nil {
		fail("to-hex", err)
		return
	}

	// Idempotency: if this match already settled on-chain (a prior attempt's tx
	// landed but we crashed/failed before recording it), don't re-submit — that
	// would hit the contract's AlreadySettled anti-replay. Record confirmed.
	if len(hexProof.Public) >= 2 {
		if done, e := m.onchain.IsSettled(ctx, hexProof.Public[0], hexProof.Public[1]); e == nil && done {
			m.failures.Delete(matchID)
			if err := m.store.SetOnchain(ctx, matchID, "confirmed", ""); err != nil {
				m.logger.Error("record settlement", "match_id", matchID, "error", err)
				return
			}
			m.logger.Info("on-chain already settled (idempotent re-check)", "match_id", matchID)
			return
		}
	}

	_ = m.store.SetOnchain(ctx, matchID, "submitted", "")
	tx, err := m.onchain.VerifyAndSettle(ctx, submitter, hexProof)
	if err != nil {
		fail("verify-and-settle", err)
		return
	}
	m.failures.Delete(matchID)
	if err := m.store.SetOnchain(ctx, matchID, "confirmed", tx); err != nil {
		m.logger.Error("record settlement", "match_id", matchID, "error", err)
		return
	}
	m.logger.Info("settled on-chain", "match_id", matchID, "tx", tx)
}

func (m *Matcher) attempts(id string) int {
	if v, ok := m.failures.Load(id); ok {
		return v.(int)
	}
	return 0
}

func (m *Matcher) bumpFailure(id string) int {
	n := m.attempts(id) + 1
	m.failures.Store(id, n)
	return n
}

// matchPair is an (ask, bid) pairing: ask is the maker, bid is the taker, so the
// circuit's maker_price <= taker_price holds for a cross.
type matchPair struct {
	MakerID string // ask
	TakerID string // bid
}

// pairOrders greedily pairs crossing orders in FIFO (price-time) order: each ask,
// in arrival order, takes the earliest unused bid that crosses (bid price >= ask
// price) at equal volume (full-fill model). Each order is used at most once.
// Pure and deterministic — unit-tested without a database.
func pairOrders(orders []order.Order) []matchPair {
	var asks, bids []order.Order
	for _, o := range orders {
		switch o.Side {
		case order.Ask:
			asks = append(asks, o)
		case order.Bid:
			bids = append(bids, o)
		}
	}

	used := make([]bool, len(bids))
	var pairs []matchPair
	for _, ask := range asks {
		ap, ok1 := ask.Payload.PriceInt()
		av, ok2 := ask.Payload.VolumeInt()
		if !ok1 || !ok2 {
			continue
		}
		for j := range bids {
			if used[j] {
				continue
			}
			bp, ok3 := bids[j].Payload.PriceInt()
			bv, ok4 := bids[j].Payload.VolumeInt()
			if !ok3 || !ok4 {
				continue
			}
			// cross: ask price <= bid price, equal volume.
			if ap.Cmp(bp) <= 0 && av.Cmp(bv) == 0 {
				pairs = append(pairs, matchPair{MakerID: ask.ID, TakerID: bids[j].ID})
				used[j] = true
				break
			}
		}
	}
	return pairs
}
