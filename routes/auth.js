
const crypto = require('crypto');
const { promisify } = require('util');
const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();
const scrypt = promisify(crypto.scrypt);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);

  return `${salt}:${derived.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const [salt, originalHash] = String(storedHash || '').split(':');

  if (!salt || !originalHash || !/^[a-f0-9]{128}$/i.test(originalHash)) {
    return false;
  }

  const originalBuffer = Buffer.from(originalHash, 'hex');
  const derived = await scrypt(password, salt, 64);

  return crypto.timingSafeEqual(originalBuffer, derived);
}

function sanitizeUser(user) {
  return {
    user_id: user.user_id,
    empno: user.empno,
    full_name: user.full_name ||
      `${user.firstname || ''} ${user.lastname || ''}`.trim(),
    email: user.email,
    role: user.role,
    status: user.status,
    must_set_password: user.must_set_password,
  };
}

function clearSession(req, res, next, status, message) {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }

    res.clearCookie('sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return res.status(status).json({
      error: message,
    });
  });
}

async function requireAuth(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.user_id) {
    return res.status(401).json({
      error: 'Authentication required.',
    });
  }

  try {
    const result = await pool.query(
      `SELECT
          u.id AS user_id,
          u.empno,
          u.full_name,
          u.email,
          u.role,
          u.status,
          u.must_set_password,
          e.firstname,
          e.lastname
       FROM users u
       JOIN employee e ON e.empno = u.empno
       WHERE u.id = $1
         AND u.status = 'active'
         AND e.sepdate IS NULL
         AND e.is_deleted = FALSE`,
      [req.session.user.user_id]
    );

    const user = result.rows[0];

    if (!user) {
      return clearSession(
        req,
        res,
        next,
        401,
        'Your session is no longer valid. Please log in again.'
      );
    }

    // Always use current database values, never stale session privileges.
    req.session.user = sanitizeUser(user);
    req.currentUser = user;

    return next();
  } catch (err) {
    return next(err);
  }
}

function requireAdmin(req, res, next) {
  if (
    !req.currentUser ||
    !['admin', 'superadmin'].includes(req.currentUser.role)
  ) {
    return res.status(403).json({
      error: 'Administrator access required.',
    });
  }

  next();
}

async function getEligibleEmployee(empno) {
  const result = await pool.query(
    `SELECT empno, firstname, lastname
     FROM employee
     WHERE empno = $1
       AND sepdate IS NULL
       AND is_deleted = FALSE`,
    [empno]
  );

  return result.rows[0] || null;
}

// REGISTER
router.post('/register', async (req, res, next) => {
  try {
    const empno = String(req.body.empno || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!/^[A-Za-z0-9]{5}$/.test(empno)) {
      return res.status(400).json({
        error: 'A valid 5-character employee number is required.',
      });
    }

    if (!EMAIL_REGEX.test(email) || email.length > 190) {
      return res.status(400).json({
        error: 'Please provide a valid email address.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters.',
      });
    }

    const employee = await getEligibleEmployee(empno);

    if (!employee) {
      return res.status(404).json({
        error: 'Employee not found or no longer eligible for registration.',
      });
    }

    const fullName =
      `${employee.firstname} ${employee.lastname}`.trim();

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO users
        (full_name, empno, email, password_hash, role, status, must_set_password)
       VALUES ($1, $2, $3, $4, 'user', 'pending', FALSE)
       RETURNING id AS user_id, empno, full_name, email,
                 role, status, must_set_password`,
      [fullName, employee.empno, email, passwordHash]
    );

    const user = result.rows[0];

    return res.status(201).json({
      message:
        'Registration submitted. Your account is pending administrator approval.',
      user: sanitizeUser(user),
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'This email address or employee number is already registered.',
      });
    }

    return next(err);
  }
});

// LOGIN
router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required.',
      });
    }

    const result = await pool.query(
      `SELECT
          u.id AS user_id,
          u.empno,
          u.full_name,
          u.email,
          u.password_hash,
          u.role,
          u.status,
          u.must_set_password,
          e.firstname,
          e.lastname
       FROM users u
       JOIN employee e ON e.empno = u.empno
       WHERE LOWER(u.email) = $1
         AND e.sepdate IS NULL
         AND e.is_deleted = FALSE`,
      [email]
    );

    const user = result.rows[0];

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({
        error: 'Invalid email or password.',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        error: user.status === 'pending'
          ? 'Your account is awaiting administrator approval.'
          : 'Your account is blocked.',
      });
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    req.session.user = sanitizeUser(user);

    return res.json({
      message: 'Login successful.',
      user: sanitizeUser(user),
    });
  } catch (err) {
    return next(err);
  }
});

// CURRENT USER
router.get('/me', requireAuth, (req, res) => {
  return res.json({
    user: req.currentUser
      ? sanitizeUser(req.currentUser)
      : req.session.user,
  });
});

// LOGOUT
router.post('/logout', requireAuth, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);

    res.clearCookie('sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return res.json({
      message: 'Logout successful.',
    });
  });
});

// PROTECTED PENDING ACCOUNTS
router.get('/pending', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
          u.id AS user_id,
          u.empno,
          u.full_name,
          u.email,
          u.role,
          u.status,
          u.created_at,
          u.must_set_password
       FROM users u
       WHERE u.status = 'pending'
       ORDER BY u.created_at ASC`
    );

    const users = result.rows.map(sanitizeUser);

    return res.json({
      count: users.length,
      users,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
