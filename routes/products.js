const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireModulePermission } = require('../services/permissionService');

const router = express.Router();

const VALID_UNITS = Object.freeze(['pc', 'ea', 'mtr', 'pkg', 'ltr']);
const PRODUCT_CODE_PATTERN = /^[A-Za-z0-9_-]{1,6}$/;

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

// S2-DEV-04: list, search, and unit filter (active products only).
router.get(
  '/',
  requireAuth,
  requireModulePermission('Product', 'can_view'),
  async (req, res, next) => {
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

      const result = await pool.query(
        `SELECT prodcode, description, unit
         FROM product
         WHERE is_deleted = FALSE
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
  }
);

// S2-DEV-05: create a new active product. Product codes stay unique even
// when a record is soft-deleted (handled by Product Delete/Restore task).
router.post(
  '/',
  requireAuth,
  requireModulePermission('Product', 'can_create'),
  async (req, res, next) => {
    try {
      const validation = validateProduct(req.body, true);
      if (validation.error) return res.status(400).json({ error: validation.error });

      const { prodcode, description, unit } = validation.product;
      const result = await pool.query(
        `INSERT INTO product (prodcode, description, unit)
         VALUES ($1, $2, $3)
         RETURNING prodcode, description, unit`,
        [prodcode, description, unit]
      );

      return res.status(201).json({ product: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({
          error: 'Product code already exists. Deleted product codes remain reserved.',
        });
      }
      return next(err);
    }
  }
);

// Product code is immutable; soft-deleted products cannot be edited.
router.put(
  '/:prodcode',
  requireAuth,
  requireModulePermission('Product', 'can_edit'),
  validateProductCode,
  async (req, res, next) => {
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
         RETURNING prodcode, description, unit`,
        [req.productCode, description, unit]
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: 'Active product not found.' });
      }

      return res.json({ product: result.rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
