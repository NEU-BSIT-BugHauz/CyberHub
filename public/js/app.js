
const loginView = document.getElementById('login-view');
const forgotPasswordView = document.getElementById('forgot-password-view');
const resetPasswordView = document.getElementById('reset-password-view');
const dashboardView = document.getElementById('dashboard-view');

const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const forgotPasswordForm = document.getElementById('forgot-password-form');
const forgotMessage = document.getElementById('forgot-message');
const resetPasswordForm = document.getElementById('reset-password-form');
const resetMessage = document.getElementById('reset-message');

const pageMessage = document.getElementById('page-message');

const usersTableBody = document.getElementById('users-table-body');
const userSearch = document.getElementById('user-search');
const userCount = document.getElementById('user-count');

const resetToken = new URLSearchParams(window.location.search).get('token');

let currentUser = null;
let users = [];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function showMessage(element, message, type = '') {
  element.textContent = message;
  element.className = `message ${type}`.trim();
}

function hideAllViews() {
  loginView.classList.add('hidden');
  forgotPasswordView.classList.add('hidden');
  resetPasswordView.classList.add('hidden');
  dashboardView.classList.add('hidden');
}

function showLogin(message = '', type = '') {
  hideAllViews();
  loginView.classList.remove('hidden');

  showMessage(loginMessage, message, type);
}

function showForgotPassword() {
  hideAllViews();
  forgotPasswordView.classList.remove('hidden');

  forgotPasswordForm.reset();
  showMessage(forgotMessage, '');

  document.getElementById('forgot-email').focus();
}

function showResetPassword(message = '', type = '') {
  hideAllViews();
  resetPasswordView.classList.remove('hidden');

  showMessage(resetMessage, message, type);
}

function showDashboard() {
  hideAllViews();
  dashboardView.classList.remove('hidden');

  document.getElementById('current-user-name').textContent =
    currentUser.full_name || currentUser.email;

  document.getElementById('current-user-role').textContent =
    currentUser.role;

  const isSuperadmin = currentUser.role === 'superadmin';

  document.getElementById('add-role-field').classList.toggle(
    'hidden',
    !isSuperadmin
  );

  document.getElementById('edit-role-field').classList.toggle(
    'hidden',
    !isSuperadmin
  );
}

function formatRole(role) {
  return String(role || '')
    .charAt(0)
    .toUpperCase() + String(role || '').slice(1);
}

// PASSWORD RESET NAVIGATION

document.getElementById('show-forgot-password').addEventListener(
  'click',
  showForgotPassword
);

document.getElementById('back-to-login').addEventListener(
  'click',
  () => showLogin()
);

document.getElementById('reset-back-to-login').addEventListener(
  'click',
  () => {
    resetPasswordForm.reset();
    showLogin();
  }
);

// FORGOT PASSWORD

forgotPasswordForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const submitButton = forgotPasswordForm.querySelector(
    'button[type="submit"]'
  );

  const email = document.getElementById('forgot-email').value
    .trim()
    .toLowerCase();

  submitButton.disabled = true;
  submitButton.textContent = 'Sending...';

  showMessage(forgotMessage, '');

  try {
    const data = await apiRequest('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    showMessage(
      forgotMessage,
      data.message ||
        'If an eligible account exists for that email, a password reset link will be sent.',
      'success'
    );

    forgotPasswordForm.reset();
  } catch (error) {
    showMessage(forgotMessage, error.message, 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Send Reset Link';
  }
});

// RESET PASSWORD

resetPasswordForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const submitButton = resetPasswordForm.querySelector(
    'button[type="submit"]'
  );

  const password = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  showMessage(resetMessage, '');

  if (!resetToken) {
    showMessage(
      resetMessage,
      'The password reset link is missing its token. Request a new reset link.',
      'error'
    );
    return;
  }

  if (password.length < 8) {
    showMessage(
      resetMessage,
      'Your password must contain at least 8 characters.',
      'error'
    );
    return;
  }

  if (password !== confirmPassword) {
    showMessage(
      resetMessage,
      'The passwords do not match.',
      'error'
    );
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Saving...';

  try {
    const data = await apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        token: resetToken,
        password,
      }),
    });

    resetPasswordForm.reset();

    // Remove the reset token from the browser address bar.
    window.history.replaceState(
      null,
      '',
      window.location.pathname
    );

    showLogin(
      data.message || 'Password updated successfully. You can now sign in.',
      'success'
    );
  } catch (error) {
    showMessage(resetMessage, error.message, 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Save Password';
  }
});

// USER TABLE

function renderUsers() {
  const searchTerm = userSearch.value.trim().toLowerCase();

  const filteredUsers = users.filter((user) => {
    const searchable = [
      user.full_name,
      user.empno,
      user.email,
      user.role,
      user.status,
    ].join(' ').toLowerCase();

    return searchable.includes(searchTerm);
  });

  userCount.textContent = users.length;

  document.getElementById('empty-search').classList.toggle(
    'hidden',
    filteredUsers.length !== 0 || users.length === 0
  );

  if (filteredUsers.length === 0) {
    usersTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          ${users.length === 0
            ? 'No manageable accounts found.'
            : 'No matching accounts found.'}
        </td>
      </tr>
    `;
    return;
  }

  usersTableBody.innerHTML = filteredUsers.map((user) => {
    const id = escapeHtml(user.user_id);
    const name = escapeHtml(user.full_name || 'Unnamed employee');
    const empno = escapeHtml(user.empno || 'N/A');
    const email = escapeHtml(user.email);
    const role = escapeHtml(formatRole(user.role));
    const status = escapeHtml(user.status);
    const isBlocked = user.status === 'blocked';
    const needsPassword = user.must_set_password;

    return `
      <tr>
        <td>
          <div class="employee-name">${name}</div>
          <div class="employee-number">${empno}</div>
        </td>
        <td>${email}</td>
        <td><span class="role-badge">${role}</span></td>
        <td>
          <span class="status ${status}">
            ${formatRole(status)}
          </span>
        </td>
        <td>
          <span class="password-badge ${needsPassword ? '' : 'complete'}">
            ${needsPassword ? 'Required' : 'Complete'}
          </span>
        </td>
        <td>
          <div class="action-group">
            <button
              type="button"
              class="btn btn-small btn-edit"
              data-action="edit"
              data-id="${id}"
            >
              Edit
            </button>

            <button
              type="button"
              class="btn btn-small ${isBlocked ? 'btn-unblock' : 'btn-block'}"
              data-action="status"
              data-id="${id}"
              data-status="${isBlocked ? 'active' : 'blocked'}"
            >
              ${isBlocked ? 'Unblock' : 'Block'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadUsers() {
  usersTableBody.innerHTML = `
    <tr>
      <td colspan="6" class="empty-state">Loading accounts...</td>
    </tr>
  `;

  try {
    const data = await apiRequest('/api/users');
    users = Array.isArray(data.users) ? data.users : [];
    renderUsers();
  } catch (error) {
    usersTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          Unable to load accounts.
        </td>
      </tr>
    `;

    showMessage(pageMessage, error.message, 'error');
  }
}

// LOGIN

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const submitButton = loginForm.querySelector('button[type="submit"]');
  const formData = new FormData(loginForm);

  const credentials = {
    email: formData.get('email'),
    password: formData.get('password'),
  };

  submitButton.disabled = true;
  submitButton.textContent = 'Signing in...';

  showMessage(loginMessage, '');

  try {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (!['admin', 'superadmin'].includes(data.user?.role)) {
      showMessage(
        loginMessage,
        'Administrator access is required to use this portal.',
        'error'
      );
      return;
    }

    currentUser = data.user;
    loginForm.reset();

    showDashboard();
    showMessage(pageMessage, 'Welcome to CyberHub.', 'success');

    await loadUsers();
  } catch (error) {
    showMessage(loginMessage, error.message, 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Sign in';
  }
});

// ADD USER PANEL

document.getElementById('show-add-form').addEventListener('click', () => {
  document.getElementById('add-panel').classList.remove('hidden');
  document.getElementById('edit-panel').classList.add('hidden');
  document.getElementById('add-empno').focus();
});

document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById(button.dataset.close).classList.add('hidden');
  });
});

// CREATE USER

document.getElementById('add-user-form').addEventListener(
  'submit',
  async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');

    const payload = {
      empno: document.getElementById('add-empno').value.trim(),
      email: document.getElementById('add-email').value.trim(),
    };

    if (currentUser.role === 'superadmin') {
      payload.role = document.getElementById('add-role').value;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Creating...';

    try {
      const data = await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      form.reset();
      document.getElementById('add-panel').classList.add('hidden');

      showMessage(pageMessage, data.message, 'success');

      await loadUsers();
    } catch (error) {
      showMessage(pageMessage, error.message, 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Create Account';
    }
  }
);

// OPEN EDIT FORM

function openEditForm(userId) {
  const user = users.find(
    (item) => String(item.user_id) === String(userId)
  );

  if (!user) {
    showMessage(pageMessage, 'Account not found.', 'error');
    return;
  }

  document.getElementById('add-panel').classList.add('hidden');
  document.getElementById('edit-panel').classList.remove('hidden');

  document.getElementById('edit-user-id').value = user.user_id;
  document.getElementById('edit-full-name').value = user.full_name || '';
  document.getElementById('edit-empno').value = user.empno || '';
  document.getElementById('edit-email').value = user.email || '';

  if (currentUser.role === 'superadmin') {
    document.getElementById('edit-role').value = user.role;
  }

  document.getElementById('edit-panel').scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

// UPDATE USER

document.getElementById('edit-user-form').addEventListener(
  'submit',
  async (event) => {
    event.preventDefault();

    const submitButton = event.currentTarget.querySelector(
      'button[type="submit"]'
    );

    const userId = document.getElementById('edit-user-id').value;

    const payload = {
      email: document.getElementById('edit-email').value.trim(),
    };

    if (currentUser.role === 'superadmin') {
      payload.role = document.getElementById('edit-role').value;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';

    try {
      const data = await apiRequest(
        `/api/users/${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      );

      document.getElementById('edit-panel').classList.add('hidden');

      showMessage(pageMessage, data.message, 'success');

      await loadUsers();
    } catch (error) {
      showMessage(pageMessage, error.message, 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Save Changes';
    }
  }
);

// BLOCK / UNBLOCK USER

async function updateUserStatus(userId, status) {
  const action = status === 'blocked' ? 'block' : 'unblock';

  const confirmed = window.confirm(
    `Are you sure you want to ${action} this account?`
  );

  if (!confirmed) return;

  try {
    const data = await apiRequest(
      `/api/users/${encodeURIComponent(userId)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }
    );

    showMessage(pageMessage, data.message, 'success');

    await loadUsers();
  } catch (error) {
    showMessage(pageMessage, error.message, 'error');
  }
}

// TABLE ACTIONS

usersTableBody.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');

  if (!button) return;

  const { action, id, status } = button.dataset;

  if (action === 'edit') {
    openEditForm(id);
  }

  if (action === 'status') {
    updateUserStatus(id, status);
  }
});

// SEARCH

userSearch.addEventListener('input', renderUsers);

// LOGOUT

document.getElementById('logout-button').addEventListener(
  'click',
  async () => {
    try {
      await apiRequest('/api/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      showMessage(pageMessage, error.message, 'error');
      return;
    }

    currentUser = null;
    users = [];
    userSearch.value = '';

    showLogin();
  }
);

// RESTORE EXISTING SESSION

async function initializeApp() {
  // Password reset links take priority over automatic session restoration.
  if (resetToken) {
    showResetPassword();
    return;
  }

  try {
    const data = await apiRequest('/api/auth/me');

    if (!['admin', 'superadmin'].includes(data.user?.role)) {
      showLogin(
        'Administrator access is required to use this portal.',
        'error'
      );
      return;
    }

    currentUser = data.user;

    showDashboard();
    await loadUsers();
  } catch (_error) {
    showLogin();
  }
}

initializeApp();
