# Senus PLC Board Report

A board-reporting platform for **Senus PLC** half-year financials. The same underlying numbers are shown to four audiences: **Management**, the **Board**, **Equity Investors**, and **Credit Providers**.

**Live rule throughout:** deterministic TypeScript computes every figure (margins, runway, ROCE, gearing, and so on). AI extracts data from PDFs and writes narrative commentary around those pre-computed numbers. It never does the arithmetic.

---

## Architecture

This is a **modular monolith**: one Next.js app, clear module boundaries, one Postgres database.


| Area                    | Responsibility                                    |
| ----------------------- | ------------------------------------------------- |
| `src/app`               | Routes and pages                                  |
| `src/modules/ingestion` | PDF upload, Claude extraction, human approve      |
| `src/modules/metrics`   | Metrics calculations                              |
| `src/modules/reporting` | Role-scoped board report                          |
| `src/modules/ai`        | Pack commentary generation and persistence        |
| `src/modules/auth`      | Invite-only accounts, sessions, RLS scoping       |
| `src/db`                | Drizzle schema and migrations (Supabase Postgres) |
| `content/`              | AI prompts                                        |


---

## Technologies used


| Layer                     | Choice                        | Why                                                                                                                            |
| ------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| App                       | Next.js (App Router, RSC)     | One app for server-rendered role-scoped reports, Server Actions (ingest/approve/invite), route guards, and server-only secrets |
| Database / auth / storage | Supabase Postgres + Drizzle   | Relational integrity, invite auth                                                                                              |
| Metrics                   | TypeScript + decimal.js       | Exact maths; easy to unit-test                                                                                                 |
| AI                        | Claude (`AI_MODEL` env) + Zod | Structured extraction and commentary; schema-validated JSON                                                                    |
| Access control            | App checks + Postgres RLS     | Two layers so a missed UI check still cannot leak rows                                                                         |


---

## How I used AI tools

I used Cursor to help outline a plan. At every step I asked it for a ranked list of options when implementing a feature, and I provided the necessary context (the project spec). I also used Cursor to write code and debug. The loop was:

- **Plan** — break the feature into steps and agree the approach before writing code
- **Ask** — request ranked options and push on trade-offs (why this decision over others, what fails, what is simpler)
- **Review** — check the suggestion against the spec and internet sources before accepting it
- **Implement** — have Cursor write or change the code once the choice is settled
- **Review again** — re-read the result, debug if needed, and only then move on

I cross-checked AI suggestions and design decisions against sources on the internet before committing to an approach.

---

## Assumptions

- **Reporting period:** based on the reference materials provided, I focused on year-on-year reporting. All metrics, comparisons, and AI-generated insights are calculated from YoY data.
- **Access depends on role:** I assumed that what a user can see should depend on who they are. Management and the Board can see everything, including the raw financial statements. Equity Investors and Credit Providers can each only see the sections relevant to them (growth, liquidity, and returns for investors; profitability, liquidity, and solvency for credit providers).
- **Data should be restricted by default:** I assumed the financial data is sensitive enough that it should not be publicly accessible. For this reason, there is no signup page, an admin must invite a named person and assign them a fixed role, rather than allowing anyone to create an account and view the board's financials.

---

## How outputs were validated


| What                            | How                                             |
| ------------------------------- | ----------------------------------------------- |
| Metrics (margins, runway, etc.) | Unit tests against HY2026 figures (`npm test`)  |
| Extraction / commentary shape   | Zod schemas; invalid model output fails closed  |
| AI commentary                   | Admin review/edit                               |
| Role access                     | App filtering + RLS + Playwright audience tests |


---

## Getting started

```bash
cd assiduous-assignment
npm install
cp .env.example .env.local   # fill DATABASE_URL, RUNTIME_DATABASE_URL, Supabase keys, CLAUDE_API_KEY, AI_MODEL
npm run db:migrate
npm run db:seed              # optional demo data — or leave empty and use /admin/ingest
npm run bootstrap-admin -- you@example.com
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → `/login`.

### Important env vars


| Var                                                          | Purpose                                               |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| `DATABASE_URL`                                               | Migrations / admin DB access                          |
| `RUNTIME_DATABASE_URL`                                       | Least-privilege `app_runtime` role for report reads   |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth client                                           |
| `SUPABASE_SERVICE_ROLE_KEY`                                  | Invites and admin auth operations                     |
| `CLAUDE_API_KEY`                                             | Data extraction and AI commentary                     |
| `AI_MODEL`                                                   | Required Claude model id (e.g. `claude-haiku-4-5`)    |
| `NEXT_PUBLIC_SITE_URL`                                       | Public origin for invite / password-reset email links |


Also in Supabase: set Site URL and redirect URLs to match production, and **disable “Allow new users to sign up”** so accounts stay invite-only.

## Authentication (short)


| Audience           | Sees                                 |
| ------------------ | ------------------------------------ |
| Credit             | Solvency, Liquidity, Profitability   |
| Equity             | Growth, Liquidity, Returns           |
| Board & Management | Everything, including raw statements |


Access is enforced in the app **and** via Postgres RLS. Admins invite users from `/admin/invite`; the first admin is bootstrapped with `npm run bootstrap-admin`.