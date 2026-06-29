// Package order defines the engine's order domain type and the private-input
// payload the matcher needs to (a) decide a cross and (b) build a ZK witness.
//
// Trust model: Nyx shields price/volume from the public chain and mempool — the
// chain only ever sees the Poseidon commitment and a proof. The off-chain engine
// is the trusted sequencer/prover, so it MUST see the raw values to match orders
// and generate their Groth16 proof (CLAUDE.md §2.2: "generate the actual Groth16
// proof once a match is found ... using the matched orders' raw data").
//
// Those raw values live in orders.encrypted_blob as a JSON Payload. For this
// build the blob is plaintext-at-rest; encrypting it at rest (so a DB dump leaks
// nothing) is a documented future hardening seam — it does not change the
// matcher's interface, which always goes through Decode/Encode here.
package order

import (
	"encoding/json"
	"fmt"
	"math/big"
)

// Side is the book side of an order.
type Side string

const (
	Bid Side = "bid" // a buyer; matched as the taker
	Ask Side = "ask" // a seller; matched as the maker
)

// Valid reports whether s is a known side.
func (s Side) Valid() bool { return s == Bid || s == Ask }

// Order is a resting order as the matcher sees it. Commitment is the public
// Poseidon hash (orders.order_commitment) used as the circuit's maker_hash/
// taker_hash; Payload carries the private values decoded from encrypted_blob.
type Order struct {
	ID         string
	Pubkey     string
	AssetPair  string
	Side       Side
	Commitment string // order_commitment — decimal Poseidon(price,volume,salt)
	Payload    Payload
}

// Payload is the order's private inputs, serialized into encrypted_blob. All
// fields are base-10 integer strings (snarkjs-native, and byte-identical to the
// decimal commitment domain), well within the circuit's 64-bit range.
type Payload struct {
	Price  string `json:"price"`
	Volume string `json:"volume"`
	Salt   string `json:"salt"`
}

// Validate checks that price, volume, and salt are base-10 integers (the domain
// the circuit and commitment require). Price and volume must additionally lie in
// (0, 2^64): the circuit instantiates DarkpoolMatch(64) and range-checks each
// price/volume operand with Num2Bits(64), so a value at or above 2^64 (or <= 0)
// yields a valid commitment but an UNSATISFIABLE witness — the order would store
// and match but never prove, then be silently abandoned. Rejecting it here (the
// API boundary + Encode) keeps a direct API caller from creating a stuck order.
// Salt is unconstrained beyond base-10 (it is only hashed, never range-checked).
func (p Payload) Validate() error {
	max := new(big.Int).Lsh(big.NewInt(1), 64) // circuit operands are Num2Bits(64)
	price, ok := new(big.Int).SetString(p.Price, 10)
	if !ok {
		return fmt.Errorf("order: price %q is not a base-10 integer", p.Price)
	}
	if price.Sign() <= 0 || price.Cmp(max) >= 0 {
		return fmt.Errorf("order: price %q out of provable range (0, 2^64)", p.Price)
	}
	volume, ok := new(big.Int).SetString(p.Volume, 10)
	if !ok {
		return fmt.Errorf("order: volume %q is not a base-10 integer", p.Volume)
	}
	if volume.Sign() <= 0 || volume.Cmp(max) >= 0 {
		return fmt.Errorf("order: volume %q out of provable range (0, 2^64)", p.Volume)
	}
	if _, ok := new(big.Int).SetString(p.Salt, 10); !ok {
		return fmt.Errorf("order: salt %q is not a base-10 integer", p.Salt)
	}
	return nil
}

// Encode serializes the payload for storage in orders.encrypted_blob.
func Encode(p Payload) ([]byte, error) {
	if err := p.Validate(); err != nil {
		return nil, err
	}
	return json.Marshal(p)
}

// Decode parses a payload previously written by Encode.
func Decode(b []byte) (Payload, error) {
	var p Payload
	if err := json.Unmarshal(b, &p); err != nil {
		return Payload{}, fmt.Errorf("order: decode payload: %w", err)
	}
	return p, nil
}

// PriceInt / VolumeInt parse the decimal fields for matching arithmetic.
func (p Payload) PriceInt() (*big.Int, bool)  { return new(big.Int).SetString(p.Price, 10) }
func (p Payload) VolumeInt() (*big.Int, bool) { return new(big.Int).SetString(p.Volume, 10) }
