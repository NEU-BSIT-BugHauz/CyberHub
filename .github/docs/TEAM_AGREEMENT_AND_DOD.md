# HOPE, Inc. ERP — Team Working Agreement, Definition of Done & Role Guide

## 1. Team Working Agreement

### Communication & Cadence
- **Sprint Structure:** 4 Sprints × 2 Weeks (8 weeks total; 10 sprint days per sprint).
- **Daily Sync / Async Check-in:** Every team member posts a brief update in the group chat (what was completed yesterday, what is planned today, and any blockers).
- **Mid-Sprint Check (Day 5):** Scrum Master conducts a mid-sprint health check to review PR progress against due dates and log impediments.
- **Sprint Review & Retrospective (Day 10):** Full team demos merged features, reviews sprint velocity, and documents action items for the next sprint.
- **Response Time:** Acknowledge @mentions, PR review requests, and blocker alerts within **12 hours** (or **4 hours** on sprint due days).

### GitHub & Pull Request Workflow
- **One Task = One PR:** Every row in `HOPE_Sprint_Task_Plan_revised.xlsx` corresponds to exactly one Pull Request.
- **Branch Naming Convention:** Use `<prefix>/<task-id>-<short-description>` (e.g., `feat/S1-DEV-02-register-user`, `db/S1-DBA-03-auth-tables`, `test/S1-TST-02-auth-cases`, `design/S1-UIX-02-auth-wireframes`, `docs/S1-SM-03-working-agreement`).
- **Protected `main` Branch:** Direct pushes to `main` are blocked. All work must enter `main` through a Pull Request using the repository's `.github/PULL_REQUEST_TEMPLATE.md`.
- **Peer Review Policy:** PR authors must link their PR URL in the Sprint Task Plan spreadsheet upon opening it and request at least **1 peer review** before merging. Reviewers must test/inspect changes within **24 hours**.
- **No Secrets in Repo:** Never commit database passwords, `.env` files, API keys, or hardcoded user passwords.

### Blocker & Deadline Escalation
- If a task will miss its target **Due (sprint day)**, notify the Scrum Master and dependent teammates at least **24 hours in advance** so dependencies (such as DB migrations or UI wireframes) can be re-sequenced.

---

## 2. Definition of Done (DoD)

A task is only considered **Done** when its Pull Request status is **Merged** into `main` and all applicable criteria below are met:

### General Criteria (All Roles)
- [ ] Deliverable fully satisfies the task scope and acceptance criteria in the Sprint Task Plan.
- [ ] Pull Request uses the standard PR template with the **Task ID** clearly stated.
- [ ] At least **1 teammate** has reviewed and approved the PR.
- [ ] Branch is up to date with `main` with zero merge conflicts.
- [ ] PR link is pasted into `HOPE_Sprint_Task_Plan_revised.xlsx` and Status is updated to **Merged**.

### Role-Specific Criteria
- **Developer:**
  - [ ] Feature works locally without console, runtime, or server errors.
  - [ ] Server-side permission/role checks are enforced (not just hidden UI elements).
  - [ ] Soft-delete, audit logging (`audit_log`), and validation rules match database constraints.
- **DB Admin:**
  - [ ] SQL migrations run cleanly from scratch via the migration runner script (no Docker required).
  - [ ] Foreign keys, constraints, indexes, and soft-delete flags are verified.
  - [ ] Seed/demo data scripts execute without hardcoded plaintext passwords.
- **UI/UX Designer:**
  - [ ] Wireframes/mockups follow the approved design system (colors, typography, core components).
  - [ ] Empty states, error states, and confirmation dialogs are specified.
  - [ ] Developer handoff notes or usability fix lists are clear and actionable.
- **Tester:**
  - [ ] Test plans, test cases, and permission matrix scenarios cover positive, negative, and edge cases.
  - [ ] Bugs are logged using the repository's `.github/ISSUE_TEMPLATE/bug_report.md` and re-verified after fixes merge.
- **Scrum Master:**
  - [ ] Sprint boards, roadmaps, check-in notes, and retrospective reports are documented in the repository and shared with the team.

---

## 3. Team Role Guide (30 PRs per Sprint / 120 PRs Total)

| Role | Sprint Target | Total Target | Primary Responsibilities & Key Deliverables |
| :--- | :---: | :---: | :--- |
| **Developer** | 8 PRs | 32 PRs | Build application scaffold, authentication & password reset flows, User Management & 36-right permission controls, Customer/Product/HR/Sales CRUD, price history & soft-delete logic, 7 PDF-exportable reports, and the Superadmin audit log viewer. |
| **DB Admin** | 6 PRs | 24 PRs | Maintain local DB setup & migration runner (no Docker), create schema migrations (`HopeDB_audit.sql`, `app_user`, roles, 36-right catalogue, reset tokens), implement `audit_user()` logging, seed demo data, enforce child-record delete checks, and tune query indexes. |
| **Tester** | 6 PRs | 24 PRs | Author sprint test plans and acceptance criteria, execute functional & edge-case tests (expired tokens, last-superadmin guard, soft-delete blocks), run full per-right permission matrix tests, maintain automated smoke/regression tests, and verify bug fixes. |
| **UI/UX Designer** | 5 PRs | 20 PRs | Establish the design system (colors, typography, components), produce wireframes and hi-fi mockups with developer handoff notes for every module, define empty/error/confirm states, and conduct usability reviews of built screens. |
| **Scrum Master** | 5 PRs | 20 PRs | Configure GitHub repo rulesets & templates, manage the 4-sprint GitHub Project board & 8-week module roadmap, facilitate working agreements & DoD, run Day 5 mid-sprint impediment checks, track velocity/burndown, and deliver sprint reviews, retrospectives, demo scripts, and peer evaluations. |