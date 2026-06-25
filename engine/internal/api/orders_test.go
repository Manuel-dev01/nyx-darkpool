package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/nyx-darkpool/engine/internal/store"
)

// fakeStore is an in-memory OrderStore double.
type fakeStore struct {
	insertErr error
	lastID    string
	match     store.Match
	matchErr  error
}

func (f *fakeStore) InsertOrder(_ context.Context, _ store.InsertParams) (string, error) {
	if f.insertErr != nil {
		return "", f.insertErr
	}
	return f.lastID, nil
}
func (f *fakeStore) ListOrders(_ context.Context, _ int) ([]store.OrderSummary, error) {
	return []store.OrderSummary{{ID: "o1", AssetPair: "USDC/TBILL", Side: "ask", Status: "open"}}, nil
}
func (f *fakeStore) GetMatch(_ context.Context, _ string) (store.Match, error) {
	return f.match, f.matchErr
}

func newTestServer(st OrderStore) *Server {
	s := newServerWithPinger(stubPinger{}, quietLogger())
	s.store = st
	return s
}

func do(t *testing.T, s *Server, method, target, body string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	s.Routes().ServeHTTP(rec, req)
	return rec
}

const validOrder = `{"pubkey":"GABC","asset_pair":"USDC/TBILL","side":"ask","price":"100","volume":"50","salt":"7","commitment":"123","nullifier":"nf-1"}`

func TestCreateOrderOK(t *testing.T) {
	s := newTestServer(&fakeStore{lastID: "ord-123"})
	rec := do(t, s, http.MethodPost, "/orders", validOrder)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201 (%s)", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "ord-123") {
		t.Fatalf("body missing id: %s", rec.Body.String())
	}
}

func TestCreateOrderValidation(t *testing.T) {
	s := newTestServer(&fakeStore{})
	cases := map[string]string{
		"bad json":        `{`,
		"missing pubkey":  `{"asset_pair":"USDC/TBILL","side":"ask","commitment":"1","nullifier":"n"}`,
		"bad side":        `{"pubkey":"G","asset_pair":"P","side":"buy","commitment":"1","nullifier":"n"}`,
		"no commitment":   `{"pubkey":"G","asset_pair":"P","side":"ask","nullifier":"n"}`,
		"bad price (int)": `{"pubkey":"G","asset_pair":"P","side":"ask","price":"1.5","volume":"5","salt":"1","commitment":"1","nullifier":"n"}`,
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			rec := do(t, s, http.MethodPost, "/orders", body)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400 (%s)", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestCreateOrderDuplicate(t *testing.T) {
	s := newTestServer(&fakeStore{insertErr: store.ErrDuplicate})
	rec := do(t, s, http.MethodPost, "/orders", validOrder)
	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409", rec.Code)
	}
}

func TestGetMatchNotFound(t *testing.T) {
	s := newTestServer(&fakeStore{matchErr: pgx.ErrNoRows})
	rec := do(t, s, http.MethodGet, "/matches/nope", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

func TestGetMatchOK(t *testing.T) {
	s := newTestServer(&fakeStore{match: store.Match{ID: "m1", OnchainStatus: "pending"}})
	rec := do(t, s, http.MethodGet, "/matches/m1", "")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "m1") {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
}

func TestListOrdersOK(t *testing.T) {
	s := newTestServer(&fakeStore{})
	rec := do(t, s, http.MethodGet, "/orders", "")
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "o1") {
		t.Fatalf("status = %d body = %s", rec.Code, rec.Body.String())
	}
}

// Health-only server (nil store) returns 503 for order endpoints, not a panic.
func TestOrderEndpointsWithoutStore(t *testing.T) {
	s := newServerWithPinger(stubPinger{}, quietLogger())
	rec := do(t, s, http.MethodPost, "/orders", validOrder)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
}
