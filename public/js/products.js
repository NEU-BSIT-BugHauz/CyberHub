(() => {
  'use strict';

  let initialized = false;
  let wasVisible = false;
  let requestSequence = 0;
  let productRows = [];
  let editingCode = null;
  let saving = false;
  let changingStatus = false;

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
      if (action === 'edit' && rights.can_edit && !product.is_deleted) {
        openProductEditor(product);
      } else if (action === 'delete' && rights.can_delete && !product.is_deleted) {
        changeProductStatus(product, 'delete', button);
      } else if (action === 'restore' && rights.can_delete && product.is_deleted) {
        changeProductStatus(product, 'restore', button);
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
