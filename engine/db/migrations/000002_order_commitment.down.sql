-- ============================================================================
-- Nyx Darkpool — Migration 000002 (DOWN): drop order_commitment column
-- ============================================================================

ALTER TABLE orders DROP COLUMN IF EXISTS order_commitment;
