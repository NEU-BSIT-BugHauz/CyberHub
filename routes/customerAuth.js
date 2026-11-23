'use strict';

const crypto = require('crypto');
const { promisify } = require('util');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { pool } = require('../config/db');
const { nextCustomerNumber } = require('../services/customerNumber');

const router = express.Router();
const scrypt = promisify(crypto.scrypt);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const customerAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many password change attempts. Try again later.' },
});

function validateAccount(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Invalid customer registration details.';
  }
  const name = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (name.length < 2 || name.length > 150) return 'Name must contain 2 to 150 characters.';
  if (!EMAIL_RE.test(email) || email.length > 190) return 'Enter a valid email address.';
  if (password.length < 8 || password.length > 128 || !password.trim()) {
    return 'Password must contain 8 to 128 nonblank characters.';
  }
  if (phone.length > 25) return 'Phone number must be 25 characters or fewer.';
  return null;
}

function validateProfile(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'Invalid profile details.';
  }
  const name = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  if (name.length < 2 || name.length > 150) return 'Name must contain 2 to 150 characters.';
  if (!EMAIL_RE.test(email) || email.length > 190) return 'Enter a valid email address.';
  if (typeof body.phone !== 'string' || phone.length > 25) {
    return 'Phone number must be 25 characters or fewer.';
  }
  if (typeof body.address !== 'string' || address.length > 500) {
    return 'Address must be 500 characters or fewer.';
  }
  return null;
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}

async function matchesPassword(password, stored) {
  const [salt, hex, extra] = String(stored || '').split(':');
  if (extra || !/^[\da-f]{32}$/i.test(salt || '') || !/^[\da-f]{128}$/i.test(hex || '')) {
    return false;
  }
  const expected = Buffer.from(hex, 'hex');
  const actual = await scrypt(password, salt, 64);
  return crypto.timingSafeEqual(expected, actual);
}

function publicAccount(row) {
  return {
    account_id: row.account_id,
    custno: row.custno,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone || '',
    address: row.address || '',
    status: row.status,
  };
}

async function requireCustomer(req, res, next) {
  try {
    const id = req.session && req.session.customer && req.session.customer.account_id;
    if (!id) return res.status(401).json({ error: 'Customer login required.' });
    const result = await pool.query(
      `SELECT ca.id AS account_id, ca.custno, c.custname AS full_name,
              c.address, ca.email, ca.phone, ca.status
       FROM customer_accounts ca
       JOIN customer c ON c.custno = ca.custno
       WHERE ca.id = $1 AND ca.status = 'active'
         AND COALESCE(c.is_deleted, FALSE) = FALSE`,
      [id]
    );
    if (!result.rows[0]) {
      delete req.session.customer;
      return res.status(401).json({ error: 'Customer session expired or account blocked.' });
    }
    req.customerAccount = result.rows[0];
    return next();
  } catch (error) {
    return next(error);
  }
}

// Registration and customer numbers remain unchanged.
router.post('/register', customerAuthLimiter, async (req, res, next) => {
  const error = validateAccount(req.body);
  if (error) return res.status(400).json({ error });
  const name = req.body.full_name.trim();
  const email = req.body.email.trim().toLowerCase();
  const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
  const password = req.body.password;
  let client;
  try {
    const passwordHash = await hashPassword(password);
    client = await pool.connect();
    await client.query('BEGIN');
    const custno = await nextCustomerNumber(client);
    await client.query(
      `INSERT INTO customer (custno, custname, payterm)
       VALUES ($1, $2, 'COD')`,
      [custno, name]
    );
    await client.query(
      `INSERT INTO customer_accounts (custno, email, password_hash, phone, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [custno, email, passwordHash, phone || null]
    );
    await client.query('COMMIT');
    return res.status(201).json({ message: 'Customer account created. You can now sign in.' });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_rollbackError) { /* preserve original error */ }
    }
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email address is already registered. Please sign in.' });
    }
    return next(err);
  } finally {
    if (client) client.release();
  }
});

router.post('/login', customerAuthLimiter, async (req, res, next) => {
  const body = req.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!EMAIL_RE.test(email) || email.length > 190 || !password || password.length > 128) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  try {
    const result = await pool.query(
      `SELECT ca.id AS account_id, ca.custno, c.custname AS full_name,
              c.address, ca.email, ca.phone, ca.password_hash, ca.status,
              COALESCE(c.is_deleted, FALSE) AS customer_deleted
       FROM customer_accounts ca
       JOIN customer c ON c.custno = ca.custno
       WHERE LOWER(ca.email) = $1`,
      [email]
    );
    const account = result.rows[0];
    if (!account || !(await matchesPassword(password, account.password_hash))) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    if (account.status !== 'active' || account.customer_deleted === true) {
      return res.status(403).json({ error: 'This customer account is unavailable. Contact support.' });
    }
    await new Promise((resolve, reject) => req.session.regenerate(
      (err) => err ? reject(err) : resolve()
    ));
    req.session.customer = { account_id: account.account_id };
    return res.json({ message: 'Customer login successful.', customer: publicAccount(account) });
  } catch (err) {
    return next(err);
  }
});

router.get('/me', requireCustomer, (req, res) => {
  res.json({ customer: publicAccount(req.customerAccount) });
});

// Only the currently signed-in customer can update their own profile.
router.put('/profile', requireCustomer, async (req, res, next) => {
  const error = validateProfile(req.body);
  if (error) return res.status(400).json({ error });

  const name = req.body.full_name.trim();
  const email = req.body.email.trim().toLowerCase();
  const phone = req.body.phone.trim();
  const address = req.body.address.trim();
  const emailChanged = email !== req.customerAccount.email.toLowerCase();
  const currentPassword = typeof req.body.current_password === 'string'
    ? req.body.current_password : '';

  if (emailChanged && (!currentPassword || currentPassword.length > 128)) {
    return res.status(400).json({ error: 'Enter your current password to change your email.' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const locked = await client.query(
      `SELECT password_hash FROM customer_accounts
       WHERE id = $1 AND status = 'active' FOR UPDATE`,
      [req.customerAccount.account_id]
    );
    if (!locked.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Account is no longer active.' });
    }
    if (emailChanged && !(await matchesPassword(currentPassword, locked.rows[0].password_hash))) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Current password is incorrect.' });
    }

    const customerResult = await client.query(
      `UPDATE customer SET custname = $1, address = $2
       WHERE custno = $3 AND COALESCE(is_deleted, FALSE) = FALSE
       RETURNING custno`,
      [name, address || null, req.customerAccount.custno]
    );
    if (!customerResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer record was not found.' });
    }
    const accountResult = await client.query(
      `UPDATE customer_accounts SET email = $1, phone = $2
       WHERE id = $3 AND status = 'active'
       RETURNING id`,
      [email, phone || null, req.customerAccount.account_id]
    );
    if (!accountResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Account is no longer active.' });
    }
    await client.query('COMMIT');
    return res.json({
      message: 'Profile updated successfully.',
      customer: publicAccount({
        ...req.customerAccount,
        full_name: name,
        email,
        phone,
        address,
      }),
    });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_rollbackError) { /* preserve original error */ }
    }
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That email address is already registered.' });
    }
    return next(err);
  } finally {
    if (client) client.release();
  }
});

router.post('/change-password', passwordChangeLimiter, requireCustomer, async (req, res, next) => {
  const body = req.body || {};
  const currentPassword = typeof body.current_password === 'string' ? body.current_password : '';
  const newPassword = typeof body.new_password === 'string' ? body.new_password : '';
  if (!currentPassword || currentPassword.length > 128) {
    return res.status(400).json({ error: 'Enter your current password.' });
  }
  if (newPassword.length < 8 || newPassword.length > 128 || !newPassword.trim()) {
    return res.status(400).json({ error: 'New password must contain 8 to 128 nonblank characters.' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'Choose a different new password.' });
  }

  try {
    const account = await pool.query(
      `SELECT password_hash FROM customer_accounts WHERE id = $1 AND status = 'active'`,
      [req.customerAccount.account_id]
    );
    if (!account.rows[0] || !(await matchesPassword(currentPassword, account.rows[0].password_hash))) {
      return res.status(403).json({ error: 'Current password is incorrect.' });
    }
    const passwordHash = await hashPassword(newPassword);
    const updated = await pool.query(
      `UPDATE customer_accounts SET password_hash = $1
       WHERE id = $2 AND status = 'active' RETURNING id`,
      [passwordHash, req.customerAccount.account_id]
    );
    if (!updated.rows[0]) {
      return res.status(401).json({ error: 'Account is no longer active.' });
    }
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('sid', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
      return res.json({ message: 'Password changed. Please sign in again.' });
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/logout', requireCustomer, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return res.json({ message: 'Signed out.' });
  });
});

module.exports = router;
