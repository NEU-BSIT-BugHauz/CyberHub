# [S1-UIX-04] High-Fidelity Mockups Documentation

- **Task ID:** `S1-UIX-04`[cite: 6]
- **Task Name:** Hi-fi mockups (login, register, main page, User Management, Rights)[cite: 6]
- **Sprint / Week:** `Sprint 1` | `Week 2` | `6 pts`[cite: 6]
- **Assignee:** UI/UX Designer[cite: 6]
- **Figma File Link:** [https://www.figma.com/design/lh4I5nrLXfW2fF3RrMstXH/Custom-Login-page-and-Signup-page-UI--Community-?node-id=0-1&p=f&t=qeRECav5SLzn50bw-0]
- **Last Updated:** 2026-11-23

---

## 1. Mockup Inventory & Completion Status

| Screen Name | View / Route | Scope | Status | Key Visual & Interactive Details |
| :--- | :--- | :--- | :--- | :--- |
| **Management Login** | `#login` | Authentication | Completed[cite: 9] | Centered auth card with top emerald-to-cyan gradient accent bar, email/password fields, `Sign in` CTA, `Forgot password?` & `Create Account` links[cite: 9] |
| **Employee Registration** | `#register` | Authentication | Completed[cite: 10] | Employee number (`e.g. E1234` with emerald focus ring), email, password (`At least 8 characters`), confirm password, `Create Account` CTA, and `.form-note` approval callout[cite: 10] |
| **Dashboard Overview (Main Page)** | `#dashboard` | Workspace | Completed[cite: 4] | Personalized welcome banner (`Hello, Rolando Dala Jr.`), 3 KPI summary cards, and 5 assigned module launcher cards with CRUD permission tags[cite: 4] |
| **User Management** | `#user-management` | Administration | Completed[cite: 7] | Top-right `+ Add User` CTA, searchable `Employee Accounts` table (`3 manageable accounts`) with role/status/password pills and contextual row actions (`Approve`, `Edit`, `Block`)[cite: 7] |
| **Rights & Permissions** | `#rights-permissions` | Administration | Completed[cite: 8] | `SUPERADMIN ONLY` header, `Select an Account` dropdown (`Loading accounts...`), empty-state permission container, and `Permission Policy` info card[cite: 8] |

---

## 2. Screen-by-Screen High-Fidelity Specifications

### A. Login Screen (`#login`)
- **Card Styling:** Centered `420px` `#0F172A` card featuring a subtle top gradient highlight (`#10B981` to `#0EA5E9`) and `CH` brand header (`CyberHub / Management Portal`)[cite: 9].
- **Header:** `Welcome back` (`1.4rem` Bold) + `Sign in to access your CyberHub account.` (`#94A3B8`)[cite: 9].
- **Form Controls:**
  - `Email address` (`you@example.com`)[cite: 9]
  - `Password` (`Enter your password`)[cite: 9]
- **Actions & Footer:** Full-width `#10B981` `Sign in` button, left-aligned `Forgot password?` text link, horizontal divider, and centered `Don't have an account? Create Account` prompt[cite: 9].

### B. Employee Registration Screen (`#register`)
- **Header:** `Create your account` + eligibility subtitle (*"Register using your active employee record. An administrator must approve your account before you can sign in."*)[cite: 10].
- **Form Controls:**
  - `Employee number` (`e.g. E1234` — shown in active emerald focus state)[cite: 10]
  - `Email address` (`you@example.com`)[cite: 10]
  - `Password` (`At least 8 characters`)[cite: 10]
  - `Confirm password` (`Re-enter your password`)[cite: 10]
- **Callout & Footer:** Full-width `Create Account` button, recessed `.form-note` banner (`3px solid #10B981` left border) explaining pending approval status, and `Already have an account? Sign in` link[cite: 10].

### C. Main Page — Dashboard Overview (`#dashboard`)
- **Shell:** Persistent `68px` topbar (`Rolando Dala Jr. / Superadmin` + `Sign out`) and `250px` left sidebar (`WORKSPACE`, `MODULES`, `ADMINISTRATION`)[cite: 4].
- **Hero & Metrics:** Gradient welcome panel with `ACCOUNT ROLE: Superadmin` badge, followed by 3 KPI cards (`YOUR ROLE: Superadmin`, `AVAILABLE MODULES: 5`, `ACCOUNT STATUS: Active`)[cite: 4].
- **Module Grid:** 5 interactive module cards (`Customer`, `Product`, `Human Resources`, `Sales`, `Reports`) displaying `View · Create · Edit · Delete` permissions and `Open workspace →` links[cite: 4].

### D. User Management (`#user-management`)
- **Header Bar:** `ADMINISTRATION` eyebrow, `User Management` heading (*"Create, update, and manage eligible employee accounts."*), and right-aligned `+ Add User` primary button[cite: 7].
- **Directory Card (`Employee Accounts`):**
  - Header with count (`3 manageable accounts`) and right-aligned search input (`Search name, email, or employee...`)[cite: 7].
  - **Table Columns:** `EMPLOYEE` (Name + ID subtitle `N/A`), `EMAIL`, `ROLE`, `STATUS`, `PASSWORD SETUP`, `ACTIONS`[cite: 7].
  - **Status & Role Badges:**
    - *Role Pills:* `Admin` (teal-tinted pill), `User` (slate/teal-tinted pill)[cite: 7].
    - *Status Pills:* `Active` (emerald pill), `Pending` (amber/gold pill)[cite: 7].
    - *Password Setup:* `Required` (amber/gold pill)[cite: 7].
  - **Contextual Row Actions:**
    - Active rows (`Operations Admin`, `Staff Member`): `Edit` (subtle slate button) + `Block` (danger-tinted button)[cite: 7].
    - Pending rows (`Pending Applicant`): `Approve` (emerald-tinted button) + `Edit` + `Block`[cite: 7].

### E. Rights & Permissions (`#rights-permissions`)
- **Header Bar:** `SUPERADMIN ONLY` emerald eyebrow, `Rights & Permissions` heading (*"Assign module access and actions to Users and Admins."*)[cite: 8].
- **Account Selection Panel (`Select an Account`):**
  - Subtitle: *"Choose a User or Admin whose permissions you want to manage."*[cite: 8]
  - `Employee account` select dropdown (`Loading accounts...` / user list)[cite: 8].
  - Recessed placeholder container: *"Select an account to view or update its module permissions."* (expands into CRUD checkbox matrix upon selection)[cite: 8].
- **Policy Info Panel (`Permission Policy`):**
  - Dedicated card detailing role inheritance rules (*"Superadmins have full access to every module. Regular Users and Admins receive only the permissions assigned to them. Missing permission assignments default to no access."*)[cite: 8].

---

## 4. Handoff & Visual Previews
- **Figma Frame / Page Name:** `🎨 Hi-Fi Mockups — Sprint 1 (S1-UIX-04)`

### Login & Registration
| Login (`#login`) | Registration (`#register`) |
| :---: | :---: |
| ![Login Mockup](./image_5e0a58.png)[cite: 9] | ![Registration Mockup](./image_5e0d03.png)[cite: 10] |

### Dashboard Overview (Main Page)
![Dashboard Overview Mockup](./image_5d9527.png)[cite: 4]

### User Management
![User Management Mockup](./image_5e09fb.png)[cite: 7]

### Rights & Permissions
![Rights & Permissions Mockup](./image_5e0a1c.png)[cite: 8]

---
