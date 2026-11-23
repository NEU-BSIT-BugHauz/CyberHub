'use strict';

(() => {
  const editButton = document.getElementById('profile-edit-button');
  const editor = document.getElementById('profile-editor');
  const editForm = document.getElementById('profile-edit-form');
  const passwordForm = document.getElementById('profile-password-form');
  const cancelButton = document.getElementById('profile-cancel-button');
  const editMessage = document.getElementById('profile-edit-message');
  const passwordMessage = document.getElementById('profile-password-message');

  let account = null;

  function show(element, text, kind = 'error') {
    element.textContent = text;
    element.className = `customer-message ${kind}`;
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || 'Request failed. Please try again.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function showAccount(customer) {
    account = customer;
    setText('customer-display-name', customer.full_name || '—');
    setText('customer-display-number', customer.custno || '—');
    setText('customer-display-email', customer.email || '—');
    setText('customer-display-phone', customer.phone || 'Not provided');
    setText('customer-display-address', customer.address || 'Not provided');
    setText('customer-display-status', customer.status || '—');
  }

  function resetForm() {
    if (!account) return;
    editForm.elements.full_name.value = account.full_name || '';
    editForm.elements.email.value = account.email || '';
    editForm.elements.phone.value = account.phone || '';
    editForm.elements.address.value = account.address || '';
    editForm.elements.current_password.value = '';
  }

  async function loadAccount() {
    try {
      const data = await api('/api/customer-auth/me');
      if (!data.customer) throw new Error('Unable to load your profile.');
      showAccount(data.customer);
      editButton.hidden = false;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        window.location.replace('/customer/login');
        return;
      }
      show(editMessage, error.message);
    }
  }

  editButton.addEventListener('click', () => {
    resetForm();
    show(editMessage, '', '');
    editor.hidden = false;
    editButton.hidden = true;
    editForm.elements.full_name.focus();
  });

  cancelButton.addEventListener('click', () => {
    resetForm();
    show(editMessage, '', '');
    editor.hidden = true;
    editButton.hidden = false;
  });

  editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!account) return;
    const form = new FormData(editForm);
    const payload = {
      full_name: String(form.get('full_name') || '').trim(),
      email: String(form.get('email') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      address: String(form.get('address') || '').trim(),
      current_password: String(form.get('current_password') || ''),
    };
    if (payload.email.toLowerCase() !== account.email.toLowerCase() && !payload.current_password) {
      show(editMessage, 'Enter your current password to change your email.');
      return;
    }
    const button = editForm.querySelector('[type="submit"]');
    button.disabled = true;
    show(editMessage, '', '');
    try {
      const data = await api('/api/customer-auth/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showAccount(data.customer);
      resetForm();
      editor.hidden = true;
      editButton.hidden = false;
      show(document.getElementById('customer-auth-message'), 'Profile updated successfully.', 'success');
    } catch (error) {
      if (error.status === 401) {
        window.location.replace('/customer/login');
        return;
      }
      show(editMessage, error.message);
    } finally {
      button.disabled = false;
    }
  });

  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(passwordForm);
    const currentPassword = String(form.get('current_password') || '');
    const newPassword = String(form.get('new_password') || '');
    const confirmPassword = String(form.get('confirm_password') || '');
    if (newPassword !== confirmPassword) {
      show(passwordMessage, 'New passwords do not match.');
      return;
    }
    const button = passwordForm.querySelector('[type="submit"]');
    button.disabled = true;
    show(passwordMessage, '', '');
    try {
      await api('/api/customer-auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      passwordForm.reset();
      window.location.assign('/customer/login');
    } catch (error) {
      if (error.status === 401) {
        window.location.replace('/customer/login');
        return;
      }
      show(passwordMessage, error.message);
    } finally {
      button.disabled = false;
    }
  });

  loadAccount();
})();
