-- 013_current_price_as_of_date.sql
-- S2-DBA-02: Effective-dated product price lookup functions and current price view

BEGIN;

-- Ensure covering index exists for fast (prodcode, effdate DESC) lateral lookups
CREATE INDEX IF NOT EXISTS idx_pricehist_active_product_effdate
    ON pricehist (prodcode, effdate DESC)
    WHERE is_deleted = FALSE;

-- 1. Scalar helper: returns the effective unitprice for a single product as of a given date
CREATE OR REPLACE FUNCTION get_product_price_as_of(
    p_prodcode VARCHAR,
    p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC(10, 2)
LANGUAGE sql
STABLE
AS $$
    SELECT ph.unitprice
    FROM pricehist ph
    WHERE ph.prodcode = p_prodcode
      AND ph.effdate <= COALESCE(p_as_of_date, CURRENT_DATE)
      AND ph.is_deleted = FALSE
    ORDER BY ph.effdate DESC
    LIMIT 1;
$$;

-- 2. Set-returning helper: returns all active products with their effective price as of a given date
CREATE OR REPLACE FUNCTION get_all_product_prices_as_of(
    p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    prodcode VARCHAR(6),
    description VARCHAR(30),
    unit VARCHAR(3),
    effdate DATE,
    unitprice NUMERIC(10, 2)
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        p.prodcode,
        p.description,
        p.unit,
        latest.effdate,
        latest.unitprice
    FROM product p
    LEFT JOIN LATERAL (
        SELECT
            ph.effdate,
            ph.unitprice
        FROM pricehist ph
        WHERE ph.prodcode = p.prodcode
          AND ph.effdate <= COALESCE(p_as_of_date, CURRENT_DATE)
          AND ph.is_deleted = FALSE
        ORDER BY ph.effdate DESC
        LIMIT 1
    ) latest ON TRUE
    WHERE p.is_deleted = FALSE
    ORDER BY p.prodcode ASC;
$$;

-- 3. Convenience view for current prices as of CURRENT_DATE
CREATE OR REPLACE VIEW vw_current_product_prices AS
SELECT
    prodcode,
    description,
    unit,
    effdate,
    unitprice
FROM get_all_product_prices_as_of(CURRENT_DATE);

COMMIT;
