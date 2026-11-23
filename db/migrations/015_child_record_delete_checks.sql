-- 015_child_record_delete_checks.sql
-- S2-DBA-04: Enforce and verify child-record delete checks for customer and product

BEGIN;

-- 1. Ensure explicit ON DELETE RESTRICT foreign keys exist on child tables
DO $$
BEGIN
    -- pricehist -> product
    IF to_regclass('public.pricehist') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'pricehist'::regclass
             AND confrelid = 'product'::regclass
             AND contype = 'f'
       ) THEN
        ALTER TABLE pricehist
            ADD CONSTRAINT fk_pricehist_product
            FOREIGN KEY (prodcode)
            REFERENCES product (prodcode)
            ON DELETE RESTRICT;
    END IF;

    -- sales -> customer (when sales table is present)
    IF to_regclass('public.sales') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'sales'
             AND column_name = 'custno'
       )
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'sales'::regclass
             AND confrelid = 'customer'::regclass
             AND contype = 'f'
       ) THEN
        ALTER TABLE sales
            ADD CONSTRAINT fk_sales_customer
            FOREIGN KEY (custno)
            REFERENCES customer (custno)
            ON DELETE RESTRICT;
    END IF;

    -- salesdetail -> product (when salesdetail table is present)
    IF to_regclass('public.salesdetail') IS NOT NULL
       AND EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'salesdetail'
             AND column_name = 'prodcode'
       )
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'salesdetail'::regclass
             AND confrelid = 'product'::regclass
             AND contype = 'f'
       ) THEN
        ALTER TABLE salesdetail
            ADD CONSTRAINT fk_salesdetail_product
            FOREIGN KEY (prodcode)
            REFERENCES product (prodcode)
            ON DELETE RESTRICT;
    END IF;
END $$;

-- 2. Diagnostic helper functions to inspect referencing child records
CREATE OR REPLACE FUNCTION check_customer_child_records(p_custno VARCHAR)
RETURNS TABLE (
    child_table TEXT,
    record_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_count BIGINT := 0;
    v_has_is_deleted BOOLEAN := FALSE;
BEGIN
    IF to_regclass('public.sales') IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'sales'
              AND column_name = 'is_deleted'
        ) INTO v_has_is_deleted;

        IF v_has_is_deleted THEN
            EXECUTE 'SELECT COUNT(*) FROM sales WHERE custno = $1 AND is_deleted = FALSE'
            INTO v_count
            USING p_custno;
        ELSE
            EXECUTE 'SELECT COUNT(*) FROM sales WHERE custno = $1'
            INTO v_count
            USING p_custno;
        END IF;

        IF v_count > 0 THEN
            child_table := 'sales';
            record_count := v_count;
            RETURN NEXT;
        END IF;
    END IF;

    RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION check_product_child_records(
    p_prodcode VARCHAR,
    p_include_pricehist BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
    child_table TEXT,
    record_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_count BIGINT := 0;
    v_has_is_deleted BOOLEAN := FALSE;
BEGIN
    IF p_include_pricehist AND to_regclass('public.pricehist') IS NOT NULL THEN
        SELECT COUNT(*)
        INTO v_count
        FROM pricehist
        WHERE prodcode = p_prodcode;

        IF v_count > 0 THEN
            child_table := 'pricehist';
            record_count := v_count;
            RETURN NEXT;
        END IF;
    END IF;

    IF to_regclass('public.salesdetail') IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'salesdetail'
              AND column_name = 'is_deleted'
        ) INTO v_has_is_deleted;

        IF v_has_is_deleted THEN
            EXECUTE 'SELECT COUNT(*) FROM salesdetail WHERE prodcode = $1 AND is_deleted = FALSE'
            INTO v_count
            USING p_prodcode;
        ELSE
            EXECUTE 'SELECT COUNT(*) FROM salesdetail WHERE prodcode = $1'
            INTO v_count
            USING p_prodcode;
        END IF;

        IF v_count > 0 THEN
            child_table := 'salesdetail';
            record_count := v_count;
            RETURN NEXT;
        END IF;
    END IF;

    RETURN;
END;
$$;

-- 3. Trigger functions guarding hard deletes and soft deletes when child records exist
CREATE OR REPLACE FUNCTION prevent_customer_delete_with_children()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_child RECORD;
BEGIN
    IF TG_OP = 'DELETE'
       OR (TG_OP = 'UPDATE' AND NEW.is_deleted = TRUE AND COALESCE(OLD.is_deleted, FALSE) = FALSE) THEN
        SELECT *
        INTO v_child
        FROM check_customer_child_records(OLD.custno)
        LIMIT 1;

        IF FOUND THEN
            RAISE EXCEPTION 'Cannot delete customer %: % referencing record(s) exist in %.',
                OLD.custno, v_child.record_count, v_child.child_table
                USING ERRCODE = '23503';
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_product_delete_with_children()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_child RECORD;
BEGIN
    IF TG_OP = 'DELETE' THEN
        SELECT *
        INTO v_child
        FROM check_product_child_records(OLD.prodcode, TRUE)
        LIMIT 1;

        IF FOUND THEN
            RAISE EXCEPTION 'Cannot hard-delete product %: % referencing record(s) exist in %.',
                OLD.prodcode, v_child.record_count, v_child.child_table
                USING ERRCODE = '23503';
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' AND NEW.is_deleted = TRUE AND COALESCE(OLD.is_deleted, FALSE) = FALSE THEN
        -- Allow product soft-delete when only pricehist rows exist, but block if active salesdetail rows exist
        SELECT *
        INTO v_child
        FROM check_product_child_records(OLD.prodcode, FALSE)
        LIMIT 1;

        IF FOUND THEN
            RAISE EXCEPTION 'Cannot deactivate product %: % active referencing record(s) exist in %.',
                OLD.prodcode, v_child.record_count, v_child.child_table
                USING ERRCODE = '23503';
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_customer_delete_with_children ON customer;
CREATE TRIGGER trg_prevent_customer_delete_with_children
    BEFORE DELETE OR UPDATE OF is_deleted ON customer
    FOR EACH ROW
    EXECUTE FUNCTION prevent_customer_delete_with_children();

DROP TRIGGER IF EXISTS trg_prevent_product_delete_with_children ON product;
CREATE TRIGGER trg_prevent_product_delete_with_children
    BEFORE DELETE OR UPDATE OF is_deleted ON product
    FOR EACH ROW
    EXECUTE FUNCTION prevent_product_delete_with_children();

COMMIT;
