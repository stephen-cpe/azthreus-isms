import type { PoolClient } from "pg"
import { recomputeAccountBalances } from "@/lib/accounts"
import { writeAudit, type AuditActor } from "@/lib/audit"
import { ApiError } from "@/lib/auth"
import { formatReceiptNo } from "@/lib/format-ids"
import { round2 } from "@/lib/grades"
import { readDate, readInt, readText } from "@/lib/validation"

export interface StudentPersonalFields {
  firstName?: string
  middleName?: string
  lastName?: string
  gender?: string
  birthdate?: string
  birthplace?: string
  birthOrder?: number | string
  age?: number | string
  address?: string
  barangay?: string
  telephone?: string
  cellphone?: string
  studentNumber?: string
}

const PERSONAL_COLUMNS: {
  key: keyof StudentPersonalFields
  column: string
  kind: "text" | "int" | "date"
  label: string
  maxLength?: number
  min?: number
  max?: number
}[] = [
  { key: "firstName", column: "first_name", kind: "text", label: "First name", maxLength: 100 },
  { key: "middleName", column: "middle_name", kind: "text", label: "Middle name", maxLength: 100 },
  { key: "lastName", column: "last_name", kind: "text", label: "Last name", maxLength: 100 },
  { key: "gender", column: "gender", kind: "text", label: "Gender", maxLength: 10 },
  { key: "birthdate", column: "birthdate", kind: "date", label: "Birthdate" },
  { key: "birthplace", column: "birthplace", kind: "text", label: "Birthplace", maxLength: 200 },
  { key: "birthOrder", column: "birth_order", kind: "int", label: "Birth order", min: 0, max: 100 },
  { key: "age", column: "age", kind: "int", label: "Age", min: 0, max: 150 },
  { key: "address", column: "address", kind: "text", label: "Address", maxLength: 500 },
  { key: "barangay", column: "barangay", kind: "text", label: "Barangay", maxLength: 100 },
  { key: "telephone", column: "telephone", kind: "text", label: "Telephone", maxLength: 20 },
  { key: "cellphone", column: "cellphone", kind: "text", label: "Cellphone", maxLength: 20 },
  { key: "studentNumber", column: "student_number", kind: "text", label: "Student number", maxLength: 20 },
]

/**
 * Updates only the personal-info columns present in `fields` (undefined = leave
 * unchanged, empty string = clear). Shared by the student edit and re-enroll
 * routes so both write identical data.
 */
export async function updateStudentPersonalFields(
  client: PoolClient,
  studentId: number,
  fields: StudentPersonalFields,
): Promise<void> {
  const sets: string[] = []
  const params: unknown[] = []
  for (const column of PERSONAL_COLUMNS) {
    const raw = (fields as unknown as Record<string, unknown>)[column.key]
    if (raw === undefined) continue
    const value =
      column.kind === "text"
        ? readText(raw, column.maxLength ?? 500, column.label)
        : column.kind === "date"
          ? readDate(raw, column.label)
          : readInt(raw, column.label, { min: column.min, max: column.max })
    params.push(value)
    sets.push(`${column.column} = $${params.length}`)
  }
  if (sets.length === 0) return
  sets.push(`updated_at = CURRENT_TIMESTAMP`)
  await client.query(`UPDATE students SET ${sets.join(", ")} WHERE id = $${params.length + 1}`, [
    ...params,
    studentId,
  ])
}

export interface ParentFields {
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
  religionId?: number | string | null
}

const PARENT_COLUMNS: {
  key: keyof ParentFields
  column: string
  kind: "text" | "int"
  label: string
  maxLength?: number
  min?: number
  max?: number
}[] = [
  { key: "fatherName", column: "father_name", kind: "text", label: "Father's name", maxLength: 200 },
  { key: "fatherOccupation", column: "father_occupation", kind: "text", label: "Father's occupation", maxLength: 100 },
  { key: "fatherAge", column: "father_age", kind: "int", label: "Father's age", min: 0, max: 150 },
  { key: "fatherEducation", column: "father_education", kind: "text", label: "Father's education", maxLength: 100 },
  { key: "motherName", column: "mother_name", kind: "text", label: "Mother's name", maxLength: 200 },
  { key: "motherOccupation", column: "mother_occupation", kind: "text", label: "Mother's occupation", maxLength: 100 },
  { key: "motherAge", column: "mother_age", kind: "int", label: "Mother's age", min: 0, max: 150 },
  { key: "motherEducation", column: "mother_education", kind: "text", label: "Mother's education", maxLength: 100 },
  { key: "parentsTelephone", column: "telephone", kind: "text", label: "Parent telephone", maxLength: 20 },
  { key: "parentsMobile", column: "mobile_number", kind: "text", label: "Parent mobile number", maxLength: 20 },
  { key: "religionId", column: "religion_id", kind: "int", label: "Religion", min: 1 },
]

/**
 * Updates the student's latest parent record, or inserts one when none exists.
 * Only columns present in `fields` are written.
 */
export async function upsertStudentParents(
  client: PoolClient,
  studentId: number,
  fields: ParentFields,
): Promise<void> {
  const sets: string[] = []
  const params: unknown[] = []
  for (const column of PARENT_COLUMNS) {
    const raw = (fields as unknown as Record<string, unknown>)[column.key]
    if (raw === undefined) continue
    const value =
      column.kind === "text"
        ? readText(raw, column.maxLength ?? 200, column.label)
        : readInt(raw, column.label, { min: column.min, max: column.max })
    params.push(value)
    sets.push(`${column.column} = $${params.length}`)
  }
  if (sets.length === 0) return

  const existing = await client.query<{ id: number }>(
    `SELECT id FROM parents WHERE student_id = $1 ORDER BY id DESC LIMIT 1`,
    [studentId],
  )
  if (existing.rows[0]) {
    await client.query(`UPDATE parents SET ${sets.join(", ")} WHERE id = $${params.length + 1}`, [
      ...params,
      existing.rows[0].id,
    ])
  } else if (params.some((value) => value !== null)) {
    const columns = sets.map((set) => set.split(" = ")[0])
    await client.query(
      `INSERT INTO parents (student_id, ${columns.join(", ")}) VALUES ($1, ${sets
        .map((_, index) => `$${index + 2}`)
        .join(", ")})`,
      [studentId, ...params],
    )
  }
}

export interface CreateEnrollmentAccountInput {
  studentId: number
  regNumber: number | null
  schoolYearId: number
  levelId: number
  paymentModeId?: number | null
  discount?: number | null
  paymentDate?: string | null
  postedBy: string
  actor: AuditActor
}

export interface EnrollmentAccountResult {
  accountId: number
  displayAccountId: number
  accountNumber: number | null
  paymentMode: string
  totalFees: number
  initialPayment: number
  paymentId: number | null
  receiptNumber: string | null
}

/**
 * Creates the student account for one enrollment (student + school year + level),
 * posts the upon-enrollment payment, and recomputes balances. Must be called
 * inside a transaction. Shared by new-student enrollment, Add Account, and
 * re-enrollment so every path produces identical account/payment data.
 */
export async function createEnrollmentAccount(
  client: PoolClient,
  input: CreateEnrollmentAccountInput,
): Promise<EnrollmentAccountResult> {
  const modeResult = await client.query<{ id: number; mode_name: string }>(
    input.paymentModeId
      ? `SELECT id, mode_name FROM payment_modes WHERE id = $1`
      : `SELECT id, mode_name FROM payment_modes WHERE mode_name = 'Monthly'`,
    input.paymentModeId ? [input.paymentModeId] : [],
  )
  const mode = modeResult.rows[0]
  if (!mode) throw new ApiError(400, "Payment mode not found")

  const existingAccount = await client.query(
    `SELECT 1 FROM accounts WHERE student_id = $1 AND school_year_id = $2 LIMIT 1`,
    [input.studentId, input.schoolYearId],
  )
  if (existingAccount.rowCount) {
    throw new ApiError(409, "This student already has an account for the selected school year.")
  }

  const assessmentResult = await client.query<{
    total_fee: string
    tuition_fee: string
    payable_monthly: string
    upon_enrollment_monthly: string
    upon_enrollment_quarterly: string
    upon_enrollment_semi_annual: string
  }>(
    `SELECT total_fee, tuition_fee, payable_monthly,
            upon_enrollment_monthly, upon_enrollment_quarterly, upon_enrollment_semi_annual
     FROM assessments WHERE level_id = $1 AND school_year_id = $2`,
    [input.levelId, input.schoolYearId],
  )
  const assessment = assessmentResult.rows[0]
  if (!assessment) {
    throw new ApiError(
      400,
      "No assessment configured for this level and school year. Set it up under Registration > Assessment first.",
    )
  }

  const totalFees = round2(Number(assessment.total_fee))
  const tuitionFee = round2(Number(assessment.tuition_fee))
  const monthlyTuition = round2(Number(assessment.payable_monthly))
  const initialPayment = round2(
    mode.mode_name === "Monthly"
      ? Number(assessment.upon_enrollment_monthly)
      : mode.mode_name === "Quarterly"
        ? Number(assessment.upon_enrollment_quarterly)
        : mode.mode_name === "Semi-Annual"
          ? Number(assessment.upon_enrollment_semi_annual)
          : Number(assessment.total_fee),
  )

  const discount = round2(input.discount ?? 0)
  if (!Number.isFinite(discount) || discount < 0) {
    throw new ApiError(400, "Discount must be zero or greater.")
  }
  if (discount > totalFees) {
    throw new ApiError(400, "Discount cannot exceed the total school fees.")
  }

  const accountIdResult = await client.query<{ next_account_id: number }>(
    `SELECT nextval('accounts_account_id_seq')::int AS next_account_id`,
  )

  const accountResult = await client.query<{ id: number; account_id: number }>(
    `INSERT INTO accounts (
       account_id, account_number, student_id, school_year_id, level_id, payment_mode_id,
       total_school_fees, tuition_fee, monthly_tuition, initial_payment, discount,
       total_payments_made, total_balance, unpaid_accounts, current_dues, posted_by
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, $12, 0, $13)
     RETURNING id, account_id`,
    [
      accountIdResult.rows[0].next_account_id,
      input.regNumber,
      input.studentId,
      input.schoolYearId,
      input.levelId,
      mode.id,
      totalFees,
      tuitionFee,
      monthlyTuition,
      initialPayment,
      discount,
      round2(totalFees - discount),
      input.postedBy,
    ],
  )
  const account = accountResult.rows[0]

  let paymentId: number | null = null
  let receiptNumber: string | null = null
  if (initialPayment > 0) {
    const paymentIdResult = await client.query<{ next_payment_id: number }>(
      `SELECT nextval('payments_payment_id_seq')::int AS next_payment_id`,
    )
    paymentId = paymentIdResult.rows[0].next_payment_id
    receiptNumber = formatReceiptNo(paymentId)
    await client.query(
      `INSERT INTO payments (
         payment_id, account_id, student_id, payment_date, receipt_number, description,
         tuition_amount, computer_amount, registration_amount, miscellaneous_amount, books_amount, others_amount,
         total_amount, form_of_payment, amount_tendered, change_amount, posted_by
       ) VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, 'Initial Payment',
         $6, 0, 0, 0, 0, 0, $6, 'Cash', $6, 0, $7)`,
      [
        paymentId,
        account.id,
        input.studentId,
        input.paymentDate ?? null,
        receiptNumber,
        initialPayment,
        input.postedBy,
      ],
    )
  }

  await recomputeAccountBalances(client, account.id, input.postedBy)

  await writeAudit(client, input.actor, {
    action: "account.create",
    entityType: "account",
    entityId: account.account_id,
    summary: `Created account AC-${account.account_id} for AA-${input.regNumber ?? input.studentId}`,
    details: {
      studentId: input.studentId,
      schoolYearId: input.schoolYearId,
      levelId: input.levelId,
      paymentMode: mode.mode_name,
      totalFees,
      initialPayment,
    },
  })

  if (paymentId) {
    await writeAudit(client, input.actor, {
      action: "payment.post",
      entityType: "payment",
      entityId: paymentId,
      summary: `Posted initial payment ${receiptNumber ?? formatReceiptNo(paymentId)} for AA-${input.regNumber ?? input.studentId} (${initialPayment.toFixed(2)})`,
      details: {
        studentId: input.studentId,
        accountId: account.id,
        receiptNumber,
        total: initialPayment,
        description: "Initial Payment",
      },
    })
  }

  return {
    accountId: account.id,
    displayAccountId: account.account_id,
    accountNumber: input.regNumber,
    paymentMode: mode.mode_name,
    totalFees,
    initialPayment,
    paymentId,
    receiptNumber,
  }
}