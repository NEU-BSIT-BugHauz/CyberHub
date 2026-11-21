-- S2-DEV-04: Product list/search/filter schema.
-- Matches HopeDB's prodCode (6), description (30), and unit (3).
-- PostgreSQL folds unquoted prodCode to prodcode.
-- Safe for a missing product table or an existing compatible HopeDB table.
-- DBA applies this; do not run automatically at server startup.

BEGIN;

CREATE TABLE IF NOT EXISTS product (
    prodcode VARCHAR(6) PRIMARY KEY,
    description VARCHAR(30),
    unit VARCHAR(3) CHECK (unit IN ('pc', 'ea', 'mtr', 'pkg', 'ltr'))
);

-- Existing audited HopeDB tables may already have these columns.
-- The list only displays active records.
ALTER TABLE product
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE product
    ADD COLUMN IF NOT EXISTS stamp VARCHAR(60);

CREATE INDEX IF NOT EXISTS idx_product_active_unit
    ON product (unit, prodcode)
    WHERE is_deleted = FALSE;

COMMIT;
