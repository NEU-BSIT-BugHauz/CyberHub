// S2-DEV-08: Verify independent Customer/Product action permissions on every route.
const express = require('express');
const request = require('supertest');

jest.mock('../config/db', () => ({ pool: { query: jest.fn() } }));
const { pool } = require('../config/db');
const customerRoutes = require('../routes/customers');
const productRoutes = require('../routes/products');

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.session = req.headers['x-user-id']
    ? { user: { user_id: 1 }, destroy(cb) { cb(null); } }
    : {};
  next();
});
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));

const customerBody = { custno: 'CUST001', custname: 'Customer', address: 'City', payterm: 'COD' };
const productBody = { prodcode: 'AD0001', description: 'Product', unit: 'ea' };
const priceBody = { effdate: '2026-11-01', unitprice: '15.00' };

// Each test case is one object: a single callback parameter prevents Jest from
// interpreting missing optional `body` fields as its `done` callback.
const routeCases = [
  ['Customer', 'can_view', 'get', '/api/customers'],
  ['Customer', 'can_create', 'post', '/api/customers', customerBody],
  ['Customer', 'can_edit', 'put', '/api/customers/CUST001', customerBody],
  ['Customer', 'can_delete', 'delete', '/api/customers/CUST001'],
  ['Customer', 'can_delete', 'patch', '/api/customers/CUST001/restore'],
  ['Product', 'can_view', 'get', '/api/products'],
  ['Product', 'can_view', 'get', '/api/products/AD0001/current-price'],
  ['Product', 'can_create', 'post', '/api/products', productBody],
  ['Product', 'can_edit', 'put', '/api/products/AD0001', productBody],
  ['Product', 'can_delete', 'delete', '/api/products/AD0001'],
  ['Product', 'can_delete', 'patch', '/api/products/AD0001/restore'],
  ['Product', 'can_view', 'get', '/api/products/AD0001/prices'],
  ['Product', 'can_create', 'post', '/api/products/AD0001/prices', priceBody],
  ['Product', 'can_edit', 'put', '/api/products/AD0001/prices/2026-11-01', { unitprice: '16.00' }],
  ['Product', 'can_delete', 'delete', '/api/products/AD0001/prices/2026-11-01'],
  ['Product', 'can_delete', 'patch', '/api/products/AD0001/prices/2026-11-01/restore'],
].map(([moduleName, action, method, url, body]) => ({ moduleName, action, method, url, body }));

const activeUser = {
  user_id: 1,
  empno: '12345',
  role: 'user',
  status: 'active',
  email: 'test@example.com',
};

function mockPermissions(records) {
  // Deleted-list endpoints evaluate permission twice: can_view, then can_delete.
  // A persistent SQL-sensitive mock returns the correct rows for both calls.
  pool.query.mockImplementation(async (sql) => {
    if (/FROM\s+users\s+u\b/i.test(sql)) return { rows: [activeUser] };
    if (/FROM\s+user_rights\b/i.test(sql)) return { rows: records };
    throw new Error(`Unexpected data query in permission-denial test: ${sql}`);
  });
}

function requestRoute(method, url, body) {
  const req = request(app)[method](url).set('x-user-id', '1');
  return body === undefined ? req : req.send(body);
}

describe('S2-DEV-08: Customer and Product per-action RBAC', () => {
  beforeEach(() => jest.resetAllMocks());

  test.each(routeCases)('$moduleName $action is required for $method $url', async ({ moduleName, action, method, url, body }) => {
    // Grant every other action for this module but deny the required action.
    const permission = {
      module_name: moduleName,
      can_view: action !== 'can_view',
      can_create: action !== 'can_create',
      can_edit: action !== 'can_edit',
      can_delete: action !== 'can_delete',
    };
    mockPermissions([permission]);
    const res = await requestRoute(method, url, body);
    expect(res.status).toBe(403);
    // One authentication query and one rights query; no data access.
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test.each(routeCases)('opposite-module permissions never authorize $moduleName $action $method $url', async ({ moduleName, method, url, body }) => {
    const opposite = moduleName === 'Customer' ? 'Product' : 'Customer';
    mockPermissions([{
      module_name: opposite,
      can_view: true, can_create: true, can_edit: true, can_delete: true,
    }]);
    const res = await requestRoute(method, url, body);
    expect(res.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test.each([
    { moduleName: 'Customer', url: '/api/customers?status=deleted' },
    { moduleName: 'Product', url: '/api/products?status=deleted' },
    { moduleName: 'Product', url: '/api/products/AD0001/prices?status=deleted' },
  ])('$moduleName deleted list requires both can_view and can_delete: $url', async ({ moduleName, url }) => {
    mockPermissions([{ module_name: moduleName, can_view: true, can_delete: false }]);
    let res = await requestRoute('get', url);
    expect(res.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(3); // auth, view, delete

    jest.resetAllMocks();
    mockPermissions([{ module_name: moduleName, can_view: false, can_delete: true }]);
    res = await requestRoute('get', url);
    expect(res.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(2); // auth, denied view
  });

  test.each(routeCases)('anonymous users cannot invoke $moduleName $action $method $url', async ({ method, url, body }) => {
    const req = request(app)[method](url);
    const res = await (body === undefined ? req : req.send(body));
    expect(res.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
