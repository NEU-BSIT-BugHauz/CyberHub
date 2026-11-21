
const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const {
  requireModulePermission,
} = require('../services/permissionService');

const router = express.Router();

const VALID_PAYMENT_TERMS = ['COD', '30D', '45D'];

// GET CUSTOMER LIST
router.get(
  '/',
  requireAuth,
  requireModulePermission('Customer', 'can_view'),
  async (req, res, next) => {
    try {
      const search = req.query.search ?? '';
      const payterm = req.query.payterm ?? '';

      if (typeof search !== 'string' || typeof payterm !== 'string') {
        return res.status(400).json({
          error: 'Invalid search or payment-term parameter.',
        });
      }

      const normalizedSearch = search.trim();
      const normalizedPayterm = payterm.trim().toUpperCase();

      if (
        normalizedPayterm &&
        !VALID_PAYMENT_TERMS.includes(normalizedPayterm)
      ) {
        return res.status(400).json({
          error: 'Invalid payment term. Use COD, 30D, or 45D.',
        });
      }

      const result = await pool.query(
        `SELECT
            custno,
            custname,
            address,
            payterm
         FROM customer
         WHERE (
           $1 = ''
           OR custno ILIKE '%' || $1 || '%'
           OR custname ILIKE '%' || $1 || '%'
           OR COALESCE(address, '') ILIKE '%' || $1 || '%'
         )
         AND (
           $2 = ''
           OR payterm = $2
         )
         ORDER BY custno ASC`,
        [normalizedSearch, normalizedPayterm]
      );

      return res.json({
        customers: result.rows,
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
