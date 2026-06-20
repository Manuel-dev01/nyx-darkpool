pragma circom 2.1.6;

// ============================================================================
// darkpool_match.circom — Nyx ZK order-match circuit (Groth16 / BN254)
// ----------------------------------------------------------------------------
// Proves that a MAKER order and a TAKER order legitimately cross — i.e. they
// match at a valid price and volume — WITHOUT revealing the price or volume to
// the public mempool. Only the two Poseidon commitments are public.
//
// Public inputs:
//   maker_hash = Poseidon(maker_price, maker_volume, maker_salt)
//   taker_hash = Poseidon(taker_price, taker_volume, taker_salt)
//
// Private (witness) inputs:
//   maker_price, taker_price, maker_volume, taker_volume, maker_salt, taker_salt
//
// Statement proven:
//   1. maker_price <= taker_price        (the orders cross — bid >= ask)
//   2. maker_volume == taker_volume      (full-fill model; matches the DB's
//                                         UNIQUE(maker)/UNIQUE(taker) one-match
//                                         invariant)
//   3. maker_hash and taker_hash are the Poseidon commitments of the private
//      values (binds the proof to the on-book order commitments)
//
// Security notes:
//   * EVERY comparator operand is range-checked to N_BITS via Num2Bits. This is
//     mandatory: circomlib's LessEqThan(n) is only sound when both operands are
//     < 2^n. Without the range check a malicious prover could pass a value that
//     wraps the ~2^254 BN254 field and prove a false ordering (the classic
//     "comparator wraparound" under-constrained vulnerability).
//   * The comparator output is asserted (=== 1), never left dangling.
//   * Poseidon component outputs are bound to the public inputs with ===, so the
//     hashes cannot be left under-constrained.
//   * All signals use <== / === (never bare <--), so no signal is assignable
//     without also being constrained.
// ============================================================================

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

// N_BITS bounds the magnitude of price/volume. 64 bits comfortably holds
// scaled-integer RWA prices/volumes (e.g. Stellar 7-decimal stroops) while
// staying far below the BN254 scalar field (~2^254), so the comparator's
// internal (1<<N)+a-b arithmetic cannot overflow the field.
template DarkpoolMatch(N_BITS) {
    // ---- Public inputs -----------------------------------------------------
    signal input maker_hash;
    signal input taker_hash;

    // ---- Private inputs ----------------------------------------------------
    signal input maker_price;
    signal input taker_price;
    signal input maker_volume;
    signal input taker_volume;
    signal input maker_salt;
    signal input taker_salt;

    // ---- 1. Range-check every comparator operand (anti-wraparound) ---------
    // Num2Bits(N) strictly constrains its input to exactly N bits, which both
    // (a) fully determines the signal and (b) guarantees value < 2^N so the
    // comparator below is sound.
    component rcMakerPrice  = Num2Bits(N_BITS);
    component rcTakerPrice  = Num2Bits(N_BITS);
    component rcMakerVolume = Num2Bits(N_BITS);
    component rcTakerVolume = Num2Bits(N_BITS);
    rcMakerPrice.in  <== maker_price;
    rcTakerPrice.in  <== taker_price;
    rcMakerVolume.in <== maker_volume;
    rcTakerVolume.in <== taker_volume;

    // ---- 2. Price cross: maker_price <= taker_price ------------------------
    component lePrice = LessEqThan(N_BITS);
    lePrice.in[0] <== maker_price;
    lePrice.in[1] <== taker_price;
    lePrice.out === 1; // assert the ordering holds (no dangling output)

    // ---- 3. Volume match (full fill) ---------------------------------------
    maker_volume === taker_volume;

    // ---- 4. Commitment binding: hashes must equal the public inputs --------
    component hMaker = Poseidon(3);
    hMaker.inputs[0] <== maker_price;
    hMaker.inputs[1] <== maker_volume;
    hMaker.inputs[2] <== maker_salt;
    maker_hash === hMaker.out;

    component hTaker = Poseidon(3);
    hTaker.inputs[0] <== taker_price;
    hTaker.inputs[1] <== taker_volume;
    hTaker.inputs[2] <== taker_salt;
    taker_hash === hTaker.out;
}

// maker_hash and taker_hash are the only public signals; everything else is
// part of the private witness.
component main { public [maker_hash, taker_hash] } = DarkpoolMatch(64);
