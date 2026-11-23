# HOPE, Inc. ERP — Sprint 1 Board & 8-Week Module Roadmap

## 1. Six-Module Roadmap Across Sprints 1–4 (8-Week Limit)

| Sprint | Weeks | Mapped ERP Guide Modules | Planned PRs | Core Scope in Task Plan |
| :--- | :--- | :--- | :---: | :--- |
| **Sprint 1** | Weeks 1–2 | **1. User Management & Access Control** (Auth + Main Shell) | 30 | App scaffold, registration (pending state), login/logout, password hashing & reset tokens, User Management CRUD + block/unblock, Superadmin approval/admin designation, 36-right per-action Rights dialog, role-filtered Main Page, and `audit_log` tracking. |
| **Sprint 2** | Weeks 3–4 | **2. Customer** + **3. Product** (with Price History) | 30 | Customer & Product search/filter, create/edit forms, soft delete & restore (with child-record delete checks), and Product price history (add/edit/delete effective dates & current-price queries). |
| **Sprint 3** | Weeks 5–6 | **4. Human Resources** | 30 | Department & Job CRUD, Employee search/filter/CRUD, soft delete/restore with separation date, Job History (promotions/transfers with effective date & salary), Employee Profile job timeline, `app_user.empno` linking, and `View Job History` salary restrictions. |
| **Sprint 4** | Weeks 7–8 | **5. Sales** + **6. Reports** (plus Audit Log Viewer) | 30 | Auto-numbered Sales header & line items (auto-filled unit price from price history), payment recording & balance views, Sales soft delete/restore, all **7 Reports** (Product Master List, Active Employees, All Employees, Employee Job History, Top Customers, Top Products, Top Sales with Print/Save as PDF), and Superadmin Audit Log viewer. |

---

## 2. Sprint 1 Board — User Stories & Acceptance Criteria

### Story 1: Project Setup, Database Migrations & Seed Data
**Related Tasks:** `S1-DEV-01`, `S1-DBA-01`, `S1-DBA-02`, `S1-DBA-03`, `S1-DBA-04`, `S1-DBA-05`

**User Story:**  
As a team member, I want a local database migration runner and seeded superadmin/module/rights data (without Docker or hardcoded passwords) so I can run and test the application locally.

**Acceptance Criteria:**
- [ ] App skeleton, environment config, and DB connection work locally with clear student setup README instructions (no Docker).
- [ ] Migrations create `HopeDB_audit.sql` base tables, `app_user` (with `role` and `blocked` flag), `role`, `module`, `rights catalogue`, `user_permission` (with soft delete), and `password_reset_token` (hashed, expiry, used flag).
- [ ] Seed script populates one superadmin account per team member, the 5 rights modules (*Customer, Product, Human Resources, Sales, Reports*), default roles, and the 36 per-action rights catalogue (guide 3.8).

---

### Story 2: User Registration, Login & Password Reset
**Related Tasks:** `S1-DEV-02`, `S1-DEV-03`, `S1-DEV-04`, `S1-TST-02`, `S1-UIX-02`

**User Story:**  
As a user, I want to register an account, set my initial password, log in/out securely, and reset a forgotten password so that I can access the ERP system safely.

**Acceptance Criteria:**
- [ ] Registration form creates new accounts in a **pending** status.
- [ ] First-time login enforces a one-time set-password flow; passwords are securely hashed.
- [ ] Blocked or pending users cannot sign in.
- [ ] Password reset emails a hashed, expiring single-use token; expired or reused tokens are rejected.

---

### Story 3: User Management Screen & Superadmin Controls
**Related Tasks:** `S1-DEV-05`, `S1-DEV-06`, `S1-TST-03`, `S1-UIX-03`

**User Story:**  
As an Admin or Superadmin, I want to manage user accounts, approve pending registrations, and assign admin roles so that only authorized staff can access the system.

**Acceptance Criteria:**
- [ ] User Management screen supports viewing the user list, adding users, editing users, and blocking/unblocking accounts.
- [ ] **Admin** users can manage standard **Users** only; **Superadmin** accounts are completely hidden from Admins.
- [ ] **Superadmins** can approve pending users and designate Admins.
- [ ] System blocks removing, demoting, or disabling the last remaining Superadmin.

---

### Story 4: Per-Action Rights Assignment & Audit Logging
**Related Tasks:** `S1-DEV-07`, `S1-DBA-06`, `S1-TST-04`

**User Story:**  
As an Admin or Superadmin, I want to assign granular per-action rights across all five modules and record every change in `audit_log` so that user permissions are strictly controlled and traceable.

**Acceptance Criteria:**
- [ ] Rights dialog allows assigning per-action rights across *Customer, Product, Human Resources, Sales,* and *Reports*, including module-level checkboxes and **All/None** toggles.
- [ ] Every permission change is recorded in `audit_log` with the logged-in user captured via `audit_user()`.
- [ ] Permission matrix tests pass across Superadmin, Admin, and User roles for every individual right.

---

### Story 5: Role-Based Main Page & Server-Side Enforcement
**Related Tasks:** `S1-DEV-08`, `S1-TST-04`, `S1-TST-05`

**User Story:**  
As a logged-in user, I want a main dashboard whose sidebar and module tiles reflect my assigned role and rights, backed by server-side permission checks.

**Acceptance Criteria:**
- [ ] Main page sidebar and module tiles dynamically show/hide based on user role and per-action rights.
- [ ] Server-side routes reject unauthorized requests even if a user bypasses hidden UI buttons.
- [ ] Automated smoke test passes for login and main page navigation.

---

### Story 6: Design System, Wireframes & Usability Sign-Off
**Related Tasks:** `S1-UIX-01`, `S1-UIX-02`, `S1-UIX-03`, `S1-UIX-04`, `S1-UIX-05`, `S1-TST-01`, `S1-TST-06`

**User Story:**  
As a product team, we want a unified design system, approved mockups, and verified bug fixes so that Sprint 1 screens are consistent and ready for Sprint 2.

**Acceptance Criteria:**
- [ ] Design system (colors, typography, core components), wireframes, and hi-fi mockups are completed with developer handoff notes.
- [ ] Usability review fix list and QA bug reports are resolved and verified prior to Sprint 1 review.