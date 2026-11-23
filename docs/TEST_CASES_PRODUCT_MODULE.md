\# CyberHub Product and Price History Test Cases



Related Issue: #57

Scope: Product management (`routes/products.js`), effective-dated price history (`pricehist`), and product pricing/catalog behavior (`routes/customerShop.js`, `routes/customerShopping.js`), including validation, soft-delete/status rules, and permission enforcement.



\## 1. Product Creation, Viewing \& Editing

\- \*\*TC-PRD-01 (Create Valid Product):\*\* Authorized user with `Product` `can\_create` creates a product with a valid code (`1-6` alphanumeric, underscore, or hyphen characters) and valid fields; product code is normalized cleanly and created without errors.

\- \*\*TC-PRD-02 (List \& View Active Products):\*\* Authorized user with `Product` `can\_view` views active products (`status = active`); invalid status values or invalid product codes return `400`.

\- \*\*TC-PRD-03 (Edit Product Details):\*\* Authorized user with `Product` `can\_edit` updates an existing product's details and saves changes cleanly.

\- \*\*TC-PRD-04 (Invalid Product Code or Payload):\*\* Submitting an invalid product code format or invalid product payload returns `400` without creating or corrupting records.



\## 2. Price History \& Effective Dating

\- \*\*TC-PRD-05 (Latest Effective Price Selection):\*\* Price history (`pricehist`) entries with effective dates (`effdate`) on or before today (Manila time) and `is\_deleted = FALSE` resolve to the latest applicable current price and effective date.

\- \*\*TC-PRD-06 (Future-Dated \& Soft-Deleted Price Entries):\*\* Future-dated prices (`effdate` after today in Manila) and soft-deleted price rows (`is\_deleted = TRUE`) are excluded from current active pricing.

\- \*\*TC-PRD-07 (Missing or Unpriced Product Guard):\*\* Products without a valid active/priced entry (`ph.unitprice > 0` and non-deleted) are rejected when adding to cart (`409`) or blocked at checkout (`409`) if deleted or unpriced.



\## 3. Deleted Products \& Status Filtering

\- \*\*TC-PRD-08 (View Deleted Products Permission):\*\* Viewing deleted products (`status = deleted`) succeeds when the caller holds both `Product` `can\_view` and `can\_delete` permissions, and is denied when missing either permission.



\## 4. Authorization \& Access Control

\- \*\*TC-PRD-09 (Module Permission Enforcement):\*\* Users lacking required `Product` permissions (`can\_view`, `can\_create`, `can\_edit`, `can\_delete`) are denied access on restricted product actions.

\- \*\*TC-PRD-10 (Customer Catalog Read-Only Guard):\*\* Customer sessions on `/products` have read-only access to active catalog items and cannot modify products or prices.

