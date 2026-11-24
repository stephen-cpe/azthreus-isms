import { NextRequest, NextResponse } from "next/server"
import { withTransaction } from "@/lib/db"
import { createEnrollmentAccount } from "@/lib/enroll"
import { ApiError, badRequest, requireRoles, serverError } from "@/lib/auth"
import { readAmount, readId } from "@/lib/validation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface CreateAccountBody {
  studentId?: number | string
  schoolYearId?: number | string
  paymentModeId?: number | string
  discount?: number | string
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(["admin", "cashier"])
  if (auth.error) return auth.error

  try {
    const body = (await req.json().catch(() => null)) as CreateAccountBody | null
    const studentId = readId(body?.studentId, "Student")
    if (!studentId) return badRequest("A student must be selected")
    const discount = readAmount(body?.discount, "Discount") ?? 0
    const requestedSchoolYearId = readId(body?.schoolYearId, "School year")
    const paymentModeId = readId(body?.paymentModeId, "Payment mode")

    const result = await withTransaction(async (client) => {
      const studentResult = await client.query<{
        id: number
        reg_number: number | null
        current_level_id: number | null
        school_year_id: number | null
      }>(`SELECT id, reg_number, current_level_id, school_year_id FROM students WHERE id = $1`, [
        studentId,
      ])
      const student = studentResult.rows[0]
      if (!student) throw new ApiError(404, "Student not found")
      if (!student.current_level_id || !student.school_year_id) {
        throw new ApiError(400, "Student is missing a level or school year")
      }

      const schoolYearId = requestedSchoolYearId ?? student.school_year_id
      if (schoolYearId !== student.school_year_id) {
        throw new ApiError(
          400,
          "Add Account creates the account for the student's current school year. Use re-enrollment to move a student to another year.",
        )
      }

      const enrollment = await createEnrollmentAccount(client, {
        studentId: student.id,
        regNumber: student.reg_number,
        schoolYearId,
        levelId: student.current_level_id,
        paymentModeId,
        discount,
        postedBy: auth.user.username,
        actor: auth.user,
      })

      return {
        id: enrollment.accountId,
        accountId: enrollment.displayAccountId,
        accountNumber: enrollment.accountNumber,
      }
    })

    return NextResponse.json({ account: result }, { status: 201 })
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "This student already has an account for that school year." }, { status: 409 })
    }
    return serverError(error)
  }
}
