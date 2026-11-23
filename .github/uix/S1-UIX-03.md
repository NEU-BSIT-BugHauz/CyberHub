# [S1-UIX-03] Low-Fidelity Wireframes Documentation: Main Page, User Management & Rights Dialog

- **Task ID:** `S1-UIX-03`[cite: 5]
- **Task Name:** Wireframes: main page, User Management list and Rights dialog[cite: 5]
- **Sprint / Week:** `Sprint 1` | `Week 1` | `4 pts`[cite: 5]
- **Assignee:** UI/UX Designer[cite: 5]
- **Figma File Link:** [Paste Figma Link Here]
- **Last Updated:** 2026-11-24

---

## 1. Wireframe Inventory & Scope


| Screen Name | Route / Section | Access Scope | Status | Structural & Functional Focus |
| :--- | :--- | :--- | :--- | :--- |
| **Dashboard Overview (Main Page)** | `#dashboard` (`WORKSPACE`)[cite: 11] | All Staff[cite: 11] | Completed[cite: 11] | Topbar + left sidebar shell, welcome container with role callout, 3-column KPI row, and 5-card module grid[cite: 11] |
| **User Management List** | `#user-management` (`ADMINISTRATION`)[cite: 12] | Admin / Superadmin[cite: 12] | Completed[cite: 12] | Top-right `+ Add User` trigger, searchable `Employee Accounts` table container, loading/empty state row, and 6-column table schema[cite: 12] |
| **Rights & Permissions View / Dialog** | `#rights-permissions` (`ADMINISTRATION`)[cite: 13] | Superadmin Only[cite: 13] | Completed[cite: 13] | Account selector dropdown (`Select an account`), conditional permission matrix placeholder, and `Permission Policy` rule box[cite: 13] |

---

## 2. Structural Shell & Navigation Architecture
> 

- **Top Header Bar:** Full-width horizontal bar containing:
  - **Left:** Square icon placeholder + `CyberHub` / `Management Portal` title block[cite: 11].
  - **Right:** Active user identity (`Rolando Dala Jr.` / `Superadmin`) and `Sign out` outlined button[cite: 11].
- **Left Navigation Sidebar:** Fixed vertical rail separated by horizontal dividers into three grouped sections[cite: 11]:
  - **`WORKSPACE`:** `Dashboard` (shaded gray pill indicates active selection)[cite: 11].
  - **`MODULES`:** `Customer`, `Product`, `Human Resources`, `Sales`, `Reports` (each paired with a square icon placeholder)[cite: 11].
  - **`ADMINISTRATION`:** `User Management`, `Customer Accounts`, `Rights & Permissions`, `Superadmin Controls`[cite: 11].
  - **Sidebar Footer:** Bottom-anchored status indicator (`• CyberHub Workspace`)[cite: 11].
- **Main Canvas & Footer:** Light neutral background canvas (`#F5F5F5` wireframe tone) with centered `CyberHub Management Portal` footer caption[cite: 12, 13].

---

## 3. Screen-by-Screen Wireframe Specifications

### A. Main Page — Dashboard Overview (`#dashboard`)
- **Page Header:** `WORKSPACE` eyebrow + `Dashboard Overview` heading + `Welcome to your CyberHub workspace.` subtitle[cite: 11].
- **Welcome Banner Box:**
  - Full-width outlined container (`1px` border, rounded corners)[cite: 11].
  - Left side: `WELCOME BACK` label, `Hello, Rolando Dala Jr.` display heading, and workspace description[cite: 11].
  - Right side: Nested `ACCOUNT ROLE` box displaying `Superadmin`[cite: 11].
- **KPI Summary Row:**
  - Equal-width 3-column card grid: **YOUR ROLE** (`Superadmin`), **AVAILABLE MODULES** (`5`), and **ACCOUNT STATUS** (`Active`)[cite: 11].
- **Available Modules Container:**
  - Outer panel titled `Your Available Modules` housing a 5-column horizontal card row (`Customer`, `Product`, `Human Resources`, `Sales`, `Reports`)[cite: 11].
  - Each module card outlines: title, 2-line description, inline permission summary (`View · Create · Edit · Delete`), and `Open workspace →` text trigger[cite: 11].

### B. User Management List (`#user-management`)
- **Page Header:** `ADMINISTRATION` eyebrow + `User Management` heading + subtitle (*"Create, update, and manage eligible employee accounts."*), paired with a right-aligned `+ Add User` button (opens Add User modal/form flow)[cite: 12].
- **Employee Accounts Panel:**
  - Panel header displaying `Employee Accounts`, dynamic account counter (`0 manageable accounts`), and right-aligned search input (`Search name, email, or employee num...`)[cite: 12].
  - **Table Header Schema (6 Columns):** `EMPLOYEE` | `EMAIL` | `ROLE` | `STATUS` | `PASSWORD SETUP` | `ACTIONS`[cite: 12].
  - **Table Body Wireframe State:** Full-width bordered state box demonstrating the asynchronous `Loading accounts...` state prior to data population[cite: 12].

### C. Rights & Permissions (`#rights-permissions`)
- **Page Header:** `SUPERADMIN ONLY` eyebrow + `Rights & Permissions` heading + subtitle (*"Assign module access and actions to Users and Admins."*)[cite: 13].
- **Account Selection & Matrix Container (`Select an Account`):**
  - Instructional copy (*"Choose a User or Admin whose permissions you want to manage."*)[cite: 13].
  - `Employee account` dropdown selector (`Select an account`)[cite: 13].
  - Nested placeholder box (*"Select an account to view or update its module permissions."*) reserving space for the interactive CRUD checkbox matrix once an account is chosen[cite: 13].
- **Policy Callout Box (`Permission Policy`):**
  - Full-width bottom card documenting role hierarchy rules (*"Superadmins have full access to every module. Regular Users and Admins receive only the permissions assigned to them. Missing permission assignments default to no access."*)[cite: 13].

---

## 4. Handoff & Visual Previews
- **Figma Frame / Page Name:** `📐 Wireframes — Main, User Management & Rights (S1-UIX-03)`

### Main Page (Dashboard Overview)
![Dashboard Overview Wireframe](./image_5e7a5d.png)[cite: 11]

### User Management List
![User Management Wireframe](./image_5e7ad7.png)[cite: 12]

### Rights & Permissions
![Rights & Permissions Wireframe](./image_5e7ddf.png)[cite: 13]

