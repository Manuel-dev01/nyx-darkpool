package api

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/nyx-darkpool/engine/internal/stellarkey"
)

// newSignedTestServer is a fake-store server that enforces order signatures.
func newSignedTestServer(st OrderStore) *Server {
	s := newServerWithPinger(stubPinger{}, quietLogger())
	s.store = st
	s.requireOrderSig = true
	return s
}

// signedOrderBody mints a keypair and returns a POST /orders body signed over
// the commitment, plus the derived G-address.
func signedOrderBody(t *testing.T, commitment string) (body, pubkey string) {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	addr, err := stellarkey.Encode(pub)
	if err != nil {
		t.Fatal(err)
	}
	sig := base64.StdEncoding.EncodeToString(ed25519.Sign(priv, []byte(commitment)))
	b, _ := json.Marshal(map[string]string{
		"pubkey": addr, "asset_pair": "USDC/TBILL", "side": "ask",
		"price": "100", "volume": "50", "salt": "7",
		"commitment": commitment, "nullifier": "nf-sig", "signature": sig,
	})
	return string(b), addr
}

func TestCreateOrder_SignedAccepted(t *testing.T) {
	s := newSignedTestServer(&fakeStore{lastID: "ord-signed"})
	body, _ := signedOrderBody(t, "12345678901234567890")
	rec := do(t, s, http.MethodPost, "/orders", body)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201 (%s)", rec.Code, rec.Body.String())
	}
}

func TestCreateOrder_TamperedSignatureRejected(t *testing.T) {
	s := newSignedTestServer(&fakeStore{lastID: "ord-x"})
	body, _ := signedOrderBody(t, "999")
	// Corrupt the signature field's first base64 char.
	tampered := strings.Replace(body, `"signature":"`, `"signature":"A`, 1)
	rec := do(t, s, http.MethodPost, "/orders", tampered)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401 for tampered sig (%s)", rec.Code, rec.Body.String())
	}
}

func TestCreateOrder_MissingSignatureRequired(t *testing.T) {
	s := newSignedTestServer(&fakeStore{lastID: "ord-x"})
	// validOrder (from orders_test.go) carries no signature.
	rec := do(t, s, http.MethodPost, "/orders", validOrder)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401 when signature required (%s)", rec.Code, rec.Body.String())
	}
}

func TestCreateOrder_WrongSignerRejected(t *testing.T) {
	s := newSignedTestServer(&fakeStore{lastID: "ord-x"})
	// Sign with one key but claim a different pubkey.
	_, priv, _ := ed25519.GenerateKey(rand.Reader)
	otherPub, _, _ := ed25519.GenerateKey(rand.Reader)
	otherAddr, _ := stellarkey.Encode(otherPub)
	commitment := "42"
	sig := base64.StdEncoding.EncodeToString(ed25519.Sign(priv, []byte(commitment)))
	b, _ := json.Marshal(map[string]string{
		"pubkey": otherAddr, "asset_pair": "P", "side": "ask",
		"price": "1", "volume": "1", "salt": "1",
		"commitment": commitment, "nullifier": "n", "signature": sig,
	})
	rec := do(t, s, http.MethodPost, "/orders", string(b))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401 for wrong signer (%s)", rec.Code, rec.Body.String())
	}
}

// Unsigned orders still pass when the server does NOT require signatures
// (default), preserving the dev/seed path.
func TestCreateOrder_UnsignedAllowedWhenNotRequired(t *testing.T) {
	s := newTestServer(&fakeStore{lastID: "ord-u"})
	rec := do(t, s, http.MethodPost, "/orders", validOrder)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201 (%s)", rec.Code, rec.Body.String())
	}
}

// --- stellarkey codec coverage (runs inside api.test.exe) ---------------------

func TestStellarKeyCodec(t *testing.T) {
	// Known-good real testnet address: pins version byte + CRC16 against the spec.
	const known = "GAW2WLHI5YHCE7FMB4TB7MLE2RIKQGOTPMC2NV66KKFTX6LGYMNT3YRK"
	pub, err := stellarkey.Decode(known)
	if err != nil {
		t.Fatalf("Decode(known): %v", err)
	}
	back, err := stellarkey.Encode(pub)
	if err != nil {
		t.Fatal(err)
	}
	if back != known {
		t.Fatalf("Encode(Decode(known)) = %q, want %q", back, known)
	}
	// Corruption is rejected.
	if _, err := stellarkey.Decode(known[:len(known)-1] + "A"); err == nil {
		t.Error("Decode accepted a corrupted address")
	}
	if _, err := stellarkey.Decode("GABC"); err == nil {
		t.Error("Decode accepted a too-short address")
	}
	// Sign/verify round-trip.
	gpub, gpriv, _ := ed25519.GenerateKey(rand.Reader)
	addr, _ := stellarkey.Encode(gpub)
	msg := "commitment-as-decimal-string"
	sig := base64.StdEncoding.EncodeToString(ed25519.Sign(gpriv, []byte(msg)))
	if err := stellarkey.Verify(addr, msg, sig); err != nil {
		t.Fatalf("Verify(valid): %v", err)
	}
	if err := stellarkey.Verify(addr, msg+"x", sig); err == nil {
		t.Error("Verify accepted a tampered message")
	}
}
