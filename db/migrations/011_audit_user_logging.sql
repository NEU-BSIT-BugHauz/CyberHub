-- 011_audit_user_logging.sql
-- S1-DBA-06: Configure audit_log table, audit_user() trigger function, and table audit triggers

BEGIN;

-- 1. Create or align the audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id TEXT,
  action VARCHAR(10) NOT NULL
    CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_by BIGINT NULL,
  db_user TEXT NOT NULL DEFAULT session_user,
  old_data JSONB,
  new_data JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS table_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS record_id TEXT,
  ADD COLUMN IF NOT EXISTS action VARCHAR(10),
  ADD COLUMN IF NOT EXISTS changed_by BIGINT,
  ADD COLUMN IF NOT EXISTS db_user TEXT DEFAULT session_user,
  ADD COLUMN IF NOT EXISTS old_data JSONB,
  ADD COLUMN IF NOT EXISTS new_data JSONB,
  ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS audit_log_table_action_idx
  ON audit_log (table_name, action);

CREATE INDEX IF NOT EXISTS audit_log_changed_at_idx
  ON audit_log (changed_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_changed_by_idx
  ON audit_log (changed_by);

-- 2. Create or replace the audit_user() trigger function
CREATE OR REPLACE FUNCTION audit_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_data   JSONB := NULL;
  v_new_data   JSONB := NULL;
  v_record_id  TEXT  := NULL;
  v_changed_by BIGINT := NULL;
  v_setting    TEXT;
BEGIN
  -- Safely read optional app-level user ID if set by backend session/transaction
  BEGIN
    v_setting := NULLIF(current_setting('app.current_user_id', true), '');
    IF v_setting IS NOT NULL THEN
      v_changed_by := v_setting::BIGINT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_changed_by := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    v_new_data := to_jsonb(NEW);
    -- Redact sensitive password hashes from audit payloads
    v_new_data := v_new_data - 'password_hash' - 'token_hash';
    v_record_id := COALESCE(
      v_new_data->>'id',
      v_new_data->>'empno',
      v_new_data->>'custno',
      v_new_data->>'prodcode',
      v_new_data->>'transno'
    );

    INSERT INTO audit_log (
      table_name,
      record_id,
      action,
      changed_by,
      db_user,
      old_data,
      new_data,
      changed_at
    )
    VALUES (
      TG_TABLE_NAME,
      v_record_id,
      'INSERT',
      v_changed_by,
      session_user,
      NULL,
      v_new_data,
      NOW()
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD) - 'password_hash' - 'token_hash';
    v_new_data := to_jsonb(NEW) - 'password_hash' - 'token_hash';
    v_record_id := COALESCE(
      v_new_data->>'id',
      v_new_data->>'empno',
      v_new_data->>'custno',
      v_new_data->>'prodcode',
      v_new_data->>'transno'
    );

    INSERT INTO audit_log (
      table_name,
      record_id,
      action,
      changed_by,
      db_user,
      old_data,
      new_data,
      changed_at
    )
    VALUES (
      TG_TABLE_NAME,
      v_record_id,
      'UPDATE',
      v_changed_by,
      session_user,
      v_old_data,
      v_new_data,
      NOW()
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD) - 'password_hash' - 'token_hash';
    v_record_id := COALESCE(
      v_old_data->>'id',
      v_old_data->>'empno',
      v_old_data->>'custno',
      v_old_data->>'prodcode',
      v_old_data->>'transno'
    );

    INSERT INTO audit_log (
      table_name,
      record_id,
      action,
      changed_by,
      db_user,
      old_data,
      new_data,
      changed_at
    )
    VALUES (
      TG_TABLE_NAME,
      v_record_id,
      'DELETE',
      v_changed_by,
      session_user,
      v_old_data,
      NULL,
      NOW()
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- 3. Attach audit_user() triggers to core auth and domain tables
DO $$
DECLARE
  t_name TEXT;
  t_list TEXT[] := ARRAY[
    'users',
    'user_rights',
    'password_resets',
    'employee',
    'customer',
    'product',
    'price_history',
    'sales',
    'salesdetail'
  ];
BEGIN
  FOREACH t_name IN ARRAY t_list
  LOOP
    IF to_regclass(format('public.%I', t_name)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON %I;', t_name, t_name);
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%I
         AFTER INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW
         EXECUTE FUNCTION audit_user();',
        t_name,
        t_name
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
