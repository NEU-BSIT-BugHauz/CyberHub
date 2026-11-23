\# CyberHub Soft Delete, Restore \& Active Dependency Guard Test Cases



Related Issue: #59

Scope: Soft deletion (`DELETE`), restoration (`PATCH .../restore`), listing active vs. soft-deleted records, reserved identifiers, and guards against acting on soft-deleted or dependent/active records (`routes/customers.js`, `routes/customerAccountsAdmin.js`, `routes/customerAuth.js`, `routes/customerShop.js`).



\## 1. Soft Delete Execution \& Guards

\- \*\*TC-SDR-01 (Soft Delete Active Record):\*\* Authorized user with delete permission deletes an active customer (`DELETE /:custno`); sets `is\_deleted = TRUE`, populates `deleted\_at` and `deleted\_by`, and preserves the record without hard deletion.

\- \*\*TC-SDR-02 (Soft Delete Missing or Already Deleted Record):\*\* Attempting `DELETE /:custno` on a non-existent or already soft-deleted record returns `404` without altering existing audit fields.

\- \*\*TC-SDR-03 (Delete Blocked by Active Children / Dependent Active Records):\*\* Attempting to delete or mutate a parent/linked entity while active child or dependent records (`customer\_accounts` / active dependencies) exist is blocked cleanly without orphaning active records.



\## 2. Restore Execution \& Guards

\- \*\*TC-SDR-04 (Restore Soft-Deleted Record):\*\* Authorized user calls restore (`PATCH /:custno/restore`) on a soft-deleted record (`is\_deleted = TRUE`); clears `is\_deleted = FALSE`, `deleted\_at = NULL`, and `deleted\_by = NULL`, returning the restored record.

\- \*\*TC-SDR-05 (Restore Non-Deleted or Missing Record):\*\* Calling restore on an active or non-existent record (`is\_deleted = FALSE` or not found) is rejected (`404`) without side effects.



\## 3. Reserved Identifiers, Filtering \& Access Guards

\- \*\*TC-SDR-06 (Reserved Identifier on Recreate):\*\* Attempting to recreate a customer with a soft-deleted `custno` is rejected (`409`) and directs restoring the deleted record instead.

\- \*\*TC-SDR-07 (Active vs. Deleted Listing \& Permission Guard):\*\* `GET /api/customers?status=active` returns non-deleted records; viewing `status=deleted` requires `can\_delete` permission and returns `400` on invalid status values.

\- \*\*TC-SDR-08 (Immediate Access Revocation on Soft-Deleted / Inactive Records):\*\* Soft-deleted or non-active accounts lose session/login/shop access immediately (`401`/`403`) and cannot be edited as active records.

