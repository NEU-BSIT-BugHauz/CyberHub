
const crypto = require('crypto');
const { promisify } = require('util');
const express = require('express');
const { rateLimit } = require('express-rate-limit');

const { pool } = require('../config/db');
const { sendPasswordResetEmail } = require('../services/emailService');

const router = express.Router();
const scryptAsync = promisify(crypto.scrypt);

const RESET_TOKEN_EXPIRY_MINUTES = 15;

const GENERIC_RESET_MESSAGE =
  'If an eligible account exists for that email, password reset instructions will be sent.';

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many password reset requests. Please try again later.',
  },
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many password reset attempts. Please try again later.',
  },
});

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, 64);

  return `${salt}:${derivedKey.toString('hex')}`;
}

router.post('/forgot-password', forgotPasswordLimiter, async (req, res, next) => {
  try {
    const email =
      typeof req.body.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';

    if (
      !email ||
      email.length > 190 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res.status(400).json({
        error: 'Please provide a valid email address.',
      });
    }

    const result = await pool.query(
      `SELECT u.id, u.email
       FROM users u
       JOIN employee e ON e.empno = u.empno
       WHERE LOWER(u.email) = $1
         AND u.status = 'active'
         AND e.sepdate IS NULL
         AND e.is_deleted = FALSE
       LIMIT 1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({
        message: GENERIC_RESET_MESSAGE,
      });
    }

    const user = result.rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(token);

    const resetUrl = new URL(process.env.PASSWORD_RESET_URL);
    resetUrl.searchParams.set('token', token);

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE password_resets
         SET used_at = NOW()
         WHERE user_id = $1
           AND used_at IS NULL`,
        [user.id]
      );

      await client.query(
        `INSERT INTO password_resets
           (user_id, token_hash, expires_at)
         VALUES
           ($1, $2, NOW() + INTERVAL '15 minutes')`,
        [user.id, tokenHash]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    try {
      await sendPasswordResetEmail(user.email, resetUrl.toString());
    } catch (emailError) {
      console.error('Password reset email failed:', emailError.message);

      try {
        await pool.query(
          `UPDATE password_resets
           SET used_at = NOW()
           WHERE token_hash = $1
             AND used_at IS NULL`,
          [tokenHash]
        );
      } catch (cleanupError) {
        console.error(
          'Failed to invalidate undelivered password reset token:',
          cleanupError.message
        );
      }
    }

    return res.status(200).json({
      message: GENERIC_RESET_MESSAGE,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/reset-password', resetPasswordLimiter, async (req, res, next) => {
  const { token, password } = req.body;

  if (
    typeof token !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(token)
  ) {
    return res.status(400).json({
      error: 'Invalid or expired password reset token.',
    });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters long.',
    });
  }

  const tokenHash = hashResetToken(token);
  let client;

  try {
    client = await pool.connect();

    await client.query('BEGIN');

    const resetResult = await client.query(
      `SELECT
         pr.id AS reset_id,
         pr.user_id
       FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.token_hash = $1
         AND pr.used_at IS NULL
         AND pr.expires_at > NOW()
         AND u.status = 'active'
       FOR UPDATE OF pr`,
      [tokenHash]
    );

    if (resetResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'Invalid or expired password reset token.',
      });
    }

    const reset = resetResult.rows[0];
    const passwordHash = await hashPassword(password);

    const updateResult = await client.query(
      `UPDATE users
       SET password_hash = $1,
           updated_at = NOW()
       WHERE id = $2
         AND status = 'active'
       RETURNING id`,
      [passwordHash, reset.user_id]
    );

    if (updateResult.rowCount !== 1) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'Unable to reset password for this account.',
      });
    }

    await client.query(
      `UPDATE password_resets
       SET used_at = NOW()
       WHERE id = $1`,
      [reset.reset_id]
    );

    await client.query(
      `DELETE FROM user_sessions
       WHERE sess -> 'user' ->> 'user_id' = $1`,
      [String(reset.user_id)]
    );

    await client.query('COMMIT');

    return res.status(200).json({
  message: 'Password reset successful.',
});
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Password reset rollback failed:', rollbackError.message);
      }
    }

    return next(error);
  } finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;
