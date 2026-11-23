-- CYBERHUB PR 5-7: Customer Cart, Checkout and My Orders
-- DATABASE ADMIN REVIEW ONLY. NOT executed by the installer.
-- Requires: customer_accounts(id, custno), customer(custno), product(prodcode).
-- These tables deliberately do NOT modify the existing audited sales/salesdetail
-- employee-module tables. Web orders are a separate, pending-order workflow.
-- Requires the production product and pricehist migrations already applied.
-- Run only after DBA review and backup in a transaction.
BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_cart_items (
  customer_account_id BIGINT NOT NULL REFERENCES public.customer_accounts(id) ON DELETE CASCADE,
  prodcode VARCHAR(6) NOT NULL REFERENCES public.product(prodcode) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (customer_account_id, prodcode)
);

CREATE TABLE IF NOT EXISTS public.customer_web_orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_account_id BIGINT NOT NULL REFERENCES public.customer_accounts(id) ON DELETE RESTRICT,
  custno VARCHAR(20) NOT NULL REFERENCES public.customer(custno) ON DELETE RESTRICT,
  checkout_token UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'fulfilled', 'cancelled')),
  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_customer_web_order_checkout UNIQUE (customer_account_id, checkout_token)
);

CREATE TABLE IF NOT EXISTS public.customer_web_order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.customer_web_orders(id) ON DELETE CASCADE,
  prodcode VARCHAR(6) NOT NULL REFERENCES public.product(prodcode) ON DELETE RESTRICT,
  description VARCHAR(30),
  unit VARCHAR(3),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price > 0),
  line_total NUMERIC(14,2) NOT NULL CHECK (line_total > 0),
  UNIQUE (order_id, prodcode)
);

CREATE INDEX IF NOT EXISTS idx_customer_web_orders_account_created
  ON public.customer_web_orders (customer_account_id, created_at DESC);

COMMIT;
