import { NextRequest, NextResponse } from "next/server"
import { query, queryOne, withTransaction } from "@/lib/db"
import { writeAudit } from "@/lib/audit"
import { ApiError, badRequest, requireAuth, requireRoles, serverError } from "@/lib/auth"
import { MAX_AMOUNT, readAmount, readId } from "@/lib/validation"
import type { Assessment } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ASSESSMENT_SELECT = `
  SELECT
    a.id,
    a.school_year_id AS "schoolYearId",
    a.level_id AS "levelId",
    l.level_name AS "levelName",
    sy.year_code AS "schoolYearCode",
    a.registration_fee::float8 AS "registrationFee",
    a.tuition_fee::float8 AS "tuitionFee",
    a.miscellaneous_fee::float8 AS "miscellaneousFee",
    a.textbooks_fee::float8 AS "textbooksFee",
    a.computer_fee::float8 AS "computerFee",
    a.field_trip_fee::float8 AS "fieldTripFee",
    a.school_uniform_fee::float8 AS "schoolUniformFee",
    a.pe_uniform_fee::float8 AS "peUniformFee",
    a.others_fee::float8 AS "othersFee",
    a.total_fee::float8 AS "totalFee",
    a.upon_enrollment_monthly::float8 AS "uponEnrollmentMonthly",
    a.payable_monthly::float8 AS "payableMonthly",
    a.upon_enrollment_quarterly::float8 AS "uponEnrollmentQuarterly",
    a.payable_quarterly::float8 AS "payableQuarterly",
    a.upon_enrollment_semi_annual::float8 AS "uponEnrollmentSemiAnnual",
    a.payable_semi_annual::float8 AS "payableSemiAnnual"
  FROM assessments a
  JOIN levels l ON l.id = a.level_id
  JOIN school_years sy ON sy.id = a.school_year_id
`

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(req.url)
    const levelId = Number(searchParams.get("levelId"))
    const schoolYearId = Number(searchParams.get("schoolYearId"))

    if (Number.isInteger(levelId) && levelId > 0 && Number.isInteger(schoolYearId) && schoolYearId > 0) {
      const assessment = await queryOne<Assessment>(
        `${ASSESSMENT_SELECT} WHERE a.level_id = $1 AND a.school_year_id = $2`,
        [levelId, schoolYearId],
      )
      return NextResponse.json({ assessments: assessment ? [assessment] : [] })
    }

    const assessments = await query<Assessment>(
      `${ASSESSMENT_SELECT} ORDER BY sy.year_code DESC, l.level_order`,
    )
    return NextResponse.json({ assessments })
  } catch (error) {
    return serverError(error)
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

interface UpsertAssessmentBody {
  levelId?: number | string
  schoolYearId?: number | string
  registrationFee?: number | string
  tuitionFee?: number | string
  miscellaneousFee?: number | string
  textbooksFee?: number | string
  computerFee?: number | string
  fieldTripFee?: number | string
  schoolUniformFee?: number | string
  peUniformFee?: number | string
  othersFee?: number | string
}

export async function PUT(req: NextRequest) {
  const auth = await requireRoles(["admin", "registrar"])
  if (auth.error) return auth.error

  try {
    const body = (await req.json().catch(() => null)) as UpsertAssessmentBody | null
    const levelId = readId(body?.levelId, "Level")
    const schoolYearId = readId(body?.schoolYearId, "School year")
    if (!levelId || !schoolYearId) {
      return badRequest("Level and school year are required")
    }

    const fees = {
      registrationFee: readAmount(body?.registrationFee, "Registration fee") ?? 0,
      tuitionFee: readAmount(body?.tuitionFee, "Tuition fee") ?? 0,
      miscellaneousFee: readAmount(body?.miscellaneousFee, "Miscellaneous fee") ?? 0,
      textbooksFee: readAmount(body?.textbooksFee, "Textbooks fee") ?? 0,
      computerFee: readAmount(body?.computerFee, "Computer fee") ?? 0,
      fieldTripFee: readAmount(body?.fieldTripFee, "Field trip fee") ?? 0,
      schoolUniformFee: readAmount(body?.schoolUniformFee, "School uniform fee") ?? 0,
      peUniformFee: readAmount(body?.peUniformFee, "PE uniform fee") ?? 0,
      othersFee: readAmount(body?.othersFee, "Other fees") ?? 0,
    }
    const total = round2(Object.values(fees).reduce((sum, value) => sum + value, 0))
    if (total > MAX_AMOUNT) return badRequest("The total fee is larger than the system can store")

    const saved = await withTransaction(async (client) => {
      const references = await client.query<{ level_exists: boolean; year_exists: boolean }>(
        `SELECT
           EXISTS (SELECT 1 FROM levels WHERE id = $1) AS level_exists,
           EXISTS (SELECT 1 FROM school_years WHERE id = $2) AS year_exists`,
        [levelId, schoolYearId],
      )
      if (!references.rows[0]?.level_exists || !references.rows[0]?.year_exists) {
        throw new ApiError(400, "The selected level or school year does not exist.")
      }

      const existing = await client.query<{ id: number }>(
        `SELECT id FROM assessments WHERE school_year_id = $1 AND level_id = $2`,
        [schoolYearId, levelId],
      )

      const assessment = await client.query<{ id: number }>(
        `INSERT INTO assessments (
           school_year_id, level_id, registration_fee, tuition_fee, miscellaneous_fee, textbooks_fee,
           computer_fee, field_trip_fee, school_uniform_fee, pe_uniform_fee, others_fee, total_fee,
           upon_enrollment_monthly, payable_monthly,
           upon_enrollment_quarterly, payable_quarterly,
           upon_enrollment_semi_annual, payable_semi_annual
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
           $13, $14, $15, $16, $17, $18
         )
         ON CONFLICT (school_year_id, level_id) DO UPDATE SET
           registration_fee = EXCLUDED.registration_fee,
           tuition_fee = EXCLUDED.tuition_fee,
           miscellaneous_fee = EXCLUDED.miscellaneous_fee,
           textbooks_fee = EXCLUDED.textbooks_fee,
           computer_fee = EXCLUDED.computer_fee,
           field_trip_fee = EXCLUDED.field_trip_fee,
           school_uniform_fee = EXCLUDED.school_uniform_fee,
           pe_uniform_fee = EXCLUDED.pe_uniform_fee,
           others_fee = EXCLUDED.others_fee,
           total_fee = EXCLUDED.total_fee,
           upon_enrollment_monthly = EXCLUDED.upon_enrollment_monthly,
           payable_monthly = EXCLUDED.payable_monthly,
           upon_enrollment_quarterly = EXCLUDED.upon_enrollment_quarterly,
           payable_quarterly = EXCLUDED.payable_quarterly,
           upon_enrollment_semi_annual = EXCLUDED.upon_enrollment_semi_annual,
           payable_semi_annual = EXCLUDED.payable_semi_annual,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          schoolYearId,
          levelId,
          fees.registrationFee,
          fees.tuitionFee,
          fees.miscellaneousFee,
          fees.textbooksFee,
          fees.computerFee,
          fees.fieldTripFee,
          fees.schoolUniformFee,
          fees.peUniformFee,
          fees.othersFee,
          total,
          round2(total * 0.2),
          round2(total * 0.08),
          round2(total * 0.3),
          round2(total * 0.175),
          round2(total * 0.5),
          round2(total * 0.25),
        ],
      )

      const savedResult = await client.query<Assessment>(
        `${ASSESSMENT_SELECT} WHERE a.id = $1`,
        [assessment.rows[0]?.id],
      )
      const savedAssessment = savedResult.rows[0]
      const action = existing.rows[0] ? "assessment.update" : "assessment.create"
      await writeAudit(client, auth.user, {
        action,
        entityType: "assessment",
        entityId: savedAssessment?.id ?? null,
        summary: `${existing.rows[0] ? "Updated" : "Created"} assessment for ${savedAssessment?.levelName ?? `level ${levelId}`} (${savedAssessment?.schoolYearCode ?? schoolYearId})`,
        details: {
          levelId,
          levelName: savedAssessment?.levelName ?? null,
          schoolYearId,
          schoolYear: savedAssessment?.schoolYearCode ?? null,
          totalFee: savedAssessment?.totalFee ?? total,
        },
      })
      return savedAssessment
    })

    return NextResponse.json({ assessment: saved })
  } catch (error) {
    return serverError(error)
  }
}
