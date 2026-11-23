'use strict';

const crypto = require('crypto');
const { promisify } = require('util');
const express = require('express');
const { pool } = require('../config/db');
const router = express.Router();
const scrypt = promisify(crypto.scrypt);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isId(id) { return /^[1-9]\d*$/.test(String(id)); }
function fields(body) {
  const full_name = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (full_name.length < 2 || full_name.length > 150) return { error: 'Customer name must be 2 to 150 characters.' };
  if (!EMAIL_RE.test(email) || email.length > 190) return { error: 'Enter a valid customer email.' };
  if (phone.length > 25) return { error: 'Phone must be at most 25 characters.' };
  return { full_name, email, phone };
}

async function requireCustomerManager(req, res, next) {
  try {
    const staffId = req.session?.user?.user_id;
    if (!staffId) return res.status(401).json({ error: 'Employee login required.' });
    const result = await pool.query(
      `SELECT u.id, u.role, u.status
       FROM users u JOIN employee e ON e.empno = u.empno
       WHERE u.id = $1 AND e.sepdate IS NULL AND e.is_deleted = FALSE`,
      [staffId]
    );
    const manager = result.rows[0];
    if (!manager || manager.status !== 'active' || !['admin', 'superadmin'].includes(manager.role)) {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    req.customerManager = manager;
    return next();
  } catch (err) { return next(err); }
}
router.use(requireCustomerManager);

// Staff can manage customer login accounts only; these are not employee users.
router.get('/', async (req, res, next) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  try {
    const result = await pool.query(
      `SELECT ca.id AS account_id, ca.custno, c.custname AS full_name,
              ca.email, ca.phone, ca.status, ca.created_at
       FROM customer_accounts ca JOIN customer c ON c.custno = ca.custno
       WHERE ($1 = '' OR c.custname ILIKE '%' || $1 || '%'
                       OR ca.email ILIKE '%' || $1 || '%'
                       OR ca.custno ILIKE '%' || $1 || '%')
       ORDER BY ca.created_at DESC LIMIT 100`,
      [q]
    );
    return res.json({ accounts: result.rows, count: result.rows.length });
  } catch (err) { return next(err); }
});

router.post('/', async (req, res, next) => {
  // Creating an account requires assigning its initial password.
  // The customer_accounts schema requires a non-null password hash,
  // so this operation is restricted to superadmins.
  if (req.customerManager.role !== 'superadmin') {
    return res.status(403).json({
      error: 'Only superadmins can create customer accounts with initial passwords.',
    });
  }
  const payload = fields(req.body || {});
  if (payload.error) return res.status(400).json({ error: payload.error });
  const password = req.body.password;
  if (typeof password !== 'string' || password.length < 8 || password.length > 128 || !password.trim()) {
    return res.status(400).json({ error: 'Initial password must contain 8 to 128 nonblank characters.' });
  }
  let client;
  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
    const custno = `C${crypto.randomBytes(9).toString('hex').toUpperCase()}`;
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO customer (custno, custname, payterm) VALUES ($1, $2, 'COD')`,
      [custno, payload.full_name]
    );
    const result = await client.query(
      `INSERT INTO customer_accounts (custno, email, password_hash, phone, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id AS account_id, custno, email, phone, status`,
      [custno, payload.email, passwordHash, payload.phone || null]
    );
    await client.query('COMMIT');
    return res.status(201).json({
      message: 'Customer account created. Share the initial password securely.',
      customer: { ...result.rows[0], full_name: payload.full_name },
    });
  } catch (err) {
    if (client) { try { await client.query('ROLLBACK'); } catch (_) {} }
    if (err.code === '23505') return res.status(409).json({ error: 'Customer email already exists.' });
    return next(err);
  } finally { if (client) client.release(); }
});

router.patch('/:id', async (req, res, next) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid customer account ID.' });
  const payload = fields(req.body || {});
  if (payload.error) return res.status(400).json({ error: payload.error });
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const account = await client.query(
      `SELECT ca.custno FROM customer_accounts ca
       JOIN customer c ON c.custno = ca.custno
       WHERE ca.id = $1 AND COALESCE(c.is_deleted, FALSE) = FALSE FOR UPDATE OF ca`,
      [req.params.id]
    );
    if (!account.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer account not found.' });
    }
    await client.query(
      `UPDATE customer SET custname = $1 WHERE custno = $2`,
      [payload.full_name, account.rows[0].custno]
    );
    const result = await client.query(
      `UPDATE customer_accounts SET email = $1, phone = $2, updated_at = NOW()
       WHERE id = $3 RETURNING id AS account_id, custno, email, phone, status`,
      [payload.email, payload.phone || null, req.params.id]
    );
    await client.query('COMMIT');
    return res.json({ message: 'Customer account updated.', customer: { ...result.rows[0], full_name: payload.full_name } });
  } catch (err) {
    if (client) { try { await client.query('ROLLBACK'); } catch (_) {} }
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use.' });
    return next(err);
  } finally { if (client) client.release(); }
});

router.patch('/:id/status', async (req, res, next) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid customer account ID.' });
  const status = req.body?.status;
  if (!['active', 'blocked'].includes(status)) return res.status(400).json({ error: 'Status must be active or blocked.' });
  try {
    const result = await pool.query(
      `UPDATE customer_accounts ca SET status = $1, updated_at = NOW()
       WHERE ca.id = $2 AND EXISTS (
         SELECT 1 FROM customer c WHERE c.custno = ca.custno
         AND COALESCE(c.is_deleted, FALSE) = FALSE
       ) RETURNING ca.id AS account_id, ca.status`,
      [status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Customer account not found.' });
    return res.json({ message: status === 'blocked' ? 'Customer account blocked.' : 'Customer account activated.', customer: result.rows[0] });
  } catch (err) { return next(err); }
});

module.exports = router;
