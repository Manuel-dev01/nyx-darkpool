// Package api exposes the engine's HTTP surface: a health/readiness probe plus
// the Phase-5 order intake and read endpoints the matcher feeds on.
package api

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/nyx-darkpool/engine/internal/db"
	"github.com/nyx-darkpool/engine/internal/order"
	"github.com/nyx-darkpool/engine/internal/store"
)

// Pinger is the minimal database dependency the health handler needs: a
// context-bounded connectivity check. *db.DB satisfies it. Depending on this
// narrow interface keeps the handlers unit-testable without a live database.
type Pinger interface {
	Ping(ctx context.Context) error
}

// OrderStore is the data-access surface the order/match handlers depend on.
// *store.Store satisfies it; tests can inject a fake.
type OrderStore interface {
	InsertOrder(ctx context.Context, p store.InsertParams) (string, error)
	ListOrders(ctx context.Context, limit int) ([]store.OrderSummary, error)
	GetMatch(ctx context.Context, id string) (store.Match, error)
}

// Server holds the dependencies for the HTTP handlers.
type Server struct {
	db     Pinger
	store  OrderStore // nil in health-only mode (e.g. unit tests)
	logger *slog.Logger
}

// NewServer wires the API to its dependencies. *db.DB satisfies Pinger and
// *store.Store satisfies OrderStore.
func NewServer(database *db.DB, st OrderStore, logger *slog.Logger) *Server {
	s := newServerWithPinger(database, logger)
	s.store = st
	return s
}

// newServerWithPinger is the internal constructor used by tests to inject a fake
// Pinger (health-only; store is nil).
func newServerWithPinger(p Pinger, logger *slog.Logger) *Server {
	return &Server{db: p, logger: logger}
}

// Routes returns the configured HTTP handler for the engine.
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.handleHealth)
	mux.HandleFunc("POST /orders", s.handleCreateOrder)
	mux.HandleFunc("GET /orders", s.handleListOrders)
	mux.HandleFunc("GET /matches/{id}", s.handleGetMatch)
	return mux
}

// handleHealth reports readiness, including live database connectivity.
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	status := http.StatusOK
	body := map[string]string{"status": "ok", "db": "up"}

	if err := s.db.Ping(r.Context()); err != nil {
		s.logger.Warn("health check: db ping failed", "error", err)
		status = http.StatusServiceUnavailable
		body["status"] = "degraded"
		body["db"] = "down"
	}
	writeJSON(w, status, body)
}

// createOrderRequest is the POST /orders body. The client seals its order
// locally and submits the commitment + the raw values (which the trusted
// off-chain engine needs to match and prove). price/volume/salt are base-10
// integer strings.
type createOrderRequest struct {
	Pubkey     string `json:"pubkey"`
	AssetPair  string `json:"asset_pair"`
	Side       string `json:"side"`
	Price      string `json:"price"`
	Volume     string `json:"volume"`
	Salt       string `json:"salt"`
	Commitment string `json:"commitment"`
	Nullifier  string `json:"nullifier"`
}

func (s *Server) handleCreateOrder(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		writeJSON(w, http.StatusServiceUnavailable, errBody("order store unavailable"))
		return
	}
	var req createOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, errBody("invalid JSON body"))
		return
	}

	side := order.Side(req.Side)
	switch {
	case req.Pubkey == "" || req.AssetPair == "":
		writeJSON(w, http.StatusBadRequest, errBody("pubkey and asset_pair are required"))
		return
	case !side.Valid():
		writeJSON(w, http.StatusBadRequest, errBody(`side must be "bid" or "ask"`))
		return
	case req.Commitment == "" || req.Nullifier == "":
		writeJSON(w, http.StatusBadRequest, errBody("commitment and nullifier are required"))
		return
	}

	payload := order.Payload{Price: req.Price, Volume: req.Volume, Salt: req.Salt}
	if err := payload.Validate(); err != nil {
		writeJSON(w, http.StatusBadRequest, errBody(err.Error()))
		return
	}

	id, err := s.store.InsertOrder(r.Context(), store.InsertParams{
		Pubkey:     req.Pubkey,
		AssetPair:  req.AssetPair,
		Side:       side,
		Payload:    payload,
		Commitment: req.Commitment,
		Nullifier:  req.Nullifier,
	})
	switch {
	case errors.Is(err, store.ErrDuplicate):
		writeJSON(w, http.StatusConflict, errBody("nullifier already used"))
		return
	case err != nil:
		// order.Encode rejects non-integer price/volume/salt as a bad request;
		// everything else is a server error.
		s.logger.Warn("create order failed", "error", err)
		writeJSON(w, http.StatusBadRequest, errBody(err.Error()))
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (s *Server) handleListOrders(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		writeJSON(w, http.StatusServiceUnavailable, errBody("order store unavailable"))
		return
	}
	limit := 100
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 1000 {
			limit = n
		}
	}
	orders, err := s.store.ListOrders(r.Context(), limit)
	if err != nil {
		s.logger.Error("list orders", "error", err)
		writeJSON(w, http.StatusInternalServerError, errBody("failed to list orders"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"orders": orders})
}

func (s *Server) handleGetMatch(w http.ResponseWriter, r *http.Request) {
	if s.store == nil {
		writeJSON(w, http.StatusServiceUnavailable, errBody("order store unavailable"))
		return
	}
	id := r.PathValue("id")
	match, err := s.store.GetMatch(r.Context(), id)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		writeJSON(w, http.StatusNotFound, errBody("match not found"))
		return
	case err != nil:
		s.logger.Error("get match", "id", id, "error", err)
		writeJSON(w, http.StatusInternalServerError, errBody("failed to load match"))
		return
	}
	writeJSON(w, http.StatusOK, match)
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func errBody(msg string) map[string]string { return map[string]string{"error": msg} }
