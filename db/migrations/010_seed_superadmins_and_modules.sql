-- 010_seed_superadmins_and_modules.sql
-- S1-DBA-05: Seed data — one superadmin account per team member and system modules

BEGIN;

-- 1. Seed system modules table
CREATE TABLE IF NOT EXISTS modules (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  module_name VARCHAR(30) NOT NULL UNIQUE
    CHECK (module_name IN ('Customer', 'Product', 'Human Resources', 'Sales', 'Reports')),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO modules (module_name, description)
VALUES
  ('Customer',        'Customer records and account management'),
  ('Product',         'Product catalog, pricing, and history management'),
  ('Human Resources', 'Employee profiles, departments, and job assignments'),
  ('Sales',           'Sales orders, transactions, and invoicing'),
  ('Reports',         'Operational and financial reporting')
ON CONFLICT (module_name) DO NOTHING;

-- 2. Ensure matching active employee rows (EMP01..EMP05) exist for users.empno FK
DO $$
DECLARE
  v_deptcode TEXT := NULL;
  v_jobcode  TEXT := NULL;
  v_cols     TEXT;
  v_vals     TEXT;
  v_sql      TEXT;
  rec        RECORD;
  col_rec    RECORD;
BEGIN
  IF to_regclass('public.employee') IS NOT NULL THEN
    IF to_regclass('public.department') IS NOT NULL THEN
      BEGIN
        EXECUTE 'SELECT deptcode::text FROM department LIMIT 1' INTO v_deptcode;
        IF v_deptcode IS NULL THEN
          EXECUTE $q$
            INSERT INTO department (deptcode, deptname)
            VALUES ('IT', 'Information Technology')
            ON CONFLICT DO NOTHING
          $q$;
          EXECUTE 'SELECT deptcode::text FROM department LIMIT 1' INTO v_deptcode;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_deptcode := NULL;
      END;
    END IF;

    IF to_regclass('public.job') IS NOT NULL THEN
      BEGIN
        EXECUTE 'SELECT jobcode::text FROM job LIMIT 1' INTO v_jobcode;
        IF v_jobcode IS NULL THEN
          EXECUTE $q$
            INSERT INTO job (jobcode, jobdesc)
            VALUES ('ADMIN', 'System Administrator')
            ON CONFLICT DO NOTHING
          $q$;
          EXECUTE 'SELECT jobcode::text FROM job LIMIT 1' INTO v_jobcode;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_jobcode := NULL;
      END;
    END IF;

    FOR rec IN
      SELECT * FROM (
        VALUES
          ('EMP01', 'Dala',   'Rolando Jr.',     NULL, 'rolandojrdala@neu.edu.ph'),
          ('EMP02', 'Asne',   'Elias',           NULL, 'asne.elias@neu.edu.ph'),
          ('EMP03', 'Clet',   'Francis Nicolai', 'F.', 'francisnicolai.clet@neu.edu.ph'),
          ('EMP04', 'Lopez',  'Marc',            NULL, 'lopez.marc@neu.edu.ph'),
          ('EMP05', 'Lareza', 'Danreih',         NULL, 'danreih.lareza@neu.edu.ph')
      ) AS t(empno, lastname, firstname, midname, email)
    LOOP
      v_cols := '';
      v_vals := '';

      FOR col_rec IN
        SELECT column_name, data_type, is_nullable, column_default, is_identity
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'employee'
        ORDER BY ordinal_position
      LOOP
        IF col_rec.is_identity = 'YES' OR col_rec.column_default LIKE 'nextval(%' THEN
          CONTINUE;
        END IF;

        IF col_rec.column_name = 'empno' THEN
          v_cols := v_cols || ', empno';
          v_vals := v_vals || ', ' || quote_literal(rec.empno);
        ELSIF col_rec.column_name IN ('lastname', 'last_name') THEN
          v_cols := v_cols || ', ' || quote_ident(col_rec.column_name);
          v_vals := v_vals || ', ' || quote_literal(rec.lastname);
        ELSIF col_rec.column_name IN ('firstname', 'first_name') THEN
          v_cols := v_cols || ', ' || quote_ident(col_rec.column_name);
          v_vals := v_vals || ', ' || quote_literal(rec.firstname);
        ELSIF col_rec.column_name IN ('midname', 'middle_name') THEN
          v_cols := v_cols || ', ' || quote_ident(col_rec.column_name);
          v_vals := v_vals || ', ' || COALESCE(quote_literal(rec.midname), 'NULL');
        ELSIF col_rec.column_name = 'email' THEN
          v_cols := v_cols || ', email';
          v_vals := v_vals || ', ' || quote_literal(rec.email);
        ELSIF col_rec.column_name IN ('gender', 'sex') THEN
          v_cols := v_cols || ', ' || quote_ident(col_rec.column_name);
          v_vals := v_vals || ', ''M''';
        ELSIF col_rec.column_name IN ('birthdate', 'birth_date') THEN
          v_cols := v_cols || ', ' || quote_ident(col_rec.column_name);
          v_vals := v_vals || ', DATE ''2003-01-01''';
        ELSIF col_rec.column_name IN ('hiredate', 'hire_date') THEN
          v_cols := v_cols || ', ' || quote_ident(col_rec.column_name);
          v_vals := v_vals || ', CURRENT_DATE';
        ELSIF col_rec.column_name IN ('sepdate', 'sep_date') THEN
          v_cols := v_cols || ', ' || quote_ident(col_rec.column_name);
          v_vals := v_vals || ', NULL';
        ELSIF col_rec.column_name = 'is_deleted' THEN
          v_cols := v_cols || ', is_deleted';
          v_vals := v_vals || ', FALSE';
        ELSIF col_rec.column_name IN ('deptcode', 'dept_code') AND v_deptcode IS NOT NULL THEN
          v_cols := v_cols || ', ' || quote_ident(col_rec.column_name);
          v_vals := v_vals || ', ' || quote_literal(v_deptcode);
        ELSIF col_rec.column_name IN ('jobcode', 'job_code') AND v_jobcode IS NOT NULL THEN
          v_cols := v_cols || ', ' || quote_ident(col_rec.column_name);
          v_vals := v_vals || ', ' || quote_literal(v_jobcode);
        ELSIF col_rec.is_nullable = 'NO' AND col_rec.column_default IS NULL THEN
          v_cols := v_cols || ', ' || quote_ident(col_rec.column_name);
          IF col_rec.data_type IN ('integer', 'bigint', 'smallint', 'numeric', 'real', 'double precision') THEN
            v_vals := v_vals || ', 0';
          ELSIF col_rec.data_type = 'boolean' THEN
            v_vals := v_vals || ', FALSE';
          ELSIF col_rec.data_type = 'date' THEN
            v_vals := v_vals || ', CURRENT_DATE';
          ELSIF col_rec.data_type LIKE 'timestamp%' THEN
            v_vals := v_vals || ', NOW()';
          ELSE
            v_vals := v_vals || ', ''N/A''';
          END IF;
        END IF;
      END LOOP;

      IF length(v_cols) > 2 THEN
        v_sql := format(
          'INSERT INTO employee (%s) VALUES (%s) ON CONFLICT (empno) DO NOTHING',
          substring(v_cols FROM 3),
          substring(v_vals FROM 3)
        );
        EXECUTE v_sql;
      END IF;
    END LOOP;
  END IF;
END $$;

-- 3. Seed one active superadmin account per team member
INSERT INTO users (
  full_name,
  email,
  empno,
  password_hash,
  role,
  status,
  must_set_password
)
VALUES
  ('Rolando Dala Jr.',        'rolandojrdala@neu.edu.ph',       'EMP01', NULL, 'superadmin', 'active', TRUE),
  ('Elias Asne',              'asne.elias@neu.edu.ph',          'EMP02', NULL, 'superadmin', 'active', TRUE),
  ('Francis Nicolai F. Clet', 'francisnicolai.clet@neu.edu.ph', 'EMP03', NULL, 'superadmin', 'active', TRUE),
  ('Marc Lopez',              'lopez.marc@neu.edu.ph',          'EMP04', NULL, 'superadmin', 'active', TRUE),
  ('Danreih Lareza',          'danreih.lareza@neu.edu.ph',      'EMP05', NULL, 'superadmin', 'active', TRUE)
ON CONFLICT (email) DO UPDATE
SET
  full_name  = EXCLUDED.full_name,
  empno      = COALESCE(users.empno, EXCLUDED.empno),
  role       = 'superadmin',
  status     = 'active',
  updated_at = NOW();

-- 4. Grant full module rights across all 5 modules to each superadmin
INSERT INTO user_rights (
  user_id,
  module_name,
  can_view,
  can_create,
  can_edit,
  can_delete
)
SELECT
  u.id,
  m.module_name,
  TRUE,
  TRUE,
  TRUE,
  TRUE
FROM users u
CROSS JOIN (
  VALUES
    ('Customer'),
    ('Product'),
    ('Human Resources'),
    ('Sales'),
    ('Reports')
) AS m(module_name)
WHERE LOWER(u.email) IN (
  'rolandojrdala@neu.edu.ph',
  'asne.elias@neu.edu.ph',
  'francisnicolai.clet@neu.edu.ph',
  'lopez.marc@neu.edu.ph',
  'danreih.lareza@neu.edu.ph'
)
ON CONFLICT (user_id, module_name) DO UPDATE
SET
  can_view   = TRUE,
  can_create = TRUE,
  can_edit   = TRUE,
  can_delete = TRUE,
  updated_at = NOW();

COMMIT;
