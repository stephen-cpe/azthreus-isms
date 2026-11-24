import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { notFound, requireAuth, serverError } from "@/lib/auth"
import { averageOf, honorsLabel, round2 } from "@/lib/grades"
import type { PaymentRow, StudentProfile } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const { id } = await params
    const studentId = Number(id)
    if (!Number.isInteger(studentId) || studentId <= 0) return notFound("Invalid student id")

    const student = await queryOne<StudentProfile["student"]>(
      `SELECT
         s.id,
         s.reg_number AS "regNumber",
         s.student_number AS "studNum",
         s.first_name AS "firstName",
         s.middle_name AS "middleName",
         s.last_name AS "lastName",
         s.gender,
         TO_CHAR(s.birthdate, 'MM/DD/YYYY') AS birthdate,
         s.birthplace,
         s.birth_order AS "birthOrder",
         s.age,
         s.address,
         s.barangay,
         s.telephone,
         s.cellphone,
         s.classification,
         s.status,
         l.level_name AS level,
         sec.section_name AS section,
         sy.year_code AS "schoolYear",
         TO_CHAR(s.date_enrolled, 'MM/DD/YYYY') AS "dateEnrolled",
         s.general_average::float8 AS "generalAverage"
       FROM students s
       LEFT JOIN levels l ON l.id = s.current_level_id
       LEFT JOIN sections sec ON sec.id = s.current_section_id
       LEFT JOIN school_years sy ON sy.id = s.school_year_id
       WHERE s.id = $1`,
      [studentId],
    )
    if (!student) return notFound("Student not found")

    const parents = await queryOne<NonNullable<StudentProfile["parents"]>>(
      `SELECT
         p.father_name AS "fatherName",
         p.father_occupation AS "fatherOccupation",
         p.father_age AS "fatherAge",
         p.father_education AS "fatherEducation",
         p.mother_name AS "motherName",
         p.mother_occupation AS "motherOccupation",
         p.mother_age AS "motherAge",
         p.mother_education AS "motherEducation",
         p.telephone,
         p.mobile_number AS "mobileNumber",
         p.religion_id AS "religionId",
         r.religion_name AS religion
       FROM parents p
       LEFT JOIN religions r ON r.id = p.religion_id
       WHERE p.student_id = $1
       ORDER BY p.id DESC
       LIMIT 1`,
      [studentId],
    )

    const schoolHistory = await query<StudentProfile["schoolHistory"][number]>(
      `SELECT
         school_level AS "schoolLevel",
         school_name AS "schoolName",
         school_address AS "schoolAddress"
       FROM school_history
       WHERE student_id = $1
       ORDER BY id`,
      [studentId],
    )

    const account = await queryOne<NonNullable<StudentProfile["account"]>>(
      `SELECT
         a.account_id AS "accountId",
         a.account_number AS "accountNumber",
         pm.mode_name AS "modeOfPayment",
         a.total_school_fees::float8 AS "totalSchoolFees",
         a.total_payments_made::float8 AS "totalPaymentsMade",
         a.total_balance::float8 AS "totalBalance",
         a.months_not_paid AS "monthsNotPaid",
         a.current_dues::float8 AS "currentDues",
         TO_CHAR(a.last_updated, 'MM/DD/YYYY HH12:MI:SS AM') AS "lastUpdated"
       FROM accounts a
       JOIN payment_modes pm ON pm.id = a.payment_mode_id
       WHERE a.student_id = $1
       ORDER BY a.id DESC
       LIMIT 1`,
      [studentId],
    )

    const payments = await query<PaymentRow>(
      `SELECT
         p.id,
         p.account_id AS "accountId",
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
         p.reverses_payment_id AS "reversesPaymentId",
         r.receipt_number AS "reversalReceipt",
         p.reason
       FROM payments p
       LEFT JOIN payments r ON r.reverses_payment_id = p.id
       WHERE p.student_id = $1
       ORDER BY p.payment_date DESC, p.id DESC
       LIMIT 20`,
      [studentId],
    )

    const canViewGrades = auth.user.role === "admin" || auth.user.role === "registrar"
    const gradeSummary = canViewGrades
      ? await query<{ period: string; average: number | null; subjects: number }>(
          `SELECT
             gp.period_name AS period,
             AVG(g.numeric_grade)::float8 AS average,
             COUNT(*)::int AS subjects
           FROM grades g
           JOIN grade_periods gp ON gp.id = g.grade_period_id
           WHERE g.student_id = $1 AND g.numeric_grade IS NOT NULL
             AND g.school_year_id = (SELECT school_year_id FROM students WHERE id = $1)
           GROUP BY gp.id, gp.period_name, gp.period_order
           ORDER BY gp.period_order`,
          [studentId],
        )
      : []

    const generalAverage = averageOf(gradeSummary.map((row) => (row.average === null ? null : round2(row.average))))

    const payload: StudentProfile = {
      student,
      parents,
      schoolHistory,
      account,
      payments,
      gradeSummary,
      generalAverage,
      honors: canViewGrades ? honorsLabel(generalAverage) : null,
    }

    return NextResponse.json(payload)
  } catch (error) {
    return serverError(error)
  }
}
