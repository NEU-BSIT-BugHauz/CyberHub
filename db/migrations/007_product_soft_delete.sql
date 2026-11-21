-- S2-DEV-06: product soft delete / restore audit fields.
-- DBA: Apply after 006_product_table.sql.
-- Works with an existing HopeDB audited product table or the CyberHub schema.
-- Does not delete data. Existing rows remain active.

BEGIN;

ALTER TABLE product
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_by BIGINT NULL;

CREATE INDEX IF NOT EXISTS product_deleted_status_idx ON product (is_deleted);

COMMIT;
