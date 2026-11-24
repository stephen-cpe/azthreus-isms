import { NextRequest, NextResponse } from "next/server"
import { withTransaction } from "@/lib/db"
import { writeAudit } from "@/lib/audit"
import {
  ParentFields,
  StudentPersonalFields,
  updateStudentPersonalFields,
  upsertStudentParents,
} from "@/lib/enroll"
import { ApiError, badRequest, notFound, requireRoles, serverError } from "@/lib/auth"
import { readAmount, readEnum, readId, readText } from "@/lib/validation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const ALLOWED_STATUSES = ["enrolled", "dropped", "graduated", "transferred"]
const CLASSIFICATIONS = ["New", "Old", "Transferee", "Returning"] as const

function toInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const num = Number(value)
  return Number.isFinite(num) ? Math.trunc(num) : null
}

function toText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

function toDate(value: unknown): string | null {
  const text = toText(value)
  if (!text) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}

interface UpdateStudentBody extends StudentPersonalFields, ParentFields {
  classification?: string
  generalAverage?: number | string
  status?: string
  levelId?: number | string
  sectionId?: number | string
  schoolYearId?: number | string
}

type FieldKind = "text" | "int" | "date"

const PERSONAL_COMPARE: { key: string; current: string; kind: FieldKind }[] = [
  { key: "firstName", current: "firstName", kind: "text" },
  { key: "middleName", current: "middleName", kind: "text" },
  { key: "lastName", current: "lastName", kind: "text" },
  { key: "gender", current: "gender", kind: "text" },
  { key: "birthdate", current: "birthdate", kind: "date" },
  { key: "birthplace", current: "birthplace", kind: "text" },
  { key: "birthOrder", current: "birthOrder", kind: "int" },
  { key: "age", current: "age", kind: "int" },
  { key: "address", current: "address", kind: "text" },
  { key: "barangay", current: "barangay", kind: "text" },
  { key: "telephone", current: "telephone", kind: "text" },
  { key: "cellphone", current: "cellphone", kind: "text" },
  { key: "studentNumber", current: "studentNumber", kind: "text" },
]

const PARENT_COMPARE: { key: string; current: string; kind: FieldKind }[] = [
  { key: "fatherName", current: "fatherName", kind: "text" },
  { key: "fatherOccupation", current: "fatherOccupation", kind: "text" },
  { key: "fatherAge", current: "fatherAge", kind: "int" },
  { key: "fatherEducation", current: "fatherEducation", kind: "text" },
  { key: "motherName", current: "motherName", kind: "text" },
  { key: "motherOccupation", current: "motherOccupation", kind: "text" },
  { key: "motherAge", current: "motherAge", kind: "int" },
  { key: "motherEducation", current: "motherEducation", kind: "text" },
  { key: "parentsTelephone", current: "parentsTelephone", kind: "text" },
  { key: "parentsMobile", current: "parentsMobile", kind: "text" },
  { key: "religionId", current: "religionId", kind: "int" },
]

function normalizeForCompare(kind: FieldKind, raw: unknown): string | number | null {
  if (kind === "text") return toText(raw)
  if (kind === "date") return toDate(raw)
  return toInt(raw)
}

/**
 * PUT /api/students/[id] — edit a student record: personal info, contact,
 * classification, enrollment (level / section / school year), and status
 * (enrolled / dropped / graduated / transferred). Only provided fields change.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(["admin", "registrar"])
  if (auth.error) return auth.error

  try {
    const { id } = await params
    const studentId = Number(id)
    if (!Number.isInteger(studentId) || studentId <= 0) return notFound("Invalid student id")

    const body = (await req.json().catch(() => null)) as UpdateStudentBody | null
    if (!body) return badRequest("Invalid request body")

    const status = readText(body.status, 20, "Status")
    if (status && !ALLOWED_STATUSES.includes(status)) {
      return badRequest(`Status must be one of: ${ALLOWED_STATUSES.join(", ")}`)
    }
    if (body.gender !== undefined) {
      readEnum(readText(body.gender, 10, "Gender"), ["Male", "Female"], "Gender")
    }
    const classification =
      body.classification === undefined
        ? undefined
        : readEnum(readText(body.classification, 20, "Classification"), CLASSIFICATIONS, "Classification") ?? "New"
    const generalAverage =
      body.generalAverage === undefined ? undefined : readAmount(body.generalAverage, "General average")
    if (generalAverage !== undefined && generalAverage !== null && generalAverage > 100) {
      return badRequest("General average must be between 0 and 100")
    }

    const result = await withTransaction(async (client) => {
      const studentResult = await client.query<{
        id: number
        regNumber: number | null
        firstName: string
        middleName: string | null
        lastName: string
        gender: string | null
        birthdate: string | null
        birthplace: string | null
        birthOrder: number | null
        age: number | null
        address: string | null
        barangay: string | null
        telephone: string | null
        cellphone: string | null
        studentNumber: string | null
        classification: string | null
        generalAverage: number | null
        status: string | null
        levelId: number | null
        schoolYearId: number | null
        sectionId: number | null
      }>(
        `SELECT
           id,
           reg_number AS "regNumber",
           first_name AS "firstName",
           middle_name AS "middleName",
           last_name AS "lastName",
           gender,
           TO_CHAR(birthdate, 'YYYY-MM-DD') AS birthdate,
           birthplace,
           birth_order AS "birthOrder",
           age,
           address,
           barangay,
           telephone,
           cellphone,
           student_number AS "studentNumber",
           classification,
           general_average::float8 AS "generalAverage",
           status,
           current_level_id AS "levelId",
           school_year_id AS "schoolYearId",
           current_section_id AS "sectionId"
         FROM students WHERE id = $1 FOR UPDATE`,
        [studentId],
      )
      const student = studentResult.rows[0]
      if (!student) throw new ApiError(404, "Student not found")

      const parentResult = await client.query<Record<string, unknown>>(
        `SELECT
           father_name AS "fatherName",
           father_occupation AS "fatherOccupation",
           father_age AS "fatherAge",
           father_education AS "fatherEducation",
           mother_name AS "motherName",
           mother_occupation AS "motherOccupation",
           mother_age AS "motherAge",
           mother_education AS "motherEducation",
           telephone AS "parentsTelephone",
           mobile_number AS "parentsMobile",
           religion_id AS "religionId"
         FROM parents
         WHERE student_id = $1
         ORDER BY id DESC
         LIMIT 1`,
        [studentId],
      )
      const currentParent = parentResult.rows[0] ?? {}

      const levelId =
        body.levelId === undefined ? student.levelId : readId(body.levelId, "Level") ?? student.levelId
      const schoolYearId =
        body.schoolYearId === undefined
          ? student.schoolYearId
          : readId(body.schoolYearId, "School year") ?? student.schoolYearId
      const sectionId =
        body.sectionId === undefined || body.sectionId === null || body.sectionId === ""
          ? null
          : readId(body.sectionId, "Section")
      if ((body.levelId !== undefined || body.schoolYearId !== undefined) && (!levelId || !schoolYearId)) {
        throw new ApiError(400, "A level and school year are required for this student")
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

      await updateStudentPersonalFields(client, studentId, body)
      await upsertStudentParents(client, studentId, body)

      const sets: string[] = []
      const values: unknown[] = []
      const add = (column: string, value: unknown) => {
        values.push(value)
        sets.push(`${column} = $${values.length}`)
      }

      if (body.classification !== undefined) add("classification", classification ?? "New")
      if (body.generalAverage !== undefined) add("general_average", generalAverage ?? null)
      if (status) add("status", status)
      if (body.levelId !== undefined) add("current_level_id", levelId)
      if (body.schoolYearId !== undefined) add("school_year_id", schoolYearId)
      if (body.sectionId !== undefined) add("current_section_id", sectionId)

      if (sets.length > 0) {
        sets.push(`updated_at = CURRENT_TIMESTAMP`)
        await client.query(`UPDATE students SET ${sets.join(", ")} WHERE id = $${values.length + 1}`, [
          ...values,
          studentId,
        ])
      }

      const updated = await client.query<{
        id: number
        first_name: string
        last_name: string
        status: string | null
        current_level_id: number | null
        school_year_id: number | null
      }>(
        `SELECT id, first_name, last_name, status, current_level_id, school_year_id
         FROM students WHERE id = $1`,
        [studentId],
      )

      const statusChanged = status !== null && status !== student.status
      const bodyRecord = body as unknown as Record<string, unknown>
      const currentStudent = student as unknown as Record<string, unknown>
      const changedFields: string[] = []

      for (const field of PERSONAL_COMPARE) {
        if (bodyRecord[field.key] === undefined) continue
        const next = normalizeForCompare(field.kind, bodyRecord[field.key])
        if (next !== (currentStudent[field.current] ?? null)) changedFields.push(field.key)
      }
      for (const field of PARENT_COMPARE) {
        if (bodyRecord[field.key] === undefined) continue
        const next = normalizeForCompare(field.kind, bodyRecord[field.key])
        if (next !== (currentParent[field.current] ?? null)) changedFields.push(field.key)
      }
      if (body.classification !== undefined) {
        const next = classification ?? "New"
        if (next !== (student.classification ?? "New")) changedFields.push("classification")
      }
      if (body.generalAverage !== undefined) {
        const next = generalAverage ?? null
        if (next !== student.generalAverage) changedFields.push("generalAverage")
      }
      if (body.levelId !== undefined) {
        const next = toInt(body.levelId)
        if (next !== null && next !== student.levelId) changedFields.push("levelId")
      }
      if (body.schoolYearId !== undefined) {
        const next = toInt(body.schoolYearId)
        if (next !== null && next !== student.schoolYearId) changedFields.push("schoolYearId")
      }
      if (body.sectionId !== undefined) {
        const next = body.sectionId === null ? null : toInt(body.sectionId)
        if (next !== student.sectionId) changedFields.push("sectionId")
      }

      if (statusChanged) {
        await writeAudit(client, auth.user, {
          action: "student.status_change",
          entityType: "student",
          entityId: student.id,
          summary: `Changed status of AA-${student.regNumber} from ${student.status ?? "unknown"} to ${status}`,
          details: { previousStatus: student.status, newStatus: status },
        })
      }
      if (changedFields.length > 0) {
        await writeAudit(client, auth.user, {
          action: "student.update",
          entityType: "student",
          entityId: student.id,
          summary: `Updated AA-${student.regNumber} (${changedFields.length} field${changedFields.length === 1 ? "" : "s"})`,
          details: { fields: changedFields },
        })
      }

      return { student: updated.rows[0] }
    })

    return NextResponse.json(result)
  } catch (error) {
    return serverError(error)
  }
}