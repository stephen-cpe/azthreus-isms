import { NextRequest, NextResponse } from "next/server"
import { query, withTransaction } from "@/lib/db"
import { createEnrollmentAccount } from "@/lib/enroll"
import { writeAudit } from "@/lib/audit"
import { ApiError, badRequest, requireAuth, requireRoles, serverError } from "@/lib/auth"
import { readAmount, readDate, readEnum, readId, readInt, readText } from "@/lib/validation"
import type { StudentListItem } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CLASSIFICATIONS = ["New", "Old", "Transferee", "Returning"] as const
const GENDERS = ["Male", "Female"] as const

function toInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const num = Number(value)
  return Number.isFinite(num) ? Math.trunc(num) : null
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q")?.trim()
    const letter = searchParams.get("letter")?.trim()
    const levelId = toInt(searchParams.get("levelId"))
    const schoolYearId = toInt(searchParams.get("schoolYearId"))
    const classification = searchParams.get("classification")?.trim()
    const enrolledOnly = searchParams.get("enrolled") === "1"
    const hasAccount = searchParams.get("hasAccount")

    if (q && q.length > 100) return badRequest("The search text is too long")
    if (letter && !/^[A-Za-z]$/.test(letter)) return badRequest("The letter filter must be a single letter")
    if (classification && classification.length > 20) return badRequest("The classification filter is too long")

    const where: string[] = []
    const params: unknown[] = []

    if (q) {
      params.push(`%${q}%`)
      where.push(`s.last_name ILIKE $${params.length}`)
    }
    if (letter) {
      params.push(letter.toUpperCase())
      where.push(`UPPER(s.last_name) LIKE $${params.length} || '%'`)
    }
    if (levelId) {
      params.push(levelId)
      where.push(`s.current_level_id = $${params.length}`)
    }
    if (schoolYearId) {
      params.push(schoolYearId)
      where.push(`s.school_year_id = $${params.length}`)
    }
    if (classification) {
      params.push(classification)
      where.push(`s.classification = $${params.length}`)
    }
    if (enrolledOnly) {
      where.push(`s.status = 'enrolled'`)
    }
    if (hasAccount === "yes") {
      where.push(`EXISTS (SELECT 1 FROM accounts acc WHERE acc.student_id = s.id AND acc.school_year_id = s.school_year_id)`)
    } else if (hasAccount === "no") {
      where.push(`NOT EXISTS (SELECT 1 FROM accounts acc WHERE acc.student_id = s.id AND acc.school_year_id = s.school_year_id)`)
    }

    const rows = await query<StudentListItem>(
      `SELECT
         s.id AS "studentId",
         s.last_name AS "lastName",
         s.first_name AS "firstName",
         s.middle_name AS "middleName",
         s.student_number AS "studNum",
         s.reg_number AS "regNum",
         s.current_level_id AS "levelId",
         s.school_year_id AS "schoolYearId",
         l.level_name AS level,
         sec.section_name AS section,
         sy.year_code AS sy,
         TO_CHAR(s.date_enrolled, 'MM/DD/YYYY') AS enrolled,
         s.classification AS classif,
         s.gender,
         s.telephone AS "telNum",
         s.cellphone AS "celNum",
         s.status,
         COALESCE(a.total_balance, 0)::float8 AS balance
        FROM students s
        LEFT JOIN levels l ON l.id = s.current_level_id
        LEFT JOIN sections sec ON sec.id = s.current_section_id
        LEFT JOIN school_years sy ON sy.id = s.school_year_id
        LEFT JOIN LATERAL (
          SELECT acc.total_balance
          FROM accounts acc
          WHERE acc.student_id = s.id
          ORDER BY acc.id DESC
          LIMIT 1
        ) a ON TRUE
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY s.last_name, s.first_name
       LIMIT 500`,
      params,
    )

    return NextResponse.json({ students: rows, count: rows.length })
  } catch (error) {
    return serverError(error)
  }
}

interface CreateStudentBody {
  firstName?: string
  middleName?: string
  lastName?: string
  gender?: string
  birthdate?: string
  birthplace?: string
  birthOrder?: number | string
  age?: number | string
  dateEnrolled?: string
  address?: string
  barangay?: string
  telephone?: string
  cellphone?: string
  classification?: string
  schoolYearId?: number | string
  levelId?: number | string
  sectionId?: number | string
  generalAverage?: number | string
  studentNumber?: string
  paymentModeId?: number | string
  religionId?: number | string
  fatherName?: string
  fatherOccupation?: string
  fatherAge?: number | string
  fatherEducation?: string
  motherName?: string
  motherOccupation?: string
  motherAge?: number | string
  motherEducation?: string
  parentsTelephone?: string
  parentsMobile?: string
  schools?: { level?: string; name?: string; address?: string }[]
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(["admin", "registrar"])
  if (auth.error) return auth.error

  try {
    const body = (await req.json().catch(() => null)) as CreateStudentBody | null
    if (!body) return badRequest("Invalid request body")

    const firstName = readText(body.firstName, 100, "First name")
    const middleName = readText(body.middleName, 100, "Middle name")
    const lastName = readText(body.lastName, 100, "Last name")
    const levelId = readId(body.levelId, "Level")
    const schoolYearId = readId(body.schoolYearId, "School year")
    const sectionId = readId(body.sectionId, "Section")
    const paymentModeId = readId(body.paymentModeId, "Payment mode")
    const religionId = readId(body.religionId, "Religion")

    if (!firstName || !lastName) return badRequest("First name and last name are required")
    if (!levelId || !schoolYearId) return badRequest("Level and school year are required")

    const gender = readEnum(readText(body.gender, 10, "Gender"), GENDERS, "Gender")
    const classification = readEnum(readText(body.classification, 20, "Classification"), CLASSIFICATIONS, "Classification") ?? "New"
    const birthdate = readDate(body.birthdate, "Birthdate")
    const birthplace = readText(body.birthplace, 200, "Birthplace")
    const birthOrder = readInt(body.birthOrder, "Birth order", { min: 0, max: 100 })
    const age = readInt(body.age, "Age", { min: 0, max: 150 })
    const address = readText(body.address, 500, "Address")
    const barangay = readText(body.barangay, 100, "Barangay")
    const telephone = readText(body.telephone, 20, "Telephone")
    const cellphone = readText(body.cellphone, 20, "Cellphone")
    const studentNumber = readText(body.studentNumber, 20, "Student number")
    const generalAverage = readAmount(body.generalAverage, "General average")
    if (generalAverage !== null && generalAverage > 100) {
      return badRequest("General average must be between 0 and 100")
    }
    const dateEnrolled = readDate(body.dateEnrolled, "Date enrolled")

    const fatherName = readText(body.fatherName, 200, "Father's name")
    const fatherOccupation = readText(body.fatherOccupation, 100, "Father's occupation")
    const fatherAge = readInt(body.fatherAge, "Father's age", { min: 0, max: 150 })
    const fatherEducation = readText(body.fatherEducation, 100, "Father's education")
    const motherName = readText(body.motherName, 200, "Mother's name")
    const motherOccupation = readText(body.motherOccupation, 100, "Mother's occupation")
    const motherAge = readInt(body.motherAge, "Mother's age", { min: 0, max: 150 })
    const motherEducation = readText(body.motherEducation, 100, "Mother's education")
    const parentsTelephone = readText(body.parentsTelephone, 20, "Parent telephone")
    const parentsMobile = readText(body.parentsMobile, 20, "Parent mobile number")

    const schoolEntries: { level: string | null; name: string; address: string | null }[] = []
    if (Array.isArray(body.schools)) {
      if (body.schools.length > 10) return badRequest("At most 10 previous schools can be recorded")
      for (const school of body.schools) {
        const schoolName = readText(school?.name, 200, "School name")
        if (!schoolName) continue
        schoolEntries.push({
          level: readText(school?.level, 50, "School level"),
          name: schoolName,
          address: readText(school?.address, 500, "School address"),
        })
      }
    }

    const result = await withTransaction(async (client) => {
      if (sectionId) {
        const sectionResult = await client.query(
          `SELECT 1 FROM sections WHERE id = $1 AND level_id = $2 AND school_year_id = $3`,
          [sectionId, levelId, schoolYearId],
        )
        if (!sectionResult.rowCount) {
          throw new ApiError(400, "The selected section does not belong to the selected level and school year")
        }
      }

      const regResult = await client.query<{ next_reg: number }>(
        `SELECT nextval('students_reg_number_seq')::int AS next_reg`,
      )
      const nextReg = regResult.rows[0].next_reg

      const studentResult = await client.query<{ id: number; reg_number: number }>(
        `INSERT INTO students (
           reg_number, student_number, first_name, middle_name, last_name, gender,
           birthdate, birthplace, birth_order, age, address, barangay, telephone, cellphone,
           classification, current_level_id, current_section_id, school_year_id, general_average,
           date_enrolled, status
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
           COALESCE($20::date, CURRENT_DATE), 'enrolled'
         )
         RETURNING id, reg_number`,
        [
          nextReg,
          studentNumber,
          firstName,
          middleName,
          lastName,
          gender,
          birthdate,
          birthplace,
          birthOrder,
          age,
          address,
          barangay,
          telephone,
          cellphone,
          classification,
          levelId,
          sectionId,
          schoolYearId,
          generalAverage,
          dateEnrolled,
        ],
      )
      const student = studentResult.rows[0]

      const hasParentData =
        fatherName || motherName || religionId || parentsTelephone || parentsMobile
      if (hasParentData) {
        await client.query(
          `INSERT INTO parents (
             student_id, father_name, father_occupation, father_age, father_education,
             mother_name, mother_occupation, mother_age, mother_education,
             telephone, mobile_number, religion_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            student.id,
            fatherName,
            fatherOccupation,
            fatherAge,
            fatherEducation,
            motherName,
            motherOccupation,
            motherAge,
            motherEducation,
            parentsTelephone,
            parentsMobile,
            religionId,
          ],
        )
      }

      for (const school of schoolEntries) {
        await client.query(
          `INSERT INTO school_history (student_id, school_level, school_name, school_address)
           VALUES ($1, $2, $3, $4)`,
          [student.id, school.level, school.name, school.address],
        )
      }

      const enrollment = await createEnrollmentAccount(client, {
        studentId: student.id,
        regNumber: student.reg_number,
        schoolYearId,
        levelId,
        paymentModeId,
        paymentDate: dateEnrolled,
        postedBy: auth.user.username,
        actor: auth.user,
      })

      await writeAudit(client, auth.user, {
        action: "student.create",
        entityType: "student",
        entityId: student.id,
        summary: `Enrolled ${lastName}, ${firstName} (AA-${student.reg_number})`,
        details: {
          regNumber: student.reg_number,
          levelId,
          schoolYearId,
          accountId: enrollment.displayAccountId,
          receiptNumber: enrollment.receiptNumber,
        },
      })

      return {
        student: { id: student.id, regNumber: student.reg_number },
        account: { id: enrollment.accountId, accountId: enrollment.displayAccountId },
        payment: { paymentId: enrollment.paymentId, receiptNumber: enrollment.receiptNumber },
      }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return serverError(error)
  }
}
