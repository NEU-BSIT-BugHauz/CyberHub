const express = require('express');
const path = require('path');

const router = express.Router();
const publicDirectory = path.join(__dirname, '..', 'public');

function servePage(filename) {
  return (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(publicDirectory, filename));
  };
}

// Keep the original employee page at /index.html, untouched. This router only
// offers a public entry point to it and never handles employee authentication.
function redirectToEmployeePage(req, res) {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  const destination = token === null
    ? '/index.html'
    : `/index.html?token=${encodeURIComponent(token)}`;

  res.redirect(302, destination);
}

// / is now the public entry point. Preserve existing root password reset links:
// employee password reset continues to be handled by the original staff app.
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

// Compatibility aliases only. The original employee HTML, JavaScript, login,
// role checks, database configuration and session handling remain untouched.
router.get('/staff', redirectToEmployeePage);
router.get('/staff/login', redirectToEmployeePage);
router.get('/staff/register', redirectToEmployeePage);
router.get('/staff/dashboard', redirectToEmployeePage);

module.exports = router;
