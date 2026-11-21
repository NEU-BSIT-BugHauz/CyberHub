(() => {
  'use strict';

  let initialized = false;
  let wasVisible = false;
  let requestSequence = 0;

  const UNIT_LABELS = Object.freeze({
    pc: 'Piece (pc)',
    ea: 'Each (ea)',
    mtr: 'Meter (mtr)',
    pkg: 'Package (pkg)',
    ltr: 'Liter (ltr)',
  });

  function escapeProductHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);
  }

  function showProductMessage(message, type = '') {
    const element = document.getElementById('product-list-message');
    if (!element) return;

    element.textContent = message;
    element.className = `message ${type}`.trim();
  }

  function createProductWorkspace() {
    const moduleView = document.getElementById('module-view');
    if (!moduleView || document.getElementById('product-list-panel')) return;

    // Share the existing placeholder panel with the Customer module rather
    // than competing with its MutationObserver over parent visibility.
    const placeholder = moduleView.querySelector('.module-placeholder');
    const placeholderPanel = placeholder?.closest('.panel');
    if (!placeholderPanel) return;

    const workspace = document.createElement('div');
    workspace.id = 'product-list-panel';
    workspace.className = 'product-workspace hidden';
    workspace.innerHTML = `
      <div class="panel-heading product-heading">
        <div>
          <h3>Product Records</h3>
          <p class="muted">Search and review active products.</p>
        </div>
        <span id="product-count" class="product-count">0 products</span>
      </div>

      <form id="product-search-form" class="product-filters">
        <div class="product-search-field">
          <label for="product-search">Search products</label>
          <input
            id="product-search"
            type="search"
            maxlength="150"
            placeholder="Product code or description"
            autocomplete="off"
          />
        </div>

        <div class="product-unit-field">
          <label for="product-unit">Unit</label>
          <select id="product-unit">
            <option value="">All units</option>
            <option value="pc">Piece (pc)</option>
            <option value="ea">Each (ea)</option>
            <option value="mtr">Meter (mtr)</option>
            <option value="pkg">Package (pkg)</option>
            <option value="ltr">Liter (ltr)</option>
          </select>
        </div>

        <div class="product-filter-actions">
          <button id="product-search-button" type="submit" class="btn btn-primary">Search</button>
          <button id="product-reset-button" type="button" class="btn btn-outline">Reset</button>
        </div>
      </form>

      <p id="product-list-message" class="message" role="status" aria-live="polite"></p>

      <div class="table-wrapper">
        <table class="product-table">
          <thead>
            <tr>
              <th scope="col">Product Code</th>
              <th scope="col">Description</th>
              <th scope="col">Unit</th>
            </tr>
          </thead>
          <tbody id="product-table-body">
            <tr><td colspan="3" class="empty-state">Open the Product module to load records.</td></tr>
          </tbody>
        </table>
      </div>
    `;

    placeholderPanel.appendChild(workspace);

    document.getElementById('product-search-form').addEventListener('submit', (event) => {
      event.preventDefault();
      loadProducts();
    });

    document.getElementById('product-reset-button').addEventListener('click', () => {
      document.getElementById('product-search').value = '';
      document.getElementById('product-unit').value = '';
      loadProducts();
    });

    initialized = true;
  }

  function renderProducts(products) {
    const body = document.getElementById('product-table-body');
    const count = document.getElementById('product-count');

    count.textContent = `${products.length} ${products.length === 1 ? 'product' : 'products'}`;

    if (products.length === 0) {
      body.innerHTML = '<tr><td colspan="3" class="empty-state">No matching product records found.</td></tr>';
      return;
    }

    body.innerHTML = products.map((product) => {
      const label = UNIT_LABELS[product.unit] || product.unit || '—';
      return `
        <tr>
          <td class="product-code">${escapeProductHtml(product.prodcode)}</td>
          <td>${escapeProductHtml(product.description || '—')}</td>
          <td><span class="product-unit-badge">${escapeProductHtml(label)}</span></td>
        </tr>
      `;
    }).join('');
  }

  async function loadProducts() {
    if (!initialized) return;

    const body = document.getElementById('product-table-body');
    const button = document.getElementById('product-search-button');
    const search = document.getElementById('product-search').value.trim();
    const unit = document.getElementById('product-unit').value;
    const params = new URLSearchParams();

    if (search) params.set('search', search);
    if (unit) params.set('unit', unit);

    const requestId = ++requestSequence;

    body.innerHTML = '<tr><td colspan="3" class="empty-state">Loading product records...</td></tr>';
    button.disabled = true;
    button.textContent = 'Searching...';
    showProductMessage('');

    try {
      const query = params.toString();
      const response = await apiRequest(`/api/products${query ? `?${query}` : ''}`);
      if (requestId !== requestSequence) return;

      if (!Array.isArray(response.products)) {
        throw new Error('The server returned an invalid product list.');
      }

      renderProducts(response.products);
    } catch (error) {
      if (requestId !== requestSequence) return;

      body.innerHTML = '<tr><td colspan="3" class="empty-state">Unable to retrieve product records.</td></tr>';
      document.getElementById('product-count').textContent = '0 products';
      if (error.status === 403) {
        showProductMessage('Access denied. You do not have permission to view Product records.', 'error');
      } else if (error.status === 401) {
        showProductMessage('Your session has expired. Please sign in again.', 'error');
      } else {
        showProductMessage(error.message || 'Unable to load products.', 'error');
      }
    } finally {
      if (requestId === requestSequence) {
        button.disabled = false;
        button.textContent = 'Search';
      }
    }
  }

  function updateProductWorkspace() {
    const moduleView = document.getElementById('module-view');
    const title = document.getElementById('module-title');
    if (!moduleView || !title) return;

    createProductWorkspace();
    if (!initialized) return;

    const isProductModule =
      !moduleView.classList.contains('hidden') &&
      title.textContent.trim() === 'Product';

    const panel = document.getElementById('product-list-panel');
    const placeholder = moduleView.querySelector('.module-placeholder');
    const placeholderHeading = placeholder?.closest('.panel')?.querySelector('.panel-heading');

    panel.classList.toggle('hidden', !isProductModule);
    placeholder?.classList.toggle('hidden', isProductModule);
    placeholderHeading?.classList.toggle('hidden', isProductModule);

    if (isProductModule && !wasVisible) {
      // Navigation permissions are enforced by app.js; the API enforces them again.
      loadProducts();
    }
    if (!isProductModule && wasVisible) {
      // Invalidate delayed requests when navigating away.
      requestSequence += 1;
      const searchButton = document.getElementById('product-search-button');
      searchButton.disabled = false;
      searchButton.textContent = 'Search';
    }

    wasVisible = isProductModule;
  }

  function initializeProductModule() {
    const moduleView = document.getElementById('module-view');
    if (!moduleView) return;

    new MutationObserver(updateProductWorkspace).observe(moduleView, {
      attributes: true,
      attributeFilter: ['class'],
    });

    const title = document.getElementById('module-title');
    if (title) {
      new MutationObserver(updateProductWorkspace).observe(title, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }

    createProductWorkspace();
    updateProductWorkspace();
  }

  initializeProductModule();
})();
