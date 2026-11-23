'use strict';

const request = require('supertest');
const express = require('express');

jest.mock('../config/db', () => ({ pool: { query: jest.fn() } }));
const { pool } = require('../config/db');
const customerShopRoutes = require('../routes/customerShop');

const app = express();
app.use((req, _res, next) => {
  req.session = req.headers['x-test-customer'] === 'yes'
    ? { customer: { account_id: 45 } }
    : req.headers['x-test-employee'] === 'yes'
      ? { user: { user_id: 3 } }
      : {};
  next();
});
app.use('/api/customer-shop', customerShopRoutes);
app.use((err, _req, res, _next) => res.status(500).json({ error: 'Internal server error.' }));

const target = '/api/customer-shop/products';
const signedIn = () => request(app).get(target).set('x-test-customer', 'yes');

beforeEach(() => jest.resetAllMocks());

test('rejects unauthenticated visitors before querying the database', async () => {
  const response = await request(app).get(target);
  expect(response.status).toBe(401);
  expect(pool.query).not.toHaveBeenCalled();
});

test('rejects employees who are not signed in as customers', async () => {
  const response = await request(app).get(target).set('x-test-employee', 'yes');
  expect(response.status).toBe(401);
  expect(pool.query).not.toHaveBeenCalled();
});

test('rejects blocked or deleted customer accounts before reading products', async () => {
  pool.query.mockResolvedValueOnce({ rows: [] });
  const response = await signedIn();
  expect(response.status).toBe(401);
  expect(pool.query).toHaveBeenCalledTimes(1);
  expect(pool.query.mock.calls[0][0]).toContain("ca.status = 'active'");
  expect(pool.query.mock.calls[0][0]).toContain('c.is_deleted');
});

test('lists active products with latest effective price and hides future and deleted prices', async () => {
  pool.query.mockResolvedValueOnce({ rows: [{ id: 45 }] })
    .mockResolvedValueOnce({ rows: [
      { prodcode: 'PROD01', description: 'CAT6 Cable', unit: 'mtr', current_price: '27.50', current_price_effdate: '2026-10-15' },
    ] });

  const response = await signedIn().query({ search: 'CAT6', unit: 'MTR' });
  expect(response.status).toBe(200);
  expect(response.body.products).toHaveLength(1);
  expect(response.body.products[0].current_price).toBe('27.50');
  expect(response.headers['cache-control']).toContain('no-store');
  expect(pool.query.mock.calls[1][1]).toEqual(['CAT6', 'mtr']);
  const sql = pool.query.mock.calls[1][0];
  expect(sql).toContain('p.is_deleted = FALSE');
  expect(sql).toContain('ph.is_deleted = FALSE');
  expect(sql).toContain("AT TIME ZONE 'Asia/Manila'");
  expect(sql).toContain('ph.effdate <=');
  expect(sql).toContain('ORDER BY ph.effdate DESC');
  expect(sql).toContain('LIMIT 100');
  expect(sql).not.toContain('password_hash');
});

test('returns products without a price as null (not invented)', async () => {
  pool.query.mockResolvedValueOnce({ rows: [{ id: 45 }] })
    .mockResolvedValueOnce({ rows: [{ prodcode: 'NO-PR', description: 'No Price', unit: 'pc', current_price: null, current_price_effdate: null }] });
  const response = await signedIn();
  expect(response.status).toBe(200);
  expect(response.body.products[0].current_price).toBeNull();
});

test('rejects invalid search and unit without a product query', async () => {
  pool.query.mockResolvedValue({ rows: [{ id: 45 }] });
  expect((await signedIn().query({ search: 'x'.repeat(101) })).status).toBe(400);
  expect((await signedIn().query({ unit: 'crate' })).status).toBe(400);
  expect((await signedIn().query({ unit: ['pc', 'ea'] })).status).toBe(400);
  expect(pool.query).toHaveBeenCalledTimes(3);
});

test('never interpolates search input into SQL', async () => {
  const input = "a' OR TRUE--";
  pool.query.mockResolvedValueOnce({ rows: [{ id: 45 }] })
    .mockResolvedValueOnce({ rows: [] });
  const response = await signedIn().query({ search: input });
  expect(response.status).toBe(200);
  expect(pool.query.mock.calls[1][0]).not.toContain(input);
  expect(pool.query.mock.calls[1][1]).toEqual([input, '']);
});

test('returns a generic error when the database is unavailable', async () => {
  pool.query.mockRejectedValueOnce(new Error('Database failed'));
  const response = await signedIn();
  expect(response.status).toBe(500);
  expect(response.body.error).toBe('Internal server error.');
});
