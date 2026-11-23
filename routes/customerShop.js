'use strict';

const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();
const VALID_UNITS = Object.freeze(['pc', 'ea', 'mtr', 'pkg', 'ltr']);

// A customer session is distinct from the employee session used by /api/products.
// Re-check account status in PostgreSQL on every catalog request so blocked and
// deleted customer accounts immediately lose access.
async function requireActiveCustomer(req, res, next) {
  const accountId = req.session?.customer?.account_id;
  if (!accountId) {
    return res.status(401).json({ error: 'Customer login required.' });
  }

  try {
    const result = await pool.query(
      `SELECT ca.id
       FROM customer_accounts ca
       JOIN customer c ON c.custno = ca.custno
       WHERE ca.id = $1
         AND ca.status = 'active'
         AND COALESCE(c.is_deleted, FALSE) = FALSE`,
      [accountId]
    );

    if (!result.rows.length) {
      delete req.session.customer;
      return res.status(401).json({ error: 'Customer session expired or account blocked.' });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

// Customer-only, read-only product catalog. Does not reuse employee Product
// permissions, and cannot modify products, prices, carts or orders.
router.get('/products', requireActiveCustomer, async (req, res, next) => {
  const rawSearch = req.query.search ?? '';
  const rawUnit = req.query.unit ?? '';

  if (typeof rawSearch !== 'string' || typeof rawUnit !== 'string') {
    return res.status(400).json({ error: 'Invalid search or unit filter.' });
  }

  const search = rawSearch.trim();
  const unit = rawUnit.trim().toLowerCase();

  if (search.length > 100) {
    return res.status(400).json({ error: 'Search must be 100 characters or fewer.' });
  }
  if (unit && !VALID_UNITS.includes(unit)) {
    return res.status(400).json({ error: 'Invalid product unit.' });
  }

  try {
    // Price history is effective-dated and soft-deleted. The latest price
    // effective today or earlier in Manila applies; future prices never show.
    const result = await pool.query(
      `SELECT p.prodcode, p.description, p.unit,
              current_price.unitprice AS current_price,
              TO_CHAR(current_price.effdate, 'YYYY-MM-DD') AS current_price_effdate
       FROM product p
       LEFT JOIN LATERAL (
         SELECT ph.unitprice, ph.effdate
         FROM pricehist ph
         WHERE ph.prodcode = p.prodcode
           AND ph.is_deleted = FALSE
           AND ph.effdate <= (NOW() AT TIME ZONE 'Asia/Manila')::date
         ORDER BY ph.effdate DESC
         LIMIT 1
       ) current_price ON TRUE
       WHERE p.is_deleted = FALSE
         AND ($1 = '' OR p.prodcode ILIKE '%' || $1 || '%'
                      OR COALESCE(p.description, '') ILIKE '%' || $1 || '%')
         AND ($2 = '' OR p.unit = $2)
       ORDER BY p.prodcode ASC
       LIMIT 100`,
      [search, unit]
    );

    res.set('Cache-Control', 'private, no-store');
    return res.json({ products: result.rows });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
