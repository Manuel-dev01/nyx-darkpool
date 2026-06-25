package secret

import (
	"bytes"
	"encoding/json"
	"testing"
)

func key32() []byte {
	k := make([]byte, KeySize)
	for i := range k {
		k[i] = byte(i + 1)
	}
	return k
}

func TestNew_RejectsBadKeyLength(t *testing.T) {
	for _, n := range []int{0, 16, 31, 33, 64} {
		if _, err := New(make([]byte, n)); err == nil {
			t.Errorf("New(%d-byte key): expected error, got nil", n)
		}
	}
}

func TestSealOpen_RoundTrip(t *testing.T) {
	c, err := New(key32())
	if err != nil {
		t.Fatal(err)
	}
	plain := []byte(`{"price":"9984","volume":"5000000","salt":"42"}`)

	ct := c.Seal(plain)
	if bytes.Equal(ct, plain) {
		t.Fatal("ciphertext equals plaintext — not encrypted")
	}
	if json.Valid(ct) {
		t.Fatal("ciphertext is valid JSON — at-rest payload would leak structure")
	}

	got, err := c.Open(ct)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if !bytes.Equal(got, plain) {
		t.Fatalf("round-trip mismatch: got %q want %q", got, plain)
	}
}

func TestSeal_FreshNoncePerCall(t *testing.T) {
	c, _ := New(key32())
	plain := []byte("same input")
	if bytes.Equal(c.Seal(plain), c.Seal(plain)) {
		t.Fatal("two Seals of the same plaintext are identical — nonce reuse")
	}
}

func TestOpen_TamperedFails(t *testing.T) {
	c, _ := New(key32())
	ct := c.Seal([]byte("secret payload"))
	ct[len(ct)-1] ^= 0xFF // flip a tag byte
	if _, err := c.Open(ct); err == nil {
		t.Fatal("Open of tampered ciphertext succeeded — GCM auth not enforced")
	}
}

func TestOpen_WrongKeyFails(t *testing.T) {
	c1, _ := New(key32())
	ct := c1.Seal([]byte("secret payload"))

	other := key32()
	other[0] ^= 0xFF
	c2, _ := New(other)
	if _, err := c2.Open(ct); err == nil {
		t.Fatal("Open with wrong key succeeded")
	}
}

func TestOpen_LegacyPlaintextPassthrough(t *testing.T) {
	c, _ := New(key32())
	legacy := []byte(`{"price":"1","volume":"1","salt":"1"}`) // no magic prefix
	got, err := c.Open(legacy)
	if err != nil {
		t.Fatalf("legacy plaintext should pass through, got error: %v", err)
	}
	if !bytes.Equal(got, legacy) {
		t.Fatalf("legacy passthrough mismatch: got %q want %q", got, legacy)
	}
}

func TestNilCipher_Passthrough(t *testing.T) {
	var c *Cipher // disabled
	plain := []byte("plain")
	if !bytes.Equal(c.Seal(plain), plain) {
		t.Fatal("nil Seal should pass through")
	}
	got, err := c.Open(plain)
	if err != nil || !bytes.Equal(got, plain) {
		t.Fatalf("nil Open should pass through, got %q err %v", got, err)
	}
}

func TestEphemeral_RoundTripAndFlag(t *testing.T) {
	c, err := NewEphemeral()
	if err != nil {
		t.Fatal(err)
	}
	if !c.IsEphemeral() {
		t.Fatal("NewEphemeral should report IsEphemeral() == true")
	}
	plain := []byte("ephemeral payload")
	got, err := c.Open(c.Seal(plain))
	if err != nil || !bytes.Equal(got, plain) {
		t.Fatalf("ephemeral round-trip failed: got %q err %v", got, err)
	}
}
