'use strict';

const express = require('express');
const request = require('supertest');

jest.mock('../config/db', () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));
const { pool } = require('../config/db');
const router = require('../routes/customerShopping');
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.session = req.headers['x-customer'] === 'yes'
    ? { customer: { account_id: 45 } }
    : req.headers['x-employee'] === 'yes'
      ? { user: { user_id: 10 } }
      : {};
  next();
});
app.use('/api/customer-shopping', router);
app.use((_err, _req, res, _next) => res.status(500).json({ error: 'Internal server error.' }));
const auth = { rows: [{ id: 45, custno: 'C12345678' }] };
const signed = (method, path) => request(app)[method](`/api/customer-shopping${path}`).set('x-customer', 'yes');
const UUID = 'f998bd10-bbe7-49b9-9b36-f90e44ccab0a';
const priceRow = (overrides = {}) => ({
  prodcode: 'PROD01', description: 'CAT6 Cable', unit: 'mtr', quantity: 2,
  is_deleted: false, current_price: '27.50', ...overrides,
});

beforeEach(() => jest.resetAllMocks());

test('customer endpoints reject visitors and employee-only sessions without DB access', async () => {
  for (const path of ['/cart', '/orders', '/orders/1']) {
    expect((await request(app).get(`/api/customer-shopping${path}`)).status).toBe(401);
    expect((await request(app).get(`/api/customer-shopping${path}`).set('x-employee', 'yes')).status).toBe(401);
  }
  expect(pool.query).not.toHaveBeenCalled();
});

test('blocked or deleted customer loses shopping access immediately', async () => {
  pool.query.mockResolvedValueOnce({ rows: [] });
  const response = await signed('get', '/cart');
  expect(response.status).toBe(401);
  expect(pool.query).toHaveBeenCalledTimes(1);
  expect(pool.query.mock.calls[0][0]).toContain("ca.status = 'active'");
  expect(pool.query.mock.calls[0][0]).toContain('c.is_deleted');
});

test('cart lists customer-owned lines and calculates subtotals in integer cents', async () => {
  pool.query.mockResolvedValueOnce(auth).mockResolvedValueOnce({ rows: [priceRow(), priceRow({ prodcode: 'PROD02', quantity: 3, current_price: '5.33' })] });
  const response = await signed('get', '/cart');
  expect(response.status).toBe(200);
  expect(response.body.subtotal).toBe('70.99');
  expect(response.body.items[0].line_total).toBe('55.00');
  expect(response.body.has_unavailable).toBe(false);
  expect(response.headers['cache-control']).toContain('no-store');
  expect(pool.query.mock.calls[1][1]).toEqual([45]);
  expect(pool.query.mock.calls[1][0]).toContain("AT TIME ZONE 'Asia/Manila'");
});

test('cart marks unavailable or unpriced products instead of inventing prices', async () => {
  pool.query.mockResolvedValueOnce(auth).mockResolvedValueOnce({ rows: [priceRow({ current_price: null }), priceRow({ prodcode: 'PROD02', is_deleted: true })] });
  const response = await signed('get', '/cart');
  expect(response.status).toBe(200);
  expect(response.body.subtotal).toBe('0.00');
  expect(response.body.has_unavailable).toBe(true);
  expect(response.body.items[0].unit_price).toBeNull();
});

test('cart additions require valid product codes and whole quantities', async () => {
  pool.query.mockResolvedValue(auth);
  for (const body of [{ prodcode: 'PROD01', quantity: 0 }, { prodcode: 'PROD01', quantity: 1.5 },
    { prodcode: 'BAD!1', quantity: 1 }, { prodcode: 'PROD01', quantity: 100 }]) {
    const response = await signed('post', '/cart/items').send(body);
    expect(response.status).toBe(400);
  }
  expect(pool.query).toHaveBeenCalledTimes(4); // authentication only
});

test('valid customer can add a priced active product using parameterized SQL', async () => {
  pool.query.mockResolvedValueOnce(auth).mockResolvedValueOnce({ rows: [{ prodcode: 'PROD01', quantity: 1 }] });
  const response = await signed('post', '/cart/items').send({ prodcode: 'prod01', quantity: 1 });
  expect(response.status).toBe(201);
  expect(response.body.item.quantity).toBe(1);
  expect(pool.query.mock.calls[1][1]).toEqual([45, 'PROD01', 1, 50]);
  expect(pool.query.mock.calls[1][0]).toContain('ph.effdate <=');
  expect(pool.query.mock.calls[1][0]).toContain('ON CONFLICT');
});

test('adding an unpriced or unavailable product returns conflict', async () => {
  pool.query.mockResolvedValueOnce(auth).mockResolvedValueOnce({ rows: [] });
  const response = await signed('post', '/cart/items').send({ prodcode: 'PROD01', quantity: 1 });
  expect(response.status).toBe(409);
});

test('quantity edits are scoped to the logged-in customer account', async () => {
  pool.query.mockResolvedValueOnce(auth).mockResolvedValueOnce({ rows: [{ prodcode: 'PROD01', quantity: 3 }] });
  const response = await signed('patch', '/cart/items/PROD01').send({ quantity: 3 });
  expect(response.status).toBe(200);
  expect(pool.query.mock.calls[1][1]).toEqual([45, 'PROD01', 3]);
});

test('quantity update returns 404 when item is not in the customer cart', async () => {
  pool.query.mockResolvedValueOnce(auth).mockResolvedValueOnce({ rows: [] });
  expect((await signed('patch', '/cart/items/PROD01').send({ quantity: 3 })).status).toBe(404);
});

test('customer can remove own cart item', async () => {
  pool.query.mockResolvedValueOnce(auth).mockResolvedValueOnce({ rows: [{ prodcode: 'PROD01' }] });
  const response = await signed('delete', '/cart/items/PROD01');
  expect(response.status).toBe(200);
  expect(pool.query.mock.calls[1][1]).toEqual([45, 'PROD01']);
});

test('checkout requires a valid idempotency token', async () => {
  pool.query.mockResolvedValueOnce(auth);
  const response = await signed('post', '/checkout').send({ checkout_token: 'not-a-uuid' });
  expect(response.status).toBe(400);
  expect(pool.connect).not.toHaveBeenCalled();
});

function mockClient(results) {
  const client = { query: jest.fn(), release: jest.fn() };
  for (const result of results) client.query.mockResolvedValueOnce(result);
  pool.connect.mockResolvedValueOnce(client);
  return client;
}

test('checkout snapshots current server-side prices and clears the cart in one transaction', async () => {
  pool.query.mockResolvedValueOnce(auth);
  const client = mockClient([
    { rows: [] }, // BEGIN
    { rows: [auth.rows[0]] }, // lock current customer account
    { rows: [] }, // idempotency lookup
    { rows: [priceRow()] }, // locked cart
    { rows: [{ order_id: 91, status: 'pending', total_amount: '55.00' }] }, // order
    { rows: [] }, // line item
    { rows: [] }, // delete cart
    { rows: [] }, // COMMIT
  ]);
  const response = await signed('post', '/checkout').send({ checkout_token: UUID });
  expect(response.status).toBe(201);
  expect(response.body.order.order_id).toBe(91);
  expect(response.body.order.status).toBe('pending');
  expect(client.query.mock.calls[4][1]).toEqual([45, 'C12345678', UUID, '55.00']);
  expect(client.query.mock.calls[5][1]).toEqual([91, 'PROD01', 'CAT6 Cable', 'mtr', 2, '27.50', '55.00']);
  expect(client.query.mock.calls[7][0]).toBe('COMMIT');
  expect(client.query.mock.calls.some(call => call[0] === 'ROLLBACK')).toBe(false);
  expect(client.release).toHaveBeenCalledTimes(1);
});

test('retrying the same checkout token returns existing order, even when cart is now empty', async () => {
  pool.query.mockResolvedValueOnce(auth);
  const client = mockClient([
    { rows: [] }, { rows: [auth.rows[0]] },
    { rows: [{ order_id: 91, status: 'pending', total_amount: '55.00' }] }, { rows: [] },
  ]);
  const response = await signed('post', '/checkout').send({ checkout_token: UUID });
  expect(response.status).toBe(200);
  expect(response.body.already_submitted).toBe(true);
  expect(client.query).toHaveBeenCalledTimes(4);
  expect(client.release).toHaveBeenCalledTimes(1);
});

test('checkout rejects unavailable products and rolls back before making an order', async () => {
  pool.query.mockResolvedValueOnce(auth);
  const client = mockClient([
    { rows: [] }, { rows: [auth.rows[0]] }, { rows: [] },
    { rows: [priceRow({ current_price: null })] }, { rows: [] },
  ]);
  const response = await signed('post', '/checkout').send({ checkout_token: UUID });
  expect(response.status).toBe(409);
  expect(client.query.mock.calls[4][0]).toBe('ROLLBACK');
  expect(client.query.mock.calls.some(call => String(call[0]).includes('INSERT INTO customer_web_orders'))).toBe(false);
  expect(client.release).toHaveBeenCalled();
});

test('empty cart cannot submit an order', async () => {
  pool.query.mockResolvedValueOnce(auth);
  const client = mockClient([
    { rows: [] }, { rows: [auth.rows[0]] }, { rows: [] }, { rows: [] }, { rows: [] },
  ]);
  expect((await signed('post', '/checkout').send({ checkout_token: UUID })).status).toBe(409);
  expect(client.query.mock.calls[4][0]).toBe('ROLLBACK');
});

test('database failure during checkout rolls back and releases the connection', async () => {
  pool.query.mockResolvedValueOnce(auth);
  const client = { query: jest.fn(), release: jest.fn() };
  client.query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error('Database failed')).mockResolvedValueOnce({ rows: [] });
  pool.connect.mockResolvedValueOnce(client);
  expect((await signed('post', '/checkout').send({ checkout_token: UUID })).status).toBe(500);
  expect(client.query.mock.calls[2][0]).toBe('ROLLBACK');
  expect(client.release).toHaveBeenCalledTimes(1);
});

test('order list returns only current customer orders', async () => {
  pool.query.mockResolvedValueOnce(auth).mockResolvedValueOnce({ rows: [{ order_id: 91, total_amount: '55.00', status: 'pending' }] });
  const response = await signed('get', '/orders');
  expect(response.status).toBe(200);
  expect(response.body.orders[0].order_id).toBe(91);
  expect(pool.query.mock.calls[1][1]).toEqual([45]);
});

test('customer cannot view another customer order', async () => {
  pool.query.mockResolvedValueOnce(auth).mockResolvedValueOnce({ rows: [] });
  const response = await signed('get', '/orders/999');
  expect(response.status).toBe(404);
  expect(pool.query.mock.calls[1][1]).toEqual([45, '999']);
  expect(pool.query).toHaveBeenCalledTimes(2);
});

test('order detail shows captured original unit prices and totals', async () => {
  pool.query.mockResolvedValueOnce(auth)
    .mockResolvedValueOnce({ rows: [{ order_id: 91, total_amount: '55.00', status: 'pending' }] })
    .mockResolvedValueOnce({ rows: [{ prodcode: 'PROD01', quantity: 2, unit_price: '27.50', line_total: '55.00' }] });
  const response = await signed('get', '/orders/91');
  expect(response.status).toBe(200);
  expect(response.body.order.items[0].unit_price).toBe('27.50');
  expect(pool.query.mock.calls[2][1]).toEqual(['91']);
});
