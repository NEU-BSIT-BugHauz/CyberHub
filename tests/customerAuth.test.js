'use strict';
const crypto = require('crypto');
const { promisify } = require('util');
const express = require('express');
const session = require('express-session');
const request = require('supertest');

jest.mock('../config/db', () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));
const { pool } = require('../config/db');
const customerAuth = require('../routes/customerAuth');
const scrypt = promisify(crypto.scrypt);

const app = express();
app.use(express.json());
app.use(session({ secret: 'customer-test-session-secret', resave: false, saveUninitialized: false }));
app.use('/api/customer-auth', customerAuth);

const account = (hash, overrides = {}) => ({
  account_id: 5, custno: 'C12345', full_name: 'Test Customer',
  email: 'customer@example.com', phone: '', password_hash: hash,
  status: 'active', customer_deleted: false, ...overrides,
});

async function passwordHash(password = 'customerPass123') {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
}

beforeEach(() => jest.clearAllMocks());

test('customer profile requires customer session, not employee credentials', async () => {
  const result = await request(app).get('/api/customer-auth/me');
  expect(result.status).toBe(401);
  expect(pool.query).not.toHaveBeenCalled();
});

test('registration validates fields before contacting PostgreSQL', async () => {
  const res = await request(app).post('/api/customer-auth/register')
    .send({ full_name: 'A', email: 'invalid', password: '123' });
  expect(res.status).toBe(400);
  expect(pool.connect).not.toHaveBeenCalled();
});

test('registration inserts both records transactionally with salted password hash', async () => {
  const db = { query: jest.fn(async (sql) =>
    sql.includes('MAX(SUBSTRING') ? { rows: [{ last_number: '7' }] } : { rows: [] }), release: jest.fn() };
  pool.connect.mockResolvedValue(db);
  const res = await request(app).post('/api/customer-auth/register').send({
    full_name: '  Test Customer ', email: 'CUSTOMER@example.com',
    password: 'customerPass123', phone: '09123456789',
  });
  expect(res.status).toBe(201);
  expect(db.query.mock.calls.map((args) => args[0])).toEqual([
    'BEGIN', expect.stringContaining('pg_advisory_xact_lock'),
    expect.stringContaining('MAX(SUBSTRING'),
    expect.stringContaining('INSERT INTO customer ('),
    expect.stringContaining('INSERT INTO customer_accounts ('), 'COMMIT',
  ]);
  expect(db.query.mock.calls[3][1]).toEqual(['CUST8', 'Test Customer']);
  expect(db.query.mock.calls[4][1][0]).toBe('CUST8');
  expect(db.query.mock.calls[4][1][1]).toBe('customer@example.com');
  expect(db.query.mock.calls[4][1][2]).toMatch(/^[a-f\d]{32}:[a-f\d]{128}$/);
  expect(db.query.mock.calls[4][1][2]).not.toBe('customerPass123');
  expect(db.release).toHaveBeenCalledTimes(1);
});

test('duplicate email rolls back the whole transaction', async () => {
  const db = { query: jest.fn(), release: jest.fn() };
  db.query.mockResolvedValueOnce({ rows: [] }) // BEGIN
    .mockResolvedValueOnce({ rows: [] }) // advisory lock
    .mockResolvedValueOnce({ rows: [{ last_number: '7' }] }) // next number
    .mockResolvedValueOnce({ rows: [] }) // customer inserted
    .mockRejectedValueOnce({ code: '23505' }) // duplicate customer email
    .mockResolvedValueOnce({ rows: [] }); // ROLLBACK
  pool.connect.mockResolvedValue(db);
  const res = await request(app).post('/api/customer-auth/register').send({
    full_name: 'Test Customer', email: 'customer@example.com', password: 'customerPass123',
  });
  expect(res.status).toBe(409);
  expect(db.query.mock.calls[5][0]).toBe('ROLLBACK');
  expect(db.release).toHaveBeenCalledTimes(1);
});

test('customer login rejects wrong password', async () => {
  pool.query.mockResolvedValueOnce({ rows: [account(await passwordHash())] });
  const res = await request(app).post('/api/customer-auth/login').send({
    email: 'customer@example.com', password: 'not-the-password',
  });
  expect(res.status).toBe(401);
});

test('blocked customers cannot sign in', async () => {
  pool.query.mockResolvedValueOnce({ rows: [account(await passwordHash(), { status: 'blocked' })] });
  const res = await request(app).post('/api/customer-auth/login').send({
    email: 'customer@example.com', password: 'customerPass123',
  });
  expect(res.status).toBe(403);
});

test('customer login returns session, me returns sanitized profile, logout invalidates', async () => {
  const agent = request.agent(app);
  const hash = await passwordHash();
  pool.query.mockResolvedValueOnce({ rows: [account(hash)] });
  const login = await agent.post('/api/customer-auth/login').send({
    email: 'customer@example.com', password: 'customerPass123',
  });
  expect(login.status).toBe(200);
  expect(login.headers['set-cookie']).toBeDefined();
  expect(login.body.customer.password_hash).toBeUndefined();

  pool.query.mockResolvedValueOnce({ rows: [account(hash)] });
  const me = await agent.get('/api/customer-auth/me');
  expect(me.status).toBe(200);
  expect(me.body.customer.custno).toBe('C12345');
  expect(me.body.customer.password_hash).toBeUndefined();

  pool.query.mockResolvedValueOnce({ rows: [account(hash)] });
  expect((await agent.post('/api/customer-auth/logout')).status).toBe(200);
  expect((await agent.get('/api/customer-auth/me')).status).toBe(401);
});

test('a blocked account loses its previous customer session', async () => {
  const agent = request.agent(app);
  pool.query.mockResolvedValueOnce({ rows: [account(await passwordHash())] });
  expect((await agent.post('/api/customer-auth/login').send({
    email: 'customer@example.com', password: 'customerPass123',
  })).status).toBe(200);
  pool.query.mockResolvedValueOnce({ rows: [] });
  expect((await agent.get('/api/customer-auth/me')).status).toBe(401);
});

test('invalid JSON bodies do not cause server errors', async () => {
  const register = await request(app).post('/api/customer-auth/register').send('null').set('Content-Type', 'application/json');
  expect(register.status).toBe(400);
  const login = await request(app).post('/api/customer-auth/login').send('null').set('Content-Type', 'application/json');
  expect(login.status).toBe(400);
});

test('oversized login passwords are rejected before hashing', async () => {
  const result = await request(app).post('/api/customer-auth/login').send({ email: 'customer@example.com', password: 'x'.repeat(129) });
  expect(result.status).toBe(400);
  expect(pool.query).not.toHaveBeenCalled();
});
