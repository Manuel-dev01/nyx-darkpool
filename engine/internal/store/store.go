// Package store is the engine's data-access layer over the orders/matches
// schema. It centralizes the SQL the matcher and API depend on, and encodes the
// transactional discipline that makes concurrent matching safe.
//
// The critical method is CreateMatch: it pairs two orders inside a SERIALIZABLE
// transaction and guards the status transition, so two workers racing the same
// resting order can never both win — the loser gets ErrAlreadyMatched (a no-op
// to skip) or ErrSerialization (a transient 40001 to retry). The DB's
// UNIQUE(maker_order_id)/UNIQUE(taker_order_id) constraints are the backstop.
package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/nyx-darkpool/engine/internal/db"
	"github.com/nyx-darkpool/engine/internal/order"
	"github.com/nyx-darkpool/engine/internal/secret"
)

// Sentinel errors callers branch on.
var (
	// ErrAlreadyMatched: one/both orders were no longer open (lost the race or
	// the unique constraint rejected the pair). The matcher skips and moves on.
	ErrAlreadyMatched = errors.New("store: order already matched")
	// ErrSerialization: SQLSTATE 40001 — a concurrent transaction conflicted.
	// Expected under contention; the caller retries the unit of work.
	ErrSerialization = errors.New("store: serialization conflict (40001)")
	// ErrDuplicate: a unique constraint (e.g. nullifier) rejected the insert.
	ErrDuplicate = errors.New("store: duplicate (unique violation)")
)

// Store wraps the connection pool with typed order/match operations.
type Store struct {
	db     *db.DB
	cipher *secret.Cipher // at-rest encryption for encrypted_blob; nil => plaintext
}

// New constructs a Store over the given database handle. The optional cipher
// encrypts/decrypts orders.encrypted_blob at rest; pass nil to store plaintext
// (a nil *secret.Cipher passes data through unchanged).
func New(d *db.DB, cipher *secret.Cipher) *Store { return &Store{db: d, cipher: cipher} }

// InsertParams describes a new order. Commitment is the client-sealed Poseidon
// hash; Payload holds the raw values the engine needs to match and prove.
type InsertParams struct {
	Pubkey     string
	AssetPair  string
	Side       order.Side
	Payload    order.Payload
	Commitment string
	Nullifier  string
	PriceHash  string // optional; defaults to Commitment (schema requires non-blank)
	VolumeHash string // optional; defaults to Commitment
}

// InsertOrder stores a new resting order and returns its id. A nullifier
// collision surfaces as ErrDuplicate.
func (s *Store) InsertOrder(ctx context.Context, p InsertParams) (string, error) {
	plain, err := order.Encode(p.Payload)
	if err != nil {
		return "", err
	}
	blob := s.cipher.Seal(plain) // at-rest encryption (no-op when cipher is nil)
	priceHash := orDefault(p.PriceHash, p.Commitment)
	volumeHash := orDefault(p.VolumeHash, p.Commitment)

	var id string
	err = s.db.Pool.QueryRow(ctx,
		`INSERT INTO orders
		   (pubkey, asset_pair, side, encrypted_blob, price_hash, volume_hash, nullifier, order_commitment)
		 VALUES ($1,$2,$3::order_side,$4,$5,$6,$7,$8)
		 RETURNING id`,
		p.Pubkey, p.AssetPair, string(p.Side), blob, priceHash, volumeHash, p.Nullifier, p.Commitment,
	).Scan(&id)
	if err != nil {
		if isUnique(err) {
			return "", ErrDuplicate
		}
		return "", fmt.Errorf("store: insert order: %w", err)
	}
	return id, nil
}

// OpenPairs returns the distinct asset pairs that currently have open orders.
func (s *Store) OpenPairs(ctx context.Context) ([]string, error) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT DISTINCT asset_pair FROM orders WHERE status='open'`)
	if err != nil {
		return nil, fmt.Errorf("store: open pairs: %w", err)
	}
	defer rows.Close()
	var pairs []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		pairs = append(pairs, p)
	}
	return pairs, rows.Err()
}

// OpenOrdersByPair loads open orders for one asset pair in FIFO (price-time)
// order. Orders missing a commitment or with an undecodable payload are skipped
// (they cannot be matched/proven) rather than failing the whole scan.
func (s *Store) OpenOrdersByPair(ctx context.Context, pair string) ([]order.Order, error) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT id, pubkey, asset_pair, side, COALESCE(order_commitment,''), encrypted_blob
		   FROM orders
		  WHERE asset_pair=$1 AND status='open'
		  ORDER BY created_at, id`, pair)
	if err != nil {
		return nil, fmt.Errorf("store: open orders by pair: %w", err)
	}
	defer rows.Close()

	var out []order.Order
	for rows.Next() {
		var (
			o    order.Order
			side string
			blob []byte
		)
		if err := rows.Scan(&o.ID, &o.Pubkey, &o.AssetPair, &side, &o.Commitment, &blob); err != nil {
			return nil, err
		}
		o.Side = order.Side(side)
		if o.Commitment == "" {
			continue
		}
		payload, err := s.decodeBlob(blob)
		if err != nil {
			continue
		}
		o.Payload = payload
		out = append(out, o)
	}
	return out, rows.Err()
}

// CreateMatch pairs maker (ask) and taker (bid) atomically under SERIALIZABLE
// isolation, guarding the open→matched transition. Returns the new match id, or
// ErrAlreadyMatched / ErrSerialization on a lost race / conflict.
func (s *Store) CreateMatch(ctx context.Context, makerID, takerID string) (string, error) {
	var matchID string
	err := s.db.WithSerializableTx(ctx, func(tx pgx.Tx) error {
		ct, e := tx.Exec(ctx,
			`UPDATE orders SET status='matched' WHERE id = ANY($1) AND status='open'`,
			[]string{makerID, takerID})
		if e != nil {
			return e
		}
		if ct.RowsAffected() != 2 {
			return ErrAlreadyMatched // one or both already taken
		}
		return tx.QueryRow(ctx,
			`INSERT INTO matches (maker_order_id, taker_order_id) VALUES ($1,$2) RETURNING id`,
			makerID, takerID).Scan(&matchID)
	})
	switch {
	case err == nil:
		return matchID, nil
	case errors.Is(err, ErrAlreadyMatched):
		return "", ErrAlreadyMatched
	case isSerialization(err):
		return "", ErrSerialization
	case isUnique(err):
		return "", ErrAlreadyMatched
	default:
		return "", fmt.Errorf("store: create match: %w", err)
	}
}

// UnprovenMatchIDs returns matches that still need a proof (proof_blob IS NULL),
// oldest first, capped at limit.
func (s *Store) UnprovenMatchIDs(ctx context.Context, limit int) ([]string, error) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT id FROM matches WHERE proof_blob IS NULL ORDER BY created_at LIMIT $1`, limit)
	if err != nil {
		return nil, fmt.Errorf("store: unproven matches: %w", err)
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// MatchOrders loads the maker and taker orders behind a match (for proving).
func (s *Store) MatchOrders(ctx context.Context, matchID string) (maker, taker order.Order, err error) {
	var makerID, takerID string
	if err = s.db.Pool.QueryRow(ctx,
		`SELECT maker_order_id, taker_order_id FROM matches WHERE id=$1`, matchID).
		Scan(&makerID, &takerID); err != nil {
		return maker, taker, fmt.Errorf("store: match orders: %w", err)
	}
	if maker, err = s.orderByID(ctx, makerID); err != nil {
		return maker, taker, err
	}
	taker, err = s.orderByID(ctx, takerID)
	return maker, taker, err
}

func (s *Store) orderByID(ctx context.Context, id string) (order.Order, error) {
	var (
		o    order.Order
		side string
		blob []byte
	)
	if err := s.db.Pool.QueryRow(ctx,
		`SELECT id, pubkey, asset_pair, side, COALESCE(order_commitment,''), encrypted_blob
		   FROM orders WHERE id=$1`, id).
		Scan(&o.ID, &o.Pubkey, &o.AssetPair, &side, &o.Commitment, &blob); err != nil {
		return o, fmt.Errorf("store: order by id: %w", err)
	}
	o.Side = order.Side(side)
	payload, err := s.decodeBlob(blob)
	if err != nil {
		return o, err
	}
	o.Payload = payload
	return o, nil
}

// decodeBlob reverses InsertOrder's encoding: decrypt at rest (no-op when the
// cipher is nil or the row is legacy plaintext), then JSON-decode the payload.
func (s *Store) decodeBlob(blob []byte) (order.Payload, error) {
	plain, err := s.cipher.Open(blob)
	if err != nil {
		return order.Payload{}, err
	}
	return order.Decode(plain)
}

// SetProof stores the serialized Groth16 proof for a match.
func (s *Store) SetProof(ctx context.Context, matchID string, proof []byte) error {
	_, err := s.db.Pool.Exec(ctx, `UPDATE matches SET proof_blob=$1 WHERE id=$2`, proof, matchID)
	if err != nil {
		return fmt.Errorf("store: set proof: %w", err)
	}
	return nil
}

// SetOnchain records the on-chain settlement outcome. tx is truncated to the
// settlement_tx column width and stored as NULL when empty.
func (s *Store) SetOnchain(ctx context.Context, matchID, status, tx string) error {
	if len(tx) > 64 {
		tx = tx[:64]
	}
	_, err := s.db.Pool.Exec(ctx,
		`UPDATE matches SET onchain_status=$1::onchain_status, settlement_tx=NULLIF($2,'') WHERE id=$3`,
		status, tx, matchID)
	if err != nil {
		return fmt.Errorf("store: set onchain: %w", err)
	}
	return nil
}

// Match is a read view of a settlement record for the API.
type Match struct {
	ID            string    `json:"id"`
	MakerOrderID  string    `json:"maker_order_id"`
	TakerOrderID  string    `json:"taker_order_id"`
	HasProof      bool      `json:"has_proof"`
	OnchainStatus string    `json:"onchain_status"`
	SettlementTx  string    `json:"settlement_tx,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

// GetMatch returns a single match view by id.
func (s *Store) GetMatch(ctx context.Context, id string) (Match, error) {
	var m Match
	err := s.db.Pool.QueryRow(ctx,
		`SELECT id, maker_order_id, taker_order_id, (proof_blob IS NOT NULL),
		        onchain_status, COALESCE(settlement_tx,''), created_at
		   FROM matches WHERE id=$1`, id).
		Scan(&m.ID, &m.MakerOrderID, &m.TakerOrderID, &m.HasProof, &m.OnchainStatus, &m.SettlementTx, &m.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Match{}, pgx.ErrNoRows
	}
	if err != nil {
		return Match{}, fmt.Errorf("store: get match: %w", err)
	}
	return m, nil
}

// OrderSummary is a read view of an order for the API (no private payload).
type OrderSummary struct {
	ID         string    `json:"id"`
	Pubkey     string    `json:"pubkey"`
	AssetPair  string    `json:"asset_pair"`
	Side       string    `json:"side"`
	Commitment string    `json:"commitment"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}

// ListOrders returns the most recent orders (no private values), capped at limit.
func (s *Store) ListOrders(ctx context.Context, limit int) ([]OrderSummary, error) {
	rows, err := s.db.Pool.Query(ctx,
		`SELECT id, pubkey, asset_pair, side, COALESCE(order_commitment,''), status, created_at
		   FROM orders ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, fmt.Errorf("store: list orders: %w", err)
	}
	defer rows.Close()
	out := []OrderSummary{}
	for rows.Next() {
		var o OrderSummary
		if err := rows.Scan(&o.ID, &o.Pubkey, &o.AssetPair, &o.Side, &o.Commitment, &o.Status, &o.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}
	return v
}

func isSerialization(err error) bool { return pgCode(err) == "40001" }
func isUnique(err error) bool        { return pgCode(err) == "23505" }

func pgCode(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}
