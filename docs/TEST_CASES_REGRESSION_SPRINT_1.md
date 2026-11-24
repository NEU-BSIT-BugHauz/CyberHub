\# CyberHub Sprint 1 Regression Test Cases



Related Issue: #<ISSUE\_NUM>

Scope: Regression verification of Sprint 1 functionality—registration, login/logout and session state, set/reset password flows, user/role management access controls, and baseline security/smoke checks (`docs/TEST\_PLAN.md`, `docs/TEST\_CASES\_AUTH.md`, `routes/auth.js`, `routes/users.js`).



\## 1. Registration \& Account State Regression

\- \*\*TC-REG-S1-01 (Registration Validation \& Duplicate Rejection):\*\* Missing/invalid fields or duplicate email/employee number are rejected (`400`/`409`), while valid registration creates the account cleanly without exposing password data.

\- \*\*TC-REG-S1-02 (Pending / Blocked / Soft-Deleted Account Login Guard):\*\* Accounts in `pending`, `blocked`, or soft-deleted (`is\_deleted = TRUE`) states are blocked from signing in (`403`) or accessing protected endpoints.



\## 2. Login, Session \& Password Flows Regression

\- \*\*TC-REG-S1-03 (Valid Sign-In \& Logout Session Clearing):\*\* Valid active credentials authenticate into the expected workspace; logging out ends the session so protected routes and browser Back do not expose authenticated views.

\- \*\*TC-REG-S1-04 (Password Set / Reset Token Handling):\*\* Reset requests complete without leaking account existence; valid tokens update credentials while invalid, expired, or reused tokens are rejected.



\## 3. User Management, Roles \& Smoke Checks Regression

\- \*\*TC-REG-S1-05 (Authentication \& Role/Admin Access Boundaries):\*\* Unauthenticated requests (`401`), inactive actors (`403`), or non-admin/disallowed role targets (`403`) are blocked on protected management/admin routes.

\- \*\*TC-REG-S1-06 (Baseline Security \& Jest Smoke Suite):\*\* Payloads/credentials stay safe and `npm test` runs the Jest smoke suite cleanly without errors.

