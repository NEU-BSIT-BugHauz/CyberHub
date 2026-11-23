const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPNO_REGEX = /^[A-Za-z0-9]{5}$/;

function requireAuth(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.user_id) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  next();
}

async function requireManager(req, res, next) {
  try {
    const actorId = req.session.user.user_id;
    const result = await pool.query(
      `SELECT u.id, u.role, u.status
       FROM users u
       JOIN employee e ON e.empno = u.empno
       WHERE u.id = $1
         AND e.sepdate IS NULL
         AND e.is_deleted = FALSE`,
      [actorId]
    );
    const actor = result.rows[0];
    if (!actor || actor.status !== 'active') {
      return res.status(403).json({
        error: 'Your account is not authorized to manage users.',
      });
    }
    if (!['admin', 'superadmin'].includes(actor.role)) {
      return res.status(403).json({ error: 'Administrator access required.' });
    }
    req.manager = actor;
    next();
  } catch (err) {
    next(err);
  }
}

function getManageableRoles(role) {
  return role === 'superadmin' ? ['user', 'admin'] : ['user'];
}

function isValidId(value) {
  return /^\d+$/.test(String(value));
}

function isValidEmail(value) {
  return typeof value === 'string'
    && value.length <= 190
    && EMAIL_REGEX.test(value.trim());
}

function canManageTarget(manager, target) {
  if (!target || String(target.id) === String(manager.id)) return false;
  return getManageableRoles(manager.role).includes(target.role);
}

// LIST MANAGEABLE USERS
router.get('/', requireAuth, requireManager, async (req, res, next) => {
  try {
    const roles = getManageableRoles(req.manager.role);
    const result = await pool.query(
      `SELECT id AS user_id, empno, full_name, email, role, status,
              must_set_password, created_at
       FROM users
       WHERE id <> $1 AND role = ANY($2::varchar[])
       ORDER BY created_at DESC`,
      [req.manager.id, roles]
    );
    return res.json({ count: result.rows.length, users: result.rows });
  } catch (err) {
    next(err);
  }
});

// ADD USER
router.post('/', requireAuth, requireManager, async (req, res, next) => {
  try {
    const empno = String(req.body.empno || '').trim().toUpperCase();
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!EMPNO_REGEX.test(empno)) {
      return res.status(400).json({
        error: 'Employee number must contain exactly five letters or numbers.',
      });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'A valid email address of no more than 190 characters is required.',
      });
    }
    const requestedRole = req.body.role || 'user';
    if (!getManageableRoles(req.manager.role).includes(requestedRole)) {
      return res.status(403).json({
        error: 'You are not allowed to create this account role.',
      });
    }
    const employeeResult = await pool.query(
      `SELECT empno, firstname, lastname
       FROM employee
       WHERE empno = $1 AND sepdate IS NULL AND is_deleted = FALSE`,
      [empno]
    );
    const employee = employeeResult.rows[0];
    if (!employee) {
      return res.status(404).json({
        error: 'Employee does not exist or is not eligible.',
      });
    }
    const fullName = [employee.firstname, employee.lastname]
      .filter(Boolean).join(' ').trim();
    if (!fullName) {
      return res.status(400).json({ error: 'Employee name is incomplete.' });
    }
    const result = await pool.query(
      `INSERT INTO users (
         empno, full_name, email, password_hash, role, status, must_set_password
       ) VALUES ($1, $2, $3, NULL, $4, 'active', TRUE)
       RETURNING id AS user_id, empno, full_name, email, role,
                 status, must_set_password, created_at`,
      [empno, fullName, email, requestedRole]
    );
    return res.status(201).json({
      message: 'User account created. The employee must set their password.',
      user: result.rows[0],
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'An account already exists for this employee number or email.',
      });
    }
    next(err);
  }
});

// EDIT USER EMAIL OR ROLE
router.patch('/:id', requireAuth, requireManager, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }
    const targetResult = await pool.query(
      `SELECT id, role FROM users WHERE id = $1`, [id]
    );
    const target = targetResult.rows[0];
    if (!canManageTarget(req.manager, target)) {
      return res.status(404).json({ error: 'User not found or not manageable.' });
    }
    const email = req.body.email === undefined
      ? null : String(req.body.email).trim().toLowerCase();
    const requestedRole = req.body.role;
    if (email !== null && !isValidEmail(email)) {
      return res.status(400).json({
        error: 'A valid email address of no more than 190 characters is required.',
      });
    }
    if (requestedRole !== undefined &&
        !getManageableRoles(req.manager.role).includes(requestedRole)) {
      return res.status(403).json({
        error: 'You are not allowed to assign this account role.',
      });
    }
    if (email === null && requestedRole === undefined) {
      return res.status(400).json({
        error: 'Provide an email address or role to update.',
      });
    }
    const newRole = requestedRole || target.role;
    const result = await pool.query(
      `UPDATE users
       SET email = COALESCE($1, email), role = $2, updated_at = NOW()
       WHERE id = $3 AND id <> $4 AND role = ANY($5::varchar[])
       RETURNING id AS user_id, empno, full_name, email, role,
                 status, must_set_password, created_at`,
      [email, newRole, id, req.manager.id, getManageableRoles(req.manager.role)]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'User not found or not manageable.' });
    }
    return res.json({ message: 'User updated successfully.', user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That email address is already in use.' });
    }
    next(err);
  }
});

// APPROVE PENDING USER, BLOCK USER, OR UNBLOCK USER
router.patch('/:id/status', requireAuth, requireManager, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }
    if (!['active', 'blocked'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active or blocked.' });
    }

    // Approval is a conditional, atomic UPDATE. A pending account is only
    // activated if its employee is still eligible and the actor can manage it.
    // Existing blocked -> active behavior remains the same.
    if (status === 'active') {
      const result = await pool.query(
        `UPDATE users AS u
         SET status = 'active', updated_at = NOW()
         FROM employee AS e
         WHERE u.id = $1
           AND u.id <> $2
           AND u.role = ANY($3::varchar[])
           AND u.empno = e.empno
           AND e.sepdate IS NULL
           AND e.is_deleted = FALSE
           AND u.status IN ('pending', 'blocked')
         RETURNING u.id AS user_id, u.email, u.role, u.status`,
        [id, req.manager.id, getManageableRoles(req.manager.role)]
      );
      if (!result.rows[0]) {
        return res.status(404).json({
          error: 'Account is not pending or blocked, is ineligible, or is not manageable.',
        });
      }
      return res.json({
        message: 'User activated successfully.',
        user: result.rows[0],
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND id <> $3 AND role = ANY($4::varchar[])
       RETURNING id AS user_id, email, role, status`,
      [status, id, req.manager.id, getManageableRoles(req.manager.role)]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found or not manageable.' });
    }
    await pool.query(
      `DELETE FROM user_sessions
       WHERE sess -> 'user' ->> 'user_id' = $1`,
      [String(user.user_id)]
    );
    return res.json({ message: 'User blocked successfully.', user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
