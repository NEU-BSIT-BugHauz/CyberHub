
const loginView = document.getElementById('login-view');
const registerView = document.getElementById('register-view');
const forgotPasswordView = document.getElementById('forgot-password-view');
const resetPasswordView = document.getElementById('reset-password-view');
const dashboardView = document.getElementById('dashboard-view');

const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
const registerForm = document.getElementById('register-form');
const registerMessage = document.getElementById('register-message');
const forgotPasswordForm = document.getElementById('forgot-password-form');
const forgotMessage = document.getElementById('forgot-message');
const resetPasswordForm = document.getElementById('reset-password-form');
const resetMessage = document.getElementById('reset-message');

const pageMessage = document.getElementById('page-message');

const usersTableBody = document.getElementById('users-table-body');
const userSearch = document.getElementById('user-search');
const userCount = document.getElementById('user-count');

const MODULES = [
  'Customer',
  'Product',
  'Human Resources',
  'Sales',
  'Reports',
];

const ACTIONS = [
  'can_view',
  'can_create',
  'can_edit',
  'can_delete',
];

const ACTION_LABELS = {
  can_view: 'View',
  can_create: 'Create',
  can_edit: 'Edit',
  can_delete: 'Delete',
};

const MODULE_DESCRIPTIONS = {
  Customer: 'Manage and review customer-related information.',
  Product: 'Access product information and related operations.',
  'Human Resources': 'Access employee and human resources information.',
  Sales: 'Access sales-related information and operations.',
  Reports: 'Access reporting and business insights.',
};

const CONTENT_VIEWS = {
  overview: 'overview-view',
  module: 'module-view',
  'user-management': 'user-management-view',
  permissions: 'permissions-view',
  superadmin: 'superadmin-view',
};

const resetToken = new URLSearchParams(window.location.search).get('token');

let currentUser = null;
let users = [];
let permissions = [];
let selectedModule = null;
let currentPermissionTarget = null;

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
  if (!element) return;

  element.textContent = message;
  element.className = `message ${type}`.trim();
}

function formatRole(role) {
  const value = String(role || '');

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isAuthenticated() {
  return Boolean(currentUser && currentUser.user_id);
}

function isAdmin() {
  return ['admin', 'superadmin'].includes(currentUser?.role);
}

function isSuperadmin() {
  return currentUser?.role === 'superadmin';
}

function createDefaultPermission(moduleName) {
  return {
    module_name: moduleName,
    can_view: false,
    can_create: false,
    can_edit: false,
    can_delete: false,
  };
}

function normalizePermissions(data) {
  const supplied = Array.isArray(data) ? data : [];

  return MODULES.map((moduleName) => {
    const existing = supplied.find(
      (item) => item.module_name === moduleName
    );

    if (!existing) {
      return createDefaultPermission(moduleName);
    }

    return {
      module_name: moduleName,
      can_view: existing.can_view === true,
      can_create: existing.can_create === true,
      can_edit: existing.can_edit === true,
      can_delete: existing.can_delete === true,
    };
  });
}

function getModulePermission(moduleName) {
  if (isSuperadmin()) {
    return {
      module_name: moduleName,
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: true,
    };
  }

  return permissions.find(
    (item) => item.module_name === moduleName
  ) || createDefaultPermission(moduleName);
}

function getAvailableModules() {
  if (isSuperadmin()) {
    return [...MODULES];
  }

  return MODULES.filter(
    (moduleName) => getModulePermission(moduleName).can_view
  );
}

function hasModuleAccess(moduleName) {
  return MODULES.includes(moduleName) &&
    getModulePermission(moduleName).can_view;
}

// ==========================================
// MAIN VIEW NAVIGATION
// ==========================================

function hideAllViews() {
  loginView.classList.add('hidden');
  registerView.classList.add('hidden');
  forgotPasswordView.classList.add('hidden');
  resetPasswordView.classList.add('hidden');
  dashboardView.classList.add('hidden');
}

function showLogin(message = '', type = '') {
  hideAllViews();
  loginView.classList.remove('hidden');

  showMessage(loginMessage, message, type);
}

function showRegister() {
  hideAllViews();
  registerView.classList.remove('hidden');

  registerForm.reset();
  showMessage(registerMessage, '');

  document.getElementById('register-empno').focus();
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

function setActiveNavigation(view, moduleName = '') {
  document.querySelectorAll('.sidebar-nav [data-view]').forEach((button) => {
    const isActive =
      button.dataset.view === view &&
      (view !== 'module' || button.dataset.module === moduleName);

    button.classList.toggle('active', isActive);
  });
}

function showContentView(view, moduleName = '') {
  if (!isAuthenticated()) return;

  if (!Object.prototype.hasOwnProperty.call(CONTENT_VIEWS, view)) {
    return;
  }

  if (view === 'user-management' && !isAdmin()) {
    showMessage(pageMessage, 'Administrator access required.', 'error');
    return;
  }

  if (
    (view === 'permissions' || view === 'superadmin') &&
    !isSuperadmin()
  ) {
    showMessage(pageMessage, 'Superadmin access required.', 'error');
    return;
  }

  if (view === 'module') {
    if (!hasModuleAccess(moduleName)) {
      showMessage(
        pageMessage,
        'You do not have access to this module.',
        'error'
      );
      return;
    }

    selectedModule = moduleName;
    renderModuleWorkspace(moduleName);
  }

  Object.values(CONTENT_VIEWS).forEach((id) => {
    document.getElementById(id).classList.add('hidden');
  });

  document.getElementById(CONTENT_VIEWS[view]).classList.remove('hidden');

  setActiveNavigation(view, moduleName);
  showMessage(pageMessage, '');

  if (view === 'user-management') {
    loadUsers();
  }

  if (view === 'permissions') {
    loadPermissionTargets();
  }
}

function showDashboard() {
  hideAllViews();
  dashboardView.classList.remove('hidden');

  document.getElementById('current-user-name').textContent =
    currentUser.full_name || currentUser.email;

  document.getElementById('current-user-role').textContent =
    formatRole(currentUser.role);

  document.getElementById('add-role-field').classList.toggle(
    'hidden',
    !isSuperadmin()
  );

  document.getElementById('add-password-field').classList.toggle(
    'hidden',
    !isSuperadmin()
  );

  document.getElementById('add-confirm-password-field').classList.toggle(
    'hidden',
    !isSuperadmin()
  );

  document.getElementById('add-password-note').textContent = isSuperadmin()
    ? 'Optional: Enter an initial password for the employee to use. If left blank, the employee must set a password through the password reset process. Share assigned passwords privately.'
    : 'New accounts are created without a password. The employee must set their own password through the password reset process.';

  document.getElementById('edit-role-field').classList.toggle(
    'hidden',
    !isSuperadmin()
  );

  configureNavigation();
  renderOverview();

  showContentView('overview');
}

function configureNavigation() {
  const availableModules = getAvailableModules();

  document.querySelectorAll('.module-link').forEach((button) => {
    const allowed = availableModules.includes(button.dataset.module);

    button.classList.toggle('hidden', !allowed);
    button.disabled = !allowed;
  });

  document.getElementById('user-management-nav').classList.toggle(
    'hidden',
    !isAdmin()
  );

  document.getElementById('permissions-nav').classList.toggle(
    'hidden',
    !isSuperadmin()
  );

  document.getElementById('superadmin-nav').classList.toggle(
    'hidden',
    !isSuperadmin()
  );
}

// ==========================================
// DASHBOARD OVERVIEW
// ==========================================

function renderOverview() {
  const availableModules = getAvailableModules();

  document.getElementById('overview-user-name').textContent =
    currentUser.full_name || currentUser.email;

  document.getElementById('overview-user-role').textContent =
    formatRole(currentUser.role);

  document.getElementById('overview-role-card').textContent =
    formatRole(currentUser.role);

  document.getElementById('overview-module-count').textContent =
    availableModules.length;

  document.getElementById('overview-account-status').textContent =
    formatRole(currentUser.status);

  const container = document.getElementById('overview-module-list');

  if (availableModules.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        No modules have been assigned to your account yet.
        Contact your administrator for access.
      </div>
    `;
    return;
  }

  container.innerHTML = availableModules.map((moduleName) => {
    const safeName = escapeHtml(moduleName);
    const permission = getModulePermission(moduleName);

    const actionLabels = ACTIONS
      .filter((action) => permission[action])
      .map((action) => ACTION_LABELS[action]);

    return `
      <button
        type="button"
        class="module-card"
        data-open-module="${safeName}"
      >
        <span class="module-card-title">${safeName}</span>
        <span class="module-card-description">
          ${escapeHtml(MODULE_DESCRIPTIONS[moduleName])}
        </span>
        <span class="module-card-permissions">
          ${actionLabels.length
            ? escapeHtml(actionLabels.join(' · '))
            : 'View access'}
        </span>
        <span class="module-card-action">Open workspace →</span>
      </button>
    `;
  }).join('');
}

function renderModuleWorkspace(moduleName) {
  const permission = getModulePermission(moduleName);

  document.getElementById('module-title').textContent = moduleName;

  document.getElementById('module-description').textContent =
    MODULE_DESCRIPTIONS[moduleName] || 'Your assigned module workspace.';

  document.getElementById('module-placeholder-title').textContent =
    `${moduleName} Workspace`;

  const summary = document.getElementById('module-permission-summary');

  summary.innerHTML = ACTIONS.map((action) => {
    const granted = permission[action];

    return `
      <div class="permission-summary-item">
        <span>${ACTION_LABELS[action]}</span>
        <strong class="${granted ? 'permission-granted' : 'permission-denied'}">
          ${granted ? 'Allowed' : 'Not allowed'}
        </strong>
      </div>
    `;
  }).join('');
}

// ==========================================
// SIDEBAR AND MODULE NAVIGATION
// ==========================================

document.querySelectorAll('.sidebar-nav [data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    showContentView(
      button.dataset.view,
      button.dataset.module || ''
    );
  });
});

document.getElementById('overview-module-list').addEventListener(
  'click',
  (event) => {
    const button = event.target.closest('[data-open-module]');

    if (!button) return;

    showContentView('module', button.dataset.openModule);
  }
);

// ==========================================
// REGISTRATION NAVIGATION AND SUBMISSION
// ==========================================

document.getElementById('show-register').addEventListener(
  'click',
  showRegister
);

document.getElementById('register-back-to-login').addEventListener(
  'click',
  () => {
    registerForm.reset();
    showLogin();
  }
);

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const submitButton = registerForm.querySelector('button[type="submit"]');
  const empno = document.getElementById('register-empno').value.trim();
  const email = document.getElementById('register-email').value.trim().toLowerCase();
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm-password').value;

  showMessage(registerMessage, '');

  if (!/^[A-Za-z0-9]{5}$/.test(empno)) {
    showMessage(registerMessage, 'Enter a valid 5-character employee number.', 'error');
    return;
  }

  if (password.length < 8) {
    showMessage(registerMessage, 'Your password must contain at least 8 characters.', 'error');
    return;
  }

  if (password !== confirmPassword) {
    showMessage(registerMessage, 'The passwords do not match.', 'error');
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Creating account...';

  try {
    const data = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ empno, email, password }),
    });

    registerForm.reset();
    showLogin(
      data.message ||
        'Registration submitted. Your account is pending administrator approval.',
      'success'
    );
  } catch (error) {
    showMessage(registerMessage, error.message, 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Create Account';
  }
});

// ==========================================
// PASSWORD RESET NAVIGATION
// ==========================================

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

// ==========================================
// FORGOT PASSWORD
// ==========================================

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

// ==========================================
// RESET PASSWORD
// ==========================================

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

// ==========================================
// USER MANAGEMENT TABLE
// ==========================================

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
    const isPending = user.status === 'pending';
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
            ${isPending ? `
            <button
              type="button"
              class="btn btn-small btn-unblock"
              data-action="status"
              data-id="${id}"
              data-status="active"
            >
              Approve
            </button>` : ''}

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

async function fetchManageableUsers() {
  const data = await apiRequest('/api/users');

  return Array.isArray(data.users) ? data.users : [];
}

async function loadUsers() {
  if (!isAdmin()) return;

  usersTableBody.innerHTML = `
    <tr>
      <td colspan="6" class="empty-state">Loading accounts...</td>
    </tr>
  `;

  try {
    users = await fetchManageableUsers();
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

// ==========================================
// LOGIN AND SESSION RESTORATION
// ==========================================

async function loadCurrentAccount() {
  const data = await apiRequest('/api/auth/me');

  if (!data.user || !['user', 'admin', 'superadmin'].includes(data.user.role)) {
    throw new Error('Your account does not have a valid portal role.');
  }

  currentUser = data.user;
  permissions = normalizePermissions(data.permissions);

  return data;
}

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
    await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    await loadCurrentAccount();

    loginForm.reset();

    showDashboard();
    showMessage(pageMessage, 'Welcome to CyberHub.', 'success');
  } catch (error) {
    currentUser = null;
    permissions = [];

    showMessage(loginMessage, error.message, 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Sign in';
  }
});

// ==========================================
// ADD USER PANEL
// ==========================================

document.getElementById('show-add-form').addEventListener('click', () => {
  if (!isAdmin()) return;

  document.getElementById('add-panel').classList.remove('hidden');
  document.getElementById('edit-panel').classList.add('hidden');

  document.getElementById('add-empno').focus();
});

document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById(button.dataset.close).classList.add('hidden');
  });
});

// ==========================================
// CREATE USER
// ==========================================

document.getElementById('add-user-form').addEventListener(
  'submit',
  async (event) => {
    event.preventDefault();

    if (!isAdmin()) return;

    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');

    const payload = {
      empno: document.getElementById('add-empno').value.trim(),
      email: document.getElementById('add-email').value.trim(),
    };

    if (isSuperadmin()) {
      payload.role = document.getElementById('add-role').value;

      const initialPassword = document.getElementById('add-password').value;
      const confirmPassword = document.getElementById('add-confirm-password').value;

      if (initialPassword || confirmPassword) {
        if (
          initialPassword.length < 8 ||
          initialPassword.length > 128 ||
          initialPassword.trim().length === 0
        ) {
          showMessage(pageMessage, 'Initial password must be 8 to 128 characters and not blank.', 'error');
          return;
        }

        if (initialPassword !== confirmPassword) {
          showMessage(pageMessage, 'The initial passwords do not match.', 'error');
          return;
        }

        payload.password = initialPassword;
      }
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

// ==========================================
// OPEN EDIT FORM
// ==========================================

function openEditForm(userId) {
  if (!isAdmin()) return;

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

  if (isSuperadmin()) {
    document.getElementById('edit-role').value = user.role;
  }

  document.getElementById('edit-panel').scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

// ==========================================
// UPDATE USER
// ==========================================

document.getElementById('edit-user-form').addEventListener(
  'submit',
  async (event) => {
    event.preventDefault();

    if (!isAdmin()) return;

    const submitButton = event.currentTarget.querySelector(
      'button[type="submit"]'
    );

    const userId = document.getElementById('edit-user-id').value;

    const payload = {
      email: document.getElementById('edit-email').value.trim(),
    };

    if (isSuperadmin()) {
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

// ==========================================
// BLOCK / UNBLOCK USER
// ==========================================

async function updateUserStatus(userId, status) {
  if (!isAdmin()) return;

  const target = users.find((user) => String(user.user_id) === String(userId));
  const action = status === 'blocked'
    ? 'block'
    : target?.status === 'pending' ? 'approve' : 'unblock';

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

// ==========================================
// USER TABLE ACTIONS
// ==========================================

usersTableBody.addEventListener('click', (event) => {
  if (!isAdmin()) return;

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

// ==========================================
// USER SEARCH
// ==========================================

userSearch.addEventListener('input', renderUsers);

// ==========================================
// RIGHTS AND PERMISSIONS
// ==========================================

function renderPermissionTargets() {
  const select = document.getElementById('permission-user-select');

  select.innerHTML = '<option value="">Select an account</option>';

  users.forEach((user) => {
    const option = document.createElement('option');

    option.value = user.user_id;
    option.textContent =
      `${user.full_name || user.email} — ${formatRole(user.role)} (${user.email})`;

    select.appendChild(option);
  });
}

async function loadPermissionTargets() {
  if (!isSuperadmin()) return;

  const select = document.getElementById('permission-user-select');
  const editor = document.getElementById('permission-editor');

  editor.classList.add('hidden');
  currentPermissionTarget = null;

  select.disabled = true;
  select.innerHTML = '<option value="">Loading accounts...</option>';

  showMessage(
    document.getElementById('permission-message'),
    ''
  );

  try {
    users = await fetchManageableUsers();

    renderPermissionTargets();

    if (users.length === 0) {
      document.getElementById('permission-user-info').textContent =
        'No eligible User or Admin accounts were found.';
    } else {
      document.getElementById('permission-user-info').textContent =
        'Select an account to view or update its module permissions.';
    }
  } catch (error) {
    select.innerHTML = '<option value="">Unable to load accounts</option>';

    showMessage(
      document.getElementById('permission-message'),
      error.message,
      'error'
    );
  } finally {
    select.disabled = false;
  }
}

async function loadSelectedPermissions(userId) {
  if (!isSuperadmin() || !userId) return;

  const editor = document.getElementById('permission-editor');
  const tableBody = document.getElementById('permission-table-body');
  const info = document.getElementById('permission-user-info');

  editor.classList.remove('hidden');

  tableBody.innerHTML = `
    <tr>
      <td colspan="5" class="empty-state">Loading permissions...</td>
    </tr>
  `;

  showMessage(
    document.getElementById('permission-message'),
    ''
  );

  currentPermissionTarget = null;

  try {
    const data = await apiRequest(
      `/api/permissions/${encodeURIComponent(userId)}`
    );

    currentPermissionTarget = data.user;
    const selectedPermissions = normalizePermissions(data.permissions);

    permissionsForEditor = selectedPermissions;

    info.textContent =
      `${data.user.full_name} — ${formatRole(data.user.role)} — ${data.user.email}`;

    renderPermissionEditor(selectedPermissions);
  } catch (error) {
    editor.classList.add('hidden');

    showMessage(
      document.getElementById('permission-message'),
      error.message,
      'error'
    );
  }
}

let permissionsForEditor = [];

function renderPermissionEditor(data) {
  const tableBody = document.getElementById('permission-table-body');

  tableBody.innerHTML = data.map((permission) => {
    const moduleName = escapeHtml(permission.module_name);

    const checkboxes = ACTIONS.map((action) => `
      <td>
        <label class="permission-checkbox">
          <input
            type="checkbox"
            data-module="${moduleName}"
            data-action="${action}"
            ${permission[action] ? 'checked' : ''}
            aria-label="${moduleName} ${ACTION_LABELS[action]}"
          />
        </label>
      </td>
    `).join('');

    return `
      <tr>
        <td class="permission-module-name">${moduleName}</td>
        ${checkboxes}
      </tr>
    `;
  }).join('');
}

document.getElementById('permission-user-select').addEventListener(
  'change',
  (event) => {
    const userId = event.target.value;

    if (!userId) {
      currentPermissionTarget = null;
      document.getElementById('permission-editor').classList.add('hidden');
      document.getElementById('permission-user-info').textContent =
        'No account selected.';
      return;
    }

    loadSelectedPermissions(userId);
  }
);

function collectPermissionChanges() {
  return MODULES.map((moduleName) => {
    const permission = {
      module_name: moduleName,
    };

    ACTIONS.forEach((action) => {
      const checkbox = document.querySelector(
        `#permission-table-body input[data-module="${CSS.escape(moduleName)}"][data-action="${action}"]`
      );

      permission[action] = Boolean(checkbox && checkbox.checked);
    });

    return permission;
  });
}

document.getElementById('save-permissions-button').addEventListener(
  'click',
  async () => {
    if (!isSuperadmin() || !currentPermissionTarget) return;

    const button = document.getElementById('save-permissions-button');

    button.disabled = true;
    button.textContent = 'Saving...';

    try {
      const payload = {
        permissions: collectPermissionChanges(),
      };

      const data = await apiRequest(
        `/api/permissions/${encodeURIComponent(currentPermissionTarget.user_id)}`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        }
      );

      permissionsForEditor = normalizePermissions(data.permissions);

      renderPermissionEditor(permissionsForEditor);

      showMessage(
        document.getElementById('permission-message'),
        data.message || 'Permissions saved successfully.',
        'success'
      );
    } catch (error) {
      showMessage(
        document.getElementById('permission-message'),
        error.message,
        'error'
      );
    } finally {
      button.disabled = false;
      button.textContent = 'Save Permissions';
    }
  }
);

document.getElementById('reset-permissions-button').addEventListener(
  'click',
  async () => {
    if (!isSuperadmin() || !currentPermissionTarget) return;

    const select = document.getElementById('permission-user-select');

    await loadSelectedPermissions(select.value);
  }
);

// ==========================================
// LOGOUT
// ==========================================

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
    permissions = [];
    permissionsForEditor = [];
    currentPermissionTarget = null;
    selectedModule = null;

    userSearch.value = '';

    document.getElementById('permission-user-select').innerHTML =
      '<option value="">Select an account</option>';

    document.getElementById('permission-editor').classList.add('hidden');

    showLogin();
  }
);

// ==========================================
// RESTORE EXISTING SESSION
// ==========================================

async function initializeApp() {
  if (resetToken) {
    showResetPassword();
    return;
  }

  try {
    await loadCurrentAccount();

    showDashboard();
  } catch (_error) {
    currentUser = null;
    permissions = [];

    showLogin();
  }
}

initializeApp();
