'use strict';

const express = require('express');
const path = require('path');

const router = express.Router();
const publicDirectory = path.join(__dirname, '..', 'public');

function servePage(filename) {
  return (_req, res) => {
    res.set('Cache-Control', 'no-store');
    return res.sendFile(path.join(publicDirectory, filename));
  };
}

function requireCustomerPage(req, res, next) {
  // Customer and employee sessions are intentionally separate.
  if (!req.session?.customer?.account_id) {
    return res.redirect(302, '/customer/login');
  }
  return next();
}

// The employee portal and employee password-reset links are unchanged.
function redirectToEmployeePage(req, res) {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  const destination = token === null
    ? '/index.html'
    : `/index.html?token=${encodeURIComponent(token)}`;
  return res.redirect(302, destination);
}

router.get('/', (req, res) => {
  if (typeof req.query.token === 'string') {
    return redirectToEmployeePage(req, res);
  }
  res.set('Cache-Control', 'no-store');
  return res.sendFile(path.join(publicDirectory, 'welcome.html'));
});

router.get('/customer', (_req, res) => res.redirect(302, '/customer/login'));
router.get('/customer/login', servePage('customer-login.html'));
router.get('/customer/register', servePage('customer-register.html'));

// The page shell requires a customer session. Each page also calls
// /api/customer-auth/me to validate account status before showing customer data.
router.get('/customer/dashboard', requireCustomerPage, servePage('customer-dashboard.html'));
router.get('/customer/shop', requireCustomerPage, servePage('customer-shop.html'));
router.get('/customer/cart', requireCustomerPage, servePage('customer-cart.html'));
router.get('/customer/checkout', requireCustomerPage, servePage('customer-checkout.html'));
router.get('/customer/orders', requireCustomerPage, servePage('customer-orders.html'));
router.get('/customer/profile', requireCustomerPage, servePage('customer-profile.html'));

// Administrative customer account management stays separate.
router.get('/staff/customer-accounts', servePage('customer-account-management.html'));

router.get('/staff', redirectToEmployeePage);
router.get('/staff/login', redirectToEmployeePage);
router.get('/staff/register', redirectToEmployeePage);
router.get('/staff/dashboard', redirectToEmployeePage);

module.exports = router;
