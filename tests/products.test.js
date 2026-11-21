const request = require('supertest');
const express = require('express');

jest.mock('../config/db', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

const { pool } = require('../config/db');
const productsRoutes = require('../routes/products');

const app = express();
app.use(express.json());

// Model the existing session middleware; protected routes still validate
// the user through the real requireAuth and permission service.
app.use((req, _res, next) => {
  const userId = req.headers['x-user-id'];
  req.session = userId
    ? {
        user: { user_id: userId },
        destroy(callback) { callback(null); },
      }
    : {};
  next();
});

app.use('/api/products', productsRoutes);
app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err.message || 'Internal server error' });
});

function createUser(overrides = {}) {
  return {
    user_id: 1,
    empno: '12345',
    full_name: 'Product Viewer',
    email: 'viewer@example.com',
    role: 'user',
    status: 'active',
    must_set_password: false,
    firstname: 'Product',
    lastname: 'Viewer',
    ...overrides,
  };
}

function createProduct(overrides = {}) {
  return {
    prodcode: 'AD0001',
    description: 'Toshiba Canvio 1 TB',
    unit: 'ea',
    ...overrides,
  };
}

function mockViewer(rows = [], permissionOverrides = {}) {
  pool.query
    .mockResolvedValueOnce({ rows: [createUser()] })
    .mockResolvedValueOnce({
      rows: [{
        module_name: 'Product',
        can_view: true,
        can_create: false,
        can_edit: false,
        can_delete: false,
        ...permissionOverrides,
      }],
    })
    .mockResolvedValueOnce({ rows });
}

describe('S2-DEV-04: Product List with Search and Filter', () => {
  beforeEach(() => jest.resetAllMocks());

  test('rejects unauthenticated list requests', async () => {
    const response = await request(app).get('/api/products');
    expect(response.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('rejects sessions whose user is no longer active', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const response = await request(app).get('/api/products').set('x-user-id', '1');
    expect(response.status).toBe(401);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('denies users without Product can_view permission', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [createUser()] })
      .mockResolvedValueOnce({ rows: [{ module_name: 'Product', can_view: false }] });
    const response = await request(app).get('/api/products').set('x-user-id', '1');
    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/permission/i);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('Customer view rights do not grant Product view rights', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [createUser()] })
      .mockResolvedValueOnce({ rows: [{ module_name: 'Customer', can_view: true }] });
    const response = await request(app).get('/api/products').set('x-user-id', '1');
    expect(response.status).toBe(403);
  });

  test('returns a product list for users with Product can_view', async () => {
    mockViewer([createProduct(), createProduct({ prodcode: 'AK0001', unit: 'pc' })]);
    const response = await request(app).get('/api/products').set('x-user-id', '1');
    expect(response.status).toBe(200);
    expect(response.body.products).toHaveLength(2);
    expect(response.body.products[0].prodcode).toBe('AD0001');
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  test('allows superadmins to list products without a permission lookup', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [createUser({ user_id: 99, role: 'superadmin' })] })
      .mockResolvedValueOnce({ rows: [createProduct()] });
    const response = await request(app).get('/api/products').set('x-user-id', '99');
    expect(response.status).toBe(200);
    expect(response.body.products).toHaveLength(1);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('searches by product code or description with parameterized SQL', async () => {
    mockViewer([createProduct()]);
    const response = await request(app)
      .get('/api/products?search=%20Toshiba%20')
      .set('x-user-id', '1');
    expect(response.status).toBe(200);
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('ILIKE'),
      ['Toshiba', '']
    );
  });

  test('filters products by unit', async () => {
    mockViewer([createProduct()]);
    const response = await request(app)
      .get('/api/products?unit=ea')
      .set('x-user-id', '1');
    expect(response.status).toBe(200);
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('unit = $2'),
      ['', 'ea']
    );
  });

  test('normalizes uppercase unit filters', async () => {
    mockViewer([createProduct()]);
    const response = await request(app)
      .get('/api/products?unit=PC')
      .set('x-user-id', '1');
    expect(response.status).toBe(200);
    expect(pool.query).toHaveBeenLastCalledWith(expect.any(String), ['', 'pc']);
  });

  test('supports combined search and unit filtering', async () => {
    mockViewer([createProduct()]);
    const response = await request(app)
      .get('/api/products?search=AD0001&unit=EA')
      .set('x-user-id', '1');
    expect(response.status).toBe(200);
    expect(pool.query).toHaveBeenLastCalledWith(expect.any(String), ['AD0001', 'ea']);
  });

  test('excludes soft-deleted products at the SQL level', async () => {
    mockViewer([createProduct()]);
    const response = await request(app).get('/api/products').set('x-user-id', '1');
    expect(response.status).toBe(200);
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('WHERE is_deleted = FALSE'),
      ['', '']
    );
  });

  test('rejects unsupported unit filters before querying products', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [createUser()] })
      .mockResolvedValueOnce({ rows: [{ module_name: 'Product', can_view: true }] });
    const response = await request(app)
      .get('/api/products?unit=box')
      .set('x-user-id', '1');
    expect(response.status).toBe(400);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test.each([
    '/api/products?unit=pc&unit=ea',
    '/api/products?search=a&search=b',
  ])('rejects duplicate query parameters: %s', async (endpoint) => {
    pool.query
      .mockResolvedValueOnce({ rows: [createUser()] })
      .mockResolvedValueOnce({ rows: [{ module_name: 'Product', can_view: true }] });
    const response = await request(app).get(endpoint).set('x-user-id', '1');
    expect(response.status).toBe(400);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('rejects search terms exceeding 150 characters', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [createUser()] })
      .mockResolvedValueOnce({ rows: [{ module_name: 'Product', can_view: true }] });
    const response = await request(app)
      .get(`/api/products?search=${'x'.repeat(151)}`)
      .set('x-user-id', '1');
    expect(response.status).toBe(400);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('returns an empty array when no products match', async () => {
    mockViewer([]);
    const response = await request(app).get('/api/products?search=Missing').set('x-user-id', '1');
    expect(response.status).toBe(200);
    expect(response.body.products).toEqual([]);
  });

  test('forwards database query failures to the global error handler', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [createUser()] })
      .mockResolvedValueOnce({ rows: [{ module_name: 'Product', can_view: true }] })
      .mockRejectedValueOnce(new Error('DB unavailable'));
    const response = await request(app).get('/api/products').set('x-user-id', '1');
    expect(response.status).toBe(500);
    expect(response.body.error).toMatch(/unavailable/i);
  });

});

describe('S2-DEV-05: Product Create and Edit', () => {
  const validProduct = {
    prodcode: 'AD0001',
    description: 'Toshiba Canvio 1 TB',
    unit: 'ea',
  };

  function mockActionPermission(action, options = {}) {
    const { user = createUser(), rows = [] } = options;
    pool.query.mockResolvedValueOnce({ rows: [user] });
    if (user.role !== 'superadmin') {
      pool.query.mockResolvedValueOnce({
        rows: [{
          module_name: 'Product',
          can_view: false,
          can_create: action === 'can_create',
          can_edit: action === 'can_edit',
          can_delete: false,
        }],
      });
    }
    if (rows !== null) pool.query.mockResolvedValueOnce({ rows });
  }

  beforeEach(() => jest.resetAllMocks());

  test('creates a product with can_create, normalizes code and unit', async () => {
    mockActionPermission('can_create', { rows: [createProduct()] });
    const response = await request(app)
      .post('/api/products')
      .set('x-user-id', '1')
      .send({ prodcode: 'ad0001', description: ' Toshiba Canvio 1 TB ', unit: 'EA' });

    expect(response.status).toBe(201);
    expect(response.body.product.prodcode).toBe('AD0001');
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO product'),
      ['AD0001', 'Toshiba Canvio 1 TB', 'ea']
    );
  });

  test('edits a product with can_edit and requires it to be active', async () => {
    mockActionPermission('can_edit', { rows: [createProduct({ description: 'New name', unit: 'pc' })] });
    const response = await request(app)
      .put('/api/products/AD0001')
      .set('x-user-id', '1')
      .send({ prodcode: 'AD0001', description: ' New name ', unit: 'pc' });

    expect(response.status).toBe(200);
    expect(response.body.product.description).toBe('New name');
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('WHERE prodcode = $1 AND is_deleted = FALSE'),
      ['AD0001', 'New name', 'pc']
    );
  });

  test('rejects create without authentication', async () => {
    const response = await request(app).post('/api/products').send(validProduct);
    expect(response.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('rejects edit without authentication', async () => {
    const response = await request(app).put('/api/products/AD0001').send(validProduct);
    expect(response.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('rejects create without Product can_create', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser()] });
    pool.query.mockResolvedValueOnce({ rows: [{ module_name: 'Product', can_view: true, can_create: false }] });
    const response = await request(app).post('/api/products').set('x-user-id', '1').send(validProduct);
    expect(response.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('rejects edit without Product can_edit', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser()] });
    pool.query.mockResolvedValueOnce({ rows: [{ module_name: 'Product', can_view: true, can_edit: false }] });
    const response = await request(app).put('/api/products/AD0001').set('x-user-id', '1').send(validProduct);
    expect(response.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('superadmin can create without looking up permissions', async () => {
    mockActionPermission('can_create', { user: createUser({ user_id: 99, role: 'superadmin' }), rows: [createProduct()] });
    const response = await request(app).post('/api/products').set('x-user-id', '99').send(validProduct);
    expect(response.status).toBe(201);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('superadmin can edit without looking up permissions', async () => {
    mockActionPermission('can_edit', { user: createUser({ user_id: 99, role: 'superadmin' }), rows: [createProduct()] });
    const response = await request(app).put('/api/products/AD0001').set('x-user-id', '99').send(validProduct);
    expect(response.status).toBe(200);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('prevents editing product code', async () => {
    mockActionPermission('can_edit', { rows: null });
    const response = await request(app).put('/api/products/AD0001').set('x-user-id', '1')
      .send({ ...validProduct, prodcode: 'AD0002' });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/cannot be changed/i);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('rejects malformed route product code before update', async () => {
    mockActionPermission('can_edit', { rows: null });
    const response = await request(app).put('/api/products/TOOLONG1').set('x-user-id', '1')
      .send(validProduct);
    expect(response.status).toBe(400);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test.each([
    [{ ...validProduct, prodcode: '' }, /code/i],
    [{ ...validProduct, prodcode: 'TOOLONG' }, /code/i],
    [{ ...validProduct, prodcode: 'A 001' }, /code/i],
    [{ ...validProduct, prodcode: 123 }, /code/i],
    [{ ...validProduct, description: '' }, /description/i],
    [{ ...validProduct, description: 'A'.repeat(31) }, /description/i],
    [{ ...validProduct, description: 20 }, /description/i],
    [{ ...validProduct, unit: 'box' }, /unit/i],
    [{ ...validProduct, unit: [] }, /unit/i],
    [[], /data/i],
    [null, /data/i],
  ])('rejects invalid create payload %#', async (payload, expectedError) => {
    mockActionPermission('can_create', { rows: null });
    const response = await request(app).post('/api/products').set('x-user-id', '1').send(payload);
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(expectedError);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('accepts valid uppercase units and trims description on edit', async () => {
    mockActionPermission('can_edit', { rows: [createProduct({ description: 'New', unit: 'ltr' })] });
    const response = await request(app).put('/api/products/ad0001').set('x-user-id', '1')
      .send({ description: ' New ', unit: 'LTR' });
    expect(response.status).toBe(200);
    expect(pool.query).toHaveBeenLastCalledWith(expect.any(String), ['AD0001', 'New', 'ltr']);
  });

  test('returns 409 for duplicate product code', async () => {
    mockActionPermission('can_create', { rows: null });
    const error = new Error('duplicate key');
    error.code = '23505';
    pool.query.mockRejectedValueOnce(error);
    const response = await request(app).post('/api/products').set('x-user-id', '1').send(validProduct);
    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/already exists/i);
  });

  test('returns 404 for a missing or soft-deleted product on edit', async () => {
    mockActionPermission('can_edit', { rows: [] });
    const response = await request(app).put('/api/products/AD0001').set('x-user-id', '1')
      .send(validProduct);
    expect(response.status).toBe(404);
  });

  test('rejects invalid edit body without querying for updates', async () => {
    mockActionPermission('can_edit', { rows: null });
    const response = await request(app).put('/api/products/AD0001').set('x-user-id', '1')
      .send({ description: '', unit: 'ea' });
    expect(response.status).toBe(400);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('forwards unexpected create database errors', async () => {
    mockActionPermission('can_create', { rows: null });
    pool.query.mockRejectedValueOnce(new Error('DB unavailable'));
    const response = await request(app).post('/api/products').set('x-user-id', '1').send(validProduct);
    expect(response.status).toBe(500);
    expect(response.body.error).toMatch(/unavailable/i);
  });

});


describe('S2-DEV-06: Product Soft Delete and Restore', () => {
  beforeEach(() => jest.resetAllMocks());

  function rights(overrides = {}) {
    return {
      module_name: 'Product',
      can_view: true,
      can_create: false,
      can_edit: false,
      can_delete: true,
      ...overrides,
    };
  }

  function mockDeleteUser(rows = [], overrides = {}, user = createUser()) {
    pool.query.mockResolvedValueOnce({ rows: [user] });
    if (user.role !== 'superadmin') {
      pool.query.mockResolvedValueOnce({ rows: [rights(overrides)] });
    }
    if (rows !== null) pool.query.mockResolvedValueOnce({ rows });
  }

  function mockDeletedList(rows = [], overrides = {}, user = createUser()) {
    pool.query.mockResolvedValueOnce({ rows: [user] });
    if (user.role !== 'superadmin') {
      pool.query.mockResolvedValueOnce({ rows: [rights(overrides)] }); // view
      pool.query.mockResolvedValueOnce({ rows: [rights(overrides)] }); // delete
    }
    if (rows !== null) pool.query.mockResolvedValueOnce({ rows });
  }

  test('active list excludes deleted products by default', async () => {
    mockViewer([createProduct()]);
    const response = await request(app).get('/api/products').set('x-user-id', '1');
    expect(response.status).toBe(200);
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('WHERE is_deleted = FALSE'), ['', '']
    );
  });

  test('allows deleted listing when user has view AND delete', async () => {
    mockDeletedList([createProduct({ is_deleted: true, deleted_by: 1 })]);
    const response = await request(app).get('/api/products?status=deleted').set('x-user-id', '1');
    expect(response.status).toBe(200);
    expect(response.body.products[0].is_deleted).toBe(true);
    expect(pool.query).toHaveBeenCalledTimes(4);
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('WHERE is_deleted = TRUE'), ['', '']
    );
  });

  test('normalizes deleted listing status and combines search and unit filter', async () => {
    mockDeletedList([createProduct({ is_deleted: true })]);
    const response = await request(app)
      .get('/api/products?status=%20DeLeTeD%20&search=AD0&unit=EA')
      .set('x-user-id', '1');
    expect(response.status).toBe(200);
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('WHERE is_deleted = TRUE'), ['AD0', 'ea']
    );
  });

  test('denies deleted listing without delete permission', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser()] });
    pool.query.mockResolvedValueOnce({ rows: [rights({ can_delete: false })] });
    pool.query.mockResolvedValueOnce({ rows: [rights({ can_delete: false })] });
    const response = await request(app).get('/api/products?status=deleted').set('x-user-id', '1');
    expect(response.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  test('does not allow delete permission to bypass view for deleted listing', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser()] });
    pool.query.mockResolvedValueOnce({ rows: [rights({ can_view: false })] });
    const response = await request(app).get('/api/products?status=deleted').set('x-user-id', '1');
    expect(response.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('case and whitespace cannot bypass deleted-list permissions', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser()] });
    pool.query.mockResolvedValueOnce({ rows: [rights({ can_delete: false })] });
    pool.query.mockResolvedValueOnce({ rows: [rights({ can_delete: false })] });
    const response = await request(app)
      .get('/api/products?status=%20DELETED%20')
      .set('x-user-id', '1');
    expect(response.status).toBe(403);
  });

  test.each([
    '/api/products?status=all',
    '/api/products?status=',
    '/api/products?status=deleted&status=active',
    '/api/products?status=deleted&status=deleted',
  ])('rejects unsupported or duplicate status parameter: %s', async (endpoint) => {
    pool.query.mockResolvedValueOnce({ rows: [createUser()] });
    pool.query.mockResolvedValueOnce({ rows: [rights()] });
    const response = await request(app).get(endpoint).set('x-user-id', '1');
    expect(response.status).toBe(400);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('superadmin can list deleted products without rights lookups', async () => {
    mockDeletedList([createProduct({ is_deleted: true })], {}, createUser({ role: 'superadmin' }));
    const response = await request(app).get('/api/products?status=deleted').set('x-user-id', '1');
    expect(response.status).toBe(200);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('soft-deletes a product without a hard DELETE statement, records user', async () => {
    mockDeleteUser([createProduct({ is_deleted: true, deleted_by: 1, deleted_at: '2026-11-21' })]);
    const response = await request(app).delete('/api/products/ad0001').set('x-user-id', '1');
    expect(response.status).toBe(200);
    expect(response.body.product.is_deleted).toBe(true);
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $2'),
      ['AD0001', 1]
    );
    expect(pool.query.mock.calls[2][0]).toContain('WHERE prodcode = $1 AND is_deleted = FALSE');
  });

  test('requires can_delete for soft deletion even when can_edit is granted', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser()] });
    pool.query.mockResolvedValueOnce({ rows: [rights({ can_delete: false, can_edit: true })] });
    const response = await request(app).delete('/api/products/AD0001').set('x-user-id', '1');
    expect(response.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test.each([
    ['delete', '/api/products/AD0001'],
    ['patch', '/api/products/AD0001/restore'],
  ])('rejects unauthenticated %s', async (method, endpoint) => {
    const response = await request(app)[method](endpoint);
    expect(response.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test.each([
    ['delete', '/api/products/INVALID1'],
    ['patch', '/api/products/INVALID1/restore'],
  ])('rejects malformed product code on %s', async (method, endpoint) => {
    mockDeleteUser(null);
    const response = await request(app)[method](endpoint).set('x-user-id', '1');
    expect(response.status).toBe(400);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('returns 404 if active product is missing or already deleted', async () => {
    mockDeleteUser([]);
    const response = await request(app).delete('/api/products/AD0001').set('x-user-id', '1');
    expect(response.status).toBe(404);
    expect(response.body.error).toMatch(/active product not found/i);
  });

  test('restores a product and clears deletion audit fields', async () => {
    mockDeleteUser([createProduct({ is_deleted: false, deleted_by: null, deleted_at: null })]);
    const response = await request(app).patch('/api/products/ad0001/restore').set('x-user-id', '1');
    expect(response.status).toBe(200);
    expect(response.body.product.is_deleted).toBe(false);
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL'),
      ['AD0001']
    );
    expect(pool.query.mock.calls[2][0]).toContain('WHERE prodcode = $1 AND is_deleted = TRUE');
  });

  test('denies restoration without can_delete permission', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser()] });
    pool.query.mockResolvedValueOnce({ rows: [rights({ can_delete: false })] });
    const response = await request(app).patch('/api/products/AD0001/restore').set('x-user-id', '1');
    expect(response.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('returns 404 when restoring an active or missing product', async () => {
    mockDeleteUser([]);
    const response = await request(app).patch('/api/products/AD0001/restore').set('x-user-id', '1');
    expect(response.status).toBe(404);
    expect(response.body.error).toMatch(/deleted product not found/i);
  });

  test('handles an audited HopeDB constraint blocking soft-delete', async () => {
    mockDeleteUser(null);
    const error = new Error('Cannot delete product row: 2 active related record(s) still exist.');
    error.code = 'P0001';
    pool.query.mockRejectedValueOnce(error);
    const response = await request(app).delete('/api/products/AD0001').set('x-user-id', '1');
    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/active related records/i);
  });

  test('forwards unrelated database errors to the global handler', async () => {
    mockDeleteUser(null);
    pool.query.mockRejectedValueOnce(new Error('DB unavailable'));
    const response = await request(app).delete('/api/products/AD0001').set('x-user-id', '1');
    expect(response.status).toBe(500);
    expect(response.body.error).toMatch(/unavailable/i);
  });

  test('deleted product codes remain reserved during create', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser()] });
    pool.query.mockResolvedValueOnce({ rows: [rights({ can_create: true })] });
    const err = new Error('unique constraint violation');
    err.code = '23505';
    pool.query.mockRejectedValueOnce(err);
    const response = await request(app).post('/api/products').set('x-user-id', '1')
      .send({ prodcode: 'AD0001', description: 'Toshiba Canvio', unit: 'ea' });
    expect(response.status).toBe(409);
    expect(response.body.error).toMatch(/restore the deleted product/i);
  });
});

// S2-DEV-07: Product Price History (effective dates + soft-delete audit).
describe('S2-DEV-07: Product Price History', () => {
  const code = 'AD0001';
  const date = '2026-11-21';
  const base = `/api/products/${code}/prices`;
  const price = {
    prodcode: code,
    effdate: date,
    unitprice: '125.50',
    is_deleted: false,
    deleted_at: null,
    deleted_by: null,
  };

  beforeEach(() => jest.resetAllMocks());

  function actor(permission = 'can_view', overrides = {}) {
    pool.query.mockResolvedValueOnce({ rows: [createUser()] });
    pool.query.mockResolvedValueOnce({
      rows: [{
        module_name: 'Product',
        can_view: permission === 'can_view',
        can_create: permission === 'can_create',
        can_edit: permission === 'can_edit',
        can_delete: permission === 'can_delete',
        ...overrides,
      }],
    });
  }

  test('rejects unauthenticated history requests', async () => {
    const r = await request(app).get(base);
    expect(r.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('requires Product can_view to list prices', async () => {
    actor('can_create');
    const r = await request(app).get(base).set('x-user-id', '1');
    expect(r.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('returns active prices newest first for active products', async () => {
    actor('can_view');
    pool.query.mockResolvedValueOnce({ rows: [{ prodcode: code }] });
    pool.query.mockResolvedValueOnce({ rows: [price] });
    const r = await request(app).get(base).set('x-user-id', '1');
    expect(r.status).toBe(200);
    expect(r.body.prices).toEqual([price]);
    expect(pool.query.mock.calls[2][0]).toMatch(/is_deleted = FALSE/);
    expect(pool.query.mock.calls[3][0]).toContain('ORDER BY effdate DESC');
    expect(pool.query.mock.calls[3][0]).toContain('is_deleted = FALSE');
    expect(pool.query.mock.calls[3][1]).toEqual([code]);
  });

  test('denies deleted price history without delete permission', async () => {
    actor('can_view', { can_delete: false });
    pool.query.mockResolvedValueOnce({
      rows: [{ module_name: 'Product', can_view: true, can_delete: false }],
    });
    const r = await request(app).get(`${base}?status=deleted`).set('x-user-id', '1');
    expect(r.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  test('deleted history requires both view and delete permissions', async () => {
    actor('can_delete');
    const r = await request(app).get(`${base}?status=deleted`).set('x-user-id', '1');
    expect(r.status).toBe(403);
  });

  test('lists deleted history for users with both permissions', async () => {
    actor('can_view', { can_delete: true });
    pool.query.mockResolvedValueOnce({ rows: [{ module_name: 'Product', can_view: true, can_delete: true }] });
    pool.query.mockResolvedValueOnce({ rows: [{ prodcode: code }] });
    pool.query.mockResolvedValueOnce({ rows: [{ ...price, is_deleted: true }] });
    const r = await request(app).get(`${base}?status=%20DELETED%20`).set('x-user-id', '1');
    expect(r.status).toBe(200);
    expect(r.body.prices[0].is_deleted).toBe(true);
    expect(pool.query.mock.calls[4][0]).toContain('is_deleted = TRUE');
  });

  test('allows superadmin history without permission queries', async () => {
    pool.query.mockResolvedValueOnce({ rows: [createUser({ role: 'superadmin' })] });
    pool.query.mockResolvedValueOnce({ rows: [{ prodcode: code }] });
    pool.query.mockResolvedValueOnce({ rows: [price] });
    const r = await request(app).get(base).set('x-user-id', '1');
    expect(r.status).toBe(200);
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  test.each(['?status=all', '?status=', '?status=active&status=deleted'])('rejects invalid list status %s', async (query) => {
    actor('can_view');
    const r = await request(app).get(`${base}${query}`).set('x-user-id', '1');
    expect(r.status).toBe(400);
  });

  test('returns 404 for a missing or deleted parent product', async () => {
    actor('can_view');
    pool.query.mockResolvedValueOnce({ rows: [] });
    const r = await request(app).get(base).set('x-user-id', '1');
    expect(r.status).toBe(404);
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  test('adds a price with validated effective date and decimal amount', async () => {
    actor('can_create');
    pool.query.mockResolvedValueOnce({ rows: [price] });
    const r = await request(app).post(base).set('x-user-id', '1')
      .send({ effdate: date, unitprice: '125.50' });
    expect(r.status).toBe(201);
    expect(r.body.price.effdate).toBe(date);
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO pricehist'), [code, date, '125.50']
    );
    expect(pool.query.mock.calls[2][0]).toContain('is_deleted = FALSE');
  });

  test.each(['2026-02-30', '2026-13-01', '21-11-2026', '2026-11-00', ''])
    ('rejects invalid effective date %s before SQL', async (badDate) => {
      actor('can_create');
      const r = await request(app).post(base).set('x-user-id', '1')
        .send({ effdate: badDate, unitprice: '1.00' });
      expect(r.status).toBe(400);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

  test.each([0, -2, '0', '0.001', '12.345', 100000000, '1e3', null, {}, ''])
    ('rejects invalid decimal price %s', async (badPrice) => {
      actor('can_create');
      const r = await request(app).post(base).set('x-user-id', '1')
        .send({ effdate: date, unitprice: badPrice });
      expect(r.status).toBe(400);
      expect(pool.query).toHaveBeenCalledTimes(2);
    });

  test('denies price creation without can_create', async () => {
    actor('can_view');
    const r = await request(app).post(base).set('x-user-id', '1')
      .send({ effdate: date, unitprice: '1.00' });
    expect(r.status).toBe(403);
  });

  test('returns 404 when trying to add a price to a deleted product', async () => {
    actor('can_create');
    pool.query.mockResolvedValueOnce({ rows: [] });
    const r = await request(app).post(base).set('x-user-id', '1')
      .send({ effdate: date, unitprice: '1.00' });
    expect(r.status).toBe(404);
  });

  test('returns 409 when the product-date combination already exists', async () => {
    actor('can_create');
    const err = new Error('duplicate');
    err.code = '23505';
    pool.query.mockRejectedValueOnce(err);
    const r = await request(app).post(base).set('x-user-id', '1')
      .send({ effdate: date, unitprice: '1.00' });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/restore/i);
  });

  test('edits an active historical price without changing its effective date', async () => {
    actor('can_edit');
    pool.query.mockResolvedValueOnce({ rows: [{ ...price, unitprice: '130.00' }] });
    const r = await request(app).put(`${base}/${date}`).set('x-user-id', '1')
      .send({ unitprice: '130.00' });
    expect(r.status).toBe(200);
    expect(r.body.price.unitprice).toBe('130.00');
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('UPDATE pricehist SET unitprice'), [code, date, '130.00']
    );
    expect(pool.query.mock.calls[2][0]).toContain('EXISTS (SELECT 1 FROM product');
  });

  test('denies price editing without can_edit', async () => {
    actor('can_view');
    const r = await request(app).put(`${base}/${date}`).set('x-user-id', '1')
      .send({ unitprice: '130.00' });
    expect(r.status).toBe(403);
  });

  test('refuses effective-date edits instead of silently moving a historical key', async () => {
    actor('can_edit');
    const r = await request(app).put(`${base}/${date}`).set('x-user-id', '1')
      .send({ effdate: '2026-11-22', unitprice: '130.00' });
    expect(r.status).toBe(400);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('refuses changing the product code of a price', async () => {
    actor('can_edit');
    const r = await request(app).put(`${base}/${date}`).set('x-user-id', '1')
      .send({ prodcode: 'AK0001', unitprice: '130.00' });
    expect(r.status).toBe(400);
  });

  test('returns 404 when editing a deleted or missing historical price', async () => {
    actor('can_edit');
    pool.query.mockResolvedValueOnce({ rows: [] });
    const r = await request(app).put(`${base}/${date}`).set('x-user-id', '1')
      .send({ unitprice: '130.00' });
    expect(r.status).toBe(404);
  });

  test('soft-deletes a historical price and records the user, without hard DELETE', async () => {
    actor('can_delete');
    pool.query.mockResolvedValueOnce({ rows: [{ ...price, is_deleted: true, deleted_by: 1 }] });
    const r = await request(app).delete(`${base}/${date}`).set('x-user-id', '1');
    expect(r.status).toBe(200);
    expect(r.body.price.is_deleted).toBe(true);
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('SET is_deleted = TRUE'), [code, date, 1]
    );
    expect(pool.query.mock.calls[2][0]).not.toMatch(/^DELETE\s/i);
  });

  test('denies price deletion without can_delete', async () => {
    actor('can_edit');
    const r = await request(app).delete(`${base}/${date}`).set('x-user-id', '1');
    expect(r.status).toBe(403);
  });

  test('returns 404 when repeatedly deleting an already deleted price', async () => {
    actor('can_delete');
    pool.query.mockResolvedValueOnce({ rows: [] });
    const r = await request(app).delete(`${base}/${date}`).set('x-user-id', '1');
    expect(r.status).toBe(404);
  });

  test('restores the same historical date with a non-destructive update', async () => {
    actor('can_delete');
    pool.query.mockResolvedValueOnce({ rows: [{ ...price, is_deleted: false }] });
    const r = await request(app).patch(`${base}/${date}/restore`).set('x-user-id', '1');
    expect(r.status).toBe(200);
    expect(pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('SET is_deleted = FALSE'), [code, date]
    );
  });

  test('denies restoration without can_delete', async () => {
    actor('can_view');
    const r = await request(app).patch(`${base}/${date}/restore`).set('x-user-id', '1');
    expect(r.status).toBe(403);
  });

  test('returns 404 when restoring an active or missing price', async () => {
    actor('can_delete');
    pool.query.mockResolvedValueOnce({ rows: [] });
    const r = await request(app).patch(`${base}/${date}/restore`).set('x-user-id', '1');
    expect(r.status).toBe(404);
  });

  test('rejects malformed effective-date URL without updating SQL', async () => {
    actor('can_delete');
    const r = await request(app).delete(`${base}/2026-02-30`).set('x-user-id', '1');
    expect(r.status).toBe(400);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('rejects unauthenticated mutation of prices', async () => {
    const r = await request(app).delete(`${base}/${date}`);
    expect(r.status).toBe(401);
  });

  test('rejects invalid product codes on price routes', async () => {
    actor('can_view');
    const r = await request(app).get('/api/products/TOO-LONG/prices').set('x-user-id', '1');
    expect(r.status).toBe(400);
  });

  test('forwards unexpected price history query errors', async () => {
    actor('can_view');
    pool.query.mockRejectedValueOnce(new Error('Database unavailable'));
    const r = await request(app).get(base).set('x-user-id', '1');
    expect(r.status).toBe(500);
    expect(r.body.error).toMatch(/Database unavailable/i);
  });
});
