-- S2-DEV-07: Product price history (effective-dated prices).
-- DBA: Apply after 006_product_table.sql and 007_product_soft_delete.sql.
-- Compatible with HopeDB's priceHist (folded to PostgreSQL pricehist).
-- All deletes in the API are soft deletes. No price history rows are destroyed.
-- Existing HopeDB audit triggers are left unchanged.

BEGIN;

CREATE TABLE IF NOT EXISTS pricehist (
    effdate DATE NOT NULL,
    prodcode VARCHAR(6) NOT NULL REFERENCES product (prodcode),
    unitprice NUMERIC(10, 2) NOT NULL CHECK (unitprice > 0),
    PRIMARY KEY (effdate, prodcode)
);

ALTER TABLE pricehist
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS stamp VARCHAR(60),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT NULL;

CREATE INDEX IF NOT EXISTS idx_pricehist_active_product_effdate
    ON pricehist (prodcode, effdate DESC)
    WHERE is_deleted = FALSE;

COMMIT;
