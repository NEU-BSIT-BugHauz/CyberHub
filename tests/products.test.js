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

  test('does not implement Product write endpoints in list-only task', async () => {
    const response = await request(app).post('/api/products').send({ prodcode: 'AD0002' });
    expect(response.status).toBe(404);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
