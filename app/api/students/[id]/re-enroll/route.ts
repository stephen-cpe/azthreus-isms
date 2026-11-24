import { NextRequest, NextResponse } from "next/server"
import { withTransaction } from "@/lib/db"
import { writeAudit } from "@/lib/audit"
import {
  createEnrollmentAccount,
  ParentFields,
  StudentPersonalFields,
  updateStudentPersonalFields,
  upsertStudentParents,
} from "@/lib/enroll"
import { ApiError, badRequest, notFound, requireRoles, serverError } from "@/lib/auth"
import { readAmount, readDate, readEnum, readId, readText } from "@/lib/validation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CLASSIFICATIONS = ["New", "Old", "Transferee", "Returning"] as const

interface ReEnrollBody extends StudentPersonalFields, ParentFields {
  levelId?: number | string
  schoolYearId?: number | string
  sectionId?: number | string | null
  paymentModeId?: number | string
  discount?: number | string
  classification?: string
  dateEnrolled?: string
}

/**
 * POST /api/students/[id]/re-enroll — enroll an existing student into a new
 * school year. Updates the student's current enrollment (never duplicates the
 * person), creates a new account for the selected school year, posts the
 * upon-enrollment payment, and recomputes balances. Prior-year accounts stay
 * untouched as history.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(["admin", "registrar"])
  if (auth.error) return auth.error

  try {
    const { id } = await params
    const studentId = Number(id)
    if (!Number.isInteger(studentId) || studentId <= 0) return notFound("Invalid student id")

    const body = (await req.json().catch(() => null)) as ReEnrollBody | null
    if (!body) return badRequest("Invalid request body")

    const levelId = readId(body.levelId, "Level")
    const schoolYearId = readId(body.schoolYearId, "School year")
    if (!levelId || !schoolYearId) return badRequest("Level and school year are required")

    const sectionId = body.sectionId === null ? null : readId(body.sectionId, "Section")
    if (body.gender !== undefined) {
      readEnum(readText(body.gender, 10, "Gender"), ["Male", "Female"], "Gender")
    }
    const classification =
      readEnum(readText(body.classification, 20, "Classification"), CLASSIFICATIONS, "Classification") ?? "Old"
    const dateEnrolled = readDate(body.dateEnrolled, "Date enrolled")
    const paymentModeId = readId(body.paymentModeId, "Payment mode")
    const discount = readAmount(body.discount, "Discount") ?? 0

    const result = await withTransaction(async (client) => {
      const studentResult = await client.query<{ id: number; reg_number: number | null }>(
        `SELECT id, reg_number FROM students WHERE id = $1 FOR UPDATE`,
        [studentId],
      )
      const student = studentResult.rows[0]
      if (!student) throw new ApiError(404, "Student not found")

      const existingAccount = await client.query<{ account_id: number }>(
        `SELECT account_id FROM accounts WHERE student_id = $1 AND school_year_id = $2 LIMIT 1`,
        [studentId, schoolYearId],
      )
      if (existingAccount.rows[0]) {
        throw new ApiError(
          409,
          "This student already has an account for the selected school year — they are already enrolled in it.",
        )
      }

      if (sectionId) {
        const sectionResult = await client.query(
          `SELECT 1 FROM sections WHERE id = $1 AND level_id = $2 AND school_year_id = $3`,
          [sectionId, levelId, schoolYearId],
        )
        if (!sectionResult.rowCount) {
          throw new ApiError(400, "The selected section does not belong to the selected level and school year")
        }
      }

      const enrollment = await createEnrollmentAccount(client, {
        studentId,
        regNumber: student.reg_number,
        schoolYearId,
        levelId,
        paymentModeId,
        discount,
        paymentDate: dateEnrolled,
        postedBy: auth.user.username,
        actor: auth.user,
      })

      await updateStudentPersonalFields(client, studentId, body)
      await upsertStudentParents(client, studentId, body)

      await client.query(
        `UPDATE students SET
           current_level_id = $1,
           current_section_id = $2,
           school_year_id = $3,
           classification = $4,
           status = 'enrolled',
           date_enrolled = COALESCE($5::date, CURRENT_DATE),
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [levelId, sectionId, schoolYearId, classification, dateEnrolled, studentId],
      )

      await writeAudit(client, auth.user, {
        action: "student.reenroll",
        entityType: "student",
        entityId: studentId,
        summary: `Re-enrolled AA-${student.reg_number} into level ${levelId} for school year ${schoolYearId}`,
        details: {
          levelId,
          sectionId,
          schoolYearId,
          classification,
          accountId: enrollment.displayAccountId,
          receiptNumber: enrollment.receiptNumber,
        },
      })

      return {
        student: { id: studentId, regNumber: student.reg_number },
        account: {
          id: enrollment.accountId,
          accountId: enrollment.displayAccountId,
          totalFees: enrollment.totalFees,
          modeOfPayment: enrollment.paymentMode,
        },
        payment: {
          paymentId: enrollment.paymentId,
          receiptNumber: enrollment.receiptNumber,
          initialPayment: enrollment.initialPayment,
        },
      }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json(
        { error: "This student already has an account for the selected school year." },
        { status: 409 },
      )
    }
    return serverError(error)
  }
}