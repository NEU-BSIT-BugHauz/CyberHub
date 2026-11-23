
const path = require('path');
const express = require('express');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');

require('dotenv').config();

const { pool } = require('./config/db');

const app = express();

app.set('trust proxy', 1);

const PORT = Number(process.env.PORT) || 3000;

const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;

if (isProduction && !sessionSecret) {
  throw new Error('SESSION_SECRET must be configured in production.');
}

const PgSessionStore = connectPgSimple(session);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// TEMPORARY HTTPS DIAGNOSTIC
// Remove this endpoint after troubleshooting the session issue.
app.get('/api/debug/https', (req, res) => {
  res.json({
    secure: req.secure,
    protocol: req.protocol,
    production: isProduction,
    proxyTrusted: app.get('trust proxy'),
  });
});

// POSTGRESQL SESSION CONFIGURATION
app.use(
  session({
    name: 'sid',
    store: new PgSessionStore({
      pool,
      tableName: 'user_sessions',
      createTableIfMissing: false,
    }),
    secret: sessionSecret || 'development-only-secret-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

// Add public landing and customer preview routes without changing employee code.
const customerPortalPages = require('./routes/customerPortalPages');
app.use(customerPortalPages);

app.use(express.static(path.join(__dirname, 'public')));

// HEALTH CHECK
app.get('/api/health', async (_req, res) => {
  let database = 'not configured';

  if (process.env.DATABASE_URL) {
    try {
      await pool.query('SELECT 1');
      database = 'connected';
    } catch (err) {
      console.error('Database health check failed:', err.message);
      database = 'unavailable';
    }
  }

  const ok = database === 'connected';

  res.status(ok ? 200 : 503).json({
    ok,
    api: 'CyberHub',
    database,
    timestamp: new Date().toISOString(),
  });
});

// CUSTOMER AUTHENTICATION (separate from employee routes)
const customerAuthRoutes = require('./routes/customerAuth');
app.use('/api/customer-auth', customerAuthRoutes);

// CUSTOMER SHOP: a separate read-only API for authenticated customers
const customerShopRoutes = require('./routes/customerShop');
app.use('/api/customer-shop', customerShopRoutes);

// AUTHENTICATION ROUTES
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// PASSWORD RESET ROUTES
const passwordResetRoutes = require('./routes/passwordReset');
app.use('/api/auth', passwordResetRoutes);

// CUSTOMER ACCOUNT ADMIN API
const customerAccountsAdminRoutes = require('./routes/customerAccountsAdmin');
app.use('/api/admin/customer-accounts', customerAccountsAdminRoutes);

// USER MANAGEMENT ROUTES
const usersRoutes = require('./routes/users');
app.use('/api/users', usersRoutes);

// PERMISSION MANAGEMENT ROUTES
const permissionsRoutes = require('./routes/permissions');
app.use('/api/permissions', permissionsRoutes);

// CUSTOMER MANAGEMENT ROUTES
const customersRoutes = require('./routes/customers');
app.use('/api/customers', customersRoutes);

// PRODUCT MANAGEMENT ROUTES
const productsRoutes = require('./routes/products');
app.use('/api/products', productsRoutes);

// GLOBAL ERROR HANDLER
app.use((err, _req, res, _next) => {
  console.error(err);

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`CyberHub server running at http://localhost:${PORT}`);
});
