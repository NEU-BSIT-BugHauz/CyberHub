const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireModulePermission } = require('../services/permissionService');

const router = express.Router();

const VALID_UNITS = Object.freeze(['pc', 'ea', 'mtr', 'pkg', 'ltr']);
const PRODUCT_CODE_PATTERN = /^[A-Za-z0-9_-]{1,6}$/;
const requireView = requireModulePermission('Product', 'can_view');
const requireCreate = requireModulePermission('Product', 'can_create');
const requireEdit = requireModulePermission('Product', 'can_edit');
const requireDelete = requireModulePermission('Product', 'can_delete');

function validateProductCode(req, res, next) {
  if (!PRODUCT_CODE_PATTERN.test(req.params.prodcode)) {
    return res.status(400).json({ error: 'Invalid product code.' });
  }
  req.productCode = req.params.prodcode.toUpperCase();
  return next();
}

function validateProduct(body, creating) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Invalid product data.' };
  }

  const { prodcode, description, unit } = body;

  if (creating && (typeof prodcode !== 'string' ||
      !PRODUCT_CODE_PATTERN.test(prodcode.trim()))) {
    return { error: 'Product code must be 1-6 letters, numbers, underscores, or hyphens.' };
  }

  if (typeof description !== 'string' ||
      description.trim().length < 1 ||
      description.trim().length > 30) {
    return { error: 'Description must be 1-30 characters.' };
  }

  if (typeof unit !== 'string' || !VALID_UNITS.includes(unit.trim().toLowerCase())) {
    return { error: 'Unit must be pc, ea, mtr, pkg, or ltr.' };
  }

  return {
    product: {
      ...(creating ? { prodcode: prodcode.trim().toUpperCase() } : {}),
      description: description.trim(),
      unit: unit.trim().toLowerCase(),
    },
  };
}

// Viewing deleted products requires BOTH view and delete permissions.
// Validate and normalize status before making the extra permission decision.
function requireListStatusPermission(req, res, next) {
  const rawStatus = req.query.status ?? 'active';
  if (typeof rawStatus !== 'string') {
    return res.status(400).json({ error: 'Invalid product status. Use active or deleted.' });
  }

  const status = rawStatus.trim().toLowerCase();
  if (status !== 'active' && status !== 'deleted') {
    return res.status(400).json({ error: 'Invalid product status. Use active or deleted.' });
  }

  req.productListStatus = status;
  if (status === 'deleted') return requireDelete(req, res, next);
  return next();
}

// S2-DEV-04/06: active or deleted list, search, and unit filter.
router.get('/', requireAuth, requireView, requireListStatusPermission, async (req, res, next) => {
  try {
    const search = req.query.search ?? '';
    const unit = req.query.unit ?? '';

    if (typeof search !== 'string' || typeof unit !== 'string') {
      return res.status(400).json({ error: 'Invalid search or unit parameter.' });
    }

    const normalizedSearch = search.trim();
    const normalizedUnit = unit.trim().toLowerCase();

    if (normalizedSearch.length > 150) {
      return res.status(400).json({ error: 'Search must be 150 characters or fewer.' });
    }
    if (normalizedUnit && !VALID_UNITS.includes(normalizedUnit)) {
      return res.status(400).json({ error: 'Invalid unit. Use pc, ea, mtr, pkg, or ltr.' });
    }

    // Safe: this is selected from fixed SQL fragments, not a user-supplied string.
    const deletionPredicate = req.productListStatus === 'deleted'
      ? 'is_deleted = TRUE'
      : 'is_deleted = FALSE';

    // As-of-today price: latest active effective date not in the future.
    // LATERAL fetches at most one price for each product. PostgreSQL's date
    // is interpreted in the same Asia/Manila timezone used by HopeDB audits.
    const result = await pool.query(
      `SELECT p.prodcode, p.description, p.unit, p.is_deleted, p.deleted_at, p.deleted_by,
              current_price.unitprice AS current_price,
              TO_CHAR(current_price.effdate, 'YYYY-MM-DD') AS current_price_effdate
       FROM product p
       LEFT JOIN LATERAL (
         SELECT ph.unitprice, ph.effdate
         FROM pricehist ph
         WHERE ph.prodcode = p.prodcode
           AND ph.is_deleted = FALSE
           AND ph.effdate <= (NOW() AT TIME ZONE 'Asia/Manila')::date
           AND p.is_deleted = FALSE
         ORDER BY ph.effdate DESC
         LIMIT 1
       ) current_price ON TRUE
       WHERE ${deletionPredicate}
         AND (
           $1 = ''
           OR p.prodcode ILIKE '%' || $1 || '%'
           OR COALESCE(p.description, '') ILIKE '%' || $1 || '%'
         )
         AND ($2 = '' OR p.unit = $2)
       ORDER BY p.prodcode ASC`,
      [normalizedSearch, normalizedUnit]
    );

    return res.json({ products: result.rows });
  } catch (err) {
    return next(err);
  }
});


// S2-DEV-08: fetch the current effective price for one active product.
// This route is read-only and requires Product can_view independently of
// Customer permissions and all Product write permissions.
router.get('/:prodcode/current-price', requireAuth, requireView, validateProductCode,
  async (req, res, next) => {
    try {
      const result = await pool.query(
        `SELECT p.prodcode,
                current_price.unitprice AS current_price,
                TO_CHAR(current_price.effdate, 'YYYY-MM-DD') AS current_price_effdate
         FROM product p
         LEFT JOIN LATERAL (
           SELECT ph.unitprice, ph.effdate
           FROM pricehist ph
           WHERE ph.prodcode = p.prodcode
             AND ph.is_deleted = FALSE
             AND ph.effdate <= (NOW() AT TIME ZONE 'Asia/Manila')::date
           ORDER BY ph.effdate DESC
           LIMIT 1
         ) current_price ON TRUE
         WHERE p.prodcode = $1 AND p.is_deleted = FALSE`,
        [req.productCode]
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: 'Active product not found.' });
      }
      return res.json({ product: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  }
);

// Product codes remain reserved when soft-deleted; restore existing rows.
router.post('/', requireAuth, requireCreate, async (req, res, next) => {
  try {
    const validation = validateProduct(req.body, true);
    if (validation.error) return res.status(400).json({ error: validation.error });

    const { prodcode, description, unit } = validation.product;
    const result = await pool.query(
      `INSERT INTO product (prodcode, description, unit)
       VALUES ($1, $2, $3)
       RETURNING prodcode, description, unit, is_deleted, deleted_at, deleted_by`,
      [prodcode, description, unit]
    );

    return res.status(201).json({ product: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Product code already exists. Restore the deleted product if applicable.',
      });
    }
    return next(err);
  }
});

// Product code is immutable; soft-deleted products cannot be edited.
router.put('/:prodcode', requireAuth, requireEdit, validateProductCode, async (req, res, next) => {
  try {
    if (
      req.body &&
      Object.prototype.hasOwnProperty.call(req.body, 'prodcode') &&
      (typeof req.body.prodcode !== 'string' ||
        req.body.prodcode.trim().toUpperCase() !== req.productCode)
    ) {
      return res.status(400).json({ error: 'Product code cannot be changed.' });
    }

    const validation = validateProduct(req.body, false);
    if (validation.error) return res.status(400).json({ error: validation.error });

    const { description, unit } = validation.product;
    const result = await pool.query(
      `UPDATE product
       SET description = $2, unit = $3
       WHERE prodcode = $1 AND is_deleted = FALSE
       RETURNING prodcode, description, unit, is_deleted, deleted_at, deleted_by`,
      [req.productCode, description, unit]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Active product not found.' });
    }

    return res.json({ product: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

// S2-DEV-06: DELETE is non-destructive. Record who deleted the product.
router.delete('/:prodcode', requireAuth, requireDelete, validateProductCode, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE product
       SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $2
       WHERE prodcode = $1 AND is_deleted = FALSE
       RETURNING prodcode, description, unit, is_deleted, deleted_at, deleted_by`,
      [req.productCode, req.currentUser.user_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Active product not found.' });
    }
    return res.json({ product: result.rows[0] });
  } catch (err) {
    // The original audited HopeDB schema may block a soft-delete while
    // active sales details or price-history entries reference this product.
    if (err.code === 'P0001' && /Cannot delete product row: \d+ active related record\(s\)/i.test(err.message || '')) {
      return res.status(409).json({
        error: 'This product has active related records and cannot be deleted.',
      });
    }
    return next(err);
  }
});

// Restore a previously soft-deleted product. The original code remains in use.
router.patch('/:prodcode/restore', requireAuth, requireDelete, validateProductCode, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE product
       SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL
       WHERE prodcode = $1 AND is_deleted = TRUE
       RETURNING prodcode, description, unit, is_deleted, deleted_at, deleted_by`,
      [req.productCode]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Deleted product not found.' });
    }
    return res.json({ product: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});


// S2-DEV-07: Effective-dated price history.
// In HopeDB, unquoted effDate/prodCode/unitPrice become effdate/prodcode/unitprice.
// The (effdate, prodcode) primary key remains immutable and unique.
const PRICE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PRICE_AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/;

function validPriceDate(value) {
  if (typeof value !== 'string' || !PRICE_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validatePriceDateParam(req, res, next) {
  if (!validPriceDate(req.params.effdate)) {
    return res.status(400).json({ error: 'Effective date must be a real date in YYYY-MM-DD format.' });
  }
  return next();
}

function validatedPriceAmount(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const amount = String(value).trim();
  if (!PRICE_AMOUNT_PATTERN.test(amount) || Number(amount) <= 0) return null;
  return amount;
}

function requirePriceListStatus(req, res, next) {
  const raw = req.query.status ?? 'active';
  if (typeof raw !== 'string') {
    return res.status(400).json({ error: 'Invalid price status. Use active or deleted.' });
  }
  const status = raw.trim().toLowerCase();
  if (!['active', 'deleted'].includes(status)) {
    return res.status(400).json({ error: 'Invalid price status. Use active or deleted.' });
  }
  req.priceListStatus = status;
  return status === 'deleted' ? requireDelete(req, res, next) : next();
}

// List the selected active product's historical prices, newest first.
// The deleted-price view requires BOTH can_view and can_delete.
router.get('/:prodcode/prices', requireAuth, requireView, validateProductCode,
  requirePriceListStatus, async (req, res, next) => {
    try {
      const product = await pool.query(
        'SELECT prodcode FROM product WHERE prodcode = $1 AND is_deleted = FALSE',
        [req.productCode]
      );
      if (!product.rows.length) {
        return res.status(404).json({ error: 'Active product not found.' });
      }
      const predicate = req.priceListStatus === 'deleted'
        ? 'is_deleted = TRUE' : 'is_deleted = FALSE';
      const result = await pool.query(
        `SELECT TO_CHAR(effdate, 'YYYY-MM-DD') AS effdate,
                prodcode, unitprice, is_deleted, deleted_at, deleted_by
         FROM pricehist
         WHERE prodcode = $1 AND ${predicate}
         ORDER BY effdate DESC`,
        [req.productCode]
      );
      return res.json({ prices: result.rows });
    } catch (error) {
      return next(error);
    }
  }
);

// A price date can be used only once for each product, including deleted dates.
// Restoring an old date is safer than overwriting its historical identity.
router.post('/:prodcode/prices', requireAuth, requireCreate, validateProductCode,
  async (req, res, next) => {
    try {
      const { effdate, unitprice } = req.body || {};
      if (!validPriceDate(effdate)) {
        return res.status(400).json({ error: 'Effective date must be a real date in YYYY-MM-DD format.' });
      }
      const amount = validatedPriceAmount(unitprice);
      if (amount === null) {
        return res.status(400).json({ error: 'Unit price must be between 0.01 and 99999999.99, with at most 2 decimal places.' });
      }
      const result = await pool.query(
        `INSERT INTO pricehist (prodcode, effdate, unitprice)
         SELECT prodcode, $2::date, $3::numeric
         FROM product
         WHERE prodcode = $1 AND is_deleted = FALSE
         RETURNING TO_CHAR(effdate, 'YYYY-MM-DD') AS effdate,
                   prodcode, unitprice, is_deleted, deleted_at, deleted_by`,
        [req.productCode, effdate, amount]
      );
      if (!result.rows.length) {
        return res.status(404).json({ error: 'Active product not found.' });
      }
      return res.status(201).json({ price: result.rows[0] });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'A price for this product and date already exists. Restore it if it was deleted.',
        });
      }
      return next(error);
    }
  }
);

// Effective dates and product codes cannot be changed through price edits.
router.put('/:prodcode/prices/:effdate', requireAuth, requireEdit,
  validateProductCode, validatePriceDateParam, async (req, res, next) => {
    try {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Invalid price data.' });
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'effdate') &&
          req.body.effdate !== req.params.effdate) {
        return res.status(400).json({ error: 'Effective date cannot be changed.' });
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'prodcode') &&
          (typeof req.body.prodcode !== 'string' || req.body.prodcode.trim().toUpperCase() !== req.productCode)) {
        return res.status(400).json({ error: 'Product code cannot be changed.' });
      }
      const amount = validatedPriceAmount(req.body.unitprice);
      if (amount === null) {
        return res.status(400).json({ error: 'Unit price must be between 0.01 and 99999999.99, with at most 2 decimal places.' });
      }
      const result = await pool.query(
        `UPDATE pricehist SET unitprice = $3::numeric
         WHERE prodcode = $1 AND effdate = $2::date AND is_deleted = FALSE
           AND EXISTS (SELECT 1 FROM product WHERE prodcode = $1 AND is_deleted = FALSE)
         RETURNING TO_CHAR(effdate, 'YYYY-MM-DD') AS effdate,
                   prodcode, unitprice, is_deleted, deleted_at, deleted_by`,
        [req.productCode, req.params.effdate, amount]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Active price not found.' });
      return res.json({ price: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  }
);

// Non-destructive delete: existing HopeDB audit triggers can record the action.
router.delete('/:prodcode/prices/:effdate', requireAuth, requireDelete,
  validateProductCode, validatePriceDateParam, async (req, res, next) => {
    try {
      const result = await pool.query(
        `UPDATE pricehist
         SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $3
         WHERE prodcode = $1 AND effdate = $2::date AND is_deleted = FALSE
           AND EXISTS (SELECT 1 FROM product WHERE prodcode = $1 AND is_deleted = FALSE)
         RETURNING TO_CHAR(effdate, 'YYYY-MM-DD') AS effdate,
                   prodcode, unitprice, is_deleted, deleted_at, deleted_by`,
        [req.productCode, req.params.effdate, req.currentUser.user_id]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Active price not found.' });
      return res.json({ price: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  }
);

// Re-enable a previously deleted historical price without duplicating its date.
router.patch('/:prodcode/prices/:effdate/restore', requireAuth, requireDelete,
  validateProductCode, validatePriceDateParam, async (req, res, next) => {
    try {
      const result = await pool.query(
        `UPDATE pricehist
         SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL
         WHERE prodcode = $1 AND effdate = $2::date AND is_deleted = TRUE
           AND EXISTS (SELECT 1 FROM product WHERE prodcode = $1 AND is_deleted = FALSE)
         RETURNING TO_CHAR(effdate, 'YYYY-MM-DD') AS effdate,
                   prodcode, unitprice, is_deleted, deleted_at, deleted_by`,
        [req.productCode, req.params.effdate]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Deleted price not found.' });
      return res.json({ price: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
