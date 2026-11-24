import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { badRequest, notFound, requireAuth, serverError } from "@/lib/auth"
import { round2 } from "@/lib/grades"
import type { Assessment, PaymentRow, StudentAccountDetail } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const { id } = await params
    const studentId = Number(id)
    if (!Number.isInteger(studentId) || studentId <= 0) return notFound("Invalid student id")

    const yearParam = req.nextUrl.searchParams.get("schoolYearId")
    const requestedSchoolYearId = yearParam === null ? null : Number(yearParam)
    if (yearParam !== null && (!Number.isInteger(requestedSchoolYearId) || (requestedSchoolYearId ?? 0) <= 0)) {
      return badRequest("A valid school year is required")
    }

    const student = await queryOne<StudentAccountDetail["student"]>(
      `SELECT
         s.id,
         s.reg_number AS "regNumber",
         s.student_number AS "studNum",
         s.first_name AS "firstName",
         s.middle_name AS "middleName",
         s.last_name AS "lastName",
         l.level_name AS level,
         sec.section_name AS section,
         sy.year_code AS "schoolYear",
         s.classification,
         s.status
       FROM students s
       LEFT JOIN levels l ON l.id = s.current_level_id
       LEFT JOIN sections sec ON sec.id = s.current_section_id
       LEFT JOIN school_years sy ON sy.id = s.school_year_id
       WHERE s.id = $1`,
      [studentId],
    )
    if (!student) return notFound("Student not found")

    const account = await queryOne<NonNullable<StudentAccountDetail["account"]>>(
      `SELECT
         a.id,
         a.account_id AS "accountId",
         a.account_number AS "accountNumber",
         a.school_year_id AS "schoolYearId",
         a.level_id AS "levelId",
         sy.year_code AS "schoolYear",
         l.level_name AS "levelName",
         pm.mode_name AS "modeOfPayment",
         a.total_school_fees::float8 AS "totalSchoolFees",
         a.tuition_fee::float8 AS "tuitionFee",
         a.monthly_tuition::float8 AS "monthlyTuition",
         a.initial_payment::float8 AS "initialPayment",
         a.discount::float8 AS discount,
         a.total_payments_made::float8 AS "totalPaymentsMade",
         a.total_balance::float8 AS "totalBalance",
         a.months_not_paid AS "monthsNotPaid",
         a.current_dues::float8 AS "currentDues",
         TO_CHAR(a.due_date, 'MM/DD/YYYY') AS "dueDate",
         TO_CHAR(a.last_updated, 'MM/DD/YYYY HH12:MI:SS AM') AS "lastUpdated",
         a.posted_by AS "postedBy"
       FROM accounts a
       JOIN payment_modes pm ON pm.id = a.payment_mode_id
       LEFT JOIN school_years sy ON sy.id = a.school_year_id
       LEFT JOIN levels l ON l.id = a.level_id
       WHERE a.student_id = $1
         ${requestedSchoolYearId ? "AND a.school_year_id = $2" : ""}
       ORDER BY a.id DESC
       LIMIT 1`,
      requestedSchoolYearId ? [studentId, requestedSchoolYearId] : [studentId],
    )

    if (!account && requestedSchoolYearId) {
      return notFound("No account is on file for this student in the selected school year.")
    }

    const assessment = await queryOne<Assessment>(
      `SELECT
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
       WHERE a.level_id = COALESCE($2, (SELECT current_level_id FROM students WHERE id = $1))
         AND a.school_year_id = COALESCE($3, (SELECT school_year_id FROM students WHERE id = $1))`,
      [studentId, account?.levelId ?? null, account?.schoolYearId ?? null],
    )

    const payments = account
      ? await query<PaymentRow>(
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
           WHERE p.student_id = $1 AND p.account_id = $2
           ORDER BY p.payment_date DESC, p.id DESC`,
          [studentId, account.id],
        )
      : []

    const totals = payments.reduce(
      (acc, payment) => {
        acc.tuition += payment.tuition
        acc.computer += payment.computer
        acc.reg += payment.reg
        acc.misc += payment.misc
        acc.books += payment.books
        acc.others += payment.others
        acc.total += payment.total
        acc.count += 1
        return acc
      },
      { tuition: 0, computer: 0, reg: 0, misc: 0, books: 0, others: 0, total: 0, count: 0 },
    )
    for (const key of ["tuition", "computer", "reg", "misc", "books", "others", "total"] as const) {
      totals[key] = round2(totals[key])
    }

    // When a specific school year is requested, present that account's year
    // and level. The section is only meaningful for the student's current year.
    const studentPayload = account
      ? {
          ...student,
          schoolYear: account.schoolYear ?? student.schoolYear,
          level: account.levelName ?? student.level,
          section: account.schoolYear && account.schoolYear !== student.schoolYear ? null : student.section,
        }
      : student

    const payload: StudentAccountDetail = { student: studentPayload, account, assessment, payments, totals }
    return NextResponse.json(payload)
  } catch (error) {
    return serverError(error)
  }
}
