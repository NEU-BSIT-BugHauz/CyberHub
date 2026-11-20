-- S1-DEV-03: Link existing user accounts to employees.

BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS empno VARCHAR(5);

CREATE UNIQUE INDEX IF NOT EXISTS users_empno_unique_idx
    ON users (empno);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_empno_fkey'
          AND conrelid = 'users'::regclass
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_empno_fkey
            FOREIGN KEY (empno)
            REFERENCES employee(empno);
    END IF;
END $$;

COMMIT;
