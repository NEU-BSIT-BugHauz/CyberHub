(() => {
  'use strict';

  let initialized = false;
  let wasVisible = false;
  let requestSequence = 0;
  let productRows = [];
  let editingCode = null;
  let saving = false;
  let changingStatus = false;
  let priceProductCode = null;
  let priceProductName = '';
  let priceRows = [];
  let priceRequestSequence = 0;
  let editingPriceDate = null;
  let savingPrice = false;
  let changingPriceStatus = false;

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

  function getProductRights() {
    return getModulePermission('Product');
  }

  function createProductWorkspace() {
    const moduleView = document.getElementById('module-view');
    if (!moduleView || document.getElementById('product-list-panel')) return;

    // Keep the Product workspace inside the existing module placeholder panel;
    // Customer has a separate panel managed by its own observer.
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
          <p class="muted">Search, manage, and restore products.</p>
        </div>
        <span id="product-count" class="product-count">0 products</span>
        <button id="product-add" type="button" class="btn btn-primary hidden">Add Product</button>
      </div>

      <form id="product-search-form" class="product-filters">
        <div class="product-search-field">
          <label for="product-search">Search products</label>
          <input id="product-search" type="search" maxlength="150"
                 placeholder="Product code or description" autocomplete="off" />
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
        <div id="product-status-field" class="product-status-field hidden">
          <label for="product-status">Record status</label>
          <select id="product-status">
            <option value="active">Active products</option>
            <option value="deleted">Deleted products</option>
          </select>
        </div>
        <div class="product-filter-actions">
          <button id="product-search-button" type="submit" class="btn btn-primary">Search</button>
          <button id="product-reset-button" type="button" class="btn btn-outline">Reset</button>
        </div>
      </form>

      <form id="product-editor" class="product-editor hidden">
        <h3 id="product-editor-title">Add Product</h3>
        <div class="product-editor-grid">
          <label for="product-code">Product code
            <input id="product-code" type="text" maxlength="6" required
                   pattern="[A-Za-z0-9_-]{1,6}" autocomplete="off" />
          </label>
          <label for="product-description">Description
            <input id="product-description" type="text" maxlength="30" required />
          </label>
          <label for="product-editor-unit">Unit
            <select id="product-editor-unit" required>
              <option value="pc">Piece (pc)</option>
              <option value="ea">Each (ea)</option>
              <option value="mtr">Meter (mtr)</option>
              <option value="pkg">Package (pkg)</option>
              <option value="ltr">Liter (ltr)</option>
            </select>
          </label>
        </div>
        <div class="product-editor-actions">
          <button id="product-save" type="submit" class="btn btn-primary">Save Product</button>
          <button id="product-cancel" type="button" class="btn btn-outline">Cancel</button>
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
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody id="product-table-body">
            <tr><td colspan="4" class="empty-state">Open the Product module to load records.</td></tr>
          </tbody>
        </table>
      </div>

      <section id="product-prices-panel" class="product-prices-panel hidden" aria-label="Product price history">
        <div class="product-price-heading">
          <div>
            <h3 id="product-prices-title">Price History</h3>
            <p class="muted">Prices by effective date. Earlier prices remain in history.</p>
          </div>
          <button id="product-prices-close" type="button" class="btn btn-outline">Close History</button>
        </div>
        <div class="product-price-toolbar">
          <span id="product-price-count" class="product-count">0 prices</span>
          <div id="product-price-status-field" class="hidden">
            <label for="product-price-status">Price status</label>
            <select id="product-price-status">
              <option value="active">Active prices</option>
              <option value="deleted">Deleted prices</option>
            </select>
          </div>
          <button id="product-price-add" type="button" class="btn btn-primary hidden">Add Price</button>
        </div>

        <form id="product-price-editor" class="product-editor hidden">
          <h4 id="product-price-editor-title">Add Price</h4>
          <div class="product-editor-grid">
            <label for="product-price-date">Effective date
              <input id="product-price-date" type="date" required />
            </label>
            <label for="product-price-amount">Unit price
              <input id="product-price-amount" type="number" min="0.01" max="99999999.99"
                     step="0.01" placeholder="0.00" required />
            </label>
          </div>
          <div class="product-editor-actions">
            <button id="product-price-save" type="submit" class="btn btn-primary">Save Price</button>
            <button id="product-price-cancel" type="button" class="btn btn-outline">Cancel</button>
          </div>
        </form>

        <p id="product-price-message" class="message" role="status" aria-live="polite"></p>
        <div class="table-wrapper">
          <table class="product-table">
            <thead>
              <tr>
                <th scope="col">Effective Date</th>
                <th scope="col">Unit Price</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody id="product-prices-body">
              <tr><td colspan="3" class="empty-state">Select an active product to view prices.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    `;

    placeholderPanel.appendChild(workspace);

    document.getElementById('product-search-form').addEventListener('submit', (event) => {
      event.preventDefault();
      loadProducts();
    });

    document.getElementById('product-reset-button').addEventListener('click', () => {
      document.getElementById('product-search').value = '';
      document.getElementById('product-unit').value = '';
      document.getElementById('product-status').value = 'active';
      updateProductActions();
      loadProducts();
    });

    document.getElementById('product-status').addEventListener('change', () => {
      if (!saving) closeProductEditor();
      updateProductActions();
      loadProducts();
    });

    document.getElementById('product-add').addEventListener('click', () => openProductEditor());
    document.getElementById('product-cancel').addEventListener('click', closeProductEditor);
    document.getElementById('product-editor').addEventListener('submit', saveProduct);
    document.getElementById('product-table-body').addEventListener('click', (event) => {
      const button = event.target.closest('[data-product-action]');
      if (!button || saving || changingStatus) return;
      const index = Number(button.dataset.productIndex);
      if (!Number.isInteger(index) || !productRows[index]) return;

      const product = productRows[index];
      const action = button.dataset.productAction;
      const rights = getProductRights();
      if (action === 'prices' && rights.can_view && !product.is_deleted) {
        openProductPrices(product);
      } else if (action === 'edit' && rights.can_edit && !product.is_deleted) {
        openProductEditor(product);
      } else if (action === 'delete' && rights.can_delete && !product.is_deleted) {
        changeProductStatus(product, 'delete', button);
      } else if (action === 'restore' && rights.can_delete && product.is_deleted) {
        changeProductStatus(product, 'restore', button);
      }
    });

    document.getElementById('product-prices-close').addEventListener('click', closeProductPrices);
    document.getElementById('product-price-status').addEventListener('change', () => {
      closePriceEditor();
      updatePriceActions();
      loadProductPrices();
    });
    document.getElementById('product-price-add').addEventListener('click', () => openPriceEditor());
    document.getElementById('product-price-cancel').addEventListener('click', closePriceEditor);
    document.getElementById('product-price-editor').addEventListener('submit', savePrice);
    document.getElementById('product-prices-body').addEventListener('click', (event) => {
      const button = event.target.closest('[data-price-action]');
      if (!button || savingPrice || changingPriceStatus) return;
      const index = Number(button.dataset.priceIndex);
      if (!Number.isInteger(index) || !priceRows[index]) return;
      const price = priceRows[index];
      const action = button.dataset.priceAction;
      const rights = getProductRights();
      if (action === 'edit' && rights.can_edit && !price.is_deleted) {
        openPriceEditor(price);
      } else if (action === 'delete' && rights.can_delete && !price.is_deleted) {
        changePriceStatus(price, 'delete', button);
      } else if (action === 'restore' && rights.can_delete && price.is_deleted) {
        changePriceStatus(price, 'restore', button);
      }
    });

    initialized = true;
  }

  function updateProductActions() {
    if (!initialized) return;
    const moduleView = document.getElementById('module-view');
    const isProductModule = !moduleView.classList.contains('hidden') &&
      document.getElementById('module-title').textContent.trim() === 'Product';
    const rights = getProductRights();
    const status = document.getElementById('product-status');
    const statusField = document.getElementById('product-status-field');

    statusField.classList.toggle('hidden', !isProductModule || !rights.can_delete);
    if (!rights.can_delete) status.value = 'active';

    const viewingDeleted = rights.can_delete && status.value === 'deleted';
    document.getElementById('product-add').classList.toggle(
      'hidden', !isProductModule || !rights.can_create || viewingDeleted
    );
    updatePriceActions();
  }

  function renderProducts(products) {
    const body = document.getElementById('product-table-body');
    const count = document.getElementById('product-count');
    const rights = getProductRights();
    const viewingDeleted = rights.can_delete &&
      document.getElementById('product-status').value === 'deleted';
    productRows = products;
    count.textContent = `${products.length} ${viewingDeleted ? 'deleted ' : ''}${products.length === 1 ? 'product' : 'products'}`;

    if (products.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="empty-state">No matching product records found.</td></tr>';
      return;
    }

    body.innerHTML = products.map((product, index) => {
      const label = UNIT_LABELS[product.unit] || product.unit || '—';
      const actions = [];

      if (viewingDeleted) {
        if (rights.can_delete && product.is_deleted) {
          actions.push(`<button type="button" class="btn btn-outline" data-product-action="restore" data-product-index="${index}">Restore</button>`);
        }
      } else if (!product.is_deleted) {
        if (rights.can_view) {
          actions.push(`<button type="button" class="btn btn-outline" data-product-action="prices" data-product-index="${index}">Price History</button>`);
        }
        if (rights.can_edit) {
          actions.push(`<button type="button" class="btn btn-outline" data-product-action="edit" data-product-index="${index}">Edit</button>`);
        }
        if (rights.can_delete) {
          actions.push(`<button type="button" class="btn btn-outline product-delete-button" data-product-action="delete" data-product-index="${index}">Delete</button>`);
        }
      }

      return `
        <tr>
          <td class="product-code">${escapeProductHtml(product.prodcode)}</td>
          <td>${escapeProductHtml(product.description || '—')}</td>
          <td><span class="product-unit-badge">${escapeProductHtml(label)}</span></td>
          <td><div class="product-row-actions">${actions.join(' ') || '—'}</div></td>
        </tr>
      `;
    }).join('');
  }

  async function loadProducts() {
    if (!initialized) return false;
    closeProductPrices();

    const body = document.getElementById('product-table-body');
    const button = document.getElementById('product-search-button');
    const search = document.getElementById('product-search').value.trim();
    const unit = document.getElementById('product-unit').value;
    const rights = getProductRights();
    const status = rights.can_delete ? document.getElementById('product-status').value : 'active';
    const params = new URLSearchParams();

    if (search) params.set('search', search);
    if (unit) params.set('unit', unit);
    if (status === 'deleted') params.set('status', 'deleted');

    const requestId = ++requestSequence;
    body.innerHTML = '<tr><td colspan="4" class="empty-state">Loading product records...</td></tr>';
    button.disabled = true;
    button.textContent = 'Searching...';
    showProductMessage('');

    try {
      const query = params.toString();
      const response = await apiRequest(`/api/products${query ? `?${query}` : ''}`);
      if (requestId !== requestSequence) return false;

      if (!Array.isArray(response.products)) {
        throw new Error('The server returned an invalid product list.');
      }

      renderProducts(response.products);
      return true;
    } catch (error) {
      if (requestId !== requestSequence) return false;

      body.innerHTML = '<tr><td colspan="4" class="empty-state">Unable to retrieve product records.</td></tr>';
      document.getElementById('product-count').textContent = '0 products';
      if (error.status === 403) {
        showProductMessage('Access denied. You do not have permission to view Product records.', 'error');
      } else if (error.status === 401) {
        showProductMessage('Your session has expired. Please sign in again.', 'error');
      } else {
        showProductMessage(error.message || 'Unable to load products.', 'error');
      }
      return false;
    } finally {
      if (requestId === requestSequence) {
        button.disabled = false;
        button.textContent = 'Search';
      }
    }
  }

  function openProductEditor(product = null) {
    const rights = getProductRights();
    if (saving || changingStatus || (product ? (!rights.can_edit || product.is_deleted) : !rights.can_create)) return;

    editingCode = product ? product.prodcode : null;
    document.getElementById('product-editor-title').textContent = product ? 'Edit Product' : 'Add Product';
    const codeInput = document.getElementById('product-code');
    codeInput.value = product?.prodcode || '';
    codeInput.readOnly = Boolean(product);
    document.getElementById('product-description').value = product?.description || '';
    document.getElementById('product-editor-unit').value = product?.unit || 'ea';
    document.getElementById('product-editor').classList.remove('hidden');
    showProductMessage('');
    (product ? document.getElementById('product-description') : codeInput).focus();
  }

  function closeProductEditor() {
    if (saving) return;
    editingCode = null;
    document.getElementById('product-editor')?.classList.add('hidden');
  }

  async function saveProduct(event) {
    event.preventDefault();
    if (saving) return;

    const editing = editingCode !== null;
    const rights = getProductRights();
    if (changingStatus || (editing ? !rights.can_edit : !rights.can_create)) return;

    const button = document.getElementById('product-save');
    const payload = {
      prodcode: document.getElementById('product-code').value.trim(),
      description: document.getElementById('product-description').value.trim(),
      unit: document.getElementById('product-editor-unit').value,
    };
    saving = true;
    button.disabled = true;
    button.textContent = 'Saving...';

    try {
      await apiRequest(
        editing ? `/api/products/${encodeURIComponent(editingCode)}` : '/api/products',
        { method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload) }
      );
      saving = false;
      editingCode = null;
      document.getElementById('product-editor').classList.add('hidden');
      const loaded = await loadProducts();
      if (loaded) {
        showProductMessage(editing ? 'Product updated successfully.' : 'Product created successfully.', 'success');
      }
    } catch (error) {
      showProductMessage(
        error.status === 403 ? 'Access denied: insufficient Product permissions.' : (error.message || 'Unable to save product.'),
        'error'
      );
    } finally {
      saving = false;
      button.disabled = false;
      button.textContent = 'Save Product';
    }
  }

  async function changeProductStatus(product, action, button) {
    if (saving || changingStatus || !getProductRights().can_delete) return;

    const deleting = action === 'delete';
    if (deleting && !window.confirm(
      `Soft-delete product ${product.prodcode} (${product.description || 'No description'})? You can restore it later.`
    )) {
      return;
    }

    changingStatus = true;
    button.disabled = true;
    try {
      const endpoint = `/api/products/${encodeURIComponent(product.prodcode)}`;
      await apiRequest(deleting ? endpoint : `${endpoint}/restore`, {
        method: deleting ? 'DELETE' : 'PATCH',
      });
      if (!saving) closeProductEditor();
      if (await loadProducts()) {
        showProductMessage(
          deleting
            ? 'Product deleted successfully. You can restore it from Deleted products.'
            : 'Product restored successfully.',
          'success'
        );
      }
    } catch (error) {
      showProductMessage(
        error.status === 403
          ? 'Access denied: Product delete permission required.'
          : (error.message || 'Unable to change product status.'),
        'error'
      );
    } finally {
      changingStatus = false;
      button.disabled = false;
    }
  }

  // S2-DEV-07: Price history remains separate from product details.
  function showPriceMessage(message, type = '') {
    const element = document.getElementById('product-price-message');
    if (!element) return;
    element.textContent = message;
    element.className = `message ${type}`.trim();
  }

  function priceDate(value) {
    return String(value ?? '').slice(0, 10);
  }

  function formatPrice(value) {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : String(value ?? '—');
  }

  function updatePriceActions() {
    const panel = document.getElementById('product-prices-panel');
    if (!panel) return;
    const rights = getProductRights();
    const status = document.getElementById('product-price-status');
    document.getElementById('product-price-status-field').classList.toggle('hidden', !rights.can_delete);
    if (!rights.can_delete) status.value = 'active';
    const viewingDeleted = rights.can_delete && status.value === 'deleted';
    document.getElementById('product-price-add').classList.toggle(
      'hidden', !priceProductCode || !rights.can_create || viewingDeleted
    );
  }

  function closePriceEditor() {
    if (savingPrice) return;
    editingPriceDate = null;
    document.getElementById('product-price-editor')?.classList.add('hidden');
  }

  function closeProductPrices() {
    priceRequestSequence += 1;
    priceProductCode = null;
    priceProductName = '';
    priceRows = [];
    closePriceEditor();
    document.getElementById('product-prices-panel')?.classList.add('hidden');
    updatePriceActions();
  }

  function openProductPrices(product) {
    if (savingPrice || changingPriceStatus || !getProductRights().can_view || product.is_deleted) return;
    priceRequestSequence += 1;
    priceProductCode = product.prodcode;
    priceProductName = product.description || '';
    closePriceEditor();
    document.getElementById('product-price-status').value = 'active';
    document.getElementById('product-prices-title').textContent =
      `Price History — ${priceProductCode}${priceProductName ? `: ${priceProductName}` : ''}`;
    document.getElementById('product-prices-panel').classList.remove('hidden');
    updatePriceActions();
    loadProductPrices();
    document.getElementById('product-prices-panel').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function renderProductPrices(prices) {
    const body = document.getElementById('product-prices-body');
    const rights = getProductRights();
    const deleted = rights.can_delete && document.getElementById('product-price-status').value === 'deleted';
    priceRows = prices;
    document.getElementById('product-price-count').textContent =
      `${prices.length} ${deleted ? 'deleted ' : ''}${prices.length === 1 ? 'price' : 'prices'}`;
    if (!prices.length) {
      body.innerHTML = '<tr><td colspan="3" class="empty-state">No price records for this product.</td></tr>';
      return;
    }
    body.innerHTML = prices.map((price, index) => {
      const actions = [];
      if (deleted) {
        if (rights.can_delete && price.is_deleted) {
          actions.push(`<button type="button" class="btn btn-outline" data-price-action="restore" data-price-index="${index}">Restore</button>`);
        }
      } else if (!price.is_deleted) {
        if (rights.can_edit) {
          actions.push(`<button type="button" class="btn btn-outline" data-price-action="edit" data-price-index="${index}">Edit</button>`);
        }
        if (rights.can_delete) {
          actions.push(`<button type="button" class="btn btn-outline product-delete-button" data-price-action="delete" data-price-index="${index}">Delete</button>`);
        }
      }
      return `<tr>
        <td>${escapeProductHtml(priceDate(price.effdate))}</td>
        <td class="product-price-number">${escapeProductHtml(formatPrice(price.unitprice))}</td>
        <td><div class="product-row-actions">${actions.join(' ') || '—'}</div></td>
      </tr>`;
    }).join('');
  }

  async function loadProductPrices() {
    if (!priceProductCode) return false;
    const code = priceProductCode;
    const reqId = ++priceRequestSequence;
    const button = document.getElementById('product-price-add');
    const body = document.getElementById('product-prices-body');
    const rights = getProductRights();
    const status = rights.can_delete ? document.getElementById('product-price-status').value : 'active';
    const suffix = status === 'deleted' ? '?status=deleted' : '';
    body.innerHTML = '<tr><td colspan="3" class="empty-state">Loading price history...</td></tr>';
    button.disabled = true;
    showPriceMessage('');
    try {
      const result = await apiRequest(`/api/products/${encodeURIComponent(code)}/prices${suffix}`);
      if (reqId !== priceRequestSequence) return false;
      if (!Array.isArray(result.prices)) throw new Error('Invalid price history returned by the server.');
      renderProductPrices(result.prices);
      return true;
    } catch (error) {
      if (reqId !== priceRequestSequence) return false;
      body.innerHTML = '<tr><td colspan="3" class="empty-state">Unable to load price history.</td></tr>';
      document.getElementById('product-price-count').textContent = '0 prices';
      showPriceMessage(error.status === 403
        ? 'Access denied: insufficient Product permissions.'
        : error.status === 401
          ? 'Your session has expired. Please sign in again.'
          : (error.message || 'Unable to load price history.'), 'error');
      return false;
    } finally {
      if (reqId === priceRequestSequence) button.disabled = false;
    }
  }

  function openPriceEditor(price = null) {
    const rights = getProductRights();
    if (!priceProductCode || savingPrice || changingPriceStatus ||
        (price ? (!rights.can_edit || price.is_deleted) : !rights.can_create)) return;
    editingPriceDate = price ? priceDate(price.effdate) : null;
    const dateInput = document.getElementById('product-price-date');
    dateInput.value = editingPriceDate || '';
    dateInput.disabled = Boolean(price);
    document.getElementById('product-price-amount').value = price?.unitprice || '';
    document.getElementById('product-price-editor-title').textContent = price ? 'Edit Price' : 'Add Price';
    document.getElementById('product-price-editor').classList.remove('hidden');
    showPriceMessage('');
    (price ? document.getElementById('product-price-amount') : dateInput).focus();
  }

  async function savePrice(event) {
    event.preventDefault();
    const rights = getProductRights();
    const editing = editingPriceDate !== null;
    if (!priceProductCode || savingPrice || changingPriceStatus ||
        (editing ? !rights.can_edit : !rights.can_create)) return;
    const code = priceProductCode;
    const date = editingPriceDate || document.getElementById('product-price-date').value;
    const amount = document.getElementById('product-price-amount').value.trim();
    const button = document.getElementById('product-price-save');
    savingPrice = true;
    button.disabled = true;
    button.textContent = 'Saving...';
    try {
      const endpoint = `/api/products/${encodeURIComponent(code)}/prices`;
      await apiRequest(editing ? `${endpoint}/${encodeURIComponent(date)}` : endpoint, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(editing ? { unitprice: amount } : { effdate: date, unitprice: amount }),
      });
      savingPrice = false;
      editingPriceDate = null;
      document.getElementById('product-price-editor').classList.add('hidden');
      if (priceProductCode === code && await loadProductPrices()) {
        showPriceMessage(editing ? 'Price updated successfully.' : 'Price added successfully.', 'success');
      }
    } catch (error) {
      showPriceMessage(error.status === 403
        ? 'Access denied: insufficient Product permissions.'
        : (error.message || 'Unable to save price.'), 'error');
    } finally {
      savingPrice = false;
      button.disabled = false;
      button.textContent = 'Save Price';
    }
  }

  async function changePriceStatus(price, action, button) {
    if (!priceProductCode || savingPrice || changingPriceStatus || !getProductRights().can_delete) return;
    const deleting = action === 'delete';
    if (deleting && !window.confirm(
      `Soft-delete the price effective ${priceDate(price.effdate)} for ${priceProductCode}? You can restore it later.`
    )) return;
    const code = priceProductCode;
    changingPriceStatus = true;
    button.disabled = true;
    try {
      const endpoint = `/api/products/${encodeURIComponent(code)}/prices/${encodeURIComponent(priceDate(price.effdate))}`;
      await apiRequest(deleting ? endpoint : `${endpoint}/restore`, {
        method: deleting ? 'DELETE' : 'PATCH',
      });
      closePriceEditor();
      if (priceProductCode === code && await loadProductPrices()) {
        showPriceMessage(deleting
          ? 'Price deleted. You can restore it under Deleted prices.'
          : 'Price restored successfully.', 'success');
      }
    } catch (error) {
      showPriceMessage(error.status === 403
        ? 'Access denied: Product delete permission required.'
        : (error.message || 'Unable to update price status.'), 'error');
    } finally {
      changingPriceStatus = false;
      button.disabled = false;
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

    updateProductActions();

    if (isProductModule && !wasVisible) loadProducts();
    if (!isProductModule && wasVisible) {
      requestSequence += 1;
      const searchButton = document.getElementById('product-search-button');
      searchButton.disabled = false;
      searchButton.textContent = 'Search';
      if (!saving) closeProductEditor();
      closeProductPrices();
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
