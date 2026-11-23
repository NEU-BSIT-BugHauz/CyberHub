const request = require('supertest');
const express = require('express');

jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));

const { pool } = require('../config/db');
const usersRoutes = require('../routes/users');

const app = express();

app.use(express.json());

app.use((req, _res, next) => {
  const userId = req.headers['x-user-id'];

  req.session = userId
    ? { user: { user_id: userId } }
    : {};

  next();
});

app.use('/api/users', usersRoutes);

function createManager(overrides = {}) {
  return {
    id: 10,
    role: 'admin',
    status: 'active',
    ...overrides,
  };
}

function createUser(overrides = {}) {
  return {
    user_id: 20,
    empno: 'E1234',
    full_name: 'John Doe',
    email: 'john@example.com',
    role: 'user',
    status: 'active',
    must_set_password: true,
    ...overrides,
  };
}

describe('CyberHub User Management API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication and authorization', () => {
    test('rejects unauthenticated requests', async () => {
      const response = await request(app).get('/api/users');

      expect(response.status).toBe(401);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('rejects regular users from managing accounts', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [createManager({ id: 1, role: 'user' })],
      });

      const response = await request(app)
        .get('/api/users')
        .set('x-user-id', '1');

      expect(response.status).toBe(403);
    });

    test('rejects blocked administrators', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [createManager({ status: 'blocked' })],
      });

      const response = await request(app)
        .get('/api/users')
        .set('x-user-id', '10');

      expect(response.status).toBe(403);
    });

    test('rejects administrators whose account no longer exists', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/users')
        .set('x-user-id', '10');

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/users', () => {
    test('allows admins to list regular users only', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [createManager()] })
        .mockResolvedValueOnce({ rows: [createUser()] });

      const response = await request(app)
        .get('/api/users')
        .set('x-user-id', '10');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(1);
      expect(response.body.users[0].role).toBe('user');

      expect(pool.query.mock.calls[1][1]).toEqual([
        10,
        ['user'],
      ]);
    });

    test('allows superadmins to list users and admins, but not superadmins', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [
            createManager({ id: 99, role: 'superadmin' }),
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            createUser(),
            createUser({ user_id: 21, role: 'admin' }),
          ],
        });

      const response = await request(app)
        .get('/api/users')
        .set('x-user-id', '99');

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(2);

      expect(pool.query.mock.calls[1][1]).toEqual([
        99,
        ['user', 'admin'],
      ]);
    });
  });

  describe('POST /api/users', () => {
    test('allows an admin to create a regular user without a password', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [createManager()] })
        .mockResolvedValueOnce({
          rows: [{
            empno: 'E1234',
            firstname: 'John',
            lastname: 'Doe',
          }],
        })
        .mockResolvedValueOnce({ rows: [createUser()] });

      const response = await request(app)
        .post('/api/users')
        .set('x-user-id', '10')
        .send({
          empno: 'E1234',
          email: 'john@example.com',
        });

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe('user');
      expect(response.body.user.must_set_password).toBe(true);

      const insertCall = pool.query.mock.calls[2];

      expect(insertCall[0]).toContain('password_hash');
      expect(insertCall[0]).toContain('NULL');
      expect(insertCall[1]).toEqual([
        'E1234',
        'John Doe',
        'john@example.com',
        'user',
      ]);
    });

    test('allows a superadmin to create an admin account', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [
            createManager({ id: 99, role: 'superadmin' }),
          ],
        })
        .mockResolvedValueOnce({
          rows: [{
            empno: 'E5678',
            firstname: 'Jane',
            lastname: 'Smith',
          }],
        })
        .mockResolvedValueOnce({
          rows: [
            createUser({
              user_id: 30,
              empno: 'E5678',
              full_name: 'Jane Smith',
              email: 'jane@example.com',
              role: 'admin',
            }),
          ],
        });

      const response = await request(app)
        .post('/api/users')
        .set('x-user-id', '99')
        .send({
          empno: 'E5678',
          email: 'jane@example.com',
          role: 'admin',
        });

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe('admin');
      expect(pool.query.mock.calls[2][1][3]).toBe('admin');
    });

    test('prevents admins from creating admin accounts', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [createManager()],
      });

      const response = await request(app)
        .post('/api/users')
        .set('x-user-id', '10')
        .send({
          empno: 'E5678',
          email: 'jane@example.com',
          role: 'admin',
        });

      expect(response.status).toBe(403);
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('rejects employees who are not eligible', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [createManager()] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/users')
        .set('x-user-id', '10')
        .send({
          empno: 'E9999',
          email: 'inactive@example.com',
        });

      expect(response.status).toBe(404);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test('rejects invalid employee numbers', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [createManager()],
      });

      const response = await request(app)
        .post('/api/users')
        .set('x-user-id', '10')
        .send({
          empno: '123',
          email: 'john@example.com',
        });

      expect(response.status).toBe(400);
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('rejects invalid email addresses', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [createManager()],
      });

      const response = await request(app)
        .post('/api/users')
        .set('x-user-id', '10')
        .send({
          empno: 'E1234',
          email: 'not-an-email',
        });

      expect(response.status).toBe(400);
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('rejects duplicate employee or email accounts', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [createManager()] })
        .mockResolvedValueOnce({
          rows: [{
            empno: 'E1234',
            firstname: 'John',
            lastname: 'Doe',
          }],
        })
        .mockRejectedValueOnce({ code: '23505' });

      const response = await request(app)
        .post('/api/users')
        .set('x-user-id', '10')
        .send({
          empno: 'E1234',
          email: 'john@example.com',
        });

      expect(response.status).toBe(409);
    });
  });

  describe('PATCH /api/users/:id', () => {
    test('prevents admins from editing admin accounts directly', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [createManager()] })
        .mockResolvedValueOnce({
          rows: [{ id: 20, role: 'admin' }],
        });

      const response = await request(app)
        .patch('/api/users/20')
        .set('x-user-id', '10')
        .send({ email: 'changed@example.com' });

      expect(response.status).toBe(404);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test('prevents administrators from editing their own account', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [createManager()] })
        .mockResolvedValueOnce({
          rows: [{ id: 10, role: 'admin' }],
        });

      const response = await request(app)
        .patch('/api/users/10')
        .set('x-user-id', '10')
        .send({ email: 'changed@example.com' });

      expect(response.status).toBe(404);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test('prevents superadmins from editing their own account', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [
            createManager({ id: 99, role: 'superadmin' }),
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 99, role: 'superadmin' }],
        });

      const response = await request(app)
        .patch('/api/users/99')
        .set('x-user-id', '99')
        .send({ email: 'changed@example.com' });

      expect(response.status).toBe(404);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test('prevents superadmins from editing other superadmin accounts', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [
            createManager({ id: 99, role: 'superadmin' }),
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 100, role: 'superadmin' }],
        });

      const response = await request(app)
        .patch('/api/users/100')
        .set('x-user-id', '99')
        .send({ email: 'changed@example.com' });

      expect(response.status).toBe(404);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test('prevents admins from promoting users to admin', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [createManager()],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 20,
            role: 'user',
          }],
        });

      const response = await request(app)
        .patch('/api/users/20')
        .set('x-user-id', '10')
        .send({ role: 'admin' });

      expect(response.status).toBe(403);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test('allows superadmins to edit admin accounts', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [
            createManager({ id: 99, role: 'superadmin' }),
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 20, role: 'admin' }],
        })
        .mockResolvedValueOnce({
          rows: [
            createUser({
              user_id: 20,
              role: 'admin',
              email: 'updated@example.com',
            }),
          ],
        });

      const response = await request(app)
        .patch('/api/users/20')
        .set('x-user-id', '99')
        .send({ email: 'updated@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('updated@example.com');
    });

    test('rejects invalid user IDs', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [createManager()],
      });

      const response = await request(app)
        .patch('/api/users/abc')
        .set('x-user-id', '10')
        .send({ email: 'changed@example.com' });

      expect(response.status).toBe(400);
      expect(pool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('PATCH /api/users/:id/status', () => {
    test('blocks a manageable user and invalidates their sessions', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [createManager()] })
        .mockResolvedValueOnce({
          rows: [{
            user_id: 20,
            email: 'john@example.com',
            role: 'user',
            status: 'blocked',
          }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .patch('/api/users/20/status')
        .set('x-user-id', '10')
        .send({ status: 'blocked' });

      expect(response.status).toBe(200);
      expect(response.body.user.status).toBe('blocked');
      expect(pool.query).toHaveBeenCalledTimes(3);
      expect(pool.query.mock.calls[2][0]).toContain(
        'DELETE FROM user_sessions'
      );
    });

    test('rejects invalid account statuses', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [createManager()],
      });

      const response = await request(app)
        .patch('/api/users/20/status')
        .set('x-user-id', '10')
        .send({ status: 'deleted' });

      expect(response.status).toBe(400);
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('does not allow admins to block admin accounts', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [createManager()] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .patch('/api/users/20/status')
        .set('x-user-id', '10')
        .send({ status: 'blocked' });

      expect(response.status).toBe(404);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test('does not allow superadmins to block superadmin accounts', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [
            createManager({ id: 99, role: 'superadmin' }),
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .patch('/api/users/100/status')
        .set('x-user-id', '99')
        .send({ status: 'blocked' });

      expect(response.status).toBe(404);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test('does not allow administrators to block their own accounts', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [createManager()] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .patch('/api/users/10/status')
        .set('x-user-id', '10')
        .send({ status: 'blocked' });

      expect(response.status).toBe(404);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test('does not allow superadmins to block their own accounts', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [
            createManager({ id: 99, role: 'superadmin' }),
          ],
        })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .patch('/api/users/99/status')
        .set('x-user-id', '99')
        .send({ status: 'blocked' });

      expect(response.status).toBe(404);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('Pending employee approval', () => {
    test('approves an eligible pending regular user', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [createManager()] })
        .mockResolvedValueOnce({ rows: [createUser({ status: 'active' })] });

      const response = await request(app)
        .patch('/api/users/20/status')
        .set('x-user-id', '10')
        .send({ status: 'active' });

      expect(response.status).toBe(200);
      expect(response.body.user.status).toBe('active');
      const [sql, params] = pool.query.mock.calls[1];
      expect(sql).toContain("u.status IN ('pending', 'blocked')");
      expect(sql).toContain('e.sepdate IS NULL');
      expect(sql).toContain('e.is_deleted = FALSE');
      expect(params).toEqual(['20', 10, ['user']]);
    });

    test('does not activate an ineligible or already-active employee', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [createManager()] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .patch('/api/users/20/status')
        .set('x-user-id', '10')
        .send({ status: 'active' });

      expect(response.status).toBe(404);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test('admins cannot approve admin accounts', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [createManager()] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .patch('/api/users/20/status')
        .set('x-user-id', '10')
        .send({ status: 'active' });

      expect(response.status).toBe(404);
      expect(pool.query.mock.calls[1][1][2]).toEqual(['user']);
    });

    test('superadmins can approve admins but not superadmins', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [createManager({ id: 99, role: 'superadmin' })],
        })
        .mockResolvedValueOnce({
          rows: [createUser({ role: 'admin', status: 'active' })],
        });

      const response = await request(app)
        .patch('/api/users/20/status')
        .set('x-user-id', '99')
        .send({ status: 'active' });

      expect(response.status).toBe(200);
      expect(pool.query.mock.calls[1][1][2]).toEqual(['user', 'admin']);
    });
  });

});
