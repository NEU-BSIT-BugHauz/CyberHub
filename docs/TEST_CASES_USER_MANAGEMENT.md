\# CyberHub Sprint 1 User Management Test Cases (S1-TST-03)



Related Issue: #<IssueNumber>

Scope: Employee account management in `User Management` (`+ Add User`, search filter, `Approve`, `Edit`, `Block`/`Unblock`) and customer account administration (`Customer Accounts`), including role/status rules and validation/authorization edge cases.



\## 1. Search and Add User

\- \*\*TC-USR-01 (Search Employee Accounts):\*\* In `User Management` under `Employee Accounts`, enter a matching name, email, or employee ID in the search box; the list filters accurately to matching manageable accounts and clears cleanly when emptied.

\- \*\*TC-USR-02 (Create Valid Employee Account):\*\* Click `+ Add User` as an authorized `Superadmin` or `Admin`, submit valid employee details and an allowed role (`Admin` or `User` for `Superadmin`; `User` for `Admin`); the account is created cleanly (`201`) with expected status and `Password Setup` state without exposing password hashes.

\- \*\*TC-USR-03 (Missing, Invalid, or Duplicate Fields / Disallowed Role):\*\* Submit `+ Add User` with blank required fields, invalid email format, duplicate email/employee number (`409`), or a role/initial-password option not permitted for the current role (`400`/`403`); submission is rejected with clear validation/error feedback.



\## 2. Edit User \& Customer Account Details / Role

\- \*\*TC-USR-04 (Edit Employee Account):\*\* Click `Edit` on a manageable employee row (`Active` or `Pending`), update allowed fields (such as email or role), and save; changes persist across page reloads.

\- \*\*TC-USR-05 (Edit Customer Account):\*\* In `Customer Accounts`, edit an existing customer account with valid details and save; updates persist cleanly.

\- \*\*TC-USR-06 (Invalid Edit Input or Unauthorized Target):\*\* Attempt to save invalid/blank values or duplicate email (`400`/`409`), or attempt to edit/modify a protected `Superadmin` or non-manageable account (`403`/`404`); rejected and existing data remains intact.



\## 3. Approve Pending Accounts

\- \*\*TC-USR-07 (Approve Pending Account):\*\* On a `Pending` employee row (such as `Pending Applicant`), click `Approve`; status updates to `Active` and the user can proceed with password setup/sign-in under their assigned role.

\- \*\*TC-USR-08 (Non-Pending or Ineligible Approval Guard):\*\* Attempt to approve an account that is not in an eligible/manageable state; rejected cleanly (`404`) without granting unauthorized access.



\## 4. Block and Unblock Accounts

\- \*\*TC-USR-09 (Block Active or Pending Account):\*\* Click `Block` on an employee row (or block a customer account in `Customer Accounts`); status updates to `Blocked` and the user is prevented from signing in or accessing restricted modules.

\- \*\*TC-USR-10 (Unblock Blocked Account):\*\* On a `Blocked` employee or customer account, trigger unblock/activate (`Active`); status returns to `Active` and normal sign-in/access is restored.

\- \*\*TC-USR-11 (Protected Superadmin / Self-Block Guard):\*\* Attempt to block a protected `Superadmin` account or perform a restricted self-action; blocked/rejected cleanly.



\## 5. Authorization \& Role Access Control

\- \*\*TC-USR-12 (Unauthorized User Management Access):\*\* Unauthenticated users (`401`), non-active accounts (`403`), non-admin users, or `Admin` accounts attempting `Superadmin`-only actions are denied access (`401`/`403` or restricted UI/route).

