'use strict';
const express = require('express');
const path = require('path');
const request = require('supertest');
const fs = require('fs');
const customerPortalPages = require('../routes/customerPortalPages');
const publicDirectory = path.join(__dirname, '..', 'public');
const app = express();
app.use(customerPortalPages);
app.use(express.static(publicDirectory));

describe('public customer entry pages and employee routes', () => {
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

  test('customer login and registration are enabled, separate from employee auth', async () => {
    const login = await request(app).get('/customer/login').expect(200);
    expect(login.text).toContain('id="customer-login-form"');
    expect(login.text).toContain('/js/customer-auth.js');
    expect(login.text).not.toContain('/api/auth/login');
    const reg = await request(app).get('/customer/register').expect(200);
    expect(reg.text).toContain('id="customer-register-form"');
    expect(reg.text).not.toContain('disabled');
    expect(reg.text).not.toContain('/api/auth/register');
  });

  test('customer dashboard route and script are present', async () => {
    const result = await request(app).get('/customer/dashboard').expect(200);
    expect(result.text).toContain('data-customer-page="dashboard"');
    expect(result.text).toContain('customer-logout');
    await request(app).get('/js/customer-auth.js').expect(200);
    await request(app).get('/customer-auth.css').expect(200);
  });

  test('customer shorthand still redirects to login', async () => {
    expect((await request(app).get('/customer').expect(302)).headers.location)
      .toBe('/customer/login');
  });
});
