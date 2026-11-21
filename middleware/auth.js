
const { pool } = require('../config/db');

function clearSession(req, res, next, status, message) {
  if (!req.session) {
    return res.status(status).json({ error: message });
  }

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
  if (
    !req.session ||
    !req.session.user ||
    !req.session.user.user_id
  ) {
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

    const sanitizedUser = {
      user_id: user.user_id,
      empno: user.empno,
      full_name: user.full_name ||
        `${user.firstname || ''} ${user.lastname || ''}`.trim(),
      email: user.email,
      role: user.role,
      status: user.status,
      must_set_password: user.must_set_password,
    };

    // Refresh session data using current database values.
    req.session.user = sanitizedUser;

    // Keep the full database user available to protected routes.
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

  return next();
}

function requireSuperadmin(req, res, next) {
  if (
    !req.currentUser ||
    req.currentUser.role !== 'superadmin'
  ) {
    return res.status(403).json({
      error: 'Superadmin access required.',
    });
  }

  return next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireSuperadmin,
};
