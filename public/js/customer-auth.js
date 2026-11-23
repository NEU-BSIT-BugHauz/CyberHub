'use strict';

(() => {
  const page = document.body.dataset.customerPage;
  const message = document.getElementById('customer-auth-message');
  const protectedPages = new Set([
    'dashboard', 'shop', 'cart', 'checkout', 'orders', 'profile',
  ]);

  function show(text, type = 'error') {
    if (!message) return;
    message.textContent = text;
    message.className = `customer-message ${type}`.trim();
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || 'Something went wrong. Try again.');
      error.status = response.status;
      throw error;
    }
    return result;
  }

  function submit(form, handler) {
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      if (button) button.disabled = true;
      show('', '');
      try {
        await handler(new FormData(form));
      } catch (error) {
        show(error.message);
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value ?? '');
  }

  async function initializeProtectedPage() {
    // Do not show customer identity from an unchecked client cache.
    try {
      const { customer } = await api('/api/customer-auth/me');
      if (!customer) throw new Error('Unable to load customer account.');
      const mapping = {
        'customer-display-name': customer.full_name || 'customer',
        'customer-display-number': customer.custno || '—',
        'customer-display-email': customer.email || '—',
        'customer-display-phone': customer.phone || 'Not provided',
        'customer-display-status': customer.status || '—',
      };
      Object.entries(mapping).forEach(([id, value]) => setText(id, value));
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        window.location.replace('/customer/login');
        return;
      }
      show('Unable to load your account right now. Please try refreshing this page.');
    }
  }

  if (page === 'login') {
    submit(document.getElementById('customer-login-form'), async (data) => {
      await api('/api/customer-auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: data.get('email'),
          password: data.get('password'),
        }),
      });
      window.location.assign('/customer/dashboard');
    });
  } else if (page === 'register') {
    submit(document.getElementById('customer-register-form'), async (data) => {
      if (data.get('password') !== data.get('confirm_password')) {
        throw new Error('Passwords do not match.');
      }
      await api('/api/customer-auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: data.get('full_name'),
          email: data.get('email'),
          phone: data.get('phone'),
          password: data.get('password'),
        }),
      });
      show('Your account was created. Go to Customer Login to sign in.', 'success');
      document.getElementById('customer-register-form').reset();
    });
  } else if (protectedPages.has(page)) {
    initializeProtectedPage();
    const logoutButton = document.getElementById('customer-logout');
    if (logoutButton) {
      logoutButton.addEventListener('click', async () => {
        logoutButton.disabled = true;
        show('', '');
        try {
          await api('/api/customer-auth/logout', { method: 'POST' });
          window.location.assign('/customer/login');
        } catch (error) {
          show(error.message);
          logoutButton.disabled = false;
        }
      });
    }
  }
})();
