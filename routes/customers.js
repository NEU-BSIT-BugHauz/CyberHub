
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



function validateCustomer(body, creating) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Invalid customer data.';
  const { custno, custname, address, payterm } = body;
  if (address != null && typeof address !== 'string') return 'Address must be text.';
  if (creating && (typeof custno !== 'string' || !/^[A-Za-z0-9_-]{1,20}$/.test(custno.trim()))) {
    return 'Customer number must be 1–20 letters, numbers, underscores, or hyphens.';
  }
  if (typeof custname !== 'string' || !custname.trim() || custname.trim().length > 150) {
    return 'Customer name must be 1–150 characters.';
  }
  if (address != null && (typeof address !== 'string' || address.trim().length > 2000)) {
    return 'Address must be 2000 characters or fewer.';
  }
  if (typeof payterm !== 'string' || !VALID_PAYMENT_TERMS.includes(payterm)) {
    return 'Payment term must be COD, 30D, or 45D.';
  }
  return null;
}

router.post(
  '/',
  requireAuth,
  requireModulePermission('Customer', 'can_create'),
  async (req, res, next) => {
    try {
      const error = validateCustomer(req.body, true);
      if (error) return res.status(400).json({ error });
      const { custno, custname, address, payterm } = req.body;
      const result = await pool.query(
        `INSERT INTO customer (custno, custname, address, payterm)
         VALUES ($1, $2, $3, $4)
         RETURNING custno, custname, address, payterm`,
        [custno.trim(), custname.trim(), (address || '').trim() || null, payterm]
      );
      return res.status(201).json({ customer: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Customer number already exists.' });
      return next(err);
    }
  }
);

router.put(
  '/:custno',
  requireAuth,
  requireModulePermission('Customer', 'can_edit'),
  async (req, res, next) => {
    try {
      if (!/^[A-Za-z0-9_-]{1,20}$/.test(req.params.custno)) {
        return res.status(400).json({ error: 'Invalid customer number.' });
      }
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'custno') &&
          req.body.custno !== req.params.custno) {
        return res.status(400).json({ error: 'Customer number cannot be changed.' });
      }
      const error = validateCustomer(req.body, false);
      if (error) return res.status(400).json({ error });
      const { custname, address, payterm } = req.body;
      const result = await pool.query(
        `UPDATE customer
         SET custname = $2, address = $3, payterm = $4
         WHERE custno = $1
         RETURNING custno, custname, address, payterm`,
        [req.params.custno, custname.trim(), (address || '').trim() || null, payterm]
      );
      if (!result.rows.length) return res.status(404).json({ error: 'Customer not found.' });
      return res.json({ customer: result.rows[0] });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
