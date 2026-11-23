# CyberHub Sprint 1 Test Plan and Acceptance Criteria

Scope: Sprint 1 QA coverage for CyberHub — Account Creation, Sign In & Sign Out, Password Reset, User Management, Role Permissions, UI/Layout, Security, and Smoke Testing.
Sources: Team brief, Sprint 1 task sheet, repository codebase, and manual/automated testing.

## Approach
- Test in desktop and mobile browser views as features and deployments become available.
- Use dedicated test accounts (`Superadmin`, `Admin`, `User`, `Pending`, `Blocked`) with credentials shared privately by the DB Admin—never commit credentials or `.env` secrets to the repo.
- Log defects as GitHub Issues with the `bug` label, steps to reproduce, expected vs. actual results, and screenshots, then re-test after fixes are merged.
- Run automated smoke checks via Jest (`npm test`).

## 1. Sign In and Sign Out
- Empty email or password fields block submission and show a validation message.
- Invalid email formatting is rejected.
- Incorrect passwords, unknown accounts, unapproved (`Pending`) accounts, or `Blocked` accounts cannot sign in and receive clear error feedback.
- Valid credentials sign in the user and route to the expected page/dashboard.
- Signing out clears the active session so pressing the browser Back button does not expose protected views.

## 2. Create Account
- Missing required fields or invalid email formats are rejected.
- Duplicate email addresses are rejected without creating duplicate accounts.
- Valid submissions create the account in a `pending` state awaiting approval without exposing passwords in the UI or responses.

## 3. Password Reset
- Requesting a password reset handles valid emails cleanly without confirming whether an account exists.
- A valid reset token updates the password so the new password works and the old one no longer works.
- Expired, invalid, or already-used reset tokens are rejected.

## 4. User Management, Roles, and Layout
- Authorized admins can add users, edit user records, approve pending users, and block/unblock accounts.
- `Superadmin` controls admin accounts and module permissions; unauthorized users or roles cannot access admin pages or routes, even via direct URL entry.
- Login, registration, password reset, and portal views fit desktop and mobile widths cleanly without broken layouts or horizontal overflow.

## 5. Security and Smoke Tests
- Passwords are never stored or displayed in plain text, and no secrets or database credentials exist in tracked files.
- Input payloads such as `<script>alert(1)</script>` and `' OR '1'='1` are safely handled without executing scripts or bypassing authentication.
- `npm test` runs the Jest smoke test suite cleanly without errors.