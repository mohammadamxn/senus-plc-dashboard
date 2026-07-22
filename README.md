# Senus PLC Board Report

AI-native board pack for **Management**, the **Board**, **equity investors**, and **credit providers**, built on Senus PLC historic financials (HY2026 statutorys + FY2026 chairman narrative/KPIs).

## Architecture overview

Modular monolith (Next.js App Router):

- `src/app` — thin routes
- `src/modules` — ingestion, metrics, reporting, AI, auth
- `src/db` — Drizzle schema → **remote Supabase Postgres**
- `content/` — seed data, prompts, evals (versioned domain content)

Deterministic TypeScript computes every number; AI narrates and must cite metrics/documents.

## Technologies used & rationale

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 15+ (RSC) | Server-rendered report pages, streaming AI, ISR-friendly |
| UI | Tailwind + owned components | Bespoke board-pack look without library lock-in |
| Data | Supabase Postgres + Drizzle | Relational integrity, `NUMERIC`, remote deploy |
| Metrics | Pure TS + decimal.js | Exact money math; fully unit-tested |
| AI extraction | Claude + Zod + human approve | PDF → facts in DB; metrics engine calculates ratios |
| Metrics | Pure TS + decimal.js | Exact money math; fully unit-tested |

## Document ingestion (AI extract → approve → calculate)

1. Admin opens `/admin/ingest`.
2. Upload a Senus-style half-year PDF → `unpdf` extracts text (page-tagged, stored on `extraction_jobs.raw_text`) → **one** Claude call returns structured line items + KPIs (Zod). There is no separate chunking stage — narrative grounding for commentary comes directly from that same page-tagged text later, on demand.
3. Admin reviews via **Financials | Insights** → edit lines → **Approve** writes `statement_lines` / `operating_kpis` (DB-only, fast) and the metrics engine fills `metric_values`. The UI switches to the Insights tab immediately — it doesn't wait on any LLM call.
4. The Insights tab then triggers **one** Claude call that generates commentary for all five sections (metrics + the approved PDF's page text), citing `pageRef` + a verbatim quote per claim rather than a pre-curated chunk id. A `dataHash` guard skips this call entirely if nothing changed since the last run. Admin can edit any section's text directly (click and type), verify each citation in the "Verify sources" box below it, then approve for board readers.
5. The board report shows KPIs always; approved (or management-preview) commentary under each section. Citations are admin-only — never shown to board/management/equity/credit readers.

```bash
npm run db:reset-facts   # clear financial facts (keeps auth + chart/periods) to test upload from empty
```

**Hard rule:** the LLM never calculates margins, runway, DSCR, or ROCE. Commentary context is metrics + the approved HY PDF's own page text (direct load, not vector search, no chunk table).

### AI commentary env

| Var | Purpose |
|---|---|
| `CLAUDE_API_KEY` / `ANTHROPIC_API_KEY` | Extraction, commentary |
| `AI_MODEL` | Optional model id (default `claude-sonnet-4-6`) |

Optional: create a Supabase Storage bucket `hy-interims` so extract can store the PDF (`source_documents.storage_path`). Extract still works if the bucket is missing.

## Authentication & role-based access control

Every user must sign in; what they see is fixed by their **audience** (role):

| Audience | Sees |
|---|---|
| Credit providers | Solvency & Leverage, Cash & Liquidity, Profitability |
| Equity investors | Growth & Revenue, Cash & Liquidity, Returns |
| Board & Management | Everything, including the raw financial statements |

This is enforced twice (defense-in-depth), not once:

1. **Application layer** — the report page (`src/app/(report)/reports/[period]/page.tsx`) derives the audience from the signed-in user's session (never a URL param) and calls `visibleCategoriesFor()`/`isMetricVisibleFor()` (`src/config/metric-categories.ts`) to decide which sections and metrics to render at all.
2. **Database layer (Row Level Security)** — a least-privilege `app_runtime` Postgres role (`NOBYPASSRLS`) is used for all report-data reads at request time, scoped per-request to `app.current_audience` via `withAudienceScope()` (`src/modules/auth/db-scope.ts`). RLS policies on `metric_values` (per-metric, via `metric_defs.audience_tags`), `operating_kpis`, and `profiles` mean that even a route that forgets the application-layer check still can't leak another audience's rows. `metric_defs.audience_tags` is seeded straight from `buildMetricAudienceTags()` — the same TypeScript policy — so the two layers can't silently drift apart (see the drift test in `tests/`).

### Accounts are invite-only — there is no signup page

Given this platform carries confidential board financials shared with external investors and lenders, nobody can create their own account:

1. An admin picks an email + a role on `/admin/invite`. The Server Action re-checks `is_admin` server-side and calls `supabase.auth.admin.inviteUserByEmail(email, { data: { audience, is_admin } })` with the service-role key — the role is trusted admin-set metadata, never something the invitee can influence.
2. A Postgres trigger (`handle_new_user`, in `0003_auth_flow.sql`) reads that metadata the instant the `auth.users` row is created and writes the matching `profiles` row — there is never a window where an account exists without its role already fixed.
3. The invitee clicks the emailed link → `/auth/confirm` exchanges the token for a session → `/accept-invite` sets their password → they land straight in their role-scoped report.

**Required manual step:** disable **"Allow new users to sign up"** in the Supabase Dashboard (Authentication → Providers → Email). Deleting the app's `/signup` page alone doesn't stop someone calling Supabase's public `signUp()` endpoint directly with the anon key — that must be turned off at the project level too. While you're there, it's also worth tightening Authentication → Rate Limits as a free, zero-code outer backstop on login/invite email volume.

### Bootstrapping the first admin

Nobody can invite the first admin from `/admin/invite` — there's no admin yet to click the button. Run this once, by hand, at initial setup:

```bash
npm run bootstrap-admin -- you@example.com
```

This calls the same invite API directly from the CLI with the service-role key, granting `audience: management, is_admin: true`. Every admin after that should be invited normally through `/admin/invite`.

### Invite abuse controls

Every invite attempt (sent or failed) and every role/admin change is written to `audit_log`. Login/password-reset attempts rely on Supabase Auth's own built-in throttling.

### Other production-hardening notes

- **Anti-enumeration**: login and password-reset return the same generic message whether the email exists or not.
- **Security headers** (`next.config.ts`): HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`, a baseline CSP.
- **Origin lock**: set `SERVER_ACTIONS_ALLOWED_ORIGINS` once the deploy domain is known, rather than relying on Next's inferred default.
- **Open-redirect guard**: `/auth/confirm`'s `?next=` param is checked against a fixed allow-list before being followed.
- **Fail-fast env validation**: `src/lib/env.ts` throws a clear error at boot if required env vars are missing, instead of failing obscurely mid-request.
- **Not built here (flagged, not silently dropped)**: MFA/2FA (Supabase supports TOTP natively if this gets prioritized later); Supabase's default email sending is dev-grade — swap in a real transactional provider (Resend/Postmark/SES) before real production traffic.

## Getting started

```bash
cd assiduous-assignment
npm install
cp .env.example .env.local   # fill in DATABASE_URL, RUNTIME_DATABASE_URL, Supabase keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → redirects to `/login`.

The UI runs from `content/seed/` **without** a database (falls back automatically if `RUNTIME_DATABASE_URL`/`DATABASE_URL` aren't set or a query fails). When ready for deploy:

1. Create a remote Supabase project
2. Set `DATABASE_URL`, `RUNTIME_DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and (for production) `NEXT_PUBLIC_SITE_URL` in `.env.local` and on your host
3. In Supabase → Authentication → URL configuration, set **Site URL** to the same public origin (e.g. `https://senus-plc-dashboard.vercel.app`) and allow redirect URLs under `/auth/confirm`
4. `npm run db:migrate` to apply all migrations (creates the `app_runtime` role among other things — copy its generated password from the migration output into `RUNTIME_DATABASE_URL`, then discard it; it's never written to disk)
5. `npm run db:seed` to load the demo dataset (or leave empty and use `/admin/ingest` to upload a PDF)
6. Set `CLAUDE_API_KEY` for extraction
7. Disable public signup in the Supabase Dashboard (see above), then `npm run bootstrap-admin -- you@example.com`

Invite and password-reset emails use `NEXT_PUBLIC_SITE_URL` + `/auth/confirm` (invite → `/accept-invite`, reset → `/update-password`). If Site URL / `NEXT_PUBLIC_SITE_URL` still point at localhost, email links will fail with connection refused.

```bash
npm test          # unit tests (vitest)
npm run test:e2e  # Playwright (needs E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD + running app env)
npm run build     # production build
```

### Playwright E2E

```bash
# .env.local (or shell):
# E2E_ADMIN_EMAIL=...
# E2E_ADMIN_PASSWORD=...
npx playwright install chromium   # once
npm run test:e2e                  # starts next dev via webServer unless PLAYWRIGHT_BASE_URL is set
npm run test:e2e:ui               # interactive
```

Slow specs that upload `docs/Senus Notification of Results HY Dec 2025.pdf` and call Claude are tagged `@slow`.

## AI-assisted development workflow

- Schema and metrics engine scaffolded from typed specs in the plan  
- Tests generated against golden HY2026 figures  
- Prompt templates in `content/prompts/`  
- CI should gate typecheck, lint, vitest, and (later) live prompt evals  

## Assumptions & output validation

- HY2026 figures are **unaudited** statutory extracts from the interim report  
- FY2026 chairman KPIs are **management/narrative** (often rounded) — labelled in UI  
- Cash: HY2026 €735,189 vs FYE2026 ~€0.13m — liquidity panel shows both  
- Integrity: fixed-assets roll-up, BS cash ↔ CF closing cash, net assets ↔ equity  
- AI must not invent arithmetic; citations required before board-visible insights  

## Repository layout

See plan doc / tree under `content/`, `src/modules/`, `src/db/`, `tests/`.
