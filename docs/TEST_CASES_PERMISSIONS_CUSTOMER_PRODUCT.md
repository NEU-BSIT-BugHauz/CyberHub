\# CyberHub Per-Right Permission Test Cases: Customer and Product



Related Issue: #61

Scope: Per-right permission enforcement (`can\_view`, `can\_create`, `can\_edit`, `can\_delete`), role checks, list-status guards, and session checks across Customer (`routes/customers.js`, `routes/customerAccountsAdmin.js`), Product (`routes/products.js`), and permissions administration (`routes/permissions.js`).



\## 1. Customer Module Per-Right Permissions

\- \*\*TC-PRM-CUS-01 (`Customer` `can\_view`):\*\* User with `Customer` `can\_view` can list/view active customers (`GET /`), while a user lacking `can\_view` is denied access.

\- \*\*TC-PRM-CUS-02 (`Customer` `can\_create`):\*\* User with `Customer` `can\_create` can create a customer (`POST /`), while a user without `can\_create` is denied.

\- \*\*TC-PRM-CUS-03 (`Customer` `can\_edit`):\*\* User with `Customer` `can\_edit` can update an existing customer (`PUT /:custno`), while a user without `can\_edit` is denied.

\- \*\*TC-PRM-CUS-04 (`Customer` `can\_delete`):\*\* User with `Customer` `can\_delete` can soft-delete (`DELETE /:custno`), restore (`PATCH /:custno/restore`), and access restricted status views, while a user without `can\_delete` is denied.



\## 2. Product Module Per-Right Permissions

\- \*\*TC-PRM-PRD-01 (`Product` `can\_view`):\*\* User with `Product` `can\_view` can view products (`GET /`) and read-only current price (`GET /:prodcode/current-price`), while a user lacking `can\_view` is denied.

\- \*\*TC-PRM-PRD-02 (`Product` `can\_create`):\*\* User with `Product` `can\_create` can create a product (`POST /`), while a user without `can\_create` is denied.

\- \*\*TC-PRM-PRD-03 (`Product` `can\_edit`):\*\* User with `Product` `can\_edit` can update a product (`PUT /:prodcode`), while a user without `can\_edit` is denied.

\- \*\*TC-PRM-PRD-04 (`Product` `can\_delete`):\*\* User with `Product` `can\_delete` can delete a product (`DELETE /:prodcode`), while a user without `can\_delete` is denied.



\## 3. Role, Admin \& Session Boundary Guards

\- \*\*TC-PRM-ROL-05 (Unauthenticated \& Inactive Session Guard):\*\* Unauthenticated requests or inactive/non-customer sessions on protected employee or customer routes are rejected cleanly.

\- \*\*TC-PRM-ROL-06 (Admin / Superadmin \& Permission Matrix Enforcement):\*\* Non-permitted roles and unauthorized permission updates (`can\_view`, `can\_create`, `can\_edit`, `can\_delete` or restricted `superadmin` actions) are blocked cleanly.

