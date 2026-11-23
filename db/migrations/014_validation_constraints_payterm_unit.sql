-- 014_validation_constraints_payterm_unit.sql
-- S2-DBA-03: Enforce named validation constraints on customer (payterm) and product (unit)

BEGIN;

-- 1. Customer validation constraints (payterm and required identifiers)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_customer_payterm'
          AND conrelid = 'customer'::regclass
    ) THEN
        ALTER TABLE customer
            ADD CONSTRAINT chk_customer_payterm
            CHECK (payterm IN ('COD', '30D', '45D'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_customer_custno_not_blank'
          AND conrelid = 'customer'::regclass
    ) THEN
        ALTER TABLE customer
            ADD CONSTRAINT chk_customer_custno_not_blank
            CHECK (BTRIM(custno) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_customer_custname_not_blank'
          AND conrelid = 'customer'::regclass
    ) THEN
        ALTER TABLE customer
            ADD CONSTRAINT chk_customer_custname_not_blank
            CHECK (BTRIM(custname) <> '');
    END IF;
END $$;

-- 2. Product validation constraints (unit and required fields)
ALTER TABLE product
    ALTER COLUMN description SET NOT NULL,
    ALTER COLUMN unit SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_product_unit'
          AND conrelid = 'product'::regclass
    ) THEN
        ALTER TABLE product
            ADD CONSTRAINT chk_product_unit
            CHECK (unit IN ('pc', 'ea', 'mtr', 'pkg', 'ltr'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_product_prodcode_not_blank'
          AND conrelid = 'product'::regclass
    ) THEN
        ALTER TABLE product
            ADD CONSTRAINT chk_product_prodcode_not_blank
            CHECK (BTRIM(prodcode) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_product_description_not_blank'
          AND conrelid = 'product'::regclass
    ) THEN
        ALTER TABLE product
            ADD CONSTRAINT chk_product_description_not_blank
            CHECK (BTRIM(description) <> '');
    END IF;
END $$;

-- 3. Price history positive unitprice constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_pricehist_unitprice_positive'
          AND conrelid = 'pricehist'::regclass
    ) THEN
        ALTER TABLE pricehist
            ADD CONSTRAINT chk_pricehist_unitprice_positive
            CHECK (unitprice > 0);
    END IF;
END $$;

COMMIT;
