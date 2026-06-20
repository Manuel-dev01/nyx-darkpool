-- ============================================================================
-- Nyx Darkpool — Migration 000001 (DOWN): tear down initial schema
-- ----------------------------------------------------------------------------
-- Reverses 000001_init_schema.up.sql in strict dependency order:
--   triggers → functions → tables (matches before orders, due to FKs) → enums.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_matches_updated_at ON matches;
DROP TRIGGER IF EXISTS trg_orders_updated_at  ON orders;

DROP FUNCTION IF EXISTS set_updated_at();

-- matches references orders → drop the child first.
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS orders;

DROP TYPE IF EXISTS onchain_status;
DROP TYPE IF EXISTS order_side;
DROP TYPE IF EXISTS order_status;

-- Note: the pgcrypto extension is intentionally left installed; it may be in
-- use by other schemas and is harmless to retain.
