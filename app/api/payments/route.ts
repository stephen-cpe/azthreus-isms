import { NextRequest, NextResponse } from "next/server"
import { withTransaction } from "@/lib/db"
import { recomputeAccountBalances } from "@/lib/accounts"
import { writeAudit } from "@/lib/audit"
import { localDateIso } from "@/lib/date"
import { formatReceiptNo } from "@/lib/format-ids"
import { round2 } from "@/lib/grades"
import { ApiError, badRequest, requireRoles, serverError } from "@/lib/auth"
import { MAX_AMOUNT, readAmount, readDate, readEnum, readId, readText } from "@/lib/validation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface CreatePaymentBody {
  studentId?: number | string
  payerName?: string
  paymentDate?: string
  paymentMonth?: string
  description?: string
  tuition?: number | string
  computer?: number | string
  registration?: number | string
  miscellaneous?: number | string
  books?: number | string
  others?: number | string
  formOfPayment?: string
  checkDate?: string
  checkNumber?: string
  bankName?: string
  branch?: string
  amountTendered?: number | string
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(["admin", "cashier"])
  if (auth.error) return auth.error

  try {
    const body = (await req.json().catch(() => null)) as CreatePaymentBody | null
    if (!body) return badRequest("Invalid request body")

    const studentId = readId(body.studentId, "Student")
    const hasStudent = studentId !== null
    const payerName = readText(body.payerName, 200, "Payer name")
    if (!hasStudent && !payerName) {
      return badRequest("A student must be selected, or a payer name must be provided for non-student payments.")
    }

    const paymentDate = readDate(body.paymentDate, "Payment date") ?? localDateIso()
    const formOfPayment =
      readEnum(readText(body.formOfPayment, 20, "Form of payment"), ["Cash", "Check"], "Form of payment") ?? "Cash"
    const checkNumber = readText(body.checkNumber, 50, "Check number")
    if (formOfPayment === "Check" && !checkNumber) {
      return badRequest("A check number is required for check payments.")
    }

    const amounts = {
      tuition: readAmount(body.tuition, "Tuition") ?? 0,
      computer: readAmount(body.computer, "Computer fee") ?? 0,
      registration: readAmount(body.registration, "Registration fee") ?? 0,
      miscellaneous: readAmount(body.miscellaneous, "Miscellaneous fee") ?? 0,
      books: readAmount(body.books, "Textbooks") ?? 0,
      others: readAmount(body.others, "Other fees") ?? 0,
    }
    const total = round2(Object.values(amounts).reduce((sum, value) => sum + value, 0))
    if (total <= 0) return badRequest("Payment amount must be greater than zero")
    if (total > MAX_AMOUNT) return badRequest("Payment amount is larger than the system can store")

    const tendered = readAmount(body.amountTendered, "Amount tendered") ?? total
    if (tendered < total) return badRequest("Amount tendered is less than the total payment.")
    const change = round2(tendered - total)

    const paymentMonth = readText(body.paymentMonth, 20, "Month")
    const description =
      readText(body.description, 200, "Description") ?? (hasStudent ? "Tuition" : "Non-student Payment")
    const checkDate = readDate(body.checkDate, "Check date")
    const bankName = readText(body.bankName, 100, "Bank")
    const branch = readText(body.branch, 100, "Branch")

    const result = await withTransaction(async (client) => {
      let accountId: number | null = null

      if (hasStudent) {
        const accountResult = await client.query<{ id: number }>(
          `SELECT a.id
           FROM accounts a
           JOIN students s ON s.id = a.student_id
           WHERE a.student_id = $1
             AND a.school_year_id = s.school_year_id
             AND s.status = 'enrolled'
           ORDER BY a.id DESC
           LIMIT 1`,
          [studentId],
        )
        const account = accountResult.rows[0]
        if (!account) {
          throw new ApiError(
            400,
            "No account found for this student's current school year. Create an account first.",
          )
        }
        accountId = account.id
      }

      const idResult = await client.query<{ next_payment_id: number }>(
        `SELECT nextval('payments_payment_id_seq')::int AS next_payment_id`,
      )
      const paymentId = idResult.rows[0].next_payment_id

      const paymentResult = await client.query(
        `INSERT INTO payments (
           payment_id, account_id, student_id, payer_name, payment_date, receipt_number, payment_month, description,
           tuition_amount, computer_amount, registration_amount, miscellaneous_amount, books_amount, others_amount,
           total_amount, form_of_payment, check_date, check_number, bank_name, branch,
           amount_tendered, change_amount, posted_by
         ) VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::date, $18, $19, $20, $21, $22, $23)
         RETURNING id, payment_id AS "paymentId", receipt_number AS "receiptNumber"`,
        [
          paymentId,
          accountId,
          hasStudent ? studentId : null,
          hasStudent ? null : payerName,
          paymentDate,
          formatReceiptNo(paymentId),
          paymentMonth,
          description,
          amounts.tuition,
          amounts.computer,
          amounts.registration,
          amounts.miscellaneous,
          amounts.books,
          amounts.others,
          total,
          formOfPayment,
          checkDate,
          checkNumber,
          bankName,
          branch,
          tendered,
          change,
          auth.user.username,
        ],
      )

      const account = accountId
        ? await recomputeAccountBalances(client, accountId, auth.user.username)
        : null

      const posted = paymentResult.rows[0] as { id: number; paymentId: number; receiptNumber: string | null }
      await writeAudit(client, auth.user, {
        action: "payment.post",
        entityType: "payment",
        entityId: posted.paymentId,
        summary: hasStudent
          ? `Posted payment ${posted.receiptNumber} for student ${studentId} (${total.toFixed(2)})`
          : `Posted payment ${posted.receiptNumber} for payer "${payerName}" (${total.toFixed(2)})`,
        details: {
          studentId: hasStudent ? studentId : null,
          accountId,
          receiptNumber: posted.receiptNumber,
          total,
          formOfPayment,
        },
      })

      return {
        payment: posted,
        account,
        change,
      }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return serverError(error)
  }
}
