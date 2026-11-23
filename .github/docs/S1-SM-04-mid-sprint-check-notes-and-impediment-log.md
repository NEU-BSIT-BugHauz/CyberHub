# Sprint 1 — Mid-Sprint Check Notes & Impediment Log (S1-SM-04)

- **Role:** Scrum Master (DALA)
- **Project:** CyberHub
- **Sprint Status:** Mid-Sprint Review (Active)

---

## 1. Mid-Sprint Check Notes

### Completed & Merged Work (PRs Merged to `main`)
* **Scrum Master Setup:**
  * `S1-SM-01`: Repo setup, branch protection, PR and issue templates (PR #28)
  * `S1-SM-02`: Sprint 1 board stories with acceptance criteria (PR #29)
  * `S1-SM-03`: Team working agreement (PR #30)
* **Database Administration (CLET):**
  * `S1-DBA-01` to `S1-DBA-06`: Database setup, base tables, auth sessions, password resets, seed data, and audit logging (PRs #15–#20)
  * `S2-DBA-01` to `S2-DBA-06`: Active views/indexes, current price query, validation constraints, child record delete checks, demo data, and search index tuning (PRs #21–#26)
* **Integration & Dev:**
  * `SUPABASE-CONNECTION-TO-OUR-CYBERHUB` (PR #27)
  * `elias-asne-dev` initial setup (PR #14)

### In Progress
* `S1-SM-04`: Mid-sprint check notes and impediment log (current branch, checks passing 3/3)
* Frontend & Backend integration (`public/index.html`, Express routes, and Supabase live deployment)

### Next Steps for Remainder of Sprint
1. Merge `S1-SM-04` into `main` via Pull Request.
2. Clean up stale merged branches (`#14` through `#30`) to keep the repository organized.
3. Complete full-stack deployment on a Node.js-compatible host (e.g., Render) and verify live Supabase connectivity.

---

## 2. Impediment Log

| ID | Impediment Description | Impact | Owner | Action / Resolution Plan | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **IMP-01** | **GitHub Pages Static Hosting Limitation:** GitHub Pages only renders static files (`README.md`) from `/ (root)` and cannot execute the Node.js/Express backend (`server.js`) or connect to Supabase. | High — Live backend routes and database features cannot run on GitHub Pages. | DALA / DevOps | Unpublish GitHub Pages and deploy the full-stack Node.js app to Render with `DATABASE_URL` configured in environment variables. | In Progress |
| **IMP-02** | **Local `npm` CLI Path Error:** PowerShell returns `npm : The term 'npm' is not recognized` on local Windows workstation. | Medium — Blocks running `npm install` and `npm run dev` locally. | Developer | Install Node.js (v18+) or add the Node.js installation path to Windows Environment Variables and restart VS Code. | Open |
| **IMP-03** | **Branch Hygiene & Divergent History:** 17 merged branches remain active on the repository and are 1–43 commits behind `main`. | Low — Clutters active branch list and increases risk of developers branching off outdated code. | Scrum Master (DALA) | Delete merged branches (`PR #14`–`#30`) after confirming merge completion and remind team to run `git pull origin main` before creating new branches. | Open |