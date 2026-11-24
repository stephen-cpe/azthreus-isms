import { NextRequest, NextResponse } from "next/server"
import { query, queryOne, withTransaction } from "@/lib/db"
import { writeAudit } from "@/lib/audit"
import { ApiError, badRequest, notFound, requireRoles, serverError } from "@/lib/auth"
import { averageOf, gradeRemarks, honorsLabel, round2 } from "@/lib/grades"
import type {
  GradeGridRow,
  LookupGradePeriod,
  RankingReport,
  RankingRow,
  ReportCard,
  ReportCardRow,
} from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface StudentLookupRow {
  id: number
  regNumber: number | null
  firstName: string
  middleName: string | null
  lastName: string
  level: string | null
  category: string | null
  section: string | null
  adviser: string | null
  schoolYearId: number | null
  schoolYear: string | null
  levelId: number | null
  sectionId: number | null
}

interface GradeRow {
  studentId: number
  subjectId: number
  gradePeriodId: number
  numericGrade: number | null
  remarks: string | null
}

async function getStudent(
  studentId: number,
  requestedSchoolYearId: number | null,
): Promise<StudentLookupRow | null> {
  return queryOne<StudentLookupRow>(
    `SELECT
       s.id,
       s.reg_number AS "regNumber",
       s.first_name AS "firstName",
       s.middle_name AS "middleName",
       s.last_name AS "lastName",
       COALESCE(al.level_name, l.level_name) AS level,
       COALESCE(al.level_category, l.level_category) AS category,
       sec.section_name AS section,
       sec.adviser,
       COALESCE(a.school_year_id, s.school_year_id) AS "schoolYearId",
       sy.year_code AS "schoolYear",
       COALESCE(a.level_id, s.current_level_id) AS "levelId",
       CASE
         WHEN COALESCE(a.school_year_id, s.school_year_id) = s.school_year_id
           THEN s.current_section_id
         ELSE NULL
       END AS "sectionId"
     FROM students s
     LEFT JOIN accounts a
       ON a.student_id = s.id
      AND a.school_year_id = COALESCE($2::int, s.school_year_id)
     LEFT JOIN levels l ON l.id = s.current_level_id
     LEFT JOIN levels al ON al.id = a.level_id
     LEFT JOIN LATERAL (
       SELECT sec.section_name, sec.adviser
       FROM sections sec
       WHERE sec.level_id = COALESCE(a.level_id, s.current_level_id)
         AND sec.school_year_id = COALESCE(a.school_year_id, s.school_year_id)
       ORDER BY sec.id
       LIMIT 1
     ) sec ON TRUE
     LEFT JOIN school_years sy ON sy.id = COALESCE(a.school_year_id, s.school_year_id)
     WHERE s.id = $1`,
    [studentId, requestedSchoolYearId],
  )
}

async function getPeriods(schoolYearId: number): Promise<LookupGradePeriod[]> {
  return query<LookupGradePeriod>(
    `SELECT gp.id, gp.period_name AS name, gp.period_order AS "order", gp.school_year_id AS "schoolYearId"
     FROM grade_periods gp
     WHERE gp.school_year_id = $1
     ORDER BY gp.period_order`,
    [schoolYearId],
  )
}

async function getSubjectIds(student: StudentLookupRow): Promise<{ id: number; subjectName: string }[]> {
  return query<{ id: number; subjectName: string }>(
    `SELECT id, subject_name AS "subjectName"
     FROM subjects
     WHERE level_category = $1 OR level_category IS NULL
     ORDER BY sort_order, subject_name`,
    [student.category],
  )
}

async function buildReportCard(studentId: number, requestedSchoolYearId: number | null): Promise<ReportCard | null> {
  const student = await getStudent(studentId, requestedSchoolYearId)
  if (!student) return null
  if (requestedSchoolYearId && student.schoolYearId !== requestedSchoolYearId) return null

  const schoolYearId = student.schoolYearId
  if (!schoolYearId) return null

  const [periods, subjects, grades] = await Promise.all([
    getPeriods(schoolYearId),
    getSubjectIds(student),
    query<GradeRow>(
      `SELECT
         g.student_id AS "studentId",
         g.subject_id AS "subjectId",
         g.grade_period_id AS "gradePeriodId",
         g.numeric_grade::float8 AS "numericGrade",
         g.remarks
       FROM grades g
       WHERE g.student_id = $1`,
      [studentId],
    ),
  ])

  const gradeMap = new Map<string, GradeRow>()
  for (const grade of grades) {
    gradeMap.set(`${grade.subjectId}:${grade.gradePeriodId}`, grade)
  }

  const rows: ReportCardRow[] = subjects.map((subject) => {
    const cellGrades = periods.map((period) => {
      const row = gradeMap.get(`${subject.id}:${period.id}`)
      return row && row.numericGrade !== null ? round2(row.numericGrade) : null
    })
    const subjectAverage = averageOf(cellGrades)
    return {
      subjectId: subject.id,
      subjectName: subject.subjectName,
      grades: cellGrades,
      subjectAverage,
      remarks: gradeRemarks(subjectAverage),
    }
  })

  const periodIds = new Set(periods.map((period) => period.id))
  const allGrades = grades
    .filter((grade) => grade.numericGrade !== null && periodIds.has(grade.gradePeriodId))
    .map((grade) => round2(grade.numericGrade as number))
  const generalAverage = averageOf(allGrades)

  const periodAverages = periods.map((period) => {
    const values = subjects.map((subject) => {
      const row = gradeMap.get(`${subject.id}:${period.id}`)
      return row && row.numericGrade !== null ? round2(row.numericGrade) : null
    })
    return averageOf(values)
  })

  const rankInfo = await getRank(student, schoolYearId, null)
  const rank = rankInfo.rows.find((row) => row.studentId === studentId)?.rank ?? null

  const schoolYear = await queryOne<{ code: string }>(`SELECT year_code AS code FROM school_years WHERE id = $1`, [
    schoolYearId,
  ])

  return {
    student: {
      id: student.id,
      regNumber: student.regNumber,
      firstName: student.firstName,
      middleName: student.middleName,
      lastName: student.lastName,
      level: student.level,
      section: student.section,
      adviser: student.adviser,
    },
    schoolYear: schoolYear?.code ?? "",
    periods,
    rows,
    periodAverages,
    generalAverage,
    remarks: gradeRemarks(generalAverage),
    rank,
    classSize: rankInfo.classSize,
    honors: honorsLabel(generalAverage),
  }
}

async function getRank(
  student: StudentLookupRow,
  schoolYearId: number,
  gradePeriodId: number | null,
): Promise<{ rows: (RankingRow & { averageValue: number | null })[]; classSize: number }> {
  const params: unknown[] = [student.levelId, schoolYearId]
  let filter = ""
  if (student.sectionId) {
    params.push(student.sectionId)
    filter += ` AND sec.section_id = $${params.length}`
  }
  if (gradePeriodId) {
    params.push(gradePeriodId)
    filter += ` AND g.grade_period_id = $${params.length}`
  }

  const rows = await query<
    RankingRow & { averageValue: number | null }
  >(
    `SELECT
       s.id AS "studentId",
       s.last_name AS "lastName",
       s.first_name AS "firstName",
       s.middle_name AS "middleName",
       l.level_name AS level,
       sec.section_name AS section,
       AVG(g.numeric_grade)::float8 AS "averageValue"
     FROM students s
     JOIN accounts a ON a.student_id = s.id AND a.school_year_id = $2
     JOIN grades g ON g.student_id = s.id AND g.school_year_id = $2
     LEFT JOIN levels l ON l.id = a.level_id
     LEFT JOIN LATERAL (
       SELECT s2.id AS section_id, s2.section_name
       FROM sections s2
       WHERE s2.level_id = a.level_id AND s2.school_year_id = a.school_year_id
       ORDER BY s2.id
       LIMIT 1
     ) sec ON TRUE
     WHERE a.level_id = $1
       AND g.numeric_grade IS NOT NULL
       ${filter}
     GROUP BY s.id, s.last_name, s.first_name, s.middle_name, l.level_name, sec.section_id, sec.section_name
     ORDER BY "averageValue" DESC, s.last_name, s.first_name`,
    params,
  )

  let rank = 0
  let previous: number | null = null
  let position = 0
  const ranked = rows.map((row) => {
    position += 1
    const average = row.averageValue === null ? null : round2(row.averageValue)
    if (average !== previous) {
      rank = position
      previous = average
    }
    return {
      ...row,
      average,
      rank,
      remarks: gradeRemarks(average),
      honors: honorsLabel(average),
    }
  })

  return { rows: ranked, classSize: ranked.length }
}

export async function GET(req: NextRequest) {
  const auth = await requireRoles(["admin", "registrar"])
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get("mode") ?? "grid"

    if (mode === "report-card") {
      const studentId = Number(searchParams.get("studentId"))
      if (!Number.isInteger(studentId) || studentId <= 0) return badRequest("A valid student is required")
      const schoolYearInput = Number(searchParams.get("schoolYearId"))
      const requestedSchoolYearId =
        Number.isInteger(schoolYearInput) && schoolYearInput > 0 ? schoolYearInput : null
      const reportCard = await buildReportCard(studentId, requestedSchoolYearId)
      if (!reportCard) {
        return requestedSchoolYearId
          ? notFound("No report card is available for that student and school year.")
          : notFound("Student not found")
      }
      return NextResponse.json({ reportCard })
    }

    if (mode === "ranking") {
      const levelId = Number(searchParams.get("levelId"))
      const schoolYearId = Number(searchParams.get("schoolYearId"))
      if (!Number.isInteger(levelId) || levelId <= 0 || !Number.isInteger(schoolYearId) || schoolYearId <= 0) {
        return badRequest("Level and school year are required")
      }
      const sectionId = Number(searchParams.get("sectionId"))
      const gradePeriodId = Number(searchParams.get("gradePeriodId"))

      const params: unknown[] = [levelId, schoolYearId]
      let filter = ""
      if (Number.isInteger(sectionId) && sectionId > 0) {
        params.push(sectionId)
        filter += ` AND sec.section_id = $${params.length}`
      }
      if (Number.isInteger(gradePeriodId) && gradePeriodId > 0) {
        params.push(gradePeriodId)
        filter += ` AND g.grade_period_id = $${params.length}`
      }

      const rows = await query<RankingRow & { averageValue: number | null }>(
        `SELECT
           s.id AS "studentId",
           s.last_name AS "lastName",
           s.first_name AS "firstName",
           s.middle_name AS "middleName",
           l.level_name AS level,
           sec.section_name AS section,
           AVG(g.numeric_grade)::float8 AS "averageValue"
         FROM students s
         JOIN accounts a ON a.student_id = s.id AND a.school_year_id = $2
         JOIN grades g ON g.student_id = s.id AND g.school_year_id = $2
         LEFT JOIN levels l ON l.id = a.level_id
         LEFT JOIN LATERAL (
           SELECT s2.id AS section_id, s2.section_name
           FROM sections s2
           WHERE s2.level_id = a.level_id AND s2.school_year_id = a.school_year_id
           ORDER BY s2.id
           LIMIT 1
         ) sec ON TRUE
         WHERE a.level_id = $1
           AND g.numeric_grade IS NOT NULL
           ${filter}
         GROUP BY s.id, s.last_name, s.first_name, s.middle_name, l.level_name, sec.section_id, sec.section_name
         ORDER BY "averageValue" DESC, s.last_name, s.first_name`,
        params,
      )

      let rank = 0
      let previous: number | null = null
      let position = 0
      const ranked: RankingRow[] = rows.map((row) => {
        position += 1
        const average = row.averageValue === null ? null : round2(row.averageValue)
        if (average !== previous) {
          rank = position
          previous = average
        }
        return {
          rank,
          studentId: row.studentId,
          lastName: row.lastName,
          firstName: row.firstName,
          middleName: row.middleName,
          level: row.level,
          section: row.section,
          average,
          remarks: gradeRemarks(average),
          honors: honorsLabel(average),
        }
      })

      const [period, schoolYear, level, section] = await Promise.all([
        Number.isInteger(gradePeriodId) && gradePeriodId > 0
          ? queryOne<LookupGradePeriod>(
              `SELECT id, period_name AS name, period_order AS "order", school_year_id AS "schoolYearId"
               FROM grade_periods WHERE id = $1`,
              [gradePeriodId],
            )
          : Promise.resolve(null),
        queryOne<{ code: string }>(`SELECT year_code AS code FROM school_years WHERE id = $1`, [schoolYearId]),
        queryOne<{ name: string }>(`SELECT level_name AS name FROM levels WHERE id = $1`, [levelId]),
        Number.isInteger(sectionId) && sectionId > 0
          ? queryOne<{ name: string }>(`SELECT section_name AS name FROM sections WHERE id = $1`, [sectionId])
          : Promise.resolve(null),
      ])

      const payload: RankingReport = {
        period: period ?? null,
        schoolYear: schoolYear?.code ?? "",
        level: level?.name ?? null,
        section: section?.name ?? null,
        rows: ranked,
      }
      return NextResponse.json(payload)
    }

    const subjectId = Number(searchParams.get("subjectId"))
    const gradePeriodId = Number(searchParams.get("gradePeriodId"))
    const levelId = Number(searchParams.get("levelId"))
    const schoolYearId = Number(searchParams.get("schoolYearId"))
    if (
      !Number.isInteger(subjectId) ||
      subjectId <= 0 ||
      !Number.isInteger(gradePeriodId) ||
      gradePeriodId <= 0 ||
      !Number.isInteger(levelId) ||
      levelId <= 0 ||
      !Number.isInteger(schoolYearId) ||
      schoolYearId <= 0
    ) {
      return badRequest("Subject, grading period, level, and school year are required")
    }
    const sectionId = Number(searchParams.get("sectionId"))

    const params: unknown[] = [subjectId, gradePeriodId, levelId, schoolYearId]
    let sectionFilter = ""
    if (Number.isInteger(sectionId) && sectionId > 0) {
      params.push(sectionId)
      sectionFilter = ` AND sec.section_id = $${params.length}`
    }

    const rows = await query<GradeGridRow>(
      `SELECT
         s.id AS "studentId",
         s.last_name AS "lastName",
         s.first_name AS "firstName",
         s.middle_name AS "middleName",
         g.id AS "gradeId",
         g.numeric_grade::float8 AS "numericGrade",
         g.remarks,
         g.posted_by AS "postedBy"
       FROM students s
       JOIN accounts a ON a.student_id = s.id AND a.school_year_id = $4
       LEFT JOIN grades g ON g.student_id = s.id
         AND g.subject_id = $1
         AND g.grade_period_id = $2
       LEFT JOIN LATERAL (
         SELECT s2.id AS section_id, s2.section_name
         FROM sections s2
         WHERE s2.level_id = a.level_id AND s2.school_year_id = a.school_year_id
         ORDER BY s2.id
         LIMIT 1
       ) sec ON TRUE
       WHERE a.level_id = $3
         AND (a.school_year_id <> s.school_year_id OR s.status = 'enrolled')
         ${sectionFilter}
       ORDER BY s.last_name, s.first_name`,
      params,
    )

    return NextResponse.json({ subjectId, gradePeriodId, rows })
  } catch (error) {
    return serverError(error)
  }
}

interface GradeEntry {
  studentId?: number | string
  subjectId?: number | string
  gradePeriodId?: number | string
  numericGrade?: number | string | null
}

export async function PUT(req: NextRequest) {
  const auth = await requireRoles(["admin", "registrar"])
  if (auth.error) return auth.error

  try {
    const body = (await req.json().catch(() => null)) as { grades?: GradeEntry[] } | null
    const entries = Array.isArray(body?.grades) ? body.grades : []
    if (entries.length === 0) return badRequest("No grade entries were provided")
    if (entries.length > 500) return badRequest("At most 500 grade entries can be saved at once")

    const normalized = entries.map((entry) => {
      const studentId = Number(entry.studentId)
      const subjectId = Number(entry.subjectId)
      const gradePeriodId = Number(entry.gradePeriodId)
      if (
        !Number.isInteger(studentId) ||
        studentId <= 0 ||
        !Number.isInteger(subjectId) ||
        subjectId <= 0 ||
        !Number.isInteger(gradePeriodId) ||
        gradePeriodId <= 0
      ) {
        throw new ApiError(400, "Each grade entry requires a student, subject, and grading period")
      }
      let numericGrade: number | null = null
      if (entry.numericGrade !== null && entry.numericGrade !== undefined && entry.numericGrade !== "") {
        const parsed = Number(String(entry.numericGrade).replace(/,/g, ""))
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
          throw new ApiError(400, "Grades must be between 0 and 100")
        }
        numericGrade = round2(parsed)
      }
      return { studentId, subjectId, gradePeriodId, numericGrade }
    })

    const saved = await withTransaction(async (client) => {
      const savedStudents: number[] = []
      for (const entry of normalized) {
        if (entry.numericGrade === null) {
          await client.query(
            `DELETE FROM grades WHERE student_id = $1 AND subject_id = $2 AND grade_period_id = $3`,
            [entry.studentId, entry.subjectId, entry.gradePeriodId],
          )
          continue
        }
        await client.query(
          `INSERT INTO grades (
             student_id, subject_id, grade_period_id, school_year_id, numeric_grade, remarks, posted_by
           ) VALUES (
             $1, $2, $3, (SELECT school_year_id FROM grade_periods WHERE id = $3), $4, $5, $6
           )
           ON CONFLICT (student_id, subject_id, grade_period_id) DO UPDATE SET
             numeric_grade = EXCLUDED.numeric_grade,
             remarks = EXCLUDED.remarks,
             posted_by = EXCLUDED.posted_by,
             school_year_id = EXCLUDED.school_year_id,
             updated_at = CURRENT_TIMESTAMP`,
          [
            entry.studentId,
            entry.subjectId,
            entry.gradePeriodId,
            entry.numericGrade,
            gradeRemarks(entry.numericGrade),
            auth.user.username,
          ],
        )
        savedStudents.push(entry.studentId)
      }

      const first = normalized[0]
      const metaResult = await client.query<{
        subjectName: string
        periodName: string
        level: string | null
        section: string | null
      }>(
        `SELECT
           sub.subject_name AS "subjectName",
           gp.period_name AS "periodName",
           l.level_name AS level,
           sec.section_name AS section
         FROM subjects sub
         CROSS JOIN grade_periods gp
         LEFT JOIN students s ON s.id = $3
         LEFT JOIN levels l ON l.id = s.current_level_id
         LEFT JOIN sections sec ON sec.id = s.current_section_id
         WHERE sub.id = $1 AND gp.id = $2`,
        [first.subjectId, first.gradePeriodId, first.studentId],
      )
      const meta = metaResult.rows[0]
      const count = savedStudents.length
      await writeAudit(client, auth.user, {
        action: "grades.save",
        entityType: "grades",
        entityId: `${first.subjectId}:${first.gradePeriodId}`,
        summary: `Saved ${count} grade${count === 1 ? "" : "s"} for ${meta?.level ?? "level"} ${meta?.section ?? ""} - ${meta?.subjectName ?? "subject"}, ${meta?.periodName ?? "period"}`.trim(),
        details: {
          level: meta?.level ?? null,
          section: meta?.section ?? null,
          subjectId: first.subjectId,
          subject: meta?.subjectName ?? null,
          gradePeriodId: first.gradePeriodId,
          period: meta?.periodName ?? null,
          count,
        },
      })

      return savedStudents
    })

    return NextResponse.json({ saved: saved.length })
  } catch (error) {
    return serverError(error)
  }
}
