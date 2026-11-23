'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const message = $('accounts-message');
  const tbody = $('customer-accounts-body');
  const html = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
  const show = (text, type = 'error') => {
    message.textContent = text;
    message.className = `admin-message ${type}`;
  };
  let accounts = [];
  let canCreateCustomer = false;
  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin', ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }
  function render() {
    $('account-count').textContent = `${accounts.length} customer accounts shown`;
    if (!accounts.length) {
      tbody.innerHTML = '<tr><td colspan="5">No customer accounts found.</td></tr>';
      return;
    }
    tbody.innerHTML = accounts.map((account) => {
      const id = html(account.account_id);
      const status = account.status === 'active' ? 'active' : 'blocked';
      return `<tr>
        <td class="customer-name">${html(account.full_name)}</td>
        <td>${html(account.custno)}</td>
        <td>${html(account.email)}</td>
        <td><span class="status-chip ${status}">${html(status)}</span></td>
        <td><div class="action-buttons">
          <button type="button" data-action="edit" data-id="${id}">Edit</button>
          <button type="button" data-action="status" data-id="${id}" data-status="${status === 'active' ? 'blocked' : 'active'}">${status === 'active' ? 'Block' : 'Unblock'}</button>
        </div></td></tr>`;
    }).join('');
  }
  async function load() {
    const q = $('customer-account-search').value.trim();
    const data = await api(`/api/admin/customer-accounts?q=${encodeURIComponent(q)}`);
    accounts = Array.isArray(data.accounts) ? data.accounts : [];
    render();
  }
  $('show-customer-add').addEventListener('click', () => {
    if (!canCreateCustomer) return;
    $('customer-edit-panel').hidden = true;
    $('customer-add-panel').hidden = false;
  });
  document.querySelectorAll('[data-hide]').forEach((b) => b.addEventListener('click', () => {
    $(b.dataset.hide).hidden = true;
  }));
  let searchTimer;
  $('customer-account-search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => load().catch((err) => show(err.message)), 220);
  });
  $('customer-add-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!canCreateCustomer) return show('Only superadmins can create customer accounts.');
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get('password') !== data.get('confirm_password')) {
      return show('Passwords do not match.');
    }
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const result = await api('/api/admin/customer-accounts', {
        method: 'POST',
        body: JSON.stringify({
          full_name: data.get('full_name'), email: data.get('email'),
          phone: data.get('phone'), password: data.get('password'),
        }),
      });
      form.reset();
      $('customer-add-panel').hidden = true;
      show(result.message, 'success');
      await load();
    } catch (err) { show(err.message); }
    finally { button.disabled = false; }
  });
  tbody.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const account = accounts.find((item) => String(item.account_id) === button.dataset.id);
    if (!account) return show('Customer account not found.');
    if (button.dataset.action === 'edit') {
      $('customer-add-panel').hidden = true;
      $('customer-edit-panel').hidden = false;
      const form = $('customer-edit-form');
      for (const key of ['account_id', 'full_name', 'email', 'phone']) {
        form.elements[key].value = account[key] ?? '';
      }
      $('customer-edit-panel').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const status = button.dataset.status;
    if (!window.confirm(`Are you sure you want to ${status === 'blocked' ? 'block' : 'unblock'} ${account.email}?`)) return;
    button.disabled = true;
    try {
      const result = await api(`/api/admin/customer-accounts/${encodeURIComponent(account.account_id)}/status`, {
        method: 'PATCH', body: JSON.stringify({ status }),
      });
      show(result.message, 'success');
      await load();
    } catch (err) { show(err.message); }
    finally { button.disabled = false; }
  });
  $('customer-edit-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const result = await api(`/api/admin/customer-accounts/${encodeURIComponent(data.get('account_id'))}`, {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: data.get('full_name'), email: data.get('email'), phone: data.get('phone'),
        }),
      });
      $('customer-edit-panel').hidden = true;
      show(result.message, 'success');
      await load();
    } catch (err) { show(err.message); }
    finally { button.disabled = false; }
  });
  (async () => {
    try {
      const staff = await api('/api/auth/me');
      if (!['admin', 'superadmin'].includes(staff.user?.role)) {
        window.location.replace('/staff/login');
        return;
      }
      canCreateCustomer = staff.user?.role === 'superadmin';
      $('show-customer-add').hidden = !canCreateCustomer;
      $('customer-add-panel').hidden = true;
      $('admin-interface').hidden = false;
      await load();
    } catch (err) {
      show('Administrator login required. Please sign in from the Staff portal.');
      window.location.replace('/staff/login');
    }
  })();
})();
