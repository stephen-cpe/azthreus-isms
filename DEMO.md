# Azthreus ISMS evaluation walkthrough

This guide is for anyone reviewing the project: a developer, a designer, or someone checking whether the workflows make sense. It walks through every module with the seeded demo cast, in the order that shows the most in the least time. Allow about 45 minutes for the full pass; the short version is sections 1, 2, and 4.

Azthreus ISMS is a demo for the fictional **Azthreus Academy of Science and Technology**, the education arm of the fictional **Azthreus Systems**. Every person and record in the database is invented. Do not enter real student data.

## 1. Before you start

### 1.1 Reseed the demo

The seed is anchored to the date it runs. A database seeded weeks ago will show an empty Daily Collection and stale dues, so reseed before evaluating. Stop the app first (`Ctrl+C`), then from the repository root:

```powershell
psql -U postgres -d azthreus_isms -f init_db.sql
```

The script drops and rebuilds every application table and re-seeds the demo. It destroys anything entered since the last seed, which is the point. If the database or role is missing, use the full drop/recreate block in `README.md` first.

The seed summary should report 266 students, 65 sections, 13 levels, 5 school years, and 266 parent records. Every data-quality check should show `0` failures. Payment, grade, and audit counts move with the seed date.

### 1.2 Start the app

`.env.local` must contain `DATABASE_URL` and `SESSION_SECRET` (see `README.md`).

```powershell
pnpm install   # only if node_modules is missing or stale
pnpm dev
```

Open <http://localhost:3000> and allow popups for the site. Receipts, certificates, statements, report cards, rankings, and collection reports open in a print window.

### 1.3 Demo accounts

| Username  | Password          | Role          |
|-----------|-------------------|---------------|
| admin     | ADMINpassword     | Administrator |
| registrar | REGISTRARpassword | Registrar     |
| cashier   | CASHIERpassword   | Cashier       |

The table on the sign-in screen is intentional; keep it for the evaluation.

### 1.4 Demo cast

The seed is deterministic: a fresh run produces the same names and registration numbers. Student numbers follow the year the seed was run; the `AA-` registration numbers do not change.

| Subject | Students | Use |
|---|---|---|
| Grade 6 graduates to re-enroll | Garcia, Dennis Santos (AA-260121) · Garcia, Camille Santos (AA-260122) · Castillo, Dominic Castillo (AA-260123) | Re-enroll into Grade 7 |
| Grade 12 graduates | Serrano, Adriana Castillo (AA-260244) · Acosta, Aldrin Rosales (AA-260245) · Acosta, Aileen Rosales (AA-260246) | Graduated status and history |
| Dropped or transferred | Gonzales, Gabriel Santos (AA-260061) · Acosta, Adriana Rojas (AA-260164) · Gonzales, Clarisse Reyes (AA-260144) | Two dropped, one transferred |
| New enrollment | Any invented name | Exercise the full enrollment form |

Using one of the Grade 6 graduates consumes it for that database. Reseed before the next evaluation.

---

## 2. Walkthrough

### Step 1 — Sign in as the cashier (2 minutes)

1. Sign in as `cashier` / `CASHIERpassword`.
2. The sidebar shows Dashboard, Accounts, and Collection Report only. The dashboard Money box shows today's, this month's, and this school year's collections, the outstanding balance, and the most recent payments.
3. Point out the **Change password** link under the signed-in user's name. Open it, then cancel.

Roles are enforced on the server, not only by hiding menu entries.

### Step 2 — Post a payment and print the receipt (6 minutes)

Stay signed in as the cashier.

1. **Accounts > Receive Payment**.
2. Select a current-year student. The account summary on the left shows fees, paid amount, balance, and payment mode. The amount due pre-fills from the assessment.
3. Choose a month (for example, July) and post the payment.
4. Note the `AZR-` receipt number in the message. Click **Print OR** to open the Official Receipt.
5. Post a second payment with **Check** as the form of payment; enter a check number, bank, and branch. The details are stored on the payment row.
6. Open **Accounts > View Individual Account** for the same student. The new payments are at the top of the record, and the balance reflects them.

### Step 3 — Reverse the payment as the administrator (5 minutes)

1. Sign out and sign in as `admin` / `ADMINpassword`.
2. **Accounts > View Individual Account**, select the student you just paid, and click **Reverse...** on the newest payment.
3. Enter a reason of at least 10 characters. Read the confirmation: the original receipt stays, a new `AZV-` reversal is posted today, and the balance increases by the same amount.
4. Confirm. The original row now says **Reversed by AZV-...**, and a red reversal row carries the negated amounts.
5. Click **Print Reversal Slip**. The printed title is **Reversal Slip**, not Official Receipt.
6. Open **Collection Report > Daily Collection** for today: the reversal is a negative row labeled "Reversal of AZR-..." and the grand total is net.

### Step 4 — Enroll a new student (6 minutes)

1. Sign in as `registrar` / `REGISTRARpassword`.
2. **Registration > Add Student**.
3. Enter an invented name, a school year, a level, and a payment mode (Monthly is fine). Select a section.
4. The right-hand fee panel loads the level's assessment and the upon-enrollment amount. Change the payment mode and watch the installment line change.
5. Click **Add Record**. One transaction creates the student, the account, the upon-enrollment payment, the initial balance, and the audit entries.
6. Open **Registration > Certificate of Registration**, select the new student, and click **Print...**.
7. Note the `AA-` registration number and the `AC-` account number in the confirmation message.

### Step 5 — Re-enroll a Grade 6 graduate (5 minutes)

1. **Inquiry > Profile Inquiry** and use the A-Z filter to find `Garcia, Dennis Santos` (AA-260121).
2. Open the profile and click **Re-enroll...**. The Add Student page opens with the existing record already selected.
3. Pick **Grade 7**, the current school year, and a section. Leave the prefilled personal and parent fields alone.
4. Click **Re-enroll Student**. The confirmation shows a new `AC-` account and an `AZR-` initial-payment receipt.
5. Reopen the profile. The student is now in Grade 7; the Grade 6 account, payments, and grades remain as history. No duplicate student row was created.

If the full record cannot be loaded, the page clears the selection rather than submitting blank fields over the existing record.

### Step 6 — Assessment and fee structure (2 minutes)

1. **Registration > Assessment**.
2. Pick a school year and level.
3. Point out the fee breakdown and the three displayed installment plans (Semi-Annual, Quarterly, Monthly); Cash/Annual is 100% upon enrollment. Fees are configured once per level per school year and applied to new enrollments and new accounts.

### Step 7 — Post grades and print a report card (6 minutes)

1. **Grades > Post Grades**. Choose the school year, level, section, subject, and grading period, then **Load Class**.
2. Enter grades for a few students and click **Save Grades**. The posted-by value and remarks update.
3. **Grades > Report Card**. Select the student, choose the school year, and click **View Report Card**. The quarter grades, subject averages, general average, rank, and honors are calculated from the posted rows.
4. Click **Print...** to print the report card.
5. **Grades > Honors & Class Ranking**. Choose a level and grading period and generate the ranking. Click a row to open that student's profile.

### Step 8 — Inquiry and student profile (3 minutes)

1. **Inquiry > Profile Inquiry**. Choose a level and school year, then click **Go**; or use **View all**.
2. Click a student. The profile shows personal information, parents, school history, the account summary, recent payments, and the current-year grade summary.
3. Click **Edit Record...**, change a phone number, and save. The profile refreshes with the change.
4. Change a student's status to **dropped** and save. The status color in the profile and the Status column in the list change. Reset the status if you want to keep the record for later.

### Step 9 — Collection reports (4 minutes)

1. **Collection Report > Daily Collection** opens on today's date. It shows the payments seeded near today plus the payment you posted in Step 2 (and the reversal from Step 3 if you did not reseed).
2. **Monthly Collection** opens on the current month.
3. **By Date Range Collection** opens on the current school year.
4. Print one report. The printed header carries the school name, address, and crest. Every fee column is present, and the total row matches the columns above it.

### Step 10 — Administration (5 minutes)

1. **Administration > User Accounts**. The table shows role, active status, last login, and creation date.
2. **Add User**: create a registrar or cashier with a password of at least 10 characters.
3. **Edit** the new user's name or role, then **Reset Password**. Sign in as that user in a separate browser profile only if you want to confirm the new password; otherwise skip.
4. **Deactivate** the new user. The server checks the user record on every request, so an already signed-in deactivated account stops working on its next action.
5. Try to deactivate or demote your own administrator account. The app refuses, and it always keeps at least one active administrator.
6. **Administration > Audit Log**. Filter action `payment.reverse` or `user.create`, open **Details**, and read the stored JSON. Each audit row was written in the same transaction as the action.
7. Open a student profile as administrator and scroll to **History** to see that student's audit entries.

---

## 3. What this demonstrates

- **Roles:** the server rejects writes outside the signed-in role; the sidebar is a convenience.
- **Transactions:** student enrollment, account creation, initial payment, and audit rows commit together or not at all.
- **Money:** payments are the source of truth. Balances, dues, dashboard totals, and collection reports are recomputed from them.
- **Corrections:** a wrong payment is reversed with a new row, not edited or deleted.
- **Printing:** every document uses the same brand header and escapes user-supplied text.
- **Audit:** every logged action has an actor, a summary, and optional JSON details.

## 4. Reset the demo

Stop the app, then run:

```powershell
psql -U postgres -d azthreus_isms -f init_db.sql
```

The same people and registration numbers return, with the school-year timeline re-anchored to the new run date. Reseed if you used a Grade 6 graduate in Step 5.

## 5. If something goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| Pages show "Failed to load..." | PostgreSQL is not running, or the database was never seeded | Start PostgreSQL, then run `init_db.sql` |
| Sign-in rejects every password | The database was reset but not seeded, or the app points at another database | Run `init_db.sql`; check `DATABASE_URL` in `.env.local` |
| "Can't reach database server" | Wrong host, port, database, user, or password | Check `DATABASE_URL` against the setup in `README.md` |
| Daily Collection is empty | The database was seeded on an earlier day | Reseed (section 1.1) |
| **Print...** does nothing | The browser blocked the popup | Allow popups for `localhost:3000` |
| Port 3000 is already in use | Another dev server is running | Stop it, or use the URL `pnpm dev` prints |
| `psql` is not recognized | PostgreSQL's `bin` folder is not on `PATH` | Use "SQL Shell (psql)" from the Start menu, or the full path to `psql.exe` |
| Add Account does not list a student | The list shows students without an account for their current school year | Use Re-enrollment to move a student to another year |
| A prior-year report card has no grades | That student has no account for the selected year | Choose a year in which the student was enrolled |

## 6. Known limitations

- Payment corrections are whole-payment reversals. Partial reversals, refunds, and cash adjustments are not supported.
- The K-12 curriculum is illustrative, not a certified DepEd curriculum. Senior High uses one STEM strand and four quarters; semesters are not modeled.
- There is no photo upload, section management, attendance, scheduling, SMS, or email integration.
- A student's section history is not stored separately; the demo has one section per level per year. Editing a student's level or school year does not move an account; use re-enrollment for a new year.
- The demo is not hardened for internet exposure: the credentials are shown on the sign-in screen, there is no rate limiting, and no TLS setup is included.
- Screens refetch when they open; there is no real-time push between signed-in users.

---

*Setup and full database reset: `README.md`. Architecture notes: `AGENTS.md`.*
