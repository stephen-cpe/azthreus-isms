# AGENTS.md

Working notes for AI coding agents on this repository. Facts below were verified against the code on the last audit. If anything here conflicts with the code, the code wins — update this file when that happens.

## What this project is

An open-source Integrated Student Management System (ISMS) for the fictional **Azthreus Academy of Science and Technology**, the education and research arm of the fictional **Azthreus Systems**. It recreates a classic Windows-era desktop UI as a web app, backed by PostgreSQL. All people and data in this repository are fictional. The project is published under the MIT License by Stephen Paul D. Jacildo.

This is an intentional demo product. Reviewers use it to get a feel for the application and give feedback. Demo affordances (for example, the credentials table on the sign-in screen) are deliberate — keep them. Do not "productionize" (hiding demo credentials, forcing password changes, hardening for the internet) unless the human asks. The finished system is demonstrated end-to-end, so seeded demo data must stay realistic.

The classic desktop layout is kept on purpose: the white school header with the crest, the left sidebar of modules with sub-links, the gray desktop, `WindowChrome` modal windows, and the date/time main pane. Do not redesign layouts, move navigation, or introduce new shells, tabs, or menus. New screens follow the existing patterns (a sidebar entry and a `WindowChrome` modal).

## Critical operating rules (hard rules)

- **The human handles ALL database and server operations**: creating/dropping databases and roles, running `psql`, executing `.sql` files, editing PostgreSQL config, and starting/stopping the app.
- Do NOT connect to PostgreSQL, guess credentials, spin up temporary database instances, modify PostgreSQL settings, or run `pnpm dev` / `pnpm start`.
- You MAY write SQL/seed files and application code, and you MAY run local non-DB checks (`pnpm build`, `pnpm exec tsc --noEmit`, `pnpm install`).
- When verification requires the database or a running app, output the exact PowerShell commands for the human to run; they will paste results back. Wiping and re-initializing the database is acceptable advice — the human executes it.
- Do not run any git command that changes state (no commit, add, reset, checkout, stash, clean). `git status` and `git diff` are fine. The owner commits checkpoints.
- Do not modify anything outside the repository.
- Ask before large or destructive changes that are not already approved by the current task.
- Do not add a component library (no shadcn/ui, MUI, Chakra, etc.) and do not add a charting library. Hand-built components with Tailwind only. `lucide-react` and `sonner` are already present.
- Every person, phone number, address, and previous-school name in seed data must be invented. Never copy a name from anywhere.
- Leave no dead UI: every button or link you touch must work, or be removed.
- `_review/` is a git-ignored scratch folder for phase reports. Create it if it is missing and keep `.gitignore` containing `_review/`.

## Stack and environment (verified)

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript, package manager `pnpm` (pinned to `12.9.1` in `package.json`).
- Tailwind CSS v4 via `@tailwindcss/postcss`. **No shadcn/ui and no component library** — every UI element is hand-built retro styling in `components/` and `app/globals.css`. Do not introduce shadcn/ui or other component frameworks.
- `lucide-react` for icons, `sonner` for toasts (`<Toaster />` in `app/layout.tsx`).
- Database access: `pg` driver with raw SQL. No ORM.
- Host OS: Windows, shell is **PowerShell 5.1** (no `&&`; chain with `;` or `if ($?)`). PostgreSQL 18 runs locally (database `azthreus_isms`, role `isms_user` — see `.env.example` and README for the setup the human runs).
- `pnpm build` currently passes with zero type errors. Don't fix pre-existing type errors unrelated to your change; never add new ones.
- `package.json` has no `lint` script and there is **no ESLint config** in the repo — do not run or rely on ESLint.

## Architecture

- **Single-route SPA.** Everything lives in `app/page.tsx`: splash → login (`LoginPage`) → welcome screen → dashboard. "Pages" and "modals" are client-side state (`activePage` / `activeModal` unions in `app/page.tsx`), not routes. Modals unmount when closed and refetch data on reopen — that is the main data-freshness mechanism.
- **API layer**: route handlers under `app/api/` for auth, lookups, students, `students/[id]`, `students/[id]/re-enroll`, `students/[id]/account`, `students/[id]/profile`, accounts, payments, `payments/[id]/reverse`, assessments, collections, grades, users, audit, and dashboard. All handlers set `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"`. SQL uses camelCase JSON aliases (`AS "studentId"` etc.); shared payload types are in `lib/types.ts`.
- **Read/write roles**: `requireAuth` gates reads that any signed-in role may use (lookups, students, profiles, account details, assessments, dashboard). `requireRoles` gates the rest: students/assessments/re-enrollment → admin+registrar; accounts/payments → admin+cashier; collections → admin+cashier; grades → admin+registrar; users/audit/reversal → admin only. The student profile route omits `gradeSummary`, `generalAverage`, and `honors` for cashiers.
- **Validation** (`lib/validation.ts`): `readText`, `readInt`, `readId`, `readDate`, `readAmount`, and `readEnum` return `null` for omitted optional values and throw a 400 `ApiError` for invalid input. Amounts are finite, non-negative, bounded, and rounded to two decimals. Dates must be real calendar dates in `YYYY-MM-DD` form. Use these helpers for new write routes rather than local coercion.
- **Date and money helpers**: `lib/date.ts` provides `localDateIso()` (local calendar date, not UTC) and `isValidIsoDate()`. `lib/money.ts` provides the two-decimal `money()` formatter used by every screen. Do not duplicate either helper.
- **DB access** (`lib/db.ts`): `query`, `queryOne`, `withTransaction`. Multi-step writes must use `withTransaction`.
- **Audit** (`lib/audit.ts`): `writeAudit(client, actor, { action, entityType, entityId, summary, details })` takes the transaction client, so the audit row commits or rolls back with the change. The action and entity lists are exported for the Audit Log filters. Details hold field names or operational facts, never password hashes, session tokens, or full personal records.
- **Display IDs** (`lib/format-ids.ts`): sequence-based numbers stored as integers and displayed as `AA-<n>` (student), `AC-<n>` (account), `AZR-` + six digits (receipt), and `AZV-` + six digits (reversal). The app and seed use `nextval()` on `students_reg_number_seq`, `accounts_account_id_seq`, and `payments_payment_id_seq`; never `MAX(...) + 1`. Receipt and reversal numbers are generated on the server only.
- **Enrollment writes** (`lib/enroll.ts`): `createEnrollmentAccount` (duplicate-account guard, account + initial payment + recompute + `account.create`/`payment.post` audit rows, used identically by new-student enrollment, Add Account, and re-enrollment), `updateStudentPersonalFields`, `upsertStudentParents`. Re-enrollment (`POST /api/students/[id]/re-enroll`) updates the student's current enrollment and opens a new account for the new school year — it never inserts a second student row. The duplicate-account check is per (student, school year), not per student. In `updateStudentPersonalFields` / `upsertStudentParents`, an omitted field is left unchanged but an empty string clears it, so the Add Student page hydrates the re-enroll form from `GET /api/students/[id]/profile` before submitting — never send a partial payload. If hydration fails, the page clears the selection instead of submitting blanks.
- **Auth** (`lib/session.ts`, `lib/auth.ts`, `lib/password.ts`): scrypt password hashing; HMAC-signed stateless session cookie (`isms_session`, 8-hour TTL, HttpOnly). `requireAuth` re-reads the user by id from the database on every request, so deactivated users are rejected and database roles (not cookie roles) are enforced. In production `SESSION_SECRET` must be at least 32 characters; development uses a fixed fallback with a one-time warning. `requireAuth` / `requireRoles` enforce roles server-side on every mutating route — UI gating (`lib/roles.ts`, `canAccessPage` / `canWrite`) is convenience only.
- **Roles**: `admin`, `registrar`, `cashier`. The `users.role` column is `NOT NULL` with a CHECK constraint for those three values.
- **Printing** (`lib/print.ts`): `openPrintWindow()` builds a styled printable document (Academy crest, school header, tables, signature lines) in a popup. OR, SOA, COR, report cards, rankings, collection reports, receipts, and reversal slips are printable. A reversal prints as a "Reversal Slip", never as an Official Receipt. Every interpolated value, including the logo URL and signature labels, is HTML-escaped; do not add unescaped interpolation.
- **Schema + seed**: `init_db.sql` at the repo root is the single consolidated source (schema, indexes, views, demo data). If the schema changes, this file must be updated and the README's setup guide kept accurate.

## Data-consistency rules

- The `payments` table is the single source of truth for money. **Never update account balances directly**: post a `payments` row, then call `recomputeAccountBalances` (`lib/accounts.ts`) inside the same transaction. This is what keeps balances, months-not-paid, dues, and collection reports consistent across features.
- Payments are immutable. A correction is a new `entry_type = 'reversal'` row with all amounts negated, a required reason, `reverses_payment_id`, and an `AZV-` receipt. `POST /api/payments/[id]/reverse` (admin only) locks the original, refuses a reversal of a reversal or a second reversal, recomputes the account, and writes the audit entry in the same transaction. A partial unique index on `reverses_payment_id` enforces one reversal per payment. Months-paid logic counts only unreversed `entry_type = 'payment'` tuition rows.
- Every logged action writes its audit row through `lib/audit.ts` with the transaction client, in the same transaction as the change. Details hold field names or operational facts, never password hashes, session tokens, or full personal records.
- One student row is one person. A student may hold **one account per school year** (current + history); a unique index on `accounts(student_id, school_year_id)` enforces it. Anywhere a "current" account is needed, resolve it as the latest account (`ORDER BY id DESC LIMIT 1` — seed and app insert history first, current enrollment last). The student list (`GET /api/students`) and `v_balance_inquiry` already use a LATERAL latest-account join for this reason — do not revert to a plain join or student rows will duplicate. `hasAccount=yes/no` on the student list means "has an account for the student's current school year", so payment screens never post to a prior-year account.
- Grade summaries shown on the student profile are scoped to the student's **current** school year. Report cards and rankings take an explicit school year and resolve the level from the account for that year; the demo has one section per level per year, so that section is used for historical display. Never aggregate grades across years into a single per-period list — period names repeat every year and will duplicate in the UI.
- Collection reports (daily / monthly / date-range) are computed live from `payments` — no archived report tables are written by the app. Totals are rounded to two decimals in the API.
- Payments are immutable history once posted; corrections should be new entries, never edits/deletes.

## Business rules

- Fee plans derived from the total fee: Monthly = 20% down + 10 installments of 8%; Quarterly = 30% + 4 x 17.5%; Semi-Annual = 50% + 2 x 25%; Cash/Annual = 100%.
- Grading: Philippine scale, 75 = passing. Honors: 90+ With Honors, 95+ With High Honors, 98+ With Highest Honors.
- Display ID generation follows the sequence conventions: `students_reg_number_seq` starts at 260001, `accounts_account_id_seq` at 410001, and `payments_payment_id_seq` at 700001. Seed and code call `nextval(...)`; the seed uses `setval(...)` afterward so the next number is unused. Receipt numbers are `AZR-` + zero-padded `payment_id`; reversal numbers are `AZV-` + six digits.
- A student may be enrolled, dropped, graduated, or transferred. `Add Account` creates the account for the student's current school year only; use re-enrollment to open a new year. A payment can be posted only to an enrolled student's current-year account (non-student payments are posted through Other Payments).

## UI conventions (keep the classic layout)

- Accent palette: the `--az-*` tokens in `app/globals.css`, exposed to Tailwind as `az-*` color utilities (`text-az-steel`, `bg-az-teal-pale`, `border-az-teal-deep`, …). `az-steel` covers labels, table-header fills, and large titles; `az-teal-deep` covers headings, links, and positive totals; `az-teal-light` is for pale fills and text on dark grids; the pale tokens (`az-teal-pale`, `az-teal-faint`, `az-steel-pale`, `az-sand-pale`) fill panels. `lib/print.ts` repeats the same values as CSS variables inside the print popup. Neutrals stay fixed: `#d4d0c8` desktop, `#f0f0f0`/`#f5f5f5` panels, `#808080` borders. Beveled controls: `border-2 border-[#808080]`, `bg-[#c0c0c0]`, hover `#d0d0d0`.
- Modals use `WindowChrome` (title bar with minimize/close, optional module icon). Sidebar entries use `ModuleIcon` (asset must exist in `public/images/module-*.png`; keep the `ModuleIconName` union in sync). Administration is an admin-only sidebar section; the header carries a `Change password` link for every role.
- Every screen shows the school header block, current user, and live clock. Currency is formatted via `lib/money.ts`. Feedback uses `sonner` toasts plus the retro message box in the payment screens.
- The dashboard main pane shows role-filtered enrollment, money, and grade-posting summaries from `GET /api/dashboard`; the boxes use div-based bars and open the related screens.
- The sign-in screen intentionally shows the demo accounts. The welcome screen states that all data is fictional.
- No dead UI in anything you touch: wire it, remove it, or ask. Prefer the smallest honest fix over building a new feature just to justify a button.

## Demo data and accounts

- The seed is anchored to the **current date** at `init_db.sql` run time: the owning June-start school year is `is_current` (mid-cycle cohort), two prior years hold returning-student history (one account per year, paid in full except the three seeded reversal examples), one future year holds assessments/sections only. Months-elapsed, quarters-posted, and installment counts all derive from `CURRENT_DATE`, and a handful of payments land within days of today so Daily Collection is alive out of the box. The `init_db.sql` header explains the timeline rule.
- 266 students, at least 18 in every level from Kindergarten to Grade 12 (single STEM strand in Senior High): mostly enrolled, plus 3 Grade 6 graduates from the prior year (re-enrollment demo subjects into Grade 7), 3 Grade 12 graduates, 2 dropped, 1 transferred. Every student has a posted payment. Prior-year accounts/payments/grades exist via the `seed_enrollment` temp table; grades gate quarters by elapsed months. Three prior-year tuition payments are reversed with plausible reasons, and matching `audit_log` rows are seeded directly, so prior-year accounts show a small balance instead of being fully paid.
- Monthly collection defaults to today's month; date-range defaults to the current school year (via the `startDate`/`endDate` on `LookupSchoolYear`); Daily Collection opens on today's date.
- The deterministic demo cast is in `_review/demo-cast.md` (git-ignored) and repeated in `DEMO.md`: Garcia, Dennis Santos (AA-260121), Garcia, Camille Santos (AA-260122), and Castillo, Dominic Castillo (AA-260123) are the Grade 6 graduates; Serrano, Adriana Castillo (AA-260244), Acosta, Aldrin Rosales (AA-260245), and Acosta, Aileen Rosales (AA-260246) are the Grade 12 graduates; Gonzales, Gabriel Santos (AA-260061), Acosta, Adriana Rojas (AA-260164), and Gonzales, Clarisse Reyes (AA-260144) are the dropped/transferred examples.
- Seeded app users (shown on the login screen; safe to reference in docs):

  | Username  | Password          | Role      |
  |-----------|-------------------|-----------|
  | admin     | ADMINpassword     | admin     |
  | registrar | REGISTRARpassword | registrar |
  | cashier   | CASHIERpassword   | cashier   |

## Known issues / out of scope

- Payment corrections are whole-payment reversals only. Partial reversals, refunds, and cash adjustments are not implemented.
- Grade periods are four quarters for every level, including Senior High; SHS semesters are not modeled. Senior High uses a single STEM strand. The K-12 curriculum is illustrative, not a certified DepEd curriculum.
- A student's section history is not stored separately. Historical report cards and rankings resolve the level from the account for that year and use the demo's one section per level per year. Editing a student's level or school year does not move an account; use re-enrollment for a new year.
- There is no photo upload (the `students.photo_url` column is unused), no section management, no attendance, no scheduling, and no SMS/email integration.
- The app is not hardened for internet exposure: demo credentials are shown, there is no rate limiting, and the session cookie is the only CSRF mitigation (`SameSite=Lax`). Do not deploy it publicly without a dedicated review.
- The student list is limited to 500 rows per request; the seed has 266, so it is not reached in the demo.
- The app has no real-time push; screens refetch on mount.
- `package.json` has no lint script and the repo has no ESLint config.

## Definition of done

- `pnpm build` passes with no new type errors; `pnpm exec tsc --noEmit` passes.
- Any schema change ships as one consolidated `init_db.sql` (schema + indexes + demo seed) with the README setup guide and demo-accounts table kept accurate.
- Persistence changes are reflected across features (balances, reports, profiles, grades).
- README.md / DEMO.md updated for whatever was added, schema change or not.
- Demo data stays realistic; every person and record is fictional.
- The forbidden-content check returns nothing outside the excluded folders.
