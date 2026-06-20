-- ============================================================================
-- Nyx Darkpool — Migration 000001 (UP): initial schema
-- ----------------------------------------------------------------------------
-- Establishes the encrypted order book (`orders`) and the settlement record
-- (`matches`) for the off-chain matching engine.
--
-- Design notes:
--   * Order price/volume are NEVER stored in plaintext. The engine sees only:
--       - `encrypted_blob` : the client-encrypted order payload (opaque bytes)
--       - `price_hash`     : Poseidon commitment to the order price
--       - `volume_hash`    : Poseidon commitment to the order volume
--     The ZK circuit (Phase 3) later proves intersection over these commitments.
--   * UUIDv4 primary keys (generated app-side or via gen_random_uuid()).
--   * Status transitions are constrained by ENUM types, not free-form text.
--   * Indexes target the order-book hot paths: scanning OPEN orders by asset
--     pair ordered by arrival time (price-time priority / FIFO sequencing).
-- ============================================================================

-- pgcrypto provides gen_random_uuid() so the DB can default-generate UUIDv4
-- if the application omits an id. The engine normally supplies its own UUID.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- ENUM types — lifecycle states (constrained, indexable, cheap to store)
-- ----------------------------------------------------------------------------

-- Lifecycle of a single resting order.
--   open    : resting in the book, eligible for matching
--   matched : paired with a counterparty; proof generation / settlement pending
--   settled : on-chain swap confirmed
--   cancelled : withdrawn by owner before match
CREATE TYPE order_status AS ENUM ('open', 'matched', 'settled', 'cancelled');

-- Side of the book.
CREATE TYPE order_side AS ENUM ('bid', 'ask');

-- Lifecycle of a match's on-chain settlement.
--   pending   : match formed off-chain, proof not yet submitted
--   submitted : proof + settlement tx sent to Soroban verifier
--   confirmed : verifier accepted proof, swap executed
--   failed    : verification or settlement rejected on-chain
CREATE TYPE onchain_status AS ENUM ('pending', 'submitted', 'confirmed', 'failed');

-- ----------------------------------------------------------------------------
-- orders — the encrypted order book
-- ----------------------------------------------------------------------------
CREATE TABLE orders (
    -- UUIDv4 identity. App supplies it; DB default is a safety net.
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Stellar account / public key that owns and authorized this order.
    pubkey          VARCHAR(56)     NOT NULL,

    -- The RWA trading pair this order belongs to, e.g. 'USDC/TBILL'.
    -- Normalized as text; the order book is partitioned by this column.
    asset_pair      VARCHAR(64)     NOT NULL,

    -- Bid or ask. Matching pairs a bid against a compatible ask.
    side            order_side      NOT NULL,

    -- Opaque client-encrypted order payload. Never decrypted by the engine.
    encrypted_blob  BYTEA           NOT NULL,

    -- Poseidon commitments (hex/text) used as public inputs to the ZK proof.
    price_hash      VARCHAR(80)     NOT NULL,
    volume_hash     VARCHAR(80)     NOT NULL,

    -- Anti-replay: unique per order, prevents the same order being matched
    -- (double-spent) more than once. Enforced UNIQUE below.
    nullifier       VARCHAR(80)     NOT NULL,

    status          order_status    NOT NULL DEFAULT 'open',

    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

    -- A commitment must be well-formed (non-empty). Cheap sanity guard.
    CONSTRAINT orders_price_hash_not_blank  CHECK (length(price_hash)  > 0),
    CONSTRAINT orders_volume_hash_not_blank CHECK (length(volume_hash) > 0)
);

-- Each order's nullifier is globally unique → no double-matching.
CREATE UNIQUE INDEX uq_orders_nullifier ON orders (nullifier);

-- Hot path: the matcher scans OPEN orders within one asset pair / side,
-- in arrival order (FIFO / price-time priority). Partial index keeps it lean
-- by indexing only the rows the matcher actually scans.
CREATE INDEX idx_orders_open_book
    ON orders (asset_pair, side, created_at)
    WHERE status = 'open';

-- Secondary lookups by owner and by status for ops / reconciliation.
CREATE INDEX idx_orders_pubkey ON orders (pubkey);
CREATE INDEX idx_orders_status ON orders (status);

-- ----------------------------------------------------------------------------
-- matches — settlement records pairing a maker and a taker order
-- ----------------------------------------------------------------------------
CREATE TABLE matches (
    id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The two orders that crossed. ON DELETE RESTRICT: a matched order can
    -- never be deleted out from under a settlement record.
    maker_order_id    UUID            NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,
    taker_order_id    UUID            NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,

    -- Serialized Groth16 proof produced off-chain (Phase 5). NULL until the
    -- engine has generated it; the on-chain status tracks downstream progress.
    proof_blob        BYTEA,

    onchain_status    onchain_status  NOT NULL DEFAULT 'pending',

    -- Stellar transaction hash once the settlement tx is submitted.
    settlement_tx     VARCHAR(64),

    created_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ     NOT NULL DEFAULT now(),

    -- A maker cannot be matched against itself.
    CONSTRAINT matches_distinct_orders CHECK (maker_order_id <> taker_order_id),

    -- An order may participate in at most one match (full-fill model).
    -- Partial fills, if added later, would relax this to a quantity ledger.
    CONSTRAINT uq_matches_maker UNIQUE (maker_order_id),
    CONSTRAINT uq_matches_taker UNIQUE (taker_order_id)
);

-- Driver for the on-chain submission worker: find matches awaiting settlement.
CREATE INDEX idx_matches_onchain_status ON matches (onchain_status);
CREATE INDEX idx_matches_created_at     ON matches (created_at);

-- ----------------------------------------------------------------------------
-- updated_at maintenance — keep the audit timestamp honest on every UPDATE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_matches_updated_at
    BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
