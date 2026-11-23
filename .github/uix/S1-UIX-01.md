# [S1-UIX-01] CyberHub Design System Documentation

- **Task ID:** `S1-UIX-01`[cite: 5]
- **Task Name:** Design system: colors, typography, core components[cite: 5]
- **Assignee:** UI/UX Designer[cite: 5]
- **Status:** In Progress[cite: 5]
- **Figma File Link:** `[https://www.figma.com/design/lh4I5nrLXfW2fF3RrMstXH/Custom-Login-page-and-Signup-page-UI--Community-?node-id=0-1&p=f&t=qeRECav5SLzn50bw-0]`
- **Last Updated:** `2026-11-23`

---

## 1. Color System

### Brand Colors
| Color Name | Figma Token | Hex Code | Usage / Notes |
| :--- | :--- | :--- | :--- |
| Primary (Emerald) | `color/brand/primary` | `#10B981` | Logo mark (`CH`), hero highlight text (`CyberHub.`), primary CTA button (`Customer Login`), feature checkmarks[cite: 6] |
| Primary Hover / Dark | `color/brand/primary-hover` | `#059669` | Hover/pressed state for primary buttons & active focus rings |
| Secondary (Slate Blue) | `color/brand/secondary` | `#334155` | Secondary CTA button (`Employee Login`), subtle UI accents[cite: 6] |
| Accent (Teal Glow) | `color/brand/accent` | `#14B8A6` | Top-left ambient background radial glow, active card top border highlight[cite: 6] |

### Neutral Colors (Dark Theme)
| Color Name | Figma Token | Hex Code | Usage / Notes |
| :--- | :--- | :--- | :--- |
| Background (Deep Navy) | `color/neutral/bg-base` | `#0B1120` | Main application canvas background[cite: 6] |
| Surface / Card | `color/neutral/surface` | `#131C2E` | Portal selection cards, elevated containers[cite: 6] |
| Surface Elevated | `color/neutral/surface-alt` | `#1E293B` | Icon badge containers inside cards, hover states[cite: 6] |
| Border / Divider | `color/neutral/border` | `#233044` | Default card borders, subtle structural dividers[cite: 6] |
| Text Primary | `color/neutral/text-primary` | `#F8FAFC` | Main headings (`Welcome to`), card titles, secondary button text (`Employee Login`)[cite: 6] |
| Text Secondary / Muted | `color/neutral/text-secondary` | `#94A3B8` | Body copy, feature checklist text, navigation links, footer disclaimer[cite: 6] |

### Semantic / Status Colors
| Color Name | Figma Token | Hex Code | Usage / Notes |
| :--- | :--- | :--- | :--- |
| Success | `color/semantic/success` | `#10B981` | Feature checklist icons, active status indicators[cite: 6] |
| Warning | `color/semantic/warning` | `#F59E0B` | Pending states, caution alerts |
| Error / Danger | `color/semantic/error` | `#EF4444` | Form validation errors, destructive actions |
| Info | `color/semantic/info` | `#38BDF8` | System notices, informational tooltips |

---

## 2. Typography

- **Primary Font Family:** `Inter` *(or `Plus Jakarta Sans` — clean geometric sans-serif)*
- **Secondary / Monospace Font:** `JetBrains Mono` *(optional for IDs/codes)*

| Text Style Name | Font Weight | Size (px) | Line Height | Letter Spacing | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Heading 1 (H1) | `700 (Bold)` | `48px` | `56px (1.16)` | `-0.02em` | Hero display headline (`Welcome to CyberHub.`)[cite: 6] |
| Heading 2 (H2) | `700 (Bold)` | `24px` | `32px (1.33)` | `-0.01em` | Portal card titles (`Customer Portal`, `Employee Portal`)[cite: 6] |
| Heading 3 (H3) | `600 (SemiBold)` | `18px` | `26px (1.44)` | `0em` | Brand title (`CyberHub`), modal headers[cite: 6] |
| Body Large | `400 (Regular)` | `16px` | `24px (1.50)` | `0em` | Hero subtitle & lead descriptions[cite: 6] |
| Body Regular | `400 (Regular)` | `14px` | `22px (1.57)` | `0em` | Card descriptions, checklist items, top nav links[cite: 6] |
| Body Small | `500 (Medium)` | `13px` | `18px (1.38)` | `0em` | Secondary action links (`Customer registration preview`), button text[cite: 6] |
| Overline / Eyebrow | `700 (Bold)` | `11px` | `16px (1.45)` | `0.10em` | All-caps category labels (`ONE PLATFORM, TWO EXPERIENCES`, `FOR CUSTOMERS`)[cite: 6] |
| Caption / Footer | `400 (Regular)` | `12px` | `18px (1.50)` | `0em` | Brand tagline (`Connected workspace`), bottom system disclaimer[cite: 6] |

---

## 3. Core Components

### Buttons
- **Variants:** `Primary (Emerald Fill #10B981 with dark text)`, `Secondary (Slate Fill #334155 with light text)`, `Ghost / Text Link`[cite: 6]
- **Sizes:** `Small (36px height)`, `Medium (44px height - Full-width card CTA)`, `Large (48px height)`[cite: 6]
- **States Included:** `Default`, `Hover`, `Pressed`, `Focus`, `Disabled`
- **Corner Radius / Padding:** `8px` border-radius; `12px 24px` padding; supports trailing icon (`→`)[cite: 6]

### Form Inputs
- **Variants:** `Text Field`, `Password Input`, `Select Dropdown`, `Checkbox`, `Radio`, `Toggle`
- **States Included:** `Default`, `Focus (Emerald border #10B981)`, `Filled`, `Error`, `Disabled`
- **Corner Radius / Height:** `8px` border-radius; `44px` standard height; dark surface fill (`#0F172A`) with `#233044` border

### Navigation & Layout
- **Components Created:** `Top Navbar` (Brand logo + tagline on left, portal quick-links on right), `Portal Selection Card` (Icon badge, overline tag, title, description, checkmark list, full-width CTA, sub-link)[cite: 6]
- **Grid / Spacing Rules:** `8pt` spatial grid system; `1200px` max-width centered container; `24px` gap between portal cards; `32px` internal card padding[cite: 6]

### Cards, Modals & Badges
- **Cards:** `#131C2E` surface fill, `1px solid #233044` border (with `1px solid #10B981` active/featured card border), `12px` corner radius[cite: 6]
- **Icon Badges:** `36px × 36px` rounded square (`8px` radius), `#1E293B` background fill[cite: 6]
- **Modals / Dialogs:** Dark backdrop overlay (`rgba(11, 17, 32, 0.8)`), `#131C2E` modal surface, `12px` radius, `24px` padding
- **Tables & Badges:** `#1E293B` header surface, `1px` `#233044` row dividers, pill badges (`9999px` radius) using 15% opacity semantic fills

### Icons
- **Icon Library Used:** `Lucide Icons` (1.5px – 2px stroke weight)
- **Standard Sizes:** `14px` (inline button arrows & checkmarks), `18px` (card badge icons), `24px` (navigation/headers)[cite: 6]

---

## 4. Handoff & Preview
- **Figma Frame / Page Name:** `🎨 Design System — CyberHub`
- **Reference Screen:** Portal Selection Landing Screen (`Welcome to CyberHub.`)[cite: 6]

---

## 5. Sign-Off Checklist
- [x] Color palette extracted and mapped to design tokens[cite: 6]
- [x] Typography scale defined for headings, body, and overline labels[cite: 6]
- [ ] All color & text styles published in Figma
- [ ] Core components built with variants & auto-layout
- [ ] Figma link permissions set so team/devs can inspect