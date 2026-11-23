-- 001_hope_base_tables.sql
-- S1-DBA-02: HOPE base tables and initial sample data (from HopeDB_audit.sql)

CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin', 'superadmin')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'blocked')),
  must_set_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_resets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_rights (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_name VARCHAR(30) NOT NULL
    CHECK (module_name IN ('Customer', 'Product', 'Human Resources', 'Sales', 'Reports')),
  can_view BOOLEAN NOT NULL DEFAULT FALSE,
  can_create BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_name)
);

-- ============================================================================
-- Sample Seed Data (Idempotent — safe to re-run without duplicate errors)
-- ============================================================================

INSERT INTO users (full_name, email, password_hash, role, status, must_set_password)
VALUES
  ('System Superadmin', 'superadmin@cyberhub.local', NULL, 'superadmin', 'active', TRUE),
  ('Operations Admin', 'admin@cyberhub.local', NULL, 'admin', 'active', TRUE),
  ('Staff Member', 'staff@cyberhub.local', NULL, 'user', 'active', TRUE),
  ('Pending Applicant', 'pending@cyberhub.local', NULL, 'user', 'pending', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Grant full module permissions to the sample Operations Admin
INSERT INTO user_rights (user_id, module_name, can_view, can_create, can_edit, can_delete)
SELECT u.id, m.module_name, TRUE, TRUE, TRUE, TRUE
FROM users u
CROSS JOIN (
  VALUES
    ('Customer'),
    ('Product'),
    ('Human Resources'),
    ('Sales'),
    ('Reports')
) AS m(module_name)
WHERE u.email = 'admin@cyberhub.local'
ON CONFLICT (user_id, module_name) DO NOTHING;

-- Grant view-only access on Customer and Product to the sample Staff Member
INSERT INTO user_rights (user_id, module_name, can_view, can_create, can_edit, can_delete)
SELECT u.id, m.module_name, TRUE, FALSE, FALSE, FALSE
FROM users u
CROSS JOIN (
  VALUES
    ('Customer'),
    ('Product')
) AS m(module_name)
WHERE u.email = 'staff@cyberhub.local'
ON CONFLICT (user_id, module_name) DO NOTHING;
