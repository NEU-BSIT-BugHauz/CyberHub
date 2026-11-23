-- 012_customer_product_active_views_indexes.sql
-- S2-DBA-01: Create active views and partial indexes for customer and product

BEGIN;

-- 1. Active views (exclude soft-deleted records)
CREATE OR REPLACE VIEW vw_active_customers AS
SELECT
    custno,
    custname,
    address,
    payterm
FROM customer
WHERE is_deleted = FALSE;

CREATE OR REPLACE VIEW vw_active_products AS
SELECT
    prodcode,
    description,
    unit,
    stamp
FROM product
WHERE is_deleted = FALSE;

-- 2. Partial indexes tailored to active customer queries
CREATE INDEX IF NOT EXISTS idx_customer_active_custname
    ON customer (LOWER(custname), custno)
    WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_customer_active_payterm
    ON customer (payterm, custno)
    WHERE is_deleted = FALSE;

-- 3. Partial indexes tailored to active product queries
CREATE INDEX IF NOT EXISTS idx_product_active_description
    ON product (LOWER(description), prodcode)
    WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_product_active_unit
    ON product (unit, prodcode)
    WHERE is_deleted = FALSE;

COMMIT;
