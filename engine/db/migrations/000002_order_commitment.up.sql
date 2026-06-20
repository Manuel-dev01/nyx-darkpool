-- ============================================================================
-- Nyx Darkpool — Migration 000002 (UP): order_commitment column
-- ----------------------------------------------------------------------------
-- Adds the single per-order Poseidon commitment that serves as the PUBLIC INPUT
-- to the ZK match circuit (darkpool_match.circom):
--
--     order_commitment = Poseidon(price, volume, salt)
--
-- In the circuit this is `maker_hash` / `taker_hash`. Stored as the decimal
-- string representation of a BN254 field element (≤ 78 digits), matching the
-- format snarkjs emits in public.json so DB and proof public inputs are
-- byte-identical.
--
-- Additive and non-breaking: the existing price_hash / volume_hash columns are
-- retained (they remain available for finer-grained per-field commitments).
-- Nullable for now (no backfill — table is empty in dev); a later migration can
-- enforce NOT NULL once every writer populates it.
-- ============================================================================

ALTER TABLE orders ADD COLUMN order_commitment VARCHAR(80);

COMMENT ON COLUMN orders.order_commitment IS
    'Poseidon(price,volume,salt) as a decimal string; the per-order public input (maker_hash/taker_hash) to the ZK match circuit.';
