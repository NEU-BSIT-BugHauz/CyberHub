const express = require('express');
const path = require('path');
const request = require('supertest');
const fs = require('fs');
const customerPortalPages = require('../routes/customerPortalPages');

// Route tests use the local static files only, with no PostgreSQL connection.
const publicDirectory = path.join(__dirname, '..', 'public');
const app = express();
app.use(customerPortalPages);
app.use(express.static(publicDirectory));

describe('public customer entry pages (employee files remain untouched)', () => {
  test('homepage links to customer preview and existing employee login', async () => {
    const response = await request(app).get('/').expect(200);
    expect(response.text).toContain('href="/customer/login"');
    expect(response.text).toContain('href="/staff/login"');
    expect(response.text).not.toContain('id="login-form"');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  test('employee login alias redirects to existing static employee HTML', async () => {
    const response = await request(app).get('/staff/login').expect(302);
    expect(response.headers.location).toBe('/index.html');
    const staff = await request(app).get('/index.html').expect(200);
    expect(staff.text).toContain('id="login-form"');
    expect(staff.text).toContain('id="register-form"');
    expect(staff.text).toContain('src="js/app.js"');
    // The bytes served are the original employee HTML; not a duplicate copy.
    expect(staff.text).toBe(fs.readFileSync(path.join(publicDirectory, 'index.html'), 'utf8'));
  });

  test('staff aliases route to the existing employee page', async () => {
    for (const url of ['/staff', '/staff/register', '/staff/dashboard']) {
      const response = await request(app).get(url).expect(302);
      expect(response.headers.location).toBe('/index.html');
    }
  });

  test('existing employee password-reset URLs preserve the reset token', async () => {
    const token = 'e'.repeat(64);
    const root = await request(app).get(`/?token=${token}`).expect(302);
    expect(root.headers.location).toBe(`/index.html?token=${token}`);
    const staff = await request(app).get(`/staff/login?token=${token}`).expect(302);
    expect(staff.headers.location).toBe(`/index.html?token=${token}`);
  });

  test('existing employee assets remain served from root without rewriting them', async () => {
    for (const asset of [
      '/styles.css', '/customers.css', '/products.css', '/login.css',
      '/js/api.js', '/js/app.js', '/js/customers.js', '/js/products.js',
    ]) {
      await request(app).get(asset).expect(200);
    }
  });

  test('customer login is only a disabled preview', async () => {
    const response = await request(app).get('/customer/login').expect(200);
    expect(response.text).toContain('Customer Sign In');
    expect(response.text).toContain('disabled');
    expect(response.text).not.toContain('src="/js/app.js"');
    expect(response.text).not.toContain('/api/auth/login');
  });

  test('customer registration is disabled pending database approval', async () => {
    const response = await request(app).get('/customer/register').expect(200);
    expect(response.text).toContain('Customer registration is a preview');
    expect(response.text).toContain('disabled');
    expect(response.text).not.toContain('/api/auth/register');
  });

  test('customer shorthand and preview stylesheet resolve', async () => {
    const redir = await request(app).get('/customer').expect(302);
    expect(redir.headers.location).toBe('/customer/login');
    await request(app).get('/portal.css').expect(200);
  });
});
