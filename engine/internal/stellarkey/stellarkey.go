// Package stellarkey is a minimal Stellar StrKey codec + ed25519 signature
// verifier — just enough to authenticate an order against the desk's Stellar
// public key (the order's `pubkey`, a G... account address) without pulling in
// the full Stellar Go SDK.
//
// StrKey layout for an ed25519 public key (G...): base32(RFC4648, no padding) of
//
//	[ version(1) | ed25519_pubkey(32) | crc16-xmodem(2, little-endian) ]
//
// where version = 6<<3 = 0x30 ("G"). See SEP-0023.
package stellarkey

import (
	"crypto/ed25519"
	"encoding/base32"
	"encoding/base64"
	"errors"
	"fmt"
)

// versionByteAccountID is the StrKey version byte for an ed25519 account id (G).
const versionByteAccountID byte = 6 << 3 // 0x30

// b32 is RFC4648 base32 without padding (Stellar StrKey encoding).
var b32 = base32.StdEncoding.WithPadding(base32.NoPadding)

// Decode parses a G... account address into its 32-byte ed25519 public key,
// validating the version byte and CRC16 checksum.
func Decode(addr string) (ed25519.PublicKey, error) {
	raw, err := b32.DecodeString(addr)
	if err != nil {
		return nil, fmt.Errorf("stellarkey: base32 decode: %w", err)
	}
	// 1 version + 32 payload + 2 checksum
	if len(raw) != 35 {
		return nil, fmt.Errorf("stellarkey: bad length %d (want 35)", len(raw))
	}
	if raw[0] != versionByteAccountID {
		return nil, fmt.Errorf("stellarkey: not an ed25519 account id (version 0x%02x)", raw[0])
	}
	payload := raw[:33]
	want := uint16(raw[33]) | uint16(raw[34])<<8 // little-endian
	if crc16XModem(payload) != want {
		return nil, errors.New("stellarkey: checksum mismatch")
	}
	return ed25519.PublicKey(append([]byte(nil), raw[1:33]...)), nil
}

// Encode renders a 32-byte ed25519 public key as a G... account address.
func Encode(pub ed25519.PublicKey) (string, error) {
	if len(pub) != ed25519.PublicKeySize {
		return "", fmt.Errorf("stellarkey: bad public key length %d", len(pub))
	}
	payload := make([]byte, 0, 33)
	payload = append(payload, versionByteAccountID)
	payload = append(payload, pub...)
	sum := crc16XModem(payload)
	out := append(payload, byte(sum), byte(sum>>8)) // little-endian checksum
	return b32.EncodeToString(out), nil
}

// Verify checks that sigB64 is a valid ed25519 signature, by the account behind
// addr, over the bytes of message. Returns a descriptive error on any failure.
func Verify(addr, message, sigB64 string) error {
	pub, err := Decode(addr)
	if err != nil {
		return err
	}
	sig, err := base64.StdEncoding.DecodeString(sigB64)
	if err != nil {
		return fmt.Errorf("stellarkey: base64 signature: %w", err)
	}
	if len(sig) != ed25519.SignatureSize {
		return fmt.Errorf("stellarkey: bad signature length %d", len(sig))
	}
	if !ed25519.Verify(pub, []byte(message), sig) {
		return errors.New("stellarkey: signature does not verify")
	}
	return nil
}

// crc16XModem computes the CRC16-XMODEM (CCITT, poly 0x1021, init 0x0000) used
// by Stellar StrKey.
func crc16XModem(data []byte) uint16 {
	var crc uint16
	for _, b := range data {
		crc ^= uint16(b) << 8
		for i := 0; i < 8; i++ {
			if crc&0x8000 != 0 {
				crc = (crc << 1) ^ 0x1021
			} else {
				crc <<= 1
			}
		}
	}
	return crc
}
