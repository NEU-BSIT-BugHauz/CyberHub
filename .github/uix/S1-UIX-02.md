# [S1-UIX-02] Customer Login UI Documentation

- **Task ID:** `S1-UIX-02`
- **Task Name:** Customer Login Page UI & Form Components
- **Assignee:** UI/UX Designer
- **Status:** In Progress
- **Figma File Link:** `[https://www.figma.com/design/lh4I5nrLXfW2fF3RrMstXH/Custom-Login-page-and-Signup-page-UI--Community-?node-id=0-1&p=f&t=qeRECav5SLzn50bw-0]`
- **Last Updated:** `2026-11-23`

---

## 1. Screen Overview

- **Page Title:** `Welcome back`[cite: 8]
- **Eyebrow / Category Tag:** `CUSTOMER ACCESS`[cite: 8]
- **Subheading:** `Your customer account will be separate from employee accounts. No employee number is required.`[cite: 8]
- **Header Context:** `CyberHub — Customer Portal` (top-left) with `Home` and `Employee login` navigation links (top-right)[cite: 8].

---

## 2. Color Tokens Used

| Element | Figma Token | Hex Code | Usage / Notes |
| :--- | :--- | :--- | :--- |
| Canvas Background | `color/neutral/bg-base` | `#0B1120` | Deep navy background with subtle top-left radial teal glow[cite: 8] |
| Login Card Surface | `color/neutral/surface` | `#131C2E` | Centered authentication container (`420px`–`440px` max-width)[cite: 8] |
| Card Border | `color/neutral/border` | `#233044` | `1px` solid subtle border around login card and inputs[cite: 8] |
| Notice Banner Fill | `color/semantic/info-bg` | `#162B3A` | Muted teal-blue background for the availability notice box[cite: 8] |
| Notice Banner Border | `color/semantic/info-border` | `#1E435A` | `1px` solid border framing the notice callout[cite: 8] |
| Input Field Fill | `color/neutral/input-bg` | `#0F172A` | Dark recessed background for Email and Password inputs[cite: 8] |
| Primary CTA (Disabled/Preview) | `color/brand/primary-muted` | `#15805D` | Muted emerald fill for `Customer Sign In — not enabled` button[cite: 8] |
| Inline Links | `color/brand/primary` | `#10B981` | Emerald text links (`View registration preview`, `Go to Employee Login`)[cite: 8] |

---

## 3. UI Components & Specifications

### Top Navigation Bar
- **Left:** Brand logo mark (`CH` in `#10B981` rounded square), `CyberHub` title, `Customer Portal` subtitle[cite: 8].
- **Right:** Horizontal text links (`Home`, `Employee login`) in `#94A3B8` (`14px` Regular)[cite: 8].

### Authentication Card
- **Layout:** Vertically stacked single-column flex container (`24px`–`32px` padding, `12px` corner radius)[cite: 8].
- **Header Elements:**
  1. **Icon Badge:** `36px × 36px` rounded square (`#1E293B` fill) with customer/shopping icon[cite: 8].
  2. **Overline:** `CUSTOMER ACCESS` (`11px` Bold, uppercase, `0.10em` tracking, `#10B981`)[cite: 8].
  3. **Heading:** `Welcome back` (`24px` Bold, `#F8FAFC`)[cite: 8].
  4. **Description:** Secondary helper text (`13px`–`14px` Regular, `#94A3B8`)[cite: 8].

### Notice / Alert Callout
- **Type:** Informational Preview Notice[cite: 8]
- **Content:** *"Not available yet: Customer login requires a future database-approved integration. Please do not enter credentials here."* (with bold emphasis on `Not available yet:`)[cite: 8]
- **Specs:** `8px` corner radius, `12px 16px` padding, `12px`–`13px` font size[cite: 8].

### Form Inputs & CTA
- **Email Address Input:**
  - Label: `Email address` (`12px` Medium, `#F8FAFC`)[cite: 8]
  - Placeholder: `you@example.com` (`#64748B`)[cite: 8]
  - Specs: `42px`–`44px` height, `8px` radius, `1px solid #233044`[cite: 8]
- **Password Input:**
  - Label: `Password` (`12px` Medium, `#F8FAFC`)[cite: 8]
  - Placeholder: `Password` (`#64748B`)[cite: 8]
  - Specs: `42px`–`44px` height, `8px` radius, `1px solid #233044`[cite: 8]
- **Submit Button:**
  - Label: `Customer Sign In — not enabled` (dark text `#06281E`, `13px` SemiBold)[cite: 8]
  - Specs: Full-width (`100%`), `44px` height, `8px` radius, non-interactive/disabled state[cite: 8]

### Card Footer Links
- **Row 1:** `New customer?` (`#94A3B8`) + `View registration preview` (`#10B981`)[cite: 8]
- **Row 2:** `Are you an employee?` (`#94A3B8`) + `Go to Employee Login` (`#10B981`)[cite: 8]


