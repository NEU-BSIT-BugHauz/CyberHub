'use strict';

const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();
const PRODUCT_CODE = /^[A-Za-z0-9_-]{1,6}$/;
const ORDER_ID = /^[1-9]\d{0,18}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ITEMS = 50;

function quantityFrom(value) {
  return Number.isInteger(value) && value >= 1 && value <= 99 ? value : null;
}

function priceToCents(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value);
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function centsToAmount(cents) {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

function validProdcode(value) {
  return typeof value === 'string' && PRODUCT_CODE.test(value) ? value.toUpperCase() : null;
}

async function requireActiveCustomer(req, res, next) {
  const id = req.session?.customer?.account_id;
  if (!id) return res.status(401).json({ error: 'Customer login required.' });
  try {
    const found = await pool.query(
      `SELECT ca.id, ca.custno FROM customer_accounts ca
       JOIN customer c ON c.custno = ca.custno
       WHERE ca.id = $1 AND ca.status = 'active'
         AND COALESCE(c.is_deleted, FALSE) = FALSE`, [id]
    );
    if (!found.rows[0]) {
      delete req.session.customer;
      return res.status(401).json({ error: 'Customer session expired or account blocked.' });
    }
    req.shoppingCustomer = found.rows[0];
    return next();
  } catch (error) { return next(error); }
}

router.use(requireActiveCustomer);

// Keep the effective-date rules identical to the customer catalog. The SQL
// returns the *current* price only, never a browser-supplied price.
const CART_SQL = `
  SELECT ci.prodcode, ci.quantity, p.description, p.unit,
         p.is_deleted, current_price.unitprice AS current_price
  FROM customer_cart_items ci
  JOIN product p ON p.prodcode = ci.prodcode
  LEFT JOIN LATERAL (
    SELECT ph.unitprice FROM pricehist ph
    WHERE ph.prodcode = p.prodcode
      AND ph.is_deleted = FALSE
      AND ph.effdate <= (NOW() AT TIME ZONE 'Asia/Manila')::date
    ORDER BY ph.effdate DESC LIMIT 1
  ) current_price ON TRUE
  WHERE ci.customer_account_id = $1
  ORDER BY ci.prodcode ASC`;

function summarizeCart(rows) {
  let totalCents = 0;
  let hasUnavailable = false;
  const items = rows.map((row) => {
    const cents = priceToCents(row.current_price);
    const available = row.is_deleted === false && cents !== null && quantityFrom(row.quantity) !== null;
    if (!available) hasUnavailable = true;
    const itemCents = available ? cents * row.quantity : null;
    if (available) totalCents += itemCents;
    return {
      prodcode: row.prodcode,
      description: row.description || row.prodcode,
      unit: row.unit,
      quantity: row.quantity,
      available,
      unit_price: available ? centsToAmount(cents) : null,
      line_total: available ? centsToAmount(itemCents) : null,
    };
  });
  return { items, subtotal: centsToAmount(totalCents), has_unavailable: hasUnavailable, currency: 'PHP' };
}

router.get('/cart', async (req, res, next) => {
  try {
    const result = await pool.query(CART_SQL, [req.shoppingCustomer.id]);
    res.set('Cache-Control', 'private, no-store');
    return res.json(summarizeCart(result.rows));
  } catch (error) { return next(error); }
});

router.post('/cart/items', async (req, res, next) => {
  const prodcode = validProdcode(req.body?.prodcode);
  const quantity = quantityFrom(req.body?.quantity);
  if (!prodcode || !quantity) {
    return res.status(400).json({ error: 'Valid product code and quantity (1-99) are required.' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO customer_cart_items (customer_account_id, prodcode, quantity)
       SELECT $1, p.prodcode, $3 FROM product p
       WHERE p.prodcode = $2 AND p.is_deleted = FALSE
         AND EXISTS (
           SELECT 1 FROM pricehist ph WHERE ph.prodcode = p.prodcode
             AND ph.is_deleted = FALSE AND ph.unitprice > 0
             AND ph.effdate <= (NOW() AT TIME ZONE 'Asia/Manila')::date
         )
         AND (
           (SELECT COUNT(*) FROM customer_cart_items ci
            WHERE ci.customer_account_id = $1) < $4
           OR EXISTS (SELECT 1 FROM customer_cart_items existing
                      WHERE existing.customer_account_id = $1 AND existing.prodcode = $2)
         )
       ON CONFLICT (customer_account_id, prodcode)
       DO UPDATE SET quantity = customer_cart_items.quantity + EXCLUDED.quantity,
                     updated_at = NOW()
       WHERE customer_cart_items.quantity + EXCLUDED.quantity <= 99
       RETURNING prodcode, quantity`,
      [req.shoppingCustomer.id, prodcode, quantity, MAX_ITEMS]
    );
    if (!result.rows[0]) {
      return res.status(409).json({ error: 'Product cannot be added: unavailable, unpriced, cart full, or quantity exceeds 99.' });
    }
    return res.status(201).json({ item: result.rows[0], message: 'Product added to cart.' });
  } catch (error) { return next(error); }
});

router.patch('/cart/items/:prodcode', async (req, res, next) => {
  const prodcode = validProdcode(req.params.prodcode);
  const quantity = quantityFrom(req.body?.quantity);
  if (!prodcode || !quantity) return res.status(400).json({ error: 'Invalid product or quantity (1-99).' });
  try {
    const result = await pool.query(
      `UPDATE customer_cart_items SET quantity = $3, updated_at = NOW()
       WHERE customer_account_id = $1 AND prodcode = $2
       RETURNING prodcode, quantity`, [req.shoppingCustomer.id, prodcode, quantity]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Cart item not found.' });
    return res.json({ item: result.rows[0] });
  } catch (error) { return next(error); }
});

router.delete('/cart/items/:prodcode', async (req, res, next) => {
  const prodcode = validProdcode(req.params.prodcode);
  if (!prodcode) return res.status(400).json({ error: 'Invalid product code.' });
  try {
    const result = await pool.query(
      'DELETE FROM customer_cart_items WHERE customer_account_id = $1 AND prodcode = $2 RETURNING prodcode',
      [req.shoppingCustomer.id, prodcode]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Cart item not found.' });
    return res.json({ message: 'Product removed from cart.' });
  } catch (error) { return next(error); }
});

// Safe checkout: no card processing, no inventory assumptions. The final price
// is recomputed on the server, then snapshotted in the order transaction.
router.post('/checkout', async (req, res, next) => {
  const token = req.body?.checkout_token;
  if (typeof token !== 'string' || !UUID.test(token)) {
    return res.status(400).json({ error: 'A valid checkout request token is required.' });
  }
  const deliveryAddress = typeof req.body?.delivery_address === 'string'
    ? req.body.delivery_address.trim() : '';
  if (deliveryAddress.length < 10 || deliveryAddress.length > 500) {
    return res.status(400).json({ error: 'Delivery address must contain 10 to 500 characters.' });
  }
  const id = req.shoppingCustomer.id;
  let client;
  let completed = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const customer = await client.query(
      `SELECT ca.id, ca.custno FROM customer_accounts ca
       JOIN customer c ON c.custno = ca.custno
       WHERE ca.id = $1 AND ca.status = 'active'
         AND COALESCE(c.is_deleted, FALSE) = FALSE
       FOR UPDATE OF ca`, [id]
    );
    if (!customer.rows[0]) {
      await client.query('ROLLBACK'); completed = true;
      return res.status(401).json({ error: 'Customer account is no longer active.' });
    }

    const alreadyPlaced = await client.query(
      `SELECT id AS order_id, status, total_amount, delivery_address, created_at
       FROM customer_web_orders WHERE customer_account_id = $1 AND checkout_token = $2`, [id, token]
    );
    if (alreadyPlaced.rows[0]) {
      await client.query('COMMIT'); completed = true;
      return res.json({ order: alreadyPlaced.rows[0], already_submitted: true });
    }

    // Lock rows through the transaction so two checkouts cannot consume the
    // same cart simultaneously. Get the latest effective prices at checkout.
    const cart = await client.query(`${CART_SQL} FOR UPDATE OF ci`, [id]);
    if (!cart.rows.length) {
      await client.query('ROLLBACK'); completed = true;
      return res.status(409).json({ error: 'Your cart is empty.' });
    }
    if (cart.rows.length > MAX_ITEMS) {
      await client.query('ROLLBACK'); completed = true;
      return res.status(409).json({ error: 'Too many items in the cart.' });
    }

    const cartSummary = summarizeCart(cart.rows);
    if (cartSummary.has_unavailable) {
      await client.query('ROLLBACK'); completed = true;
      return res.status(409).json({ error: 'One or more products are deleted or have no current price. Remove them before checkout.' });
    }
    const totalCents = cartSummary.items.reduce((sum, item) => {
      return sum + priceToCents(item.line_total);
    }, 0);
    if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
      await client.query('ROLLBACK'); completed = true;
      return res.status(409).json({ error: 'Could not calculate a valid order total.' });
    }

    const created = await client.query(
      `INSERT INTO customer_web_orders (customer_account_id, custno, checkout_token, total_amount, delivery_address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id AS order_id, status, total_amount, delivery_address, created_at`,
      [id, customer.rows[0].custno, token, centsToAmount(totalCents), deliveryAddress]
    );
    const order = created.rows[0];
    for (const item of cartSummary.items) {
      await client.query(
        `INSERT INTO customer_web_order_items
         (order_id, prodcode, description, unit, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [order.order_id, item.prodcode, item.description, item.unit,
          item.quantity, item.unit_price, item.line_total]
      );
    }
    await client.query('DELETE FROM customer_cart_items WHERE customer_account_id = $1', [id]);
    await client.query('COMMIT'); completed = true;
    res.set('Cache-Control', 'private, no-store');
    return res.status(201).json({ order, already_submitted: false, message: 'Order submitted for review. No online payment has been taken.' });
  } catch (error) {
    if (client && !completed) {
      try { await client.query('ROLLBACK'); } catch (_rollbackError) { /* preserve original error */ }
    }
    return next(error);
  } finally { if (client) client.release(); }
});

router.get('/orders', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id AS order_id, status, total_amount, delivery_address, created_at
       FROM customer_web_orders WHERE customer_account_id = $1
       ORDER BY created_at DESC LIMIT 50`, [req.shoppingCustomer.id]
    );
    res.set('Cache-Control', 'private, no-store');
    return res.json({ orders: result.rows });
  } catch (error) { return next(error); }
});

router.get('/orders/:id', async (req, res, next) => {
  if (!ORDER_ID.test(req.params.id) || BigInt(req.params.id) > 9223372036854775807n) {
    return res.status(400).json({ error: 'Invalid order ID.' });
  }
  try {
    const result = await pool.query(
      `SELECT id AS order_id, status, total_amount, delivery_address, created_at
       FROM customer_web_orders WHERE customer_account_id = $1 AND id = $2`,
      [req.shoppingCustomer.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Order not found.' });
    const items = await pool.query(
      `SELECT prodcode, description, unit, quantity, unit_price, line_total
       FROM customer_web_order_items WHERE order_id = $1 ORDER BY id ASC`, [req.params.id]
    );
    res.set('Cache-Control', 'private, no-store');
    return res.json({ order: { ...result.rows[0], items: items.rows } });
  } catch (error) { return next(error); }
});

module.exports = router;
