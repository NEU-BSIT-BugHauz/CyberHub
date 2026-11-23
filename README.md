# CyberHub — Database & Student Setup Guide

## Prerequisites
* **Node.js** (v18 or higher)
* **Git**
* Access to the team **Supabase** project (or a local PostgreSQL 15+ instance)

---

## Local Setup Instructions

1. **Clone the repository and install dependencies:**
   ```bash
   git clone [https://github.com/rolandojrdala-debug/CyberHub.git](https://github.com/rolandojrdala-debug/CyberHub.git)
   cd CyberHub
   npm install
   ```

2. **Create your local `.env` file:**
   Duplicate `.env.example` and rename the copy to `.env` (or run the command below in your terminal):
   ```bash
   cp .env.example .env
   ```
   *(Never commit `.env` to GitHub—it is ignored automatically by `.gitignore`.)*

3. **Add the team Supabase database URL:**
   * Open the team **Supabase Dashboard** and click **Connect** at the top.
   * Select **Session pooler** (Port `5432`, IPv4 compatible) and copy the connection URI.
   * Open your `.env` file, paste the URI into `DATABASE_URL`, and replace `[YOUR-PASSWORD]` with the team database password.

4. **Test your database connection:**
   ```bash
   npm run db:test
   ```
   You should see: `PostgreSQL connection established.`

5. **Run all pending database migrations:**
   ```bash
   npm run migrate
   ```
   This runs every `.sql` file in `db/migrations/` in order and records applied scripts in the `schema_migrations` table.

6. **Start the development server:**
   ```bash
   npm run dev
   ```
   The server will run at `http://localhost:3000`.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run db:test` | Verifies that Node.js can connect to PostgreSQL/Supabase. |
| `npm run migrate` | Applies all pending `.sql` migration files in `db/migrations/`. |
| `npm run dev` | Starts the Express server with Nodemon auto-reload. |
| `npm start` | Starts the Express server in standard mode. |
| `npm test` | Runs the Jest test suite. |
