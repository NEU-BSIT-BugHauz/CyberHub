const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { requireModulePermission } = require('../services/permissionService');

const router = express.Router();
const VALID_PAYMENT_TERMS = ['COD', '30D', '45D'];
const CUSTOMER_NUMBER_PATTERN = /^[A-Za-z0-9_-]{1,20}$/;
const requireView = requireModulePermission('Customer', 'can_view');
const requireCreate = requireModulePermission('Customer', 'can_create');
const requireEdit = requireModulePermission('Customer', 'can_edit');
const requireDelete = requireModulePermission('Customer', 'can_delete');

function validateCustomer(body, creating) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Invalid customer data.';
  }

  const { custno, custname, address, payterm } = body;

  if (
    creating &&
    (typeof custno !== 'string' || !CUSTOMER_NUMBER_PATTERN.test(custno.trim()))
  ) {
    return 'Customer number must be 1-20 letters, numbers, underscores, or hyphens.';
  }

  if (
    typeof custname !== 'string' ||
    !custname.trim() ||
    custname.trim().length > 150
  ) {
    return 'Customer name must be 1-150 characters.';
  }

  if (address != null && typeof address !== 'string') {
    return 'Address must be text.';
  }
  if (address != null && address.trim().length > 2000) {
    return 'Address must be 2000 characters or fewer.';
  }

  if (typeof payterm !== 'string' || !VALID_PAYMENT_TERMS.includes(payterm)) {
    return 'Payment term must be COD, 30D, or 45D.';
  }
  return null;
}

function validateCustomerNumber(req, res, next) {
  if (!CUSTOMER_NUMBER_PATTERN.test(req.params.custno)) {
    return res.status(400).json({ error: 'Invalid customer number.' });
  }
  return next();
}

// Deleted customer listings require both view and delete permission.
// Normalize and validate BEFORE applying the additional permission check.
function requireListStatusPermission(req, res, next) {
  const rawStatus = req.query.status ?? 'active';
  if (typeof rawStatus !== 'string') {
    return res.status(400).json({ error: 'Invalid customer status. Use active or deleted.' });
  }
  const status = rawStatus.trim().toLowerCase();
  if (!['active', 'deleted'].includes(status)) {
    return res.status(400).json({ error: 'Invalid customer status. Use active or deleted.' });
  }
  req.customerListStatus = status;
  if (status === 'deleted') return requireDelete(req, res, next);
  return next();
}

// GET /api/customers?status=active|deleted
router.get('/', requireAuth, requireView, requireListStatusPermission, async (req, res, next) => {
  try {
    const search = req.query.search ?? '';
    const payterm = req.query.payterm ?? '';
    if (typeof search !== 'string' || typeof payterm !== 'string') {
      return res.status(400).json({ error: 'Invalid search or payment-term parameter.' });
    }

    const normalizedSearch = search.trim();
    const normalizedPayterm = payterm.trim().toUpperCase();
    if (normalizedSearch.length > 150) {
      return res.status(400).json({ error: 'Search must be 150 characters or fewer.' });
    }
    if (normalizedPayterm && !VALID_PAYMENT_TERMS.includes(normalizedPayterm)) {
      return res.status(400).json({ error: 'Invalid payment term. Use COD, 30D, or 45D.' });
    }

    // Both predicates are hardcoded, never interpolated from untrusted input.
    const deletionPredicate = req.customerListStatus === 'deleted'
      ? 'is_deleted = TRUE'
      : 'is_deleted = FALSE';

    const result = await pool.query(
      `SELECT custno, custname, address, payterm, is_deleted, deleted_at, deleted_by
       FROM customer
       WHERE ${deletionPredicate}
         AND (
           $1 = ''
           OR custno ILIKE '%' || $1 || '%'
           OR custname ILIKE '%' || $1 || '%'
           OR COALESCE(address, '') ILIKE '%' || $1 || '%'
         )
         AND ($2 = '' OR payterm = $2)
       ORDER BY custno ASC`,
      [normalizedSearch, normalizedPayterm]
    );
    return res.json({ customers: result.rows });
  } catch (err) {
    return next(err);
  }
});

router.post('/', requireAuth, requireCreate, async (req, res, next) => {
  try {
    const error = validateCustomer(req.body, true);
    if (error) return res.status(400).json({ error });

    const { custno, custname, address, payterm } = req.body;
    const result = await pool.query(
      `INSERT INTO customer (custno, custname, address, payterm)
       VALUES ($1, $2, $3, $4)
       RETURNING custno, custname, address, payterm, is_deleted, deleted_at, deleted_by`,
      [custno.trim(), custname.trim(), (address || '').trim() || null, payterm]
    );
    return res.status(201).json({ customer: result.rows[0] });
  } catch (err) {
    // Soft-deleted customer numbers remain reserved; restore rather than recreate.
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Customer number already exists. Restore the deleted customer if applicable.' });
    }
    return next(err);
  }
});

router.put('/:custno', requireAuth, requireEdit, validateCustomerNumber, async (req, res, next) => {
  try {
    if (
      Object.prototype.hasOwnProperty.call(req.body || {}, 'custno') &&
      req.body.custno !== req.params.custno
    ) {
      return res.status(400).json({ error: 'Customer number cannot be changed.' });
    }

    const error = validateCustomer(req.body, false);
    if (error) return res.status(400).json({ error });

    const { custname, address, payterm } = req.body;
    const result = await pool.query(
      `UPDATE customer
       SET custname = $2, address = $3, payterm = $4
       WHERE custno = $1 AND is_deleted = FALSE
       RETURNING custno, custname, address, payterm, is_deleted, deleted_at, deleted_by`,
      [req.params.custno, custname.trim(), (address || '').trim() || null, payterm]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Active customer not found.' });
    }
    return res.json({ customer: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

// DELETE is a soft delete. No rows are permanently removed.
router.delete('/:custno', requireAuth, requireDelete, validateCustomerNumber, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE customer
       SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $2
       WHERE custno = $1 AND is_deleted = FALSE
       RETURNING custno, custname, address, payterm, is_deleted, deleted_at, deleted_by`,
      [req.params.custno, req.currentUser.user_id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Active customer not found.' });
    }
    return res.json({ customer: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

router.patch('/:custno/restore', requireAuth, requireDelete, validateCustomerNumber, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE customer
       SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL
       WHERE custno = $1 AND is_deleted = TRUE
       RETURNING custno, custname, address, payterm, is_deleted, deleted_at, deleted_by`,
      [req.params.custno]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Deleted customer not found.' });
    }
    return res.json({ customer: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
