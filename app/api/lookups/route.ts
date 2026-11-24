import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { requireAuth, serverError } from "@/lib/auth"
import type { Lookups } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const [levels, schoolYears, paymentModes, religions, sections, subjects, gradePeriods] = await Promise.all([
      query<Lookups["levels"][number]>(
        `SELECT id, level_name AS name, level_order AS "order", level_category AS category
         FROM levels ORDER BY level_order`,
      ),
      query<Lookups["schoolYears"][number]>(
        `SELECT id, year_code AS code, is_current AS "isCurrent",
                TO_CHAR(start_date, 'YYYY-MM-DD') AS "startDate",
                TO_CHAR(end_date, 'YYYY-MM-DD') AS "endDate"
         FROM school_years ORDER BY year_code DESC`,
      ),
      query<Lookups["paymentModes"][number]>(
        `SELECT id, mode_name AS name, installments
         FROM payment_modes ORDER BY installments DESC`,
      ),
      query<Lookups["religions"][number]>(`SELECT id, religion_name AS name FROM religions ORDER BY religion_name`),
      query<Lookups["sections"][number]>(
        `SELECT id, section_name AS name, level_id AS "levelId", school_year_id AS "schoolYearId"
         FROM sections ORDER BY section_name`,
      ),
      query<Lookups["subjects"][number]>(
        `SELECT id, subject_name AS name, level_category AS category, sort_order AS "order"
         FROM subjects ORDER BY sort_order, subject_name`,
      ),
      query<Lookups["gradePeriods"][number]>(
        `SELECT id, period_name AS name, period_order AS "order", school_year_id AS "schoolYearId"
         FROM grade_periods ORDER BY school_year_id, period_order`,
      ),
    ])

    const payload: Lookups = { levels, schoolYears, paymentModes, religions, sections, subjects, gradePeriods }
    return NextResponse.json(payload)
  } catch (error) {
    return serverError(error)
  }
}
