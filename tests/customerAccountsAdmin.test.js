'use strict';
const request = require('supertest');
const express = require('express');
jest.mock('../config/db', () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));
const { pool } = require('../config/db');
const customerAccountsAdmin = require('../routes/customerAccountsAdmin');
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const userId = req.get('x-staff-id');
  req.session = userId ? { user: { user_id: userId } } : {};
  next();
});
app.use('/api/admin/customer-accounts', customerAccountsAdmin);
const admin = (role = 'admin', status = 'active') => ({ id: 10, role, status });
const asAdmin = () => pool.query.mockResolvedValueOnce({ rows: [admin()] });

beforeEach(() => jest.clearAllMocks());

test('rejects anonymous customer calls', async () => {
  expect((await request(app).get('/api/admin/customer-accounts')).status).toBe(401);
  expect(pool.query).not.toHaveBeenCalled();
});

test('rejects employee users without admin role', async () => {
  pool.query.mockResolvedValueOnce({ rows: [admin('user')] });
  expect((await request(app).get('/api/admin/customer-accounts').set('x-staff-id', '10')).status).toBe(403);
});

test('rejects blocked admins and stale employees', async () => {
  pool.query.mockResolvedValueOnce({ rows: [admin('admin', 'blocked')] });
  expect((await request(app).get('/api/admin/customer-accounts').set('x-staff-id', '10')).status).toBe(403);
  pool.query.mockResolvedValueOnce({ rows: [] });
  expect((await request(app).get('/api/admin/customer-accounts').set('x-staff-id', '10')).status).toBe(403);
});

test('admins may list customer accounts, not password hashes', async () => {
  asAdmin();
  pool.query.mockResolvedValueOnce({ rows: [{ account_id: 5, custno: 'C123', email: 'one@example.com', status: 'active' }] });
  const res = await request(app).get('/api/admin/customer-accounts?q=one').set('x-staff-id', '10');
  expect(res.status).toBe(200);
  expect(res.body.count).toBe(1);
  expect(res.body.accounts[0].password_hash).toBeUndefined();
  expect(pool.query.mock.calls[1][1]).toEqual(['one']);
});

test('superadmins are also allowed to list customer accounts', async () => {
  pool.query.mockResolvedValueOnce({ rows: [admin('superadmin')] });
  pool.query.mockResolvedValueOnce({ rows: [] });
  const res = await request(app).get('/api/admin/customer-accounts').set('x-staff-id', '10');
  expect(res.status).toBe(200);
});

test('ordinary admins cannot create customer accounts or assign initial passwords', async () => {
  asAdmin();
  const res = await request(app).post('/api/admin/customer-accounts')
    .set('x-staff-id', '10').send({
      full_name: 'Test Customer', email: 'one@example.com', password: 'customerPass123',
    });
  expect(res.status).toBe(403);
  expect(res.body.error).toMatch(/superadmin/i);
  expect(pool.connect).not.toHaveBeenCalled();
  expect(pool.query).toHaveBeenCalledTimes(1);
});

test('ordinary admins cannot bypass restrictions using malformed customer data', async () => {
  asAdmin();
  const res = await request(app).post('/api/admin/customer-accounts')
    .set('x-staff-id', '10').send({});
  expect(res.status).toBe(403);
  expect(pool.connect).not.toHaveBeenCalled();
});

test('customer creation validates initial password before touching DB', async () => {
  pool.query.mockResolvedValueOnce({ rows: [admin('superadmin')] });
  const res = await request(app).post('/api/admin/customer-accounts')
    .set('x-staff-id', '10').send({ full_name: 'Test Customer', email: 'one@example.com', password: 'short' });
  expect(res.status).toBe(400);
  expect(pool.connect).not.toHaveBeenCalled();
});

test('superadmin creates customer and account atomically without storing plaintext', async () => {
  pool.query.mockResolvedValueOnce({ rows: [admin('superadmin')] });
  const db = { query: jest.fn(), release: jest.fn() };
  db.query.mockResolvedValueOnce({ rows: [] }) // BEGIN
    .mockResolvedValueOnce({ rows: [] }) // advisory lock
    .mockResolvedValueOnce({ rows: [{ last_number: '8' }] }) // next number
    .mockResolvedValueOnce({ rows: [] }) // customer insert
    .mockResolvedValueOnce({ rows: [{ account_id: 5, custno: 'CUST9', email: 'one@example.com', status: 'active' }] })
    .mockResolvedValueOnce({ rows: [] }); // COMMIT
  pool.connect.mockResolvedValueOnce(db);
  const res = await request(app).post('/api/admin/customer-accounts')
    .set('x-staff-id', '10').send({
      full_name: 'Test Customer', email: 'ONE@example.com', password: 'customerPass123', phone: '09123456789',
    });
  expect(res.status).toBe(201);
  expect(db.query.mock.calls.map((call) => call[0])).toEqual([
    'BEGIN', expect.stringContaining('pg_advisory_xact_lock'),
    expect.stringContaining('MAX(SUBSTRING'),
    expect.stringContaining('INSERT INTO customer ('),
    expect.stringContaining('INSERT INTO customer_accounts ('), 'COMMIT',
  ]);
  expect(db.query.mock.calls[3][1]).toEqual(['CUST9', 'Test Customer']);
  expect(db.query.mock.calls[4][1][0]).toBe('CUST9');
  expect(db.query.mock.calls[4][1][2]).toMatch(/^[\da-f]{32}:[\da-f]{128}$/);
  expect(res.body.customer.password_hash).toBeUndefined();
  expect(db.release).toHaveBeenCalledTimes(1);
});

test('superadmin creation rolls back duplicate email', async () => {
  pool.query.mockResolvedValueOnce({ rows: [admin('superadmin')] });
  const db = { query: jest.fn(), release: jest.fn() };
  db.query.mockResolvedValueOnce({ rows: [] }) // BEGIN
    .mockResolvedValueOnce({ rows: [] }) // lock
    .mockResolvedValueOnce({ rows: [{ last_number: '9' }] }) // next number
    .mockResolvedValueOnce({ rows: [] }) // customer inserted
    .mockRejectedValueOnce({ code: '23505' }) // duplicate email
    .mockResolvedValueOnce({ rows: [] });
  pool.connect.mockResolvedValueOnce(db);
  const res = await request(app).post('/api/admin/customer-accounts')
    .set('x-staff-id', '10').send({ full_name: 'Test Customer', email: 'one@example.com', password: 'customerPass123' });
  expect(res.status).toBe(409);
  expect(db.query.mock.calls[5][0]).toBe('ROLLBACK');
});

test('edit rejects invalid IDs and names', async () => {
  asAdmin();
  const res = await request(app).patch('/api/admin/customer-accounts/nope')
    .set('x-staff-id', '10').send({ full_name: 'Test Customer', email: 'one@example.com' });
  expect(res.status).toBe(400);
});

test('admin can edit customer name and email inside a transaction', async () => {
  asAdmin();
  const db = { query: jest.fn(), release: jest.fn() };
  db.query.mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ custno: 'C123' }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ account_id: 5, custno: 'C123', email: 'updated@example.com', status: 'active' }] })
    .mockResolvedValueOnce({ rows: [] });
  pool.connect.mockResolvedValueOnce(db);
  const res = await request(app).patch('/api/admin/customer-accounts/5')
    .set('x-staff-id', '10').send({ full_name: 'Updated Customer', email: 'updated@example.com' });
  expect(res.status).toBe(200);
  expect(res.body.customer.full_name).toBe('Updated Customer');
  expect(db.query.mock.calls[2][0]).toContain('UPDATE customer SET custname');
});

test('status change allows admin to block a customer', async () => {
  asAdmin();
  pool.query.mockResolvedValueOnce({ rows: [{ account_id: 5, status: 'blocked' }] });
  const res = await request(app).patch('/api/admin/customer-accounts/5/status')
    .set('x-staff-id', '10').send({ status: 'blocked' });
  expect(res.status).toBe(200);
  expect(res.body.customer.status).toBe('blocked');
  expect(pool.query.mock.calls[1][1]).toEqual(['blocked', '5']);
});

test('status change rejects invalid statuses', async () => {
  asAdmin();
  const res = await request(app).patch('/api/admin/customer-accounts/5/status')
    .set('x-staff-id', '10').send({ status: 'superadmin' });
  expect(res.status).toBe(400);
  expect(pool.query).toHaveBeenCalledTimes(1);
});

test('status change returns not found for missing customer accounts', async () => {
  asAdmin();
  pool.query.mockResolvedValueOnce({ rows: [] });
  expect((await request(app).patch('/api/admin/customer-accounts/5/status')
    .set('x-staff-id', '10').send({ status: 'active' })).status).toBe(404);
});
