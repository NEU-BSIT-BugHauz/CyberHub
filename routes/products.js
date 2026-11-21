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

    const result = await pool.query(
      `SELECT prodcode, description, unit, is_deleted, deleted_at, deleted_by
       FROM product
       WHERE ${deletionPredicate}
         AND (
           $1 = ''
           OR prodcode ILIKE '%' || $1 || '%'
           OR COALESCE(description, '') ILIKE '%' || $1 || '%'
         )
         AND ($2 = '' OR unit = $2)
       ORDER BY prodcode ASC`,
      [normalizedSearch, normalizedUnit]
    );

    return res.json({ products: result.rows });
  } catch (err) {
    return next(err);
  }
});

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

module.exports = router;
