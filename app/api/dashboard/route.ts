import { NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { requireAuth, serverError } from "@/lib/auth"
import { round2 } from "@/lib/grades"
import type { DashboardData, DashboardGrades } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface CurrentYear {
  id: number
  code: string
  startDate: string | null
  endDate: string | null
}

interface EnrollmentTotals {
  enrolled: number
  newStudents: number
  returning: number
  dropped: number
  transferred: number
}

interface MoneyTotals {
  today: number
  month: number
  schoolYear: number
}

interface AccountTotals {
  outstanding: number
  accountsWithDues: number
}

interface RecentPayment {
  id: number
  payer: string
  date: string
  amount: number
  receipt: string | null
  postedBy: string | null
  entryType: "payment" | "reversal"
}

interface LevelGradeRow {
  level: string
  slots: number
  posted: number
}

function percent(posted: number, slots: number): number | null {
  return slots > 0 ? round2((posted / slots) * 100) : null
}

async function loadEnrollment(yearId: number): Promise<DashboardData["enrollment"]> {
  const [totals, byLevel] = await Promise.all([
    queryOne<EnrollmentTotals>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'enrolled')::int AS enrolled,
         COUNT(*) FILTER (WHERE status = 'enrolled' AND COALESCE(classification, '') IN ('New', 'Transferee'))::int AS "newStudents",
         COUNT(*) FILTER (WHERE status = 'enrolled' AND COALESCE(classification, '') NOT IN ('New', 'Transferee'))::int AS returning,
         COUNT(*) FILTER (WHERE status = 'dropped')::int AS dropped,
         COUNT(*) FILTER (WHERE status = 'transferred')::int AS transferred
       FROM students
       WHERE school_year_id = $1`,
      [yearId],
    ),
    query<{ level: string; count: number }>(
      `SELECT l.level_name AS level, COUNT(s.id)::int AS count
       FROM levels l
       LEFT JOIN students s
         ON s.current_level_id = l.id
        AND s.school_year_id = $1
        AND s.status = 'enrolled'
       GROUP BY l.id, l.level_name, l.level_order
       ORDER BY l.level_order`,
      [yearId],
    ),
  ])

  return {
    enrolled: totals?.enrolled ?? 0,
    newStudents: totals?.newStudents ?? 0,
    returning: totals?.returning ?? 0,
    dropped: totals?.dropped ?? 0,
    transferred: totals?.transferred ?? 0,
    byLevel,
  }
}

async function loadMoney(year: CurrentYear): Promise<DashboardData["money"]> {
  const startDate = year.startDate ?? "1900-01-01"
  const endDate = year.endDate ?? "2999-12-31"

  const [collections, accounts, recentPayments] = await Promise.all([
    queryOne<MoneyTotals>(
      `SELECT
         COALESCE(SUM(total_amount) FILTER (WHERE payment_date = CURRENT_DATE), 0)::float8 AS today,
         COALESCE(SUM(total_amount) FILTER (
           WHERE date_trunc('month', payment_date) = date_trunc('month', CURRENT_DATE)
         ), 0)::float8 AS month,
         COALESCE(SUM(total_amount) FILTER (
           WHERE payment_date >= $1::date AND payment_date <= $2::date
         ), 0)::float8 AS "schoolYear"
       FROM payments`,
      [startDate, endDate],
    ),
    queryOne<AccountTotals>(
      `SELECT
         COALESCE(SUM(total_balance), 0)::float8 AS outstanding,
         COUNT(*) FILTER (WHERE months_not_paid > 0)::int AS "accountsWithDues"
       FROM accounts
       WHERE school_year_id = $1`,
      [year.id],
    ),
    query<RecentPayment>(
      `SELECT
         p.id,
         COALESCE(NULLIF(TRIM(s.last_name || ', ' || s.first_name), ''), p.payer_name, 'Unknown payer') AS payer,
         TO_CHAR(p.payment_date, 'MM/DD/YYYY') AS date,
         p.total_amount::float8 AS amount,
         p.receipt_number AS receipt,
         p.posted_by AS "postedBy",
         p.entry_type AS "entryType"
       FROM payments p
       LEFT JOIN students s ON s.id = p.student_id
       ORDER BY p.payment_date DESC, p.id DESC
       LIMIT 8`,
    ),
  ])

  return {
    today: collections?.today ?? 0,
    month: collections?.month ?? 0,
    schoolYear: collections?.schoolYear ?? 0,
    outstanding: accounts?.outstanding ?? 0,
    accountsWithDues: accounts?.accountsWithDues ?? 0,
    recentPayments,
  }
}

async function loadGrades(year: CurrentYear): Promise<DashboardGrades> {
  const quarter = await queryOne<{ id: number; name: string; order: number }>(
    `WITH elapsed AS (
       SELECT GREATEST(1, LEAST(10,
         (EXTRACT(YEAR FROM CURRENT_DATE)::int - EXTRACT(YEAR FROM COALESCE(sy.start_date, CURRENT_DATE))::int) * 12
         + EXTRACT(MONTH FROM CURRENT_DATE)::int - EXTRACT(MONTH FROM COALESCE(sy.start_date, CURRENT_DATE))::int + 1
       )) AS months
       FROM school_years sy
       WHERE sy.id = $1
     )
     SELECT gp.id, gp.period_name AS name, gp.period_order AS "order"
     FROM grade_periods gp
     CROSS JOIN elapsed e
     WHERE gp.school_year_id = $1
       AND gp.period_order = CASE
         WHEN e.months >= 9 THEN 4
         WHEN e.months >= 7 THEN 3
         WHEN e.months >= 4 THEN 2
         WHEN e.months >= 2 THEN 1
         ELSE 0
       END
     LIMIT 1`,
    [year.id],
  )

  if (!quarter) {
    return { period: null, overall: { slots: 0, posted: 0, percent: null }, byLevel: [] }
  }

  const rows = await query<LevelGradeRow>(
    `WITH expected AS (
       SELECT s.id AS student_id, s.current_level_id AS level_id, l.level_name, l.level_order
       FROM students s
       JOIN levels l ON l.id = s.current_level_id
       WHERE s.school_year_id = $1 AND s.status = 'enrolled'
     ),
     expected_subjects AS (
       SELECT e.student_id, e.level_id, e.level_name, e.level_order, sub.id AS subject_id
       FROM expected e
       JOIN levels l ON l.id = e.level_id
       JOIN subjects sub ON sub.level_category = l.level_category OR sub.level_category IS NULL
     ),
     posted_grades AS (
       SELECT g.student_id, g.subject_id
       FROM grades g
       WHERE g.grade_period_id = $2 AND g.numeric_grade IS NOT NULL
     )
     SELECT es.level_name AS level,
            COUNT(*)::int AS slots,
            COUNT(p.student_id)::int AS posted
     FROM expected_subjects es
     LEFT JOIN posted_grades p ON p.student_id = es.student_id AND p.subject_id = es.subject_id
     GROUP BY es.level_id, es.level_name, es.level_order
     ORDER BY es.level_order`,
    [year.id, quarter.id],
  )

  const totalSlots = rows.reduce((sum, row) => sum + row.slots, 0)
  const totalPosted = rows.reduce((sum, row) => sum + row.posted, 0)

  return {
    period: quarter.name,
    overall: { slots: totalSlots, posted: totalPosted, percent: percent(totalPosted, totalSlots) },
    byLevel: rows.map((row) => ({
      level: row.level,
      slots: row.slots,
      posted: row.posted,
      percent: percent(row.posted, row.slots),
    })),
  }
}

export async function GET() {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const year = await queryOne<CurrentYear>(
      `SELECT id, year_code AS code,
              TO_CHAR(start_date, 'YYYY-MM-DD') AS "startDate",
              TO_CHAR(end_date, 'YYYY-MM-DD') AS "endDate"
       FROM school_years
       WHERE is_current = TRUE
       ORDER BY id DESC
       LIMIT 1`,
    )

    if (!year) return NextResponse.json({ schoolYear: null } satisfies DashboardData)

    const payload: DashboardData = { schoolYear: year.code }
    const role = auth.user.role

    const wantsEnrollment = role === "admin" || role === "registrar"
    const wantsMoney = role === "admin" || role === "cashier"
    const wantsGrades = role === "admin" || role === "registrar"

    const [enrollment, money, grades] = await Promise.all([
      wantsEnrollment ? loadEnrollment(year.id) : Promise.resolve(undefined),
      wantsMoney ? loadMoney(year) : Promise.resolve(undefined),
      wantsGrades ? loadGrades(year) : Promise.resolve(undefined),
    ])

    if (enrollment) payload.enrollment = enrollment
    if (money) payload.money = money
    if (grades) payload.grades = grades

    return NextResponse.json(payload)
  } catch (error) {
    return serverError(error)
  }
}
