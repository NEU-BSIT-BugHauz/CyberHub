
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

describe('S2-DEV-02 customer create and edit', () => {
  beforeEach(() => jest.resetAllMocks());

  test('creates a customer with permission', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser({ role: 'superadmin' })] })
      .mockResolvedValueOnce({ rows: [createCustomer()] });
    const response = await request(app).post('/api/customers').set('x-user-id', '1')
      .send(createCustomer());
    expect(response.status).toBe(201);
    expect(response.body.customer.custno).toBe('CUST001');
  });

  test('edits an existing customer with permission', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser({ role: 'superadmin' })] })
      .mockResolvedValueOnce({ rows: [createCustomer({ custname: 'Updated' })] });
    const response = await request(app).put('/api/customers/CUST001').set('x-user-id', '1')
      .send({ custname: 'Updated', address: 'Manila', payterm: 'COD' });
    expect(response.status).toBe(200);
    expect(response.body.customer.custname).toBe('Updated');
  });

  test('rejects invalid payment terms', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser({ role: 'superadmin' })] });
    const response = await request(app).post('/api/customers').set('x-user-id', '1')
      .send(createCustomer({ payterm: '90D' }));
    expect(response.status).toBe(400);
  });

  test('rejects changing customer number during edit', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser({ role: 'superadmin' })] });
    const response = await request(app).put('/api/customers/CUST001').set('x-user-id', '1')
      .send(createCustomer({ custno: 'CUST002' }));
    expect(response.status).toBe(400);
  });

  test('rejects duplicate customer numbers', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser({ role: 'superadmin' })] })
      .mockRejectedValueOnce({ code: '23505' });
    const response = await request(app).post('/api/customers').set('x-user-id', '1')
      .send(createCustomer());
    expect(response.status).toBe(409);
  });

  test('returns 404 when editing a missing customer', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser({ role: 'superadmin' })] })
      .mockResolvedValueOnce({ rows: [] });
    const response = await request(app).put('/api/customers/CUST001').set('x-user-id', '1')
      .send({ custname: 'Updated', payterm: 'COD' });
    expect(response.status).toBe(404);
  });

  test('rejects create without can_create permission', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser()] })
      .mockResolvedValueOnce({ rows: [{ module_name: 'Customer', can_view: true, can_create: false, can_edit: true }] });
    const response = await request(app).post('/api/customers').set('x-user-id', '1')
      .send(createCustomer());
    expect(response.status).toBe(403);
  });

  test('rejects edit without can_edit permission', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser()] })
      .mockResolvedValueOnce({ rows: [{ module_name: 'Customer', can_view: true, can_create: true, can_edit: false }] });
    const response = await request(app).put('/api/customers/CUST001').set('x-user-id', '1')
      .send(createCustomer());
    expect(response.status).toBe(403);
  });
});


describe('S2-DEV-02 additional validation and authorization', () => {
  beforeEach(() => jest.resetAllMocks());

  test('rejects missing customer name before inserting', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser({ role: 'superadmin' })] });
    const response = await request(app).post('/api/customers').set('x-user-id', '1')
      .send({ custno: 'CUST003', payterm: 'COD' });
    expect(response.status).toBe(400);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('rejects invalid customer number before inserting', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser({ role: 'superadmin' })] });
    const response = await request(app).post('/api/customers').set('x-user-id', '1')
      .send(createCustomer({ custno: 'bad number!' }));
    expect(response.status).toBe(400);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('rejects non-string address before inserting', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser({ role: 'superadmin' })] });
    const response = await request(app).post('/api/customers').set('x-user-id', '1')
      .send(createCustomer({ address: 42 }));
    expect(response.status).toBe(400);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('rejects unauthenticated create and edit', async () => {
    const create = await request(app).post('/api/customers').send(createCustomer());
    const edit = await request(app).put('/api/customers/CUST001')
      .send({ custname: 'Updated', payterm: 'COD' });
    expect(create.status).toBe(401);
    expect(edit.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('S2-DEV-03 customer soft delete and restore', () => {
  beforeEach(() => jest.resetAllMocks());

  function grantPermissions(overrides = {}) {
    pool.query
      .mockResolvedValueOnce({ rows: [createUser()] })
      .mockResolvedValueOnce({
        rows: [{
          module_name: 'Customer',
          can_view: true,
          can_create: false,
          can_edit: false,
          can_delete: false,
          ...overrides,
        }],
      });
  }

  test('active customer list excludes soft-deleted rows', async () => {
    grantPermissions();
    pool.query.mockResolvedValueOnce({ rows: [createCustomer({ is_deleted: false })] });
    const response = await request(app).get('/api/customers').set('x-user-id', '1');
    expect(response.status).toBe(200);
    expect(response.body.customers).toHaveLength(1);
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('is_deleted = FALSE'),
      ['', '']
    );
  });

  test('lists deleted records for users with view and delete permission', async () => {
    grantPermissions({ can_delete: true });
    // requireDelete rechecks user_rights after requireView.
    pool.query
      .mockResolvedValueOnce({
        rows: [{ module_name: 'Customer', can_view: true, can_delete: true }],
      })
      .mockResolvedValueOnce({ rows: [createCustomer({ is_deleted: true })] });
    const response = await request(app)
      .get('/api/customers?status=deleted')
      .set('x-user-id', '1');
    expect(response.status).toBe(200);
    expect(response.body.customers[0].is_deleted).toBe(true);
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('is_deleted = TRUE'),
      ['', '']
    );
  });

  test('denies deleted listing without delete permission', async () => {
    grantPermissions();
    pool.query.mockResolvedValueOnce({
      rows: [{ module_name: 'Customer', can_view: true, can_delete: false }],
    });
    const response = await request(app)
      .get('/api/customers?status=deleted')
      .set('x-user-id', '1');
    expect(response.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  test('normalization cannot bypass deleted-list permissions', async () => {
    grantPermissions();
    pool.query.mockResolvedValueOnce({
      rows: [{ module_name: 'Customer', can_view: true, can_delete: false }],
    });
    const response = await request(app)
      .get('/api/customers?status=%20DeLeTeD%20')
      .set('x-user-id', '1');
    expect(response.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  test('rejects unsupported status', async () => {
    grantPermissions();
    const response = await request(app).get('/api/customers?status=all').set('x-user-id', '1');
    expect(response.status).toBe(400);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('rejects duplicate status query parameters', async () => {
    grantPermissions();
    const response = await request(app)
      .get('/api/customers?status=active&status=deleted')
      .set('x-user-id', '1');
    expect(response.status).toBe(400);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('soft deletes a customer and records the acting user', async () => {
    grantPermissions({ can_delete: true });
    pool.query.mockResolvedValueOnce({
      rows: [createCustomer({ is_deleted: true, deleted_by: 1, deleted_at: '2026-11-21T12:00:00Z' })],
    });
    const response = await request(app).delete('/api/customers/CUST001').set('x-user-id', '1');
    expect(response.status).toBe(200);
    expect(response.body.customer.is_deleted).toBe(true);
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('SET is_deleted = TRUE'),
      ['CUST001', 1]
    );
    expect(pool.query.mock.calls[2][0]).not.toMatch(/DELETE\s+FROM/i);
  });

  test('denies delete without can_delete permission', async () => {
    grantPermissions();
    const response = await request(app).delete('/api/customers/CUST001').set('x-user-id', '1');
    expect(response.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('rejects unauthenticated deletion and restoration', async () => {
    const deleting = await request(app).delete('/api/customers/CUST001');
    const restoring = await request(app).patch('/api/customers/CUST001/restore');
    expect(deleting.status).toBe(401);
    expect(restoring.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('rejects invalid customer numbers on delete', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser({ role: 'superadmin' })] });
    const response = await request(app).delete('/api/customers/invalid%20number').set('x-user-id', '1');
    expect(response.status).toBe(400);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('returns 404 when customer already deleted or missing', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser({ role: 'superadmin' })] })
      .mockResolvedValueOnce({ rows: [] });
    const response = await request(app).delete('/api/customers/CUST001').set('x-user-id', '1');
    expect(response.status).toBe(404);
  });

  test('restores a customer and clears deletion audit fields', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser({ role: 'superadmin' })] })
      .mockResolvedValueOnce({ rows: [createCustomer({ is_deleted: false, deleted_at: null, deleted_by: null })] });
    const response = await request(app).patch('/api/customers/CUST001/restore').set('x-user-id', '1');
    expect(response.status).toBe(200);
    expect(response.body.customer.is_deleted).toBe(false);
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('deleted_at = NULL, deleted_by = NULL'),
      ['CUST001']
    );
  });

  test('denies restore without delete permission', async () => {
    grantPermissions();
    const response = await request(app).patch('/api/customers/CUST001/restore').set('x-user-id', '1');
    expect(response.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('returns 404 when restoring active or missing customer', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser({ role: 'superadmin' })] })
      .mockResolvedValueOnce({ rows: [] });
    const response = await request(app).patch('/api/customers/CUST001/restore').set('x-user-id', '1');
    expect(response.status).toBe(404);
  });

  test('edit query cannot modify soft-deleted customers', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser({ role: 'superadmin' })] })
      .mockResolvedValueOnce({ rows: [] });
    const response = await request(app).put('/api/customers/CUST001').set('x-user-id', '1')
      .send({ custname: 'Not Editable', payterm: 'COD' });
    expect(response.status).toBe(404);
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('AND is_deleted = FALSE'),
      ['CUST001', 'Not Editable', null, 'COD']
    );
  });

  test('deleted customer numbers remain reserved on create', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser({ role: 'superadmin' })] })
      .mockRejectedValueOnce({ code: '23505' });
    const response = await request(app).post('/api/customers').set('x-user-id', '1')
      .send(createCustomer());
    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/restore/i);
  });
});
