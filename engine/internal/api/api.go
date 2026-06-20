// Package api exposes the engine's HTTP surface.
//
// Phase 2 ships only the health/readiness endpoint backed by a DB ping; order
// ingestion and book queries are added in Phase 5 alongside the matcher.
package api

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/nyx-darkpool/engine/internal/db"
)

// Server holds the dependencies for the HTTP handlers.
type Server struct {
	db     *db.DB
	logger *slog.Logger
}

// NewServer wires the API handlers to their dependencies.
func NewServer(database *db.DB, logger *slog.Logger) *Server {
	return &Server{db: database, logger: logger}
}

// Routes returns the configured HTTP handler for the engine.
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.handleHealth)
	return mux
}

// handleHealth reports readiness, including live database connectivity. The
// request context bounds the DB ping so a slow database cannot hang the probe.
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	status := http.StatusOK
	body := map[string]string{"status": "ok", "db": "up"}

	if err := s.db.Ping(r.Context()); err != nil {
		s.logger.Warn("health check: db ping failed", "error", err)
		status = http.StatusServiceUnavailable
		body["status"] = "degraded"
		body["db"] = "down"
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
