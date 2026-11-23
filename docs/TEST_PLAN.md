# CyberHub Sprint 1 Test Plan and Acceptance Criteria

- **Task:** S1-TST-01
- **Role:** Tester
- **Author:** Danreih B. Lareza
- **Sprint:** 1 (Weeks 1-2)
- **Status:** Draft v1. Criteria are based on the Sprint 1 task sheet and the repository. Each one is confirmed against the running app during Week 2 test execution, and this plan is updated if behavior differs.

## 1. Purpose

This plan defines what will be tested in Sprint 1, how it will be tested, and what counts as "working" (acceptance criteria). Every Week 2 test case links back to a criterion ID in section 6.

## 2. Scope

**In scope (Sprint 1 features)**
- Registration, including new users waiting for approval
- Login and logout
- Password reset
- User management: add, edit, block/unblock, approve
- Roles and permissions (superadmin, admin, user) and module permissions
- Audit logging of who performed an action
- Database setup: connection, migrations, seed data

**Out of scope**
- Performance and load testing
- Hosting and deployment infrastructure
- Features not planned for Sprint 1

## 3. Test Approach

- **Manual functional testing** in the browser, one criterion at a time. Each result is recorded as Pass or Fail with a screenshot as evidence.
- **Permission matrix testing:** every role is tried against every right, covering both allowed and denied cases.
- **Negative testing:** empty fields, invalid input, expired or reused tokens, and direct URL access without permission.
- **Developer test suite:** run `npm test` and report any failures as GitHub Issues.
- **Automated smoke test** of login and the main page (S1-TST-05), added once the login flow is stable.
- **Regression:** after a bug is fixed, the same steps are repeated and the result is noted on the issue.
- **Peer review:** teammate Pull Requests are reviewed against these criteria.

## 4. Test Environment

| Item | Detail |
|---|---|
| Runtime | Node.js v18 or higher, Git |
| Database | Team Supabase (PostgreSQL) via `DATABASE_URL` in a local `.env` (never committed) |
| Setup | `npm install`, `npm run db:test`, `npm run migrate`, `npm run dev` |
| Local URL | http://localhost:3000 |
| Deployed site | Production and Preview deployments listed on the repository page |
| Browsers | Chrome (primary), Edge or Firefox (secondary), plus phone width using browser dev tools |

## 5. Test Accounts

Passwords are shared privately by the DB Admin and are never written in this repository.

| Account | Purpose |
|---|---|
| Superadmin | Full access; manages admins and module permissions (seeded per team member) |
| Admin | Access limited to the rights granted |
| User | Standard access |
| Pending user | Freshly registered, waiting for approval |
| Blocked user | Used to confirm that blocked accounts cannot sign in |

## 6. Acceptance Criteria

### 6.1 Registration (AC-REG)
- **AC-REG-01** A new user can submit the registration form with valid details and the account is created as pending.
- **AC-REG-02** Submitting with required fields empty is rejected with a clear message and nothing is created.
- **AC-REG-03** An invalid email format is rejected.
- **AC-REG-04** Registering with an email that already exists is rejected, with no duplicate account and no false success message.
- **AC-REG-05** A pending user cannot log in until approved.
- **AC-REG-06** Passwords are never shown on the page or returned in API responses.

### 6.2 Login and Logout (AC-LOG)
- **AC-LOG-01** Valid credentials log the user in and open the correct landing page for their role.
- **AC-LOG-02** A wrong password or unknown account is rejected with an error and no login.
- **AC-LOG-03** Empty fields show a validation message.
- **AC-LOG-04** A blocked or unapproved account cannot log in and sees a clear message.
- **AC-LOG-05** Logout ends the session, and the browser Back button does not show protected pages.
- **AC-LOG-06** Opening a protected page without being logged in redirects to the login page.

### 6.3 Password Reset (AC-PWD)
- **AC-PWD-01** Requesting a reset for an existing email issues a reset token.
- **AC-PWD-02** A valid token lets the user set a new password; the old password stops working and the new one works.
- **AC-PWD-03** A reset token can only be used once; reusing it fails.
- **AC-PWD-04** An expired token is rejected with a clear message.
- **AC-PWD-05** An invalid or altered token is rejected.
- **AC-PWD-06** The reset request does not reveal whether an email has an account.

### 6.4 User Management (AC-USR)
- **AC-USR-01** An authorized admin can add a user.
- **AC-USR-02** Editing a user saves the changes.
- **AC-USR-03** Blocking a user prevents login; unblocking restores it.
- **AC-USR-04** Approving a pending user allows them to log in.
- **AC-USR-05** Users without permission cannot see or use user management.
- **AC-USR-06** Adding a user with a duplicate email is rejected.

### 6.5 Roles and Permissions (AC-RBAC)
- **AC-RBAC-01** Superadmin can manage admins and module permissions.
- **AC-RBAC-02** Admin can only do what their granted rights allow.
- **AC-RBAC-03** A normal user cannot open admin pages or admin routes, including by typing the URL directly.
- **AC-RBAC-04** Changing a module permission takes effect for the affected role.
- **AC-RBAC-05** Every row of the permission matrix (role x right) matches the intended access, both allowed and denied.

### 6.6 Audit Log (AC-AUD)
- **AC-AUD-01** Key actions (login, add/edit/block user, permission change) create an audit log entry.
- **AC-AUD-02** Each entry records the logged-in user who performed the action.

### 6.7 Database and Setup (AC-DB)
- **AC-DB-01** `npm run db:test` reports that the PostgreSQL connection is established.
- **AC-DB-02** `npm run migrate` applies all pending `.sql` files in order without errors and records them in `schema_migrations`.
- **AC-DB-03** Seed data exists: one superadmin account per team member and the system modules.
- **AC-DB-04** `npm run dev` starts the server at http://localhost:3000.
- **AC-DB-05** `npm test` passes; any failures are reported as issues.

## 7. Test Case Format (used in Week 2)

| ID | Criterion | Steps | Expected result | Actual result | Pass/Fail | Issue # |
|---|---|---|---|---|---|---|
| TC-LOG-01 | AC-LOG-01 | | | | | |

## 8. Bug Reporting

Every defect becomes a GitHub Issue with the `bug` label.

- **Title:** `[Area] short description`, for example `[Login] Blocked user can still sign in`
- **Body:** steps to reproduce, expected result, actual result, environment (browser, local or deployed), and a screenshot
- **Severity:** Critical (blocks login or access control), Major (feature broken), Minor (cosmetic or wording)
- **Assignment:** the Developer for logic and backend bugs, the UI/UX Designer for layout and styling bugs
- **Verification:** once fixed, the Tester repeats the steps, comments the result on the issue, and confirms it can be closed

## 9. Entry and Exit Criteria

**Entry:** the feature is merged or available locally, the database is migrated, and test accounts exist.

**Exit:** all Sprint 1 criteria have been executed and recorded, and there are no open Critical or Major bugs for login, password reset, or permissions.

## 10. Deliverables and Schedule

| Task | Week | Deliverable |
|---|---|---|
| S1-TST-01 | 1 | `docs/TEST_PLAN.md` (this file) |
| S1-TST-02 | 2 | Test cases for registration, login/logout, password reset: `docs/test-cases-auth.md` |
| S1-TST-03 | 2 | Test cases for user management: `docs/test-cases-users.md` |
| S1-TST-04 | 2 | Permission matrix tests: `docs/permission-matrix.md` |
| S1-TST-05 | 2 | Automated smoke test of login and the main page |
| S1-TST-06 | 2 | Bug reports as GitHub Issues and `docs/bug-verification.md` |

## 11. Risks

- Running the app locally needs the team database password, so it must be requested early.
- Features are still being merged, so criteria may change and this plan will be updated.
- Shared test data can be changed by others, so dedicated test accounts are used.
