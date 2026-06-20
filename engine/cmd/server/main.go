// Command server is the entrypoint for the Nyx off-chain engine process.
//
// Responsibilities at this phase:
//   - load & validate configuration from the environment,
//   - establish a health-checked PostgreSQL pool,
//   - start the HTTP API and the (stub) matcher under one cancellable context,
//   - shut everything down gracefully on SIGINT/SIGTERM.
//
// Hardening choices: structured logging via slog, strict context propagation,
// bounded shutdown, and fail-fast startup (non-zero exit on any init error).
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/nyx-darkpool/engine/internal/api"
	"github.com/nyx-darkpool/engine/internal/config"
	"github.com/nyx-darkpool/engine/internal/db"
	"github.com/nyx-darkpool/engine/internal/matcher"
)

func main() {
	// run() owns the real logic so we can return an error and centralize the
	// single os.Exit (deferred cleanup in run() still executes on failure).
	if err := run(); err != nil {
		slog.Error("fatal", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	logger := newLogger(cfg.LogLevel)
	slog.SetDefault(logger)
	logger.Info("starting nyx engine", "http_addr", cfg.HTTPAddr, "log_level", cfg.LogLevel)

	// Root context cancelled on SIGINT/SIGTERM — propagates to DB, API, matcher.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// --- Database --------------------------------------------------------
	connectCtx, cancel := context.WithTimeout(ctx, cfg.DBConnectTimeout)
	defer cancel()

	database, err := db.Connect(connectCtx, cfg.DatabaseURL, cfg.DBMaxConns, logger)
	if err != nil {
		return err
	}
	defer database.Close()

	// --- HTTP API --------------------------------------------------------
	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           api.NewServer(database, logger).Routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	var wg sync.WaitGroup

	// Matcher worker loop.
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := matcher.New(database, logger).Run(ctx); err != nil {
			logger.Error("matcher exited with error", "error", err)
		}
	}()

	// HTTP server.
	wg.Add(1)
	go func() {
		defer wg.Done()
		logger.Info("http server listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("http server error", "error", err)
			stop() // unrecoverable: trigger graceful shutdown of the process
		}
	}()

	// Block until a shutdown signal cancels the root context.
	<-ctx.Done()
	logger.Info("shutdown signal received, draining...")

	// Bounded graceful HTTP shutdown, independent of the (now-cancelled) root ctx.
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("http graceful shutdown failed", "error", err)
	}

	wg.Wait()
	logger.Info("shutdown complete")
	return nil
}

// newLogger builds a JSON slog logger at the configured level.
func newLogger(level string) *slog.Logger {
	var lvl slog.Level
	switch level {
	case "debug":
		lvl = slog.LevelDebug
	case "warn":
		lvl = slog.LevelWarn
	case "error":
		lvl = slog.LevelError
	default:
		lvl = slog.LevelInfo
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: lvl}))
}
