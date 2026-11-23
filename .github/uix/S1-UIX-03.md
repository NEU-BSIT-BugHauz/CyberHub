# [S1-UIX-03] Wireframes & UI Documentation: Main Page, User Management & Rights Dialog

- **Task ID:** `S1-UIX-03`[cite: 5]
- **Task Name:** Wireframes: main page, User Management list and Rights dialog[cite: 5]
- **Sprint / Story Points:** `Sprint 1` | `4 pts`[cite: 5]
- **Assignee:** UI/UX Designer[cite: 5]
- **Figma File Link:** [https://www.figma.com/design/lh4I5nrLXfW2fF3RrMstXH/Custom-Login-page-and-Signup-page-UI--Community-?node-id=0-1&p=f&t=qeRECav5SLzn50bw-0]
- **Last Updated:** 2026-11-23

---

## 1. Screen Inventory & Navigation Architecture


| Screen / View | Route / Section | Access Scope | Status | Key Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Dashboard Overview (Main Page)** | `#dashboard` (`WORKSPACE`)[cite: 4] | All Authenticated Staff[cite: 4] | Completed[cite: 4] | Personalized welcome banner, role/status KPI cards, assigned module launcher grid[cite: 4] |
| **User Management List** | `#user-management` (`ADMINISTRATION`)[cite: 4] | Admin / Superadmin[cite: 4] | In Progress | Create user form, searchable/filterable user directory table, role assignment & actions |
| **Rights & Permissions Dialog / Matrix** | `#rights-permissions` (`ADMINISTRATION`)[cite: 4] | Admin / Superadmin[cite: 4] | In Progress | User selector, granular CRUD permission checkboxes (`View`, `Create`, `Edit`, `Delete`) per module[cite: 4] |
| **Customer Accounts** | `#customer-accounts` (`ADMINISTRATION`)[cite: 4] | Admin / Superadmin[cite: 4] | Planned | Customer directory overview and account status controls |
| **Superadmin Controls** | `#superadmin-controls` (`ADMINISTRATION`)[cite: 4] | Superadmin Only[cite: 4] | Planned | System-level configuration, access policy rules, and audit controls |

---

## 2. Dashboard Shell & Persistent Layout


- **Topbar (`.topbar`):** `68px` sticky header (`#0F172A` background, `1px solid #1E293B` bottom border).
  - **Left:** `40px × 40px` `CH` emerald gradient brand mark + `CyberHub` title and `Management Portal` subtitle[cite: 4].
  - **Right:** Active user display (`Rolando Dala Jr.`)[cite: 4], emerald `.role-label` (`Superadmin`)[cite: 4], and `Sign out` outline button (`.btn-outline`)[cite: 4].
- **Sidebar (`.sidebar`):** `250px` fixed desktop width (`#0F172A` background, `1px solid #1E293B` right border), organized into three grouped sections[cite: 4]:
  - **`WORKSPACE`:** `Dashboard` (active state uses `rgba(16, 185, 129, 0.14)` fill and `#10B981` text)[cite: 4].
  - **`MODULES`:** `Customer`, `Product`, `Human Resources`, `Sales`, `Reports`[cite: 4].
  - **`ADMINISTRATION`:** `User Management`, `Customer Accounts`, `Rights & Permissions`, `Superadmin Controls`[cite: 4].
  - **Sidebar Footer (`.sidebar-footer`):** Anchored status bar with an `8px` `#10B981` indicator dot and `CyberHub Workspace` label[cite: 4].
- **Main Content Area (`.main-content`):** Fluid `1fr` column (`max-width: 1280px`, `28px 32px` padding, `20px` vertical stack gap).

---

## 3. Screen-by-Screen Wireframe Specifications

### A. Main Page — Dashboard Overview
- **Page Header (`.page-heading`):**
  - Eyebrow: `WORKSPACE` (`0.72rem` Bold uppercase `#10B981`)[cite: 4].
  - Title: `Dashboard Overview` (`1.55rem` Bold `#F8FAFC`)[cite: 4].
  - Subtitle: `Welcome to your CyberHub workspace.` (`0.9rem` `#94A3B8`)[cite: 4].
- **Welcome Banner (`.welcome-panel`):**
  - Gradient surface (`#0F172A` to `#132238`), `1px solid #334155` border, `22px` padding.
  - Left block: `WELCOME BACK` eyebrow, `Hello, Rolando Dala Jr.` heading, and role context description[cite: 4].
  - Right badge (`.welcome-role`): Recessed `#0B1120` box (`10px 16px` padding, `6px` radius) showing `ACCOUNT ROLE` (`0.72rem`) and `Superadmin` (`#10B981`)[cite: 4].
- **KPI Summary Row (`.overview-grid`):**
  - 3-column responsive grid (`repeat(auto-fit, minmax(220px, 1fr))`, `16px` gap).
  - Cards: **YOUR ROLE** (`Superadmin`), **AVAILABLE MODULES** (`5`), and **ACCOUNT STATUS** (`Active`) — values styled in `1.6rem` Bold `#10B981`[cite: 4].
- **Module Launcher Panel (`.panel` + `.module-card-grid`):**
  - Container heading: `Your Available Modules` + instructional subtitle[cite: 4].
  - 5-card grid (`Customer`, `Product`, `Human Resources`, `Sales`, `Reports`)[cite: 4]:
    - Recessed `#0B1120` cards (`1px solid #1E293B`, `#10B981` border on hover, `16px` padding)[cite: 4].
    - Includes module title, short description, inline emerald permission summary (`View · Create · Edit · Delete`), and `Open workspace →` action link[cite: 4].

### B. User Management List
- **Page Header:** `ADMINISTRATION` eyebrow + `User Management` heading + contextual description.
- **Create / Invite User Panel (`.panel`):**
  - Responsive `.form-grid` (`repeat(auto-fit, minmax(210px, 1fr))`, `14px` gap) with inputs for `Full Name`, `Email Address`, `Temporary Password`, and `Assigned Role` (`select` dropdown).
  - `.form-actions` row with primary `Create User` button (`.btn-primary`) and inline `.message` feedback banner.
- **User Directory Table Panel (`.panel`):**
  - Header bar with title and right-aligned `.search-box` (`max-width: 260px`) for filtering by name, email, or role.
  - `.table-wrapper` (`1px solid #1E293B`, `6px` radius) containing:
    - **Columns:** `Name`, `Email`, `Role`, `Status`, `Actions` (e.g., `Edit Role`, `Reset Password`, `Manage Rights`, `Deactivate`).
    - **Empty State (`.empty-state`):** Centered `24px` muted fallback message when no users match search criteria.

### C. Rights & Permissions Dialog / Matrix
- **Presentation Variants:**
  - *Inline Admin View (`#rights-permissions`):* Dedicated `.panel` inside the Administration section[cite: 4].
  - *Modal / Dialog Trigger:* Accessible directly from a user row's `Manage Rights` action in the User Management list (`.icon-button` `32px × 32px` close trigger in dialog header).
- **Target User Selector (`.permission-user-field`):**
  - `max-width: 360px` `select` dropdown to choose an employee account, paired with `.permission-user-info` displaying their current role and email.
- **Permission Matrix Table (`.permission-table`):**
  - Separated by `.permission-table-heading` (`margin-top: 24px`, `padding-top: 20px`, `1px solid #1E293B`).
  - **Rows:** System modules (`Customer`, `Product`, `Human Resources`, `Sales`, `Reports`)[cite: 4].
  - **Columns:** `Module` (left-aligned) + centered `100px`-wide columns for `View`, `Create`, `Edit`, and `Delete` (`16px × 16px` `#10B981` checkboxes)[cite: 4].
- **Footer Actions (`.permission-actions`):**
  - `margin-top: 16px` action row with `Save Permissions` (`.btn-primary`), `Reset to Role Defaults` (`.btn-outline`), and status confirmation banner (`.message.success`).

---

## 4. Handoff & Preview
- **Figma Frame / Page Name:** `📐 Wireframes — Main & Admin (S1-UIX-03)`
- **Visual Reference (Dashboard Overview — Superadmin State):**

![CyberHub Dashboard Overview Preview](./image_5d9527.png)[cite: 4]

---

## 5. Sign-Off Checklist
- [x] Main Dashboard Overview wireframe & layout finalized[cite: 4]
- [x] Sidebar navigation hierarchy (`Workspace`, `Modules`, `Administration`) defined[cite: 4]
- [x] User Management list & search/filter wireframe finalized
- [x] Rights & Permissions dialog/matrix states documented
- [x] Figma prototype links connected for developer handoff