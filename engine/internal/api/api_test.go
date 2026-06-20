package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

// stubPinger is a test double for the Pinger dependency.
type stubPinger struct{ err error }

func (s stubPinger) Ping(context.Context) error { return s.err }

func quietLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func doHealth(t *testing.T, p Pinger) (int, map[string]string) {
	t.Helper()
	srv := newServerWithPinger(p, quietLogger())
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	srv.Routes().ServeHTTP(rec, req)

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("response body is not JSON: %v (%q)", err, rec.Body.String())
	}
	return rec.Code, body
}

// TestHealthzOK: when the DB ping succeeds, /healthz returns 200 and an "ok" body.
func TestHealthzOK(t *testing.T) {
	code, body := doHealth(t, stubPinger{err: nil})
	if code != http.StatusOK {
		t.Errorf("status = %d, want %d", code, http.StatusOK)
	}
	if body["status"] != "ok" || body["db"] != "up" {
		t.Errorf("body = %v, want status=ok db=up", body)
	}
}

// TestHealthzDBDown: when the DB ping fails, /healthz returns 503 and a
// "degraded" body — proving the probe reflects real connectivity.
func TestHealthzDBDown(t *testing.T) {
	code, body := doHealth(t, stubPinger{err: errors.New("connection refused")})
	if code != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want %d", code, http.StatusServiceUnavailable)
	}
	if body["status"] != "degraded" || body["db"] != "down" {
		t.Errorf("body = %v, want status=degraded db=down", body)
	}
}
