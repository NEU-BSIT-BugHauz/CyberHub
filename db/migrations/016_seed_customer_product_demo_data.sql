-- 016_seed_customer_product_demo_data.sql
-- S2-DBA-05: Seed demo data for customer, product, and effective-dated pricehist

BEGIN;

-- 1. Seed demo customers covering all valid payment terms ('COD', '30D', '45D')
INSERT INTO customer (
    custno,
    custname,
    address,
    payterm,
    is_deleted
)
VALUES
    ('CUST01', 'Northgate Tech Solutions Inc.', '142 Katipunan Ave., Quezon City',       '30D', FALSE),
    ('CUST02', 'MetroLink Systems Corp.',       '88 Ayala Ave., Makati City',            '45D', FALSE),
    ('CUST03', 'Apex Office & Retail Supply',   '215 Shaw Blvd., Mandaluyong City',      'COD', FALSE),
    ('CUST04', 'BlueRidge Logistics Group',     '54 Ortigas Ave., Pasig City',           '30D', FALSE),
    ('CUST05', 'Horizon Digital Enterprises',   '902 Espana Blvd., Sampaloc, Manila',    'COD', FALSE),
    ('CUST06', 'Silverline Industrial Trading', '17 MacArthur Hwy., Valenzuela City',    '45D', FALSE),
    ('CUST07', 'Eastwood Cloud Builders',       '12 Orchard Rd., Libis, Quezon City',    '30D', FALSE),
    ('CUST08', 'Legacy Archive Corp. (Demo)',   '400 Taft Ave., Malate, Manila',         'COD', TRUE)
ON CONFLICT (custno) DO UPDATE
SET
    custname   = EXCLUDED.custname,
    address    = EXCLUDED.address,
    payterm    = EXCLUDED.payterm,
    is_deleted = EXCLUDED.is_deleted;

-- 2. Seed demo products covering all valid units ('pc', 'ea', 'mtr', 'pkg', 'ltr')
--    and respecting VARCHAR(6) prodcode and VARCHAR(30) description limits
INSERT INTO product (
    prodcode,
    description,
    unit,
    is_deleted,
    stamp
)
VALUES
    ('PROD01', 'CAT6 UTP Cable (Per Meter)',   'mtr', FALSE, 'SEED-S2-DBA-05'),
    ('PROD02', 'RJ45 Modular Plug (100/pack)', 'pkg', FALSE, 'SEED-S2-DBA-05'),
    ('PROD03', '24-Port Gigabit Switch',       'ea',  FALSE, 'SEED-S2-DBA-05'),
    ('PROD04', 'Fiber Patch Cord LC-LC 3m',    'pc',  FALSE, 'SEED-S2-DBA-05'),
    ('PROD05', 'Thermal Paste Syringe 4g',     'pc',  FALSE, 'SEED-S2-DBA-05'),
    ('PROD06', 'UPS Battery Backup 1000VA',    'ea',  FALSE, 'SEED-S2-DBA-05'),
    ('PROD07', 'Isopropyl Cleaning Solution',  'ltr', FALSE, 'SEED-S2-DBA-05'),
    ('PROD08', 'Cable Tie Assortment Pack',    'pkg', FALSE, 'SEED-S2-DBA-05'),
    ('PROD09', 'Legacy VGA Adapter (Demo)',    'pc',  TRUE,  'SEED-S2-DBA-05')
ON CONFLICT (prodcode) DO UPDATE
SET
    description = EXCLUDED.description,
    unit        = EXCLUDED.unit,
    is_deleted  = EXCLUDED.is_deleted,
    stamp       = EXCLUDED.stamp;

-- 3. Seed multi-date price history (past, current, and scheduled future dates)
--    so effective-dated lookups can be verified across multiple dates
INSERT INTO pricehist (
    effdate,
    prodcode,
    unitprice,
    is_deleted,
    stamp
)
VALUES
    -- PROD01: CAT6 UTP Cable (Per Meter)
    (DATE '2026-01-15', 'PROD01',   22.50, FALSE, 'SEED-S2-DBA-05'),
    (DATE '2026-06-01', 'PROD01',   25.00, FALSE, 'SEED-S2-DBA-05'),
    (DATE '2026-10-15', 'PROD01',   27.50, FALSE, 'SEED-S2-DBA-05'),
    (DATE '2026-12-15', 'PROD01',   29.00, FALSE, 'SEED-S2-DBA-05'),

    -- PROD02: RJ45 Modular Plug (100/pack)
    (DATE '2026-01-15', 'PROD02',  320.00, FALSE, 'SEED-S2-DBA-05'),
    (DATE '2026-07-01', 'PROD02',  350.00, FALSE, 'SEED-S2-DBA-05'),
    (DATE '2026-11-01', 'PROD02',  365.00, FALSE, 'SEED-S2-DBA-05'),

    -- PROD03: 24-Port Gigabit Switch
    (DATE '2026-02-01', 'PROD03', 4850.00, FALSE, 'SEED-S2-DBA-05'),
    (DATE '2026-08-15', 'PROD03', 5100.00, FALSE, 'SEED-S2-DBA-05'),
    (DATE '2026-11-10', 'PROD03', 5250.00, FALSE, 'SEED-S2-DBA-05'),

    -- PROD04: Fiber Patch Cord LC-LC 3m
    (DATE '2026-01-20', 'PROD04',  280.00, FALSE, 'SEED-S2-DBA-05'),
    (DATE '2026-09-01', 'PROD04',  310.00, FALSE, 'SEED-S2-DBA-05'),

    -- PROD05: Thermal Paste Syringe 4g
    (DATE '2026-03-01', 'PROD05',  195.00, FALSE, 'SEED-S2-DBA-05'),
    (DATE '2026-10-01', 'PROD05',  215.00, FALSE, 'SEED-S2-DBA-05'),

    -- PROD06: UPS Battery Backup 1000VA
    (DATE '2026-01-15', 'PROD06', 3400.00, FALSE, 'SEED-S2-DBA-05'),
    (DATE '2026-06-15', 'PROD06', 3650.00, FALSE, 'SEED-S2-DBA-05'),
    (DATE '2026-11-01', 'PROD06', 3790.00, FALSE, 'SEED-S2-DBA-05'),

    -- PROD07: Isopropyl Cleaning Solution
    (DATE '2026-02-10', 'PROD07',  160.00, FALSE, 'SEED-S2-DBA-05'),
    (DATE '2026-09-15', 'PROD07',  175.00, FALSE, 'SEED-S2-DBA-05'),

    -- PROD08: Cable Tie Assortment Pack
    (DATE '2026-04-01', 'PROD08',  140.00, FALSE, 'SEED-S2-DBA-05'),
    (DATE '2026-10-20', 'PROD08',  155.00, FALSE, 'SEED-S2-DBA-05'),

    -- PROD09: Legacy VGA Adapter (soft-deleted demo product)
    (DATE '2026-01-15', 'PROD09',  120.00, FALSE, 'SEED-S2-DBA-05')
ON CONFLICT (effdate, prodcode) DO UPDATE
SET
    unitprice  = EXCLUDED.unitprice,
    is_deleted = EXCLUDED.is_deleted,
    stamp      = EXCLUDED.stamp;

COMMIT;
