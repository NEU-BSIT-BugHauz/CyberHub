
const request = require('supertest');
const express = require('express');

jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

const { pool } = require('../config/db');
const customersRoutes = require('../routes/customers');

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

app.use('/api/customers', customersRoutes);

app.use((err, _req, res, _next) => {
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
});

function createUser(overrides = {}) {
  return {
    user_id: 1,
    empno: '12345',
    full_name: 'John Doe',
    email: 'john@example.com',
    role: 'user',
    status: 'active',
    must_set_password: false,
    firstname: 'John',
    lastname: 'Doe',
    ...overrides,
  };
}

function createCustomer(overrides = {}) {
  return {
    custno: 'CUST001',
    custname: 'John Customer',
    address: 'Manila',
    payterm: '30D',
    ...overrides,
  };
}

describe('CyberHub Customer API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('Authentication and authorization', () => {
    test('rejects unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/customers');

      expect(response.status).toBe(401);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test('rejects users without Customer view permission', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [createUser()],
        })
        .mockResolvedValueOnce({
          rows: [{
            module_name: 'Customer',
            can_view: false,
            can_create: false,
            can_edit: false,
            can_delete: false,
          }],
        });

      const response = await request(app)
        .get('/api/customers')
        .set('x-user-id', '1');

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/permission/i);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test('allows superadmins to retrieve customers', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [
            createUser({
              user_id: 99,
              role: 'superadmin',
            }),
          ],
        })
        .mockResolvedValueOnce({
          rows: [createCustomer()],
        });

      const response = await request(app)
        .get('/api/customers')
        .set('x-user-id', '99');

      expect(response.status).toBe(200);
      expect(response.body.customers).toHaveLength(1);
      expect(response.body.customers[0].custno).toBe('CUST001');
    });
  });

  describe('GET /api/customers', () => {
    test('returns the customer list for authorized users', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [createUser()],
        })
        .mockResolvedValueOnce({
          rows: [{
            module_name: 'Customer',
            can_view: true,
            can_create: false,
            can_edit: false,
            can_delete: false,
          }],
        })
        .mockResolvedValueOnce({
          rows: [
            createCustomer(),
            createCustomer({
              custno: 'CUST002',
              custname: 'Jane Customer',
              payterm: 'COD',
            }),
          ],
        });

      const response = await request(app)
        .get('/api/customers')
        .set('x-user-id', '1');

      expect(response.status).toBe(200);
      expect(response.body.customers).toHaveLength(2);
      expect(pool.query).toHaveBeenCalledTimes(3);
    });

    test('supports customer search', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [createUser()],
        })
        .mockResolvedValueOnce({
          rows: [{
            module_name: 'Customer',
            can_view: true,
          }],
        })
        .mockResolvedValueOnce({
          rows: [createCustomer()],
        });

      const response = await request(app)
        .get('/api/customers?search=John')
        .set('x-user-id', '1');

      expect(response.status).toBe(200);
      expect(response.body.customers).toHaveLength(1);

      expect(pool.query).toHaveBeenLastCalledWith(
        expect.stringContaining('ILIKE'),
        ['John', '']
      );
    });

    test('supports payment-term filtering', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [createUser()],
        })
        .mockResolvedValueOnce({
          rows: [{
            module_name: 'Customer',
            can_view: true,
          }],
        })
        .mockResolvedValueOnce({
          rows: [createCustomer()],
        });

      const response = await request(app)
        .get('/api/customers?payterm=30D')
        .set('x-user-id', '1');

      expect(response.status).toBe(200);
      expect(response.body.customers).toHaveLength(1);

      expect(pool.query).toHaveBeenLastCalledWith(
        expect.stringContaining('payterm = $2'),
        ['', '30D']
      );
    });

    test('rejects unsupported payment terms', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [createUser()],
        })
        .mockResolvedValueOnce({
          rows: [{
            module_name: 'Customer',
            can_view: true,
          }],
        });

      const response = await request(app)
        .get('/api/customers?payterm=60D')
        .set('x-user-id', '1');

      expect(response.status).toBe(400);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

    test('returns an empty list when no customers match', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [
            createUser({
              user_id: 99,
              role: 'superadmin',
            }),
          ],
        })
        .mockResolvedValueOnce({
          rows: [],
        });

      const response = await request(app)
        .get('/api/customers?search=NotFound')
        .set('x-user-id', '99');

      expect(response.status).toBe(200);
      expect(response.body.customers).toEqual([]);
    });
  });
});
