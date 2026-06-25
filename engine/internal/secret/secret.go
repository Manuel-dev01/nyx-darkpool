// Package secret provides authenticated at-rest encryption for the order's
// private payload (orders.encrypted_blob).
//
// Trust model: Nyx hides price/volume from the public chain and mempool — the
// chain only ever sees the Poseidon commitment and a proof. The off-chain engine
// is the trusted sequencer/prover, so it necessarily handles raw values in
// memory; this package closes the remaining seam by ensuring a *database dump*
// (bytes at rest) leaks nothing. Plaintext was the documented prior state; this
// makes encryption the default.
//
// Cipher uses AES-256-GCM (a 32-byte key, a fresh random 96-bit nonce per Seal,
// nonce prepended to the ciphertext). The default deployment uses an EPHEMERAL
// key generated at process start (NewEphemeral) so no secret is ever written to
// disk; supply NYX_BLOB_KEY only when orders must survive a restart.
package secret

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
)

// KeySize is the required AES-256 key length in bytes.
const KeySize = 32

// nonceSize is the standard GCM nonce length (96 bits).
const nonceSize = 12

// Cipher seals and opens order payloads with AES-256-GCM.
type Cipher struct {
	aead      cipher.AEAD
	ephemeral bool
}

// New builds a Cipher from a 32-byte key. It errors if the key length is wrong.
func New(key []byte) (*Cipher, error) {
	if len(key) != KeySize {
		return nil, fmt.Errorf("secret: key must be %d bytes, got %d", KeySize, len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("secret: new cipher: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("secret: new gcm: %w", err)
	}
	return &Cipher{aead: aead}, nil
}

// NewEphemeral builds a Cipher with a fresh random key that exists only in this
// process's memory and is never persisted. Orders encrypted with it cannot be
// decrypted after a restart — that is the intended trade-off for "no key on
// disk". Reports IsEphemeral() == true so callers can warn at startup.
func NewEphemeral() (*Cipher, error) {
	key := make([]byte, KeySize)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return nil, fmt.Errorf("secret: generate ephemeral key: %w", err)
	}
	c, err := New(key)
	if err != nil {
		return nil, err
	}
	c.ephemeral = true
	return c, nil
}

// IsEphemeral reports whether this Cipher uses a non-persisted random key.
func (c *Cipher) IsEphemeral() bool { return c != nil && c.ephemeral }

// magic prefixes every ciphertext Seal produces. It lets Open distinguish our
// GCM frames from legacy plaintext rows written before encryption existed, so a
// mixed table still reads. "NYX1" — Nyx blob format v1.
var magic = []byte("NYX1")

// Seal encrypts plaintext, returning magic || nonce || ciphertext+tag. A nil
// Cipher passes the plaintext through unchanged (encryption disabled).
func (c *Cipher) Seal(plaintext []byte) []byte {
	if c == nil {
		return plaintext
	}
	nonce := make([]byte, nonceSize)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		// crypto/rand failure is unrecoverable; surface loudly rather than
		// silently store weak data.
		panic(fmt.Sprintf("secret: read nonce: %v", err))
	}
	out := make([]byte, 0, len(magic)+nonceSize+len(plaintext)+c.aead.Overhead())
	out = append(out, magic...)
	out = append(out, nonce...)
	return c.aead.Seal(out, nonce, plaintext, nil)
}

// errOpen is returned when a value carries our magic prefix but fails
// authenticated decryption (wrong key or tampered ciphertext).
var errOpen = errors.New("secret: decrypt failed (wrong key or tampered ciphertext)")

// Open reverses Seal. For backward compatibility, a value that does NOT carry
// the magic prefix is assumed to be legacy plaintext and returned unchanged — so
// rows written before encryption was enabled still decode. A value that DOES
// carry the prefix but fails authentication returns an error (never silently
// falls back), which is the tamper/wrong-key signal.
//
// A nil Cipher returns the input unchanged (encryption disabled).
func (c *Cipher) Open(b []byte) ([]byte, error) {
	if c == nil || !hasMagic(b) {
		return b, nil // legacy plaintext (or encryption disabled)
	}
	body := b[len(magic):]
	if len(body) < nonceSize {
		return nil, errOpen
	}
	nonce, ct := body[:nonceSize], body[nonceSize:]
	pt, err := c.aead.Open(nil, nonce, ct, nil)
	if err != nil {
		return nil, errOpen
	}
	return pt, nil
}

func hasMagic(b []byte) bool {
	if len(b) < len(magic) {
		return false
	}
	for i := range magic {
		if b[i] != magic[i] {
			return false
		}
	}
	return true
}
