'use strict';
const express = require('express');
const path = require('path');
const request = require('supertest');
const fs = require('fs');
const customerPortalPages = require('../routes/customerPortalPages');
const publicDirectory = path.join(__dirname, '..', 'public');
const app = express();

// Route tests simulate customer session presence without querying PostgreSQL.
// Production sessions come from express-session middleware in server.js.
app.use((req, _res, next) => {
  req.session = req.headers['x-test-customer'] === 'yes'
    ? { customer: { account_id: 45 } }
    : {};
  next();
});
app.use(customerPortalPages);
app.use(express.static(publicDirectory));

describe('customer portal navigation and separate staff entry', () => {
  test('homepage links to customer and staff entry points', async () => {
    const response = await request(app).get('/').expect(200);
    expect(response.text).toContain('href="/customer/login"');
    expect(response.text).toContain('href="/staff/login"');
  });

  test('original employee login aliases still point to same staff page', async () => {
    for (const url of ['/staff', '/staff/login', '/staff/register', '/staff/dashboard']) {
      const result = await request(app).get(url).expect(302);
      expect(result.headers.location).toBe('/index.html');
    }
    const staff = await request(app).get('/index.html').expect(200);
    expect(staff.text).toBe(fs.readFileSync(path.join(publicDirectory, 'index.html'), 'utf8'));
  });

  test('employee reset links preserve the token', async () => {
    const token = 'e'.repeat(64);
    expect((await request(app).get(`/?token=${token}`).expect(302)).headers.location)
      .toBe(`/index.html?token=${token}`);
  });

  test('customer login and registration remain public and separate', async () => {
    const login = await request(app).get('/customer/login').expect(200);
    expect(login.text).toContain('id="customer-login-form"');
    expect(login.text).toContain('/js/customer-auth.js');
    expect(login.text).not.toContain('/api/auth/login');
    const reg = await request(app).get('/customer/register').expect(200);
    expect(reg.text).toContain('id="customer-register-form"');
    expect(reg.text).not.toContain('/api/auth/register');
  });

  const pages = ['dashboard', 'shop', 'cart', 'checkout', 'orders', 'profile'];

  test.each(pages)('customer %s page requires a customer session', async (page) => {
    const result = await request(app).get(`/customer/${page}`).expect(302);
    expect(result.headers.location).toBe('/customer/login');
  });

  test.each(pages)('authenticated customer can navigate to %s', async (page) => {
    const result = await request(app).get(`/customer/${page}`)
      .set('x-test-customer', 'yes').expect(200);
    expect(result.text).toContain(`data-customer-page="${page}"`);
    expect(result.text).toContain('id="customer-logout"');
    expect(result.text).toContain('href="/customer/dashboard"');
    expect(result.text).toContain('href="/customer/shop"');
    expect(result.text).toContain('href="/customer/cart"');
    expect(result.text).toContain('href="/customer/checkout"');
    expect(result.text).toContain('href="/customer/orders"');
    expect(result.text).toContain('href="/customer/profile"');
    expect(result.text).toContain('/js/customer-auth.js');
  });

  test('pending shopping pages do not pretend checkout or orders work', async () => {
    for (const page of ['shop', 'cart', 'checkout', 'orders']) {
      const result = await request(app).get(`/customer/${page}`)
        .set('x-test-customer', 'yes').expect(200);
      expect(result.text).toContain('In development');
    }
  });

  test('customer CSS and JavaScript files are served', async () => {
    await request(app).get('/js/customer-auth.js').expect(200);
    await request(app).get('/customer-auth.css').expect(200);
    await request(app).get('/customer-navigation.css').expect(200);
  });

  test('staff customer account management page remains available', async () => {
    const result = await request(app).get('/staff/customer-accounts').expect(200);
    expect(result.text).toContain('Customer');
  });

  test('customer shorthand still redirects to login', async () => {
    expect((await request(app).get('/customer').expect(302)).headers.location)
      .toBe('/customer/login');
  });
});
