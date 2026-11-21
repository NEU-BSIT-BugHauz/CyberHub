-- S2-DEV-03: Customer soft delete and restore.
-- DBA: Apply after 004_customer_table.sql. Existing customers remain active.
BEGIN;

ALTER TABLE customer
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_by BIGINT NULL;

CREATE INDEX IF NOT EXISTS customer_is_deleted_idx ON customer (is_deleted);

COMMIT;
