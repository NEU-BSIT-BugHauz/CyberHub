'use strict';
(() => {
  const page = document.body.dataset.customerPage;
  const message = document.getElementById('customer-auth-message');
  const show = (text, type = 'error') => {
    if (message) { message.textContent = text; message.className = `customer-message ${type}`; }
  };
  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Something went wrong. Try again.');
    return result;
  }
  async function submit(form, handler) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      button.disabled = true;
      show('', '');
      try { await handler(new FormData(form)); }
      catch (error) { show(error.message); }
      finally { button.disabled = false; }
    });
  }
  if (page === 'login') {
    submit(document.getElementById('customer-login-form'), async (data) => {
      await api('/api/customer-auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: data.get('email'), password: data.get('password') }),
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
  } else if (page === 'dashboard') {
    (async () => {
      try {
        const { customer } = await api('/api/customer-auth/me');
        const mapping = {
          'customer-display-name': customer.full_name,
          'customer-display-number': customer.custno,
          'customer-display-email': customer.email,
          'customer-display-phone': customer.phone || 'Not provided',
          'customer-display-status': customer.status,
        };
        for (const [id, value] of Object.entries(mapping)) {
          document.getElementById(id).textContent = String(value ?? '');
        }
      } catch (_error) { window.location.replace('/customer/login'); }
    })();
    document.getElementById('customer-logout').addEventListener('click', async () => {
      try {
        await api('/api/customer-auth/logout', { method: 'POST' });
        window.location.assign('/customer/login');
      } catch (error) { show(error.message); }
    });
  }
})();
