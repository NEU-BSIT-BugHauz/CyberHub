
const request = require('supertest');
const express = require('express');

jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

const { pool } = require('../config/db');
const permissionsRoutes = require('../routes/permissions');

const app = express();

app.use(express.json());

app.use((req, _res, next) => {
  const userId = req.headers['x-user-id'];

  req.session = userId
    ? {
        user: { user_id: userId },
        destroy(callback) {
          callback(null);
        },
      }
    : {};

  next();
});

app.use('/api/permissions', permissionsRoutes);

app.use((err, _req, res, _next) => {
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
});

const MODULES = [
  'Customer',
  'Product',
  'Human Resources',
  'Sales',
  'Reports',
];

function createSuperadmin(overrides = {}) {
  return {
    user_id: 99,
    role: 'superadmin',
    status: 'active',
    ...overrides,
  };
}

function createTarget(overrides = {}) {
  return {
    user_id: 20,
    full_name: 'John Doe',
    email: 'john@example.com',
    role: 'user',
    status: 'active',
    ...overrides,
  };
}

function createPermissions() {
  return MODULES.map((moduleName) => ({
    module_name: moduleName,
    can_view: true,
    can_create: false,
    can_edit: false,
    can_delete: false,
  }));
}

function createTransactionClient() {
  return {
    query: jest.fn(),
    release: jest.fn(),
  };
}

describe('CyberHub Permission Management API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('Authentication and authorization', () => {
    test('rejects unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/permissions/20');

      expect(response.status).toBe(401);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('rejects regular users', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          user_id: 1,
          role: 'user',
          status: 'active',
        }],
      });

      const response = await request(app)
        .get('/api/permissions/20')
        .set('x-user-id', '1');

      expect(response.status).toBe(403);
    });

    test('rejects administrators', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          user_id: 10,
          role: 'admin',
          status: 'active',
        }],
      });

      const response = await request(app)
        .get('/api/permissions/20')
        .set('x-user-id', '10');

      expect(response.status).toBe(403);
    });

    test('rejects blocked superadmin accounts', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [],
      });

      const response = await request(app)
        .get('/api/permissions/20')
        .set('x-user-id', '99');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/permissions/:id', () => {
    test('allows superadmins to retrieve user permissions', async () => {
      const permissions = createPermissions();

      pool.query
        .mockResolvedValueOnce({
          rows: [createSuperadmin()],
        })
        .mockResolvedValueOnce({
          rows: [createTarget()],
        })
        .mockResolvedValueOnce({
          rows: permissions,
        });

      const response = await request(app)
        .get('/api/permissions/20')
        .set('x-user-id', '99');

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('user');
      expect(response.body.permissions).toHaveLength(5);
      expect(response.body.permissions[0].module_name).toBe('Customer');
    });

    test('allows superadmins to retrieve admin permissions', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [createSuperadmin()],
        })
        .mockResolvedValueOnce({
          rows: [createTarget({ role: 'admin' })],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      const response = await request(app)
        .get('/api/permissions/20')
        .set('x-user-id', '99');

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('admin');
      expect(response.body.permissions).toHaveLength(5);
    });

    test('does not allow permission lookup for superadmin accounts', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [createSuperadmin()],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      const response = await request(app)
        .get('/api/permissions/100')
        .set('x-user-id', '99');

      expect(response.status).toBe(404);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test('rejects invalid user IDs', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [createSuperadmin()],
      });

      const response = await request(app)
        .get('/api/permissions/abc')
        .set('x-user-id', '99');

      expect(response.status).toBe(400);
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /api/permissions/:id', () => {
    test('rejects incomplete permission assignments', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [createSuperadmin()],
      });

      const response = await request(app)
        .put('/api/permissions/20')
        .set('x-user-id', '99')
        .send({
          permissions: [
            createPermissions()[0],
          ],
        });

      expect(response.status).toBe(400);
      expect(pool.connect).not.toHaveBeenCalled();
    });

    test('rejects duplicate modules', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [createSuperadmin()],
      });

      const permissions = createPermissions();
      permissions[4].module_name = 'Customer';

      const response = await request(app)
        .put('/api/permissions/20')
        .set('x-user-id', '99')
        .send({ permissions });

      expect(response.status).toBe(400);
      expect(pool.connect).not.toHaveBeenCalled();
    });

    test('rejects invalid permission values', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [createSuperadmin()],
      });

      const permissions = createPermissions();
      permissions[0].can_create = 'true';

      const response = await request(app)
        .put('/api/permissions/20')
        .set('x-user-id', '99')
        .send({ permissions });

      expect(response.status).toBe(400);
      expect(pool.connect).not.toHaveBeenCalled();
    });

    test('rejects attempts to assign permissions to superadmin accounts', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [createSuperadmin()],
      });

      const client = createTransactionClient();

      client.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [createSuperadmin()],
        }) // Actor revalidation
        .mockResolvedValueOnce({ rows: [] }) // Target lookup
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      pool.connect.mockResolvedValueOnce(client);

      const response = await request(app)
        .put('/api/permissions/100')
        .set('x-user-id', '99')
        .send({
          permissions: createPermissions(),
        });

      expect(response.status).toBe(404);
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalled();
    });

    test('saves all five module permission assignments', async () => {
      const client = createTransactionClient();

      client.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [createSuperadmin()],
        }) // Actor revalidation
        .mockResolvedValueOnce({
          rows: [createTarget()],
        }) // Target lookup
        .mockResolvedValue({ rows: [] }); // DELETE, INSERT and COMMIT

      pool.query
        .mockResolvedValueOnce({
          rows: [createSuperadmin()],
        })
        .mockResolvedValueOnce({
          rows: createPermissions(),
        });

      pool.connect.mockResolvedValueOnce(client);

      const permissions = createPermissions();

      const response = await request(app)
        .put('/api/permissions/20')
        .set('x-user-id', '99')
        .send({ permissions });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        'Module permissions updated successfully.'
      );

      expect(client.query).toHaveBeenCalledWith('BEGIN');

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_rights'),
        [20]
      );

      const insertCalls = client.query.mock.calls.filter(
        ([sql]) => sql.includes('INSERT INTO user_rights')
      );

      expect(insertCalls).toHaveLength(5);

      expect(client.query).toHaveBeenCalledWith('COMMIT');
      expect(client.release).toHaveBeenCalled();

      expect(response.body.permissions).toHaveLength(5);
    });

    test('rolls back when a permission insert fails', async () => {
      const client = createTransactionClient();

      client.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [createSuperadmin()],
        }) // Actor revalidation
        .mockResolvedValueOnce({
          rows: [createTarget()],
        }) // Target lookup
        .mockResolvedValueOnce({ rows: [] }) // DELETE
        .mockRejectedValueOnce(
          new Error('Permission insert failed.')
        ) // First INSERT
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      pool.query.mockResolvedValueOnce({
        rows: [createSuperadmin()],
      });

      pool.connect.mockResolvedValueOnce(client);

      const response = await request(app)
        .put('/api/permissions/20')
        .set('x-user-id', '99')
        .send({
          permissions: createPermissions(),
        });

      expect(response.status).toBe(500);
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
      expect(client.release).toHaveBeenCalled();
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('rejects invalid target IDs', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [createSuperadmin()],
      });

      const response = await request(app)
        .put('/api/permissions/invalid')
        .set('x-user-id', '99')
        .send({
          permissions: createPermissions(),
        });

      expect(response.status).toBe(400);
      expect(pool.connect).not.toHaveBeenCalled();
    });
  });
});
