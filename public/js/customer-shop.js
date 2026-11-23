'use strict';

(() => {
  if (document.body.dataset.customerPage !== 'shop') return;

  const form = document.getElementById('customer-shop-filters');
  const searchInput = document.getElementById('shop-search');
  const unitInput = document.getElementById('shop-unit');
  const clearButton = document.getElementById('shop-clear-button');
  const searchButton = document.getElementById('shop-search-button');
  const productsContainer = document.getElementById('shop-products');
  const message = document.getElementById('shop-message');
  const pesos = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
  let requestNumber = 0;

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value == null ? '' : String(value);
    return node;
  }

  function renderProducts(products) {
    productsContainer.replaceChildren();
    for (const product of products) {
      const card = element('article', 'customer-shop-product');
      card.appendChild(element('div', 'customer-shop-code', product.prodcode));
      card.appendChild(element('h2', '', product.description || 'Untitled product'));
      card.appendChild(element('p', 'customer-shop-unit', `Unit: ${product.unit || 'Not specified'}`));

      const priceNumber = product.current_price === null || product.current_price === undefined
        ? null : Number(product.current_price);
      const hasPrice = Number.isFinite(priceNumber) && priceNumber > 0;
      card.appendChild(element('div', hasPrice ? 'customer-shop-price' : 'customer-shop-price not-priced',
        hasPrice ? pesos.format(priceNumber) : 'Price unavailable'));
      if (hasPrice && product.current_price_effdate) {
        card.appendChild(element('small', 'customer-shop-price-date',
          `Price effective ${product.current_price_effdate}`));
      }
      productsContainer.appendChild(card);
    }
  }

  async function loadProducts() {
    const currentRequest = ++requestNumber;
    searchButton.disabled = true;
    message.className = 'customer-shop-message';
    message.textContent = 'Loading catalog…';
    productsContainer.replaceChildren();

    const params = new URLSearchParams({
      search: searchInput.value.trim(),
      unit: unitInput.value,
    });

    try {
      const response = await fetch(`/api/customer-shop/products?${params}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => ({}));
      if (currentRequest !== requestNumber) return;
      if (response.status === 401) {
        window.location.replace('/customer/login');
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Unable to load the product catalog.');
      const products = Array.isArray(data.products) ? data.products : [];
      renderProducts(products);
      message.textContent = products.length
        ? `Showing ${products.length} product${products.length === 1 ? '' : 's'}.`
        : 'No matching products found. Try another search or unit.';
    } catch (error) {
      if (currentRequest !== requestNumber) return;
      message.className = 'customer-shop-message error';
      message.textContent = error.message || 'Unable to load the product catalog.';
    } finally {
      if (currentRequest === requestNumber) searchButton.disabled = false;
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    loadProducts();
  });
  clearButton.addEventListener('click', () => {
    searchInput.value = '';
    unitInput.value = '';
    loadProducts();
  });

  loadProducts();
})();
