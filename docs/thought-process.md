# Thought Process — Senus PLC Board Report

I built this as a board-reporting platform for four distinct readers of the same underlying financial data — Management, the Board, Equity Investors, and Credit Providers — where the numbers are always computed the same way, but what each person is shown, and how it's narrated, differs by who they are.

## Architecture

I built this as a single, well-organised application (a "modular monolith") rather than splitting it into separate services from day one. Routes are kept thin, and the real logic lives in dedicated modules for document ingestion, financial metrics, reporting, AI, and authentication. This keeps the codebase easy to navigate and safe to change one area without breaking another.

The one rule I held firm on throughout: every number shown on the report — margins, cash runway, ROCE, gearing — is calculated by deterministic TypeScript code, never by the AI. The AI's job is limited to extracting data from documents and writing narrative commentary around numbers that have already been calculated.

I chose **Next.js** as the framework for a few reasons:

- Its App Router renders pages on the server. A report page can query the database and send back complete HTML in one step, instead of loading an empty page and then fetching data separately in the browser. For a data-heavy board report, this is a better fit than a client-only single-page app.
- Server Actions let me write admin operations — inviting a user, approving a financial pack, generating commentary — as plain server-side functions, instead of building a separate REST API for each one.
- It combines the frontend and backend into a single application, which was simpler to build and deploy than running a separate frontend and API service for a project of this size.

For the database, authentication, and file storage, I chose **Supabase**, for a few reasons:

- It bundles a proper Postgres database (for relational integrity between statement lines and metrics), user authentication (invite-only accounts, sessions, email links), and file storage (for the original PDFs) into one connected platform, rather than three separate services I'd have to wire together myself.
- Because it's built on Postgres, it gives me Row Level Security out of the box. This is a standard Postgres feature, not something unique to Supabase — it lets me enforce who can see what data directly inside the database, not only in the application code. That gives two independent layers of protection: even if a page or API route ever forgot to check a user's permissions, the database itself would still refuse to return data that user isn't allowed to see. Supabase just makes this easy to set up and connect to the app's session, without me having to run and secure a Postgres server myself.
- It's fully managed and hosted, so I didn't need to run or maintain my own database server. That let me spend my time on the financial metrics engine and the AI pipeline instead of on infrastructure.

## Product decisions

- Financials are approved before any AI commentary is generated. I designed it this way so the AI only ever writes commentary about numbers that a human has already checked and confirmed are correct — it never comments on raw, unverified extraction output. Approving is a fast, database-only step that never waits on an LLM call: before approving, admins can review the data the AI extracted from the PDF and correct anything it got wrong. The same principle applies to AI-generated insights: an admin reviews and can edit the text before it's shown to anyone else.
- Citations (a page reference plus a quote from the source document) are visible to admins only — never to board, investor, or credit readers. They exist purely so an admin can check that the AI's commentary is actually grounded in the document, and edit the text if it isn't; they're not meant to appear in the final, polished report.
- Every section has a table/chart toggle, so users can view the same data as either precise figures or a visual chart, depending on what they find easier to read. The comparison shown is always the same half-year the year before (for example, HY2026 vs HY2025).

## Assumptions

- **Reporting period:** based on the reference materials provided, I focused on year-on-year reporting. All metrics, comparisons, and AI-generated insights are calculated from YoY data — this half-year against the same half-year last year — rather than sequential or multi-year trends.
- **Access depends on role:** I assumed that what a user can see should depend on who they are. Management and the Board can see everything, including the raw financial statements. Equity Investors and Credit Providers can each only see the sections relevant to them (growth, liquidity, and returns for investors; profitability, liquidity, and solvency for credit providers). This is enforced both in the application and at the database level.
- **Data should be restricted by default:** I assumed the financial data is sensitive enough that it should not be publicly accessible. For this reason, there is no signup page — an admin must invite a named person and assign them a fixed role, rather than allowing anyone to create an account and view the board's financials.
- **Labelling data sources:** I treated the HY statutory figures as unaudited extracts from the interim report, and the FY "chairman" KPIs as management/narrative estimates. Both are labelled accordingly in the UI, rather than presented with false precision.

## AI decisions, token usage, and cost

The Claude model is configured only via `AI_MODEL` (no hardcoded default in code), so extraction and commentary can be pointed at Haiku, Sonnet, or anything else without a redeploy of model strings. Both tasks return strict JSON that has to validate against a Zod schema — which matters more here than raw creativity — and call volume is low enough (a handful of ingestions per reporting period) that a cheaper tier like Haiku is a reasonable default in env.

To keep token usage (and cost) down, I deliberately avoided the "obvious" version of this pipeline:

- **One call per stage, not one call per section.** Extraction is a single Claude call per uploaded PDF. Commentary is a single `generateObject` call that returns all five sections (growth, profitability, liquidity, solvency, returns) together, instead of five separate round-trips — roughly a 5x cut in repeated system-prompt and context tokens versus calling once per section.
- **A `dataHash` guard skips the call entirely** when nothing has changed since the last successful generation, so re-opening the admin panel, or an accidental double-click, doesn't re-spend tokens producing identical output.
- **Context sent to the model is trimmed**, not the whole document repeated per section — page text is capped, and only the current period's approved facts and metrics are included, not the full historical dataset.
- **Arithmetic never goes into the prompt.** Margins, runway, DSCR, ROCE etc. are pre-computed and handed to Claude as already-calculated figures to narrate, which keeps prompts shorter and outputs more reliable — the model is never asked to "think through" a calculation.
- **Zod is a hard gate, not a retry loop.** If the model's output doesn't validate, I fix it by tightening what the prompt asks for (e.g. a citation quote length limit) rather than automatically retrying, which would otherwise multiply token spend on every failure.

## Security

Accounts are invite-only; access is enforced twice — once in the application layer, once via Postgres Row Level Security — so the two can't silently drift apart. Invite and password-reset emails always resolve against the deployed site URL, never localhost, in production.

## How I used AI tools

I used Cursor and Claude heavily for implementation speed — scaffolding modules, writing tests, drafting prompts — but I owned the prompt design, the schema constraints, and the debugging. One concrete example: commentary generation silently stopped working in production because a *single* citation quote exceeded its character limit, which failed validation for the *entire* five-section response object. I traced that with runtime logs down to the exact Zod issue, then fixed it by tightening what the prompt asks Claude for, rather than quietly truncating the model's output after the fact.

## What I'd do next

MFA/2FA on top of invite-only accounts, a production-grade transactional email provider in place of Supabase's default sender, and a fuller multi-page PDF fixture for the slow end-to-end ingestion test.
