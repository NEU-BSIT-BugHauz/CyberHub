(() => {
  'use strict';

  let requestSequence = 0;
  let initialized = false;

  function escapeCustomerHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);
  }

  function createCustomerWorkspace() {
    const moduleView = document.getElementById('module-view');

    if (!moduleView || document.getElementById('customer-list-panel')) {
      return;
    }

    const placeholder = moduleView.querySelector('.module-placeholder');

    if (!placeholder) return;

    const placeholderPanel = placeholder.closest('.panel');

    if (placeholderPanel) {
      placeholderPanel.id = 'module-placeholder-panel';
    }

    const panel = document.createElement('section');
    panel.id = 'customer-list-panel';
    panel.className = 'panel hidden';

    panel.innerHTML = `
      <div class="panel-heading customer-heading">
        <div>
          <h3>Customer Records</h3>
          <p class="muted">
            Search and review customer information.
          </p>
        </div>
        <span id="customer-count" class="customer-count">0 customers</span>
      </div>

      <form id="customer-search-form" class="customer-filters">
        <div class="customer-search-field">
          <label for="customer-search">Search customers</label>
          <input
            id="customer-search"
            type="search"
            maxlength="150"
            placeholder="Customer no., name, or address"
            autocomplete="off"
          />
        </div>

        <div class="customer-payment-field">
          <label for="customer-payterm">Payment terms</label>
          <select id="customer-payterm">
            <option value="">All payment terms</option>
            <option value="COD">COD</option>
            <option value="30D">30 Days</option>
            <option value="45D">45 Days</option>
          </select>
        </div>

        <div class="customer-filter-actions">
          <button
            type="submit"
            id="customer-search-button"
            class="btn btn-primary"
          >
            Search
          </button>

          <button
            type="button"
            id="customer-reset-button"
            class="btn btn-outline"
          >
            Reset
          </button>
        </div>
      </form>

      <p
        id="customer-list-message"
        class="message"
        role="status"
        aria-live="polite"
      ></p>

      <div class="table-wrapper">
        <table class="customer-table">
          <thead>
            <tr>
              <th>Customer No.</th>
              <th>Customer Name</th>
              <th>Address</th>
              <th>Payment Terms</th>
            </tr>
          </thead>
          <tbody id="customer-table-body">
            <tr>
              <td colspan="4" class="empty-state">
                Open the Customer module to load records.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    if (placeholderPanel) {
      placeholderPanel.insertAdjacentElement('afterend', panel);
    } else {
      moduleView.appendChild(panel);
    }

    document.getElementById('customer-search-form').addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        loadCustomers();
      }
    );

    document.getElementById('customer-reset-button').addEventListener(
      'click',
      () => {
        document.getElementById('customer-search').value = '';
        document.getElementById('customer-payterm').value = '';
        loadCustomers();
      }
    );

    initialized = true;
  }

  function showCustomerMessage(message, type = '') {
    const element = document.getElementById('customer-list-message');

    if (!element) return;

    element.textContent = message;
    element.className = `message ${type}`.trim();
  }

  function showCustomerLoading() {
    const body = document.getElementById('customer-table-body');
    const button = document.getElementById('customer-search-button');

    body.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state">
          Loading customer records...
        </td>
      </tr>
    `;

    button.disabled = true;
    button.textContent = 'Searching...';

    showCustomerMessage('');
  }

  function renderCustomers(customers) {
    const body = document.getElementById('customer-table-body');
    const count = document.getElementById('customer-count');

    count.textContent =
      `${customers.length} ${customers.length === 1 ? 'customer' : 'customers'}`;

    if (customers.length === 0) {
      body.innerHTML = `
        <tr>
          <td colspan="4" class="empty-state">
            No matching customer records found.
          </td>
        </tr>
      `;
      return;
    }

    body.innerHTML = customers.map((customer) => `
      <tr>
        <td class="customer-number">
          ${escapeCustomerHtml(customer.custno)}
        </td>
        <td class="customer-name">
          ${escapeCustomerHtml(customer.custname)}
        </td>
        <td class="customer-address">
          ${escapeCustomerHtml(customer.address || '—')}
        </td>
        <td>
          <span class="customer-payment-badge">
            ${escapeCustomerHtml(customer.payterm)}
          </span>
        </td>
      </tr>
    `).join('');
  }

  async function loadCustomers() {
    if (!initialized) return;

    const body = document.getElementById('customer-table-body');
    const button = document.getElementById('customer-search-button');

    const search = document.getElementById('customer-search').value.trim();
    const payterm = document.getElementById('customer-payterm').value;

    const params = new URLSearchParams();

    if (search) params.set('search', search);
    if (payterm) params.set('payterm', payterm);

    const requestId = ++requestSequence;

    showCustomerLoading();

    try {
      const query = params.toString();
      const endpoint = `/api/customers${query ? `?${query}` : ''}`;

      const data = await apiRequest(endpoint);

      if (requestId !== requestSequence) return;

      if (!Array.isArray(data.customers)) {
        throw new Error('The server returned an invalid customer list.');
      }

      renderCustomers(data.customers);
    } catch (error) {
      if (requestId !== requestSequence) return;

      body.innerHTML = `
        <tr>
          <td colspan="4" class="empty-state">
            Unable to retrieve customer records.
          </td>
        </tr>
      `;

      if (error.message.includes('403')) {
        showCustomerMessage(
          'Access denied. You do not have permission to view Customer records.',
          'error'
        );
      } else if (error.message.includes('401')) {
        showCustomerMessage(
          'Your session has expired. Please sign in again.',
          'error'
        );
      } else {
        showCustomerMessage(error.message, 'error');
      }
    } finally {
      if (requestId === requestSequence) {
        button.disabled = false;
        button.textContent = 'Search';
      }
    }
  }

  function updateCustomerWorkspace() {
    const moduleView = document.getElementById('module-view');
    const moduleTitle = document.getElementById('module-title');

    if (!moduleView || !moduleTitle) return;

    createCustomerWorkspace();

    if (!initialized) return;

    const isCustomerModule =
      !moduleView.classList.contains('hidden') &&
      moduleTitle.textContent.trim() === 'Customer';

    const customerPanel = document.getElementById('customer-list-panel');
    const placeholderPanel = document.getElementById(
      'module-placeholder-panel'
    );

    customerPanel.classList.toggle('hidden', !isCustomerModule);

    if (placeholderPanel) {
      placeholderPanel.classList.toggle('hidden', isCustomerModule);
    }

    if (isCustomerModule) {
      loadCustomers();
    }
  }

  function initializeCustomerModule() {
    const moduleView = document.getElementById('module-view');

    if (!moduleView) return;

    const observer = new MutationObserver(() => {
      updateCustomerWorkspace();
    });

    observer.observe(moduleView, {
      attributes: true,
      attributeFilter: ['class'],
    });

    const title = document.getElementById('module-title');

    if (title) {
      const titleObserver = new MutationObserver(() => {
        updateCustomerWorkspace();
      });

      titleObserver.observe(title, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }

    createCustomerWorkspace();
    updateCustomerWorkspace();
  }

  initializeCustomerModule();
})();