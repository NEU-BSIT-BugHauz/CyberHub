const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireModulePermission } = require('../services/permissionService');

const router = express.Router();

const VALID_UNITS = Object.freeze(['pc', 'ea', 'mtr', 'pkg', 'ltr']);

// S2-DEV-04: Read-only Product listing. Write operations are separate tasks.
router.get(
  '/',
  requireAuth,
  requireModulePermission('Product', 'can_view'),
  async (req, res, next) => {
    try {
      const search = req.query.search ?? '';
      const unit = req.query.unit ?? '';

      if (typeof search !== 'string' || typeof unit !== 'string') {
        return res.status(400).json({
          error: 'Invalid search or unit parameter.',
        });
      }

      const normalizedSearch = search.trim();
      const normalizedUnit = unit.trim().toLowerCase();

      if (normalizedSearch.length > 150) {
        return res.status(400).json({
          error: 'Search must be 150 characters or fewer.',
        });
      }

      if (normalizedUnit && !VALID_UNITS.includes(normalizedUnit)) {
        return res.status(400).json({
          error: 'Invalid unit. Use pc, ea, mtr, pkg, or ltr.',
        });
      }

      const result = await pool.query(
        `SELECT
            prodcode,
            description,
            unit
         FROM product
         WHERE is_deleted = FALSE
           AND (
             $1 = ''
             OR prodcode ILIKE '%' || $1 || '%'
             OR COALESCE(description, '') ILIKE '%' || $1 || '%'
           )
           AND (
             $2 = ''
             OR unit = $2
           )
         ORDER BY prodcode ASC`,
        [normalizedSearch, normalizedUnit]
      );

      return res.json({ products: result.rows });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
