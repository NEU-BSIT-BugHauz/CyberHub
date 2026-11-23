\# CyberHub Customer Module Test Cases



Related Issue: #55

Scope: Customer account administration (`routes/customerAccountsAdmin.js`) and customer authentication/profile flows (`routes/customerAuth.js`), covering creation, validation/duplicates, editing, status changes (`blocked`/`activated`/soft-deleted), and session/role authorization.



\## 1. Customer Account Creation \& Registration

\- \*\*TC-CUS-01 (Admin Creation of Customer Account):\*\* Authorized `superadmin` creates a customer account with valid name (2–150 chars), valid email, and allowed initial password/details; generates customer number, inserts `customer` and `customer\_accounts` records, and returns `201` without exposing password hashes.

\- \*\*TC-CUS-02 (Customer Self-Registration):\*\* Valid registration request (`POST /api/.../register`) with rate limiting active creates customer and account records and returns `201`.

\- \*\*TC-CUS-03 (Invalid Input, Duplicate Email, or Disallowed Role):\*\* Rejects invalid `full\_name` length, invalid/overlong email, invalid registration details, duplicate email (`409`), or non-`superadmin` attempting initial-password customer creation (`403`).



\## 2. Viewing, Editing \& Profile Updates

\- \*\*TC-CUS-04 (List \& View Customer Accounts):\*\* Authorized customer manager views customer accounts joined with customer record details (`custno`, `custname`, email, phone, status).

\- \*\*TC-CUS-05 (Edit Customer Account Details):\*\* Authorized manager updates a valid customer account's `custname`, `email`, and `phone`; changes persist and return `200`.

\- \*\*TC-CUS-06 (Customer Self-Profile \& Session Read):\*\* Authenticated customer (`GET /me`, `PUT /profile`) reads own public account data and updates own profile cleanly.

\- \*\*TC-CUS-07 (Invalid ID or Missing Customer Account):\*\* Invalid account ID returns `400`; non-existent or unlinked customer account returns `404` without mutating records.



\## 3. Status \& Availability Controls

\- \*\*TC-CUS-08 (Block / Activate Customer Account):\*\* Toggling account status updates `customer\_accounts.status` (`blocked` / `activated`) and `updated\_at` cleanly.

\- \*\*TC-CUS-09 (Blocked or Soft-Deleted Login \& Session Guard):\*\* Customer with `status !== 'active'` or `is\_deleted === true` is rejected on login (`403`) and has active session cleared (`401`) on protected customer routes.



\## 4. Authorization \& Access Control

\- \*\*TC-CUS-10 (Unauthenticated or Unauthorized Access):\*\* Unauthenticated customer session (`401`) or unauthorized caller on admin customer routes is denied access.

