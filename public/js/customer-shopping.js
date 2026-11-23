'use strict';

// Customer-only cart, checkout, and order history. No staff APIs are used.
(() => {
  const page = document.body.dataset.customerPage;
  if (!['cart', 'checkout', 'orders'].includes(page)) return;
  const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
  const message = document.getElementById('shopping-message');
  const content = document.getElementById('shopping-content');
  const action = document.getElementById('shopping-action');

  function show(text, error = false) {
    message.textContent = text;
    message.className = `customer-shopping-message${error ? ' error' : ''}`;
  }

  function el(tag, text = '', className = '') {
    const node = document.createElement(tag);
    node.textContent = String(text ?? '');
    if (className) node.className = className;
    return node;
  }

  function moneyText(value) {
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? money.format(amount) : 'Price unavailable';
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-PH');
  }

  async function api(path, options = {}) {
    const response = await fetch(`/api/customer-shopping${path}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.replace('/customer/login');
      throw new Error('Customer session ended.');
    }
    if (!response.ok) throw new Error(data.error || 'The request failed. Please try again.');
    return data;
  }

  function makeItemRow(item, editable = false) {
    const row = el('div', '', 'customer-shopping-line');
    const left = el('div');
    left.append(el('strong', item.description), el('small', `${item.prodcode} · ${item.unit || 'unit'}`));
    if (!item.available) left.append(el('small', 'Unavailable: remove before checkout', 'unavailable'));
    row.append(left);

    const pricing = el('div', '', 'customer-shopping-line-price');
    pricing.append(el('span', item.available ? moneyText(item.unit_price) : 'Unavailable'));
    pricing.append(el('strong', item.available ? moneyText(item.line_total) : '—'));
    row.append(pricing);

    if (editable) {
      const controls = el('div', '', 'customer-shopping-controls');
      const qty = document.createElement('input');
      qty.type = 'number'; qty.min = '1'; qty.max = '99'; qty.step = '1';
      qty.value = String(item.quantity); qty.setAttribute('aria-label', `Quantity for ${item.prodcode}`);
      const update = el('button', 'Update', 'portal-button secondary');
      update.type = 'button';
      update.addEventListener('click', async () => {
        const newQty = Number(qty.value);
        if (!Number.isInteger(newQty) || newQty < 1 || newQty > 99) {
          show('Quantity must be a whole number between 1 and 99.', true);
          return;
        }
        update.disabled = true;
        try {
          await api(`/cart/items/${encodeURIComponent(item.prodcode)}`, {
            method: 'PATCH', body: JSON.stringify({ quantity: newQty }),
          });
          await loadCart();
          show('Cart quantity updated.');
        } catch (error) { show(error.message, true); }
        finally { update.disabled = false; }
      });
      const remove = el('button', 'Remove', 'portal-button secondary');
      remove.type = 'button';
      remove.addEventListener('click', async () => {
        remove.disabled = true;
        try {
          await api(`/cart/items/${encodeURIComponent(item.prodcode)}`, { method: 'DELETE' });
          await loadCart();
          show('Product removed.');
        } catch (error) { show(error.message, true); }
        finally { remove.disabled = false; }
      });
      controls.append(qty, update, remove);
      row.append(controls);
    } else {
      row.append(el('span', `Qty ${item.quantity}`, 'customer-shopping-quantity'));
    }
    return row;
  }

  function displayCart(data, editable) {
    content.replaceChildren();
    if (data.items.length === 0) {
      content.append(el('p', 'Your cart is empty. Browse products to add items.'));
      const link = el('a', 'Shop products', 'portal-button primary');
      link.href = '/customer/shop'; content.append(link);
    } else {
      data.items.forEach(item => content.append(makeItemRow(item, editable)));
      const subtotal = el('div', '', 'customer-shopping-total');
      subtotal.append(el('strong', 'Current estimated total'), el('strong', moneyText(data.subtotal)));
      content.append(subtotal);
      if (data.has_unavailable) {
        content.append(el('p', 'Some items have no current price or were removed from the catalog. Remove them before checkout.', 'unavailable'));
      }
    }
    if (action) action.disabled = !data.items.length || data.has_unavailable;
  }

  async function loadCart() {
    show('Loading cart…');
    const data = await api('/cart');
    displayCart(data, page === 'cart');
    show(data.items.length ? `${data.items.length} distinct product(s) in cart.` : 'Cart is empty.');
  }

  if (page === 'cart') {
    action.addEventListener('click', () => window.location.assign('/customer/checkout'));
    loadCart().catch(error => show(error.message, true));
  }

  if (page === 'checkout') {
    const token = crypto.randomUUID();
    action.addEventListener('click', async () => {
      if (!window.confirm('Submit this order for review? No online payment will be collected.')) return;
      action.disabled = true;
      show('Submitting order…');
      try {
        const data = await api('/checkout', {
          method: 'POST', body: JSON.stringify({ checkout_token: token }),
        });
        window.location.assign(`/customer/orders?order=${encodeURIComponent(data.order.order_id)}`);
      } catch (error) {
        show(error.message, true);
        // Keep the same token for retries; the backend handles repeats safely.
        try { await loadCart(); } catch (_) { /* original error already shown */ }
        show(error.message, true);
      }
    });
    loadCart().catch(error => show(error.message, true));
  }

  async function showOrder(id) {
    const data = await api(`/orders/${encodeURIComponent(id)}`);
    const order = data.order;
    const details = document.getElementById('shopping-order-details');
    details.replaceChildren();
    details.append(el('h2', `Order #${order.order_id}`));
    details.append(el('p', `${formatDate(order.created_at)} · ${order.status}`));
    order.items.forEach(item => {
      const row = el('div', '', 'customer-shopping-line');
      row.append(el('span', `${item.description || item.prodcode} · ${item.quantity} × ${moneyText(item.unit_price)}`));
      row.append(el('strong', moneyText(item.line_total)));
      details.append(row);
    });
    details.append(el('strong', `Total: ${moneyText(order.total_amount)}`));
    details.hidden = false;
  }

  async function loadOrders() {
    show('Loading orders…');
    const data = await api('/orders');
    content.replaceChildren();
    if (!data.orders.length) {
      content.append(el('p', 'No orders yet. Your submitted orders will appear here.'));
    }
    data.orders.forEach(order => {
      const row = el('div', '', 'customer-shopping-line');
      const label = el('div');
      label.append(el('strong', `Order #${order.order_id}`));
      label.append(el('small', `${formatDate(order.created_at)} · ${order.status}`));
      row.append(label);
      row.append(el('strong', moneyText(order.total_amount)));
      const view = el('button', 'Details', 'portal-button secondary');
      view.type = 'button';
      view.addEventListener('click', () => showOrder(order.order_id).catch(error => show(error.message, true)));
      row.append(view);
      content.append(row);
    });
    show(`${data.orders.length} order(s) shown.`);
    const selected = new URLSearchParams(window.location.search).get('order');
    if (selected && /^\d+$/.test(selected)) await showOrder(selected);
  }
  if (page === 'orders') loadOrders().catch(error => show(error.message, true));
})();
