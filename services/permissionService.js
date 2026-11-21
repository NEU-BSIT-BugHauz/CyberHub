
const { pool } = require('../config/db');

const MODULES = Object.freeze([
  'Customer',
  'Product',
  'Human Resources',
  'Sales',
  'Reports',
]);

const ACTIONS = Object.freeze([
  'can_view',
  'can_create',
  'can_edit',
  'can_delete',
]);

const DEFAULT_PERMISSIONS = Object.freeze({
  can_view: false,
  can_create: false,
  can_edit: false,
  can_delete: false,
});

function createPermissionRecord(moduleName, overrides = {}) {
  return {
    module_name: moduleName,
    can_view: Boolean(overrides.can_view),
    can_create: Boolean(overrides.can_create),
    can_edit: Boolean(overrides.can_edit),
    can_delete: Boolean(overrides.can_delete),
  };
}

function getSuperadminPermissions() {
  return MODULES.map((moduleName) =>
    createPermissionRecord(moduleName, {
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: true,
    })
  );
}

async function getUserPermissions(userId, role) {
  if (role === 'superadmin') {
    return getSuperadminPermissions();
  }

  const result = await pool.query(
    `SELECT
        module_name,
        can_view,
        can_create,
        can_edit,
        can_delete
     FROM user_rights
     WHERE user_id = $1`,
    [userId]
  );

  const assignedPermissions = new Map(
    result.rows.map((permission) => [
      permission.module_name,
      permission,
    ])
  );

  return MODULES.map((moduleName) => {
    const assigned = assignedPermissions.get(moduleName);

    return createPermissionRecord(
      moduleName,
      assigned || DEFAULT_PERMISSIONS
    );
  });
}

function hasPermission(permissions, moduleName, action) {
  if (
    !MODULES.includes(moduleName) ||
    !ACTIONS.includes(action)
  ) {
    return false;
  }

  const permission = permissions.find(
    (item) => item.module_name === moduleName
  );

  return Boolean(permission && permission[action] === true);
}

function requireModulePermission(moduleName, action) {
  if (!MODULES.includes(moduleName)) {
    throw new Error(`Unknown CyberHub module: ${moduleName}`);
  }

  if (!ACTIONS.includes(action)) {
    throw new Error(`Unknown permission action: ${action}`);
  }

  return async (req, res, next) => {
    const user = req.currentUser;

    if (!user || !user.user_id) {
      return res.status(401).json({
        error: 'Authentication required.',
      });
    }

    if (user.role === 'superadmin') {
      return next();
    }

    try {
      const permissions = await getUserPermissions(
        user.user_id,
        user.role
      );

      if (!hasPermission(permissions, moduleName, action)) {
        return res.status(403).json({
          error: `You do not have ${action.replace('can_', '')} permission for the ${moduleName} module.`,
        });
      }

      req.modulePermissions = permissions;

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = {
  MODULES,
  ACTIONS,
  getUserPermissions,
  hasPermission,
  requireModulePermission,
  getSuperadminPermissions,
};
