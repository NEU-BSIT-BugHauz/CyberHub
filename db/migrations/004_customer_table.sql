
-- S2-DEV-01: Create the Customer table.

BEGIN;

CREATE TABLE IF NOT EXISTS customer (
    custno VARCHAR(20) PRIMARY KEY,
    custname VARCHAR(150) NOT NULL,
    address TEXT,
    payterm VARCHAR(10) NOT NULL
        CHECK (payterm IN ('COD', '30D', '45D'))
);

COMMIT;
