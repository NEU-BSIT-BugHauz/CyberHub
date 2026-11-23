-- 017_search_performance_index_tuning.sql
-- S2-DBA-06: Search performance check and index tuning for customer, product, and pricehist

BEGIN;

-- 1. Enable pg_trgm if permitted so ILIKE '%term%' searches use GIN trigram indexes
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_trgm extension not enabled (insufficient privileges); skipping trigram indexes.';
END $$;

-- 2. Partial B-tree pattern_ops indexes for fast case-insensitive prefix searches (LIKE 'term%')
CREATE INDEX IF NOT EXISTS idx_customer_active_custno_pattern
    ON customer (LOWER(custno) varchar_pattern_ops)
    WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_customer_active_custname_pattern
    ON customer (LOWER(custname) varchar_pattern_ops)
    WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_product_active_prodcode_pattern
    ON product (LOWER(prodcode) varchar_pattern_ops)
    WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_product_active_desc_pattern
    ON product (LOWER(description) varchar_pattern_ops)
    WHERE is_deleted = FALSE;

-- 3. Composite filter + sort indexes for paginated list queries
CREATE INDEX IF NOT EXISTS idx_customer_active_payterm_name
    ON customer (payterm, LOWER(custname), custno)
    WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_product_active_unit_desc
    ON product (unit, LOWER(description), prodcode)
    WHERE is_deleted = FALSE;

-- 4. Covering index on pricehist for Index-Only Scans on effective-dated price lookups
CREATE INDEX IF NOT EXISTS idx_pricehist_active_prod_effdate_cover
    ON pricehist (prodcode, effdate DESC)
    INCLUDE (unitprice)
    WHERE is_deleted = FALSE;

-- 5. Partial GIN trigram indexes for fast substring searches (ILIKE '%term%')
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
        EXECUTE '
            CREATE INDEX IF NOT EXISTS idx_customer_active_custno_trgm
                ON customer USING GIN (custno gin_trgm_ops)
                WHERE is_deleted = FALSE;
        ';
        EXECUTE '
            CREATE INDEX IF NOT EXISTS idx_customer_active_custname_trgm
                ON customer USING GIN (custname gin_trgm_ops)
                WHERE is_deleted = FALSE;
        ';
        EXECUTE '
            CREATE INDEX IF NOT EXISTS idx_customer_active_address_trgm
                ON customer USING GIN (address gin_trgm_ops)
                WHERE is_deleted = FALSE;
        ';
        EXECUTE '
            CREATE INDEX IF NOT EXISTS idx_product_active_prodcode_trgm
                ON product USING GIN (prodcode gin_trgm_ops)
                WHERE is_deleted = FALSE;
        ';
        EXECUTE '
            CREATE INDEX IF NOT EXISTS idx_product_active_description_trgm
                ON product USING GIN (description gin_trgm_ops)
                WHERE is_deleted = FALSE;
        ';
    END IF;
END $$;

-- 6. Diagnostic view to inspect index definitions, sizes, and scan statistics
CREATE OR REPLACE VIEW vw_db_search_index_health AS
SELECT
    s.relname AS table_name,
    s.indexrelname AS index_name,
    pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size,
    s.idx_scan AS index_scans,
    s.idx_tup_read AS tuples_read,
    s.idx_tup_fetch AS tuples_fetched,
    i.indexdef AS index_definition
FROM pg_stat_user_indexes s
JOIN pg_indexes i
  ON i.schemaname = s.schemaname
 AND i.tablename = s.relname
 AND i.indexname = s.indexrelname
WHERE s.schemaname = 'public'
  AND s.relname IN ('customer', 'product', 'pricehist')
ORDER BY s.relname ASC, s.indexrelname ASC;

-- 7. Refresh planner statistics after index creation
ANALYZE customer;
ANALYZE product;
ANALYZE pricehist;

COMMIT;
