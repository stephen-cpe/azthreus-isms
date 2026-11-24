import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { badRequest, requireRoles, serverError } from "@/lib/auth"
import { isValidIsoDate } from "@/lib/date"
import { round2 } from "@/lib/grades"
import type { CollectionReport, CollectionRow } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const auth = await requireRoles(["admin", "cashier"])
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type") ?? "daily"
    const schoolYearId = Number(searchParams.get("schoolYearId"))

    const where: string[] = []
    const params: unknown[] = []

    if (type === "daily") {
      const date = searchParams.get("date")
      if (!date || !isValidIsoDate(date)) return badRequest("A valid date is required (YYYY-MM-DD)")
      params.push(date)
      where.push(`p.payment_date = $${params.length}::date`)
    } else if (type === "monthly") {
      const month = Number(searchParams.get("month"))
      const year = Number(searchParams.get("year"))
      if (
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12 ||
        !Number.isInteger(year) ||
        year < 1900 ||
        year > 2200
      ) {
        return badRequest("Valid month and year are required")
      }
      params.push(month)
      where.push(`EXTRACT(MONTH FROM p.payment_date) = $${params.length}`)
      params.push(year)
      where.push(`EXTRACT(YEAR FROM p.payment_date) = $${params.length}`)
    } else if (type === "range") {
      const from = searchParams.get("from")
      const to = searchParams.get("to")
      if (!from || !to || !isValidIsoDate(from) || !isValidIsoDate(to)) {
        return badRequest("Valid beginning and ending dates are required (YYYY-MM-DD)")
      }
      if (from > to) return badRequest("The beginning date cannot be after the ending date")
      params.push(from)
      where.push(`p.payment_date >= $${params.length}::date`)
      params.push(to)
      where.push(`p.payment_date <= $${params.length}::date`)
    } else {
      return badRequest("Invalid report type")
    }

    if (Number.isInteger(schoolYearId) && schoolYearId > 0) {
      params.push(schoolYearId)
      where.push(`a.school_year_id = $${params.length}`)
    }

    const rows = await query<CollectionRow>(
      `SELECT
         COALESCE(s.last_name || ', ' || s.first_name, 'NON-STUDENT: ' || COALESCE(p.payer_name, 'Unknown')) AS "studentName",
         l.level_name AS level,
         p.payment_month AS months,
         TO_CHAR(p.payment_date, 'MM/DD/YYYY') AS date,
         p.receipt_number AS receipt,
         p.description,
         p.tuition_amount::float8 AS tuition,
         p.computer_amount::float8 AS computer,
         p.registration_amount::float8 AS reg,
         p.miscellaneous_amount::float8 AS misc,
         p.books_amount::float8 AS books,
         p.others_amount::float8 AS others,
         p.total_amount::float8 AS total,
         p.posted_by AS "postedBy",
         p.entry_type AS "entryType",
         orig.receipt_number AS "reversesReceipt"
       FROM payments p
       LEFT JOIN payments orig ON orig.id = p.reverses_payment_id
       LEFT JOIN accounts a ON a.id = p.account_id
       LEFT JOIN students s ON s.id = p.student_id
       LEFT JOIN levels l ON l.id = a.level_id
       WHERE ${where.join(" AND ")}
       ORDER BY p.payment_date, p.id, s.last_name, s.first_name`,
      params,
    )

    const totals = rows.reduce(
      (acc, row) => {
        acc.tuition += row.tuition
        acc.computer += row.computer
        acc.reg += row.reg
        acc.misc += row.misc
        acc.books += row.books
        acc.others += row.others
        acc.total += row.total
        return acc
      },
      { tuition: 0, computer: 0, reg: 0, misc: 0, books: 0, others: 0, total: 0 },
    )
    for (const key of Object.keys(totals) as (keyof typeof totals)[]) {
      totals[key] = round2(totals[key])
    }

    const payload: CollectionReport = { rows, totals, count: rows.length }
    return NextResponse.json(payload)
  } catch (error) {
    return serverError(error)
  }
}
