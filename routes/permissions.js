
const express = require('express');
const { pool } = require('../config/db');
const {
  MODULES,
  ACTIONS,
  getUserPermissions,
} = require('../services/permissionService');
const {
  requireAuth,
  requireSuperadmin,
} = require('../middleware/auth');

const router = express.Router();

function isValidId(value) {
  return /^\d+$/.test(String(value));
}

function validatePermissions(permissions) {
  if (!Array.isArray(permissions) || permissions.length !== MODULES.length) {
    return false;
  }

  const receivedModules = new Set();

  for (const permission of permissions) {
    if (
      !permission ||
      typeof permission !== 'object' ||
      Array.isArray(permission) ||
      !MODULES.includes(permission.module_name) ||
      receivedModules.has(permission.module_name)
    ) {
      return false;
    }

    receivedModules.add(permission.module_name);

    for (const action of ACTIONS) {
      if (typeof permission[action] !== 'boolean') {
        return false;
      }
    }
  }

  return receivedModules.size === MODULES.length;
}

// Only regular Users and Admins can receive assigned permissions.
async function getManageableTarget(userId) {
  const result = await pool.query(
    `SELECT id AS user_id, full_name, email, role, status
     FROM users
     WHERE id = $1
       AND role IN ('user', 'admin')`,
    [userId]
  );

  return result.rows[0] || null;
}

// GET PERMISSIONS FOR A USER OR ADMIN
router.get(
  '/:id',
  requireAuth,
  requireSuperadmin,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!isValidId(id)) {
        return res.status(400).json({
          error: 'Invalid user ID.',
        });
      }

      const target = await getManageableTarget(id);

      if (!target) {
        return res.status(404).json({
          error: 'User not found or not eligible for permission management.',
        });
      }

      const permissions = await getUserPermissions(
        target.user_id,
        target.role
      );

      return res.json({
        user: target,
        permissions,
      });
    } catch (err) {
      return next(err);
    }
  }
);

// REPLACE ALL MODULE PERMISSIONS FOR A USER OR ADMIN
router.put(
  '/:id',
  requireAuth,
  requireSuperadmin,
  async (req, res, next) => {
    const { id } = req.params;
    const permissions = req.body?.permissions;

    if (!isValidId(id)) {
      return res.status(400).json({
        error: 'Invalid user ID.',
      });
    }

    if (!validatePermissions(permissions)) {
      return res.status(400).json({
        error:
          'Provide exactly one permission record for each module, with Boolean values for all four actions.',
      });
    }

    let client;
    let transactionStarted = false;

    try {
      client = await pool.connect();

      await client.query('BEGIN');
      transactionStarted = true;

      // Recheck the actor inside the transaction.
      const actorResult = await client.query(
        `SELECT id AS user_id, role, status
         FROM users
         WHERE id = $1
           AND role = 'superadmin'
           AND status = 'active'
         FOR UPDATE`,
        [req.currentUser.user_id]
      );

      if (!actorResult.rows[0]) {
        await client.query('ROLLBACK');
        transactionStarted = false;

        return res.status(403).json({
          error: 'Superadmin access is no longer authorized.',
        });
      }

      // Lock the target account and recheck its role.
      const targetResult = await client.query(
        `SELECT id AS user_id, full_name, email, role, status
         FROM users
         WHERE id = $1
           AND role IN ('user', 'admin')
         FOR UPDATE`,
        [id]
      );

      const target = targetResult.rows[0];

      if (!target) {
        await client.query('ROLLBACK');
        transactionStarted = false;

        return res.status(404).json({
          error: 'User not found or not eligible for permission management.',
        });
      }

      await client.query(
        `DELETE FROM user_rights
         WHERE user_id = $1`,
        [target.user_id]
      );

      for (const permission of permissions) {
        await client.query(
          `INSERT INTO user_rights (
              user_id,
              module_name,
              can_view,
              can_create,
              can_edit,
              can_delete,
              updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [
            target.user_id,
            permission.module_name,
            permission.can_view,
            permission.can_create,
            permission.can_edit,
            permission.can_delete,
          ]
        );
      }

      await client.query('COMMIT');
      transactionStarted = false;

      const savedPermissions = await getUserPermissions(
        target.user_id,
        target.role
      );

      return res.json({
        message: 'Module permissions updated successfully.',
        user: target,
        permissions: savedPermissions,
      });
    } catch (err) {
      if (client && transactionStarted) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Permission rollback failed:', rollbackError);
        }
      }

      return next(err);
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

module.exports = router;
