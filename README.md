# Azthreus ISMS

Azthreus ISMS is an Integrated Student Management System for **Azthreus Academy of Science and Technology**, a fictional school. The Academy is the education and research arm of **Azthreus Systems**, a fictional deep space engineering company.

The interface keeps a classic Windows-era desktop layout on purpose: a white school header, a left sidebar of modules, and beveled modal windows. The data lives in PostgreSQL, with server-side authentication, role checks, transactions, and an audit log.

> **This is a demo with fictional data.** Every student, parent, address, phone number, payment, and grade in `init_db.sql` is invented. Do not put real student data into a demo database; it is wiped and rebuilt whenever the seed is run.

## Screenshots

Screenshots are not committed yet. Add captures to `docs/screenshots/` and keep the filenames below, or update this list:

- `docs/screenshots/01-sign-in.png` — sign-in screen with the demo accounts table
- `docs/screenshots/02-dashboard.png` — dashboard summary panels and live clock
- `docs/screenshots/03-add-student.png` — enrollment form with the fee panel
- `docs/screenshots/04-receive-payment.png` — payment posting form
- `docs/screenshots/05-individual-account.png` — statement of account and payment history
- `docs/screenshots/06-collections.png` — daily collection report
- `docs/screenshots/07-report-card.png` — report card with quarter grades
- `docs/screenshots/08-audit-log.png` — audit log filters and details drawer

## Features

- Sign-in with scrypt password hashes and an HMAC-signed, HttpOnly session cookie (8-hour lifetime)
- Server-enforced roles: Administrator, Registrar, Cashier; user administration is Administrator-only
- Role-filtered dashboard with enrollment, money, and grade-posting summaries
- New-student enrollment: personal information, parents, previous schools, assessment-driven fees, account creation, and the upon-enrollment payment in one transaction
- Re-enrollment: update the existing person and open a new account for a new school year without duplicating the student row
- Student editing: personal information, parents, classification, status (enrolled / dropped / graduated / transferred), level, section, and school year
- Assessment management per level and school year, with the four payment plans
- Accounts: add an account for the current school year, receive payments, post other payments for a student account or a non-student payer, balance inquiry, and individual account / statement of account
- Certificate of Registration generation and printing
- Collection reports for a day, a month, or a date range, computed live from payments and printable
- Quarter-grade posting by level, section, subject, and grading period
- Report cards with quarter grades, general average, remarks, class rank, and honors
- Honors and class ranking by level, section, and grading period
- Payment reversal: an Administrator posts a new `AZV-` row with a required reason; the original payment is never edited or deleted
- Audit Log: filters, 50-row pages, and a JSON details drawer; audit rows commit or roll back with the change they describe
- User management: add users, edit names and roles, reset passwords, activate or deactivate accounts; every user can change their own password
- Seeded demo data that is ready to demonstrate

## Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript with React 19
- **Database:** PostgreSQL 14 or newer, accessed through the `pg` driver with raw SQL (no ORM)
- **Styling:** Tailwind CSS v4, hand-built retro components, and the Azthreus accent tokens in `app/globals.css`
- **Icons and feedback:** `lucide-react` and `sonner`
- **Package manager:** pnpm (the repository pins `pnpm@12.9.1` in `package.json`)

## Prerequisites

- Node.js 20 or newer
- pnpm
- PostgreSQL 14 or newer, running locally
- `psql` on your `PATH`, or the full path to it

## Setup

### Windows PowerShell

1. Create the application role and database. Open a PostgreSQL superuser session:

   ```powershell
   psql -U postgres
   ```

   Paste:

   ```sql
   CREATE USER isms_user WITH PASSWORD 'isms_pass';
   CREATE DATABASE azthreus_isms OWNER isms_user;
   \c azthreus_isms
   GRANT CREATE ON SCHEMA public TO isms_user;
   \q
   ```

2. From the repository root, build the schema and demo data:

   ```powershell
   psql -U postgres -d azthreus_isms -f init_db.sql
   ```

   `init_db.sql` drops and recreates every table, index, view, and sequence, then seeds the demo. It also grants table and sequence access to `isms_user` when that role exists. Read the summary and data-quality checks it prints; every check should report `0` failures.

3. Copy the environment template:

   ```powershell
   Copy-Item .env.example .env.local
   ```

4. Generate a session secret and put it in `.env.local`:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   `.env.local` should contain:

   ```dotenv
   DATABASE_URL=postgresql://isms_user:isms_pass@localhost:5432/azthreus_isms
   SESSION_SECRET=<the value from the command above>
   ```

5. Install and start:

   ```powershell
   pnpm install
   pnpm dev
   ```

   Open <http://localhost:3000>.

### macOS / Linux

1. Create the role and database. The superuser name depends on how PostgreSQL was installed; on many systems `psql -U postgres` works, and with Homebrew the current macOS user is the superuser:

   ```bash
   sudo -u postgres psql
   # or: psql postgres
   ```

   Paste:

   ```sql
   CREATE USER isms_user WITH PASSWORD 'isms_pass';
   CREATE DATABASE azthreus_isms OWNER isms_user;
   \c azthreus_isms
   GRANT CREATE ON SCHEMA public TO isms_user;
   \q
   ```

2. Build the schema and demo data:

   ```bash
   psql -U postgres -d azthreus_isms -f init_db.sql
   ```

3. Configure the environment:

   ```bash
   cp .env.example .env.local
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Put the generated value into `SESSION_SECRET` in `.env.local`. The `DATABASE_URL` in the template already points at `isms_user` and `azthreus_isms`.

4. Install and start:

   ```bash
   pnpm install
   pnpm dev
   ```

## Demo accounts

The sign-in screen shows the same table. These accounts are seeded by `init_db.sql`.

| Username  | Password          | Role          |
|-----------|-------------------|---------------|
| admin     | ADMINpassword     | Administrator |
| registrar | REGISTRARpassword | Registrar     |
| cashier   | CASHIERpassword   | Cashier       |

## Resetting the demo data

Stop the app, then run the seed again. It drops and recreates every application table:

```powershell
psql -U postgres -d azthreus_isms -f init_db.sql
```

If the database or role itself is missing or broken, recreate them first:

```sql
DROP DATABASE IF EXISTS azthreus_isms WITH (FORCE);
DROP OWNED BY isms_user CASCADE;
DROP USER IF EXISTS isms_user;
CREATE USER isms_user WITH PASSWORD 'isms_pass';
CREATE DATABASE azthreus_isms OWNER isms_user;
ALTER DATABASE azthreus_isms OWNER TO isms_user;
\c azthreus_isms
GRANT CREATE ON SCHEMA public TO isms_user;
\q
```

Then run `init_db.sql` again. The seed is anchored to the date it runs: the current school year owns the mid-cycle cohort, two prior years hold returning-student history, and a few payments land near today. Reseed before a demonstration so Daily Collection, dues, and report cards line up with today.

## Data model summary

`init_db.sql` is the single source for the schema, indexes, views, and demo data.

**Lookup tables**

- `school_years` — June-to-March school years; exactly one is current
- `levels` — Kindergarten through Grade 12, grouped into `kindergarten`, `elementary`, `junior_high`, and `senior_high`
- `sections` — one section per level per school year in the demo
- `payment_modes` — Monthly, Quarterly, Semi-Annual, Cash/Annual
- `religions`, `fee_types`, `subjects`, `grade_periods` — supporting lists

**Main tables**

- `students` — one row per person; holds the current enrollment only
- `parents`, `school_history` — supporting records for a student
- `assessments` — fees and installment amounts per level and school year
- `accounts` — one account per student per school year; balances are recomputed from payments
- `payments` — the single source of truth for money; `entry_type` is `payment` or `reversal`
- `grades` — one row per student, subject, and grading period
- `audit_log` — who did what, when, and with a small JSON details object
- `users` — app accounts with scrypt hashes and one of the three roles

**Relationships**

- A student may have one account per school year; the latest account is the current one.
- An account has many payments. A reversal is a new payment row with negated amounts, a required reason, and `reverses_payment_id` pointing at the original.
- Grades belong to a student, subject, grading period, and school year.
- Audit rows record the actor and entity, and are written with the same transaction client as the change.

**Views for direct SQL inspection:** `v_student_list`, `v_balance_inquiry`, and `v_payment_history`. The application computes its own lists in the route handlers.

## Business rules

**Payment plans** (derived from the total fee):

| Plan        | Upon enrollment | Remaining payable   |
|-------------|-----------------|---------------------|
| Monthly     | 20%             | 10 × 8%             |
| Quarterly   | 30%             | 4 × 17.5%           |
| Semi-Annual | 50%             | 2 × 25%             |
| Cash/Annual | 100%            | —                   |

**Grading** uses the Philippine scale: 75 is passing. 90–94 is With Honors, 95–97 With High Honors, and 98+ With Highest Honors.

**Display numbers** come from PostgreSQL sequences, never `MAX(...) + 1`:

- Student registration: `AA-<number>`, starting at 260001
- Account: `AC-<number>`, starting at 410001
- Receipt: `AZR-` plus six digits, starting at 700001
- Reversal: `AZV-` plus six digits

Receipt and reversal numbers are generated on the server only.

**Payments are immutable.** A correction is a new `entry_type = 'reversal'` row with all amounts negated, a required reason, its own reversal number, and a link to the original. A payment can be reversed at most once, and a reversal cannot be reversed again. Balances, months not paid, dues, dashboard figures, and collection reports all net the reversal.

**Months not paid** for a Monthly account count unreversed tuition payment rows against the plan's 10 installments. `current_dues` is the monthly tuition while a monthly account still has unpaid installments.

## Roles and permissions

| Area | Administrator | Registrar | Cashier |
|---|---|---|---|
| Dashboard | Yes | Yes | Yes |
| Registration, Add Student, Assessment, Certificate of Registration | Yes | Yes | No |
| Accounts page (Add Account, Receive Payment, Other Payments) | Yes | No | Yes |
| Balance Inquiry and individual account (read-only) | Yes | Yes | Yes |
| Collection reports | Yes | No | Yes |
| Student profile | Yes | Yes | Yes (no grade summary) |
| Grades, report cards, honors and ranking | Yes | Yes | No |
| User accounts | Yes | No | No |
| Audit Log | Yes | No | No |
| Payment reversal | Yes | No | No |
| Change own password | Yes | Yes | Yes |

The Registrar reaches Balance Inquiry and a student's account through the Registration and Inquiry screens; the Accounts module itself is for the Administrator and Cashier. `requireAuth` re-reads the user from the database on every request, so a deactivated account stops working immediately. `requireRoles` enforces the write roles on the server. The sidebar and modal gating in `lib/roles.ts` are convenience only.

## Printing

Print actions open a styled document in a popup with the school header, the Academy crest, tables, and signature lines. The printable documents are the Official Receipt, Statement of Account, Certificate of Registration, student profile, report card, honors and class ranking, daily/monthly/date-range collection reports, and the Reversal Slip. A reversal never prints as an Official Receipt.

Allow popups for the site in your browser.

## Limitations

- This is a fictional demo. It is not hardened for exposure to the internet: demo passwords are shown on the sign-in screen, there is no rate limiting, and the app assumes HTTPS is terminated in front of it if it is ever deployed.
- The K-12 curriculum is illustrative, not a certified DepEd curriculum. Senior High uses a single STEM strand; four quarters are used for every level, so SHS semesters are not modeled.
- The demo stores one section per level per school year. A student's section history is not kept separately; historical report cards use the section list for the account's level and year (one section in the demo). Editing a student's level or school year changes the student row only; it does not move an account. Use re-enrollment to open a new school year's account.
- Payment corrections are whole-payment reversals. Partial reversals, refunds, and cash adjustments are out of scope.
- There is no photo upload, attendance, scheduling, SMS, or email integration.
- Screens refetch when they open; there is no real-time push between users.
- The student list is limited to 500 rows per request, which is well above the 266 seeded students.
- `SESSION_SECRET` is required in production; development uses a fixed fallback and warns once.

## Project structure

```
azthreus-isms/
├── app/
│   ├── api/                 # Route handlers (auth, students, accounts, payments, grades, ...)
│   ├── globals.css          # Tailwind entry point and Azthreus accent tokens
│   ├── layout.tsx           # Root layout, metadata, toaster
│   └── page.tsx             # Single-route SPA shell (splash, sign-in, welcome, dashboard)
├── components/              # Hand-built module pages, modals, window chrome, icons
├── lib/                     # Database, auth, session, roles, enrollment, accounts, grades, print
├── public/images/           # Academy crest, parent-company mark, module icons, welcome art
├── init_db.sql              # Consolidated schema + indexes + views + demo seed
├── .env.example             # Environment template
├── LICENSE
└── README.md
```

## Development checks

```powershell
pnpm exec tsc --noEmit
pnpm build
```

The application and database are separate: this repository contains no migration runner. Schema changes ship in `init_db.sql`.

## License

Released under the MIT License. Copyright (c) 2026 Stephen Paul D. Jacildo. See [LICENSE](LICENSE).
