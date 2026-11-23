# CyberHub Sprint 1 Auth Test Cases (S1-TST-02)

Related Issue: #48
Scope: Registration, login/logout, and set/reset password flows across Customer and Management/Employee portals (including invalid, expired, or unauthorized cases).

## 1. Registration
- **TC-AUTH-01 (Valid Customer Registration):** On the Customer Portal `Create an account` form, enter valid `Full name`, `Email address`, optional `Phone`, and matching `Password` and `Confirm password`, then submit; customer account is created without exposing password data.
- **TC-AUTH-02 (Valid Management/Employee Registration):** On the Management Portal `Create your account` form, enter a valid `Employee number` (e.g., `E1234`), `Email address`, matching `Password` and `Confirm password` (at least 8 characters), and click `Create Account`; account is created with `pending` status and no module access until approved by an administrator.
- **TC-AUTH-03 (Missing, Short, Mismatched, or Invalid Fields):** Submit blank required fields, invalid email format, password under 8 characters on Management registration, or mismatched `Password` and `Confirm password`; submission is blocked with clear validation feedback.
- **TC-AUTH-04 (Duplicate Email / Employee Number or Ineligible Employee):** Attempt registration with an already-registered email/employee number or an ineligible/non-active employee record; registration is rejected without creating an unauthorized or duplicate account.

## 2. Login and Logout
- **TC-AUTH-05 (Valid Customer Login):** Sign in on Customer Login with valid registered credentials; user is authenticated and routed to the customer workspace.
- **TC-AUTH-06 (Valid Management/Employee Login):** Sign in on Management Portal login with valid credentials for an approved account; user is authenticated and routed to their authorized workspace.
- **TC-AUTH-07 (Invalid Credentials or Unknown User):** Attempt `Sign in` with a wrong password, unregistered email, or invalid email format; login fails with clear error/validation feedback.
- **TC-AUTH-08 (Pending or Blocked Account Login):** Attempt `Sign in` on Management Portal (or customer login if blocked) with a `pending` or `blocked` account; sign-in/module access is denied until approved or unblocked.
- **TC-AUTH-09 (Logout and Session Clearing):** Log out of an active session; session ends, protected routes cannot be accessed, and pressing browser Back does not restore authenticated views.

## 3. Set and Reset Password
- **TC-AUTH-10 (Request Password Reset):** Click `Forgot password?` on the Management Portal login screen and submit a valid email; request completes cleanly without leaking whether the email exists.
- **TC-AUTH-11 (Valid Set / Reset Password):** Use a valid password set/reset token or flow to set a new password; signing in with the new password succeeds and the old password is rejected.
- **TC-AUTH-12 (Invalid, Expired, or Reused Token):** Attempt to set/reset password using an invalid, expired, or already-used token/link; action is rejected and the existing password remains unchanged.