import { NextRequest, NextResponse } from "next/server"
import { withTransaction } from "@/lib/db"
import { recomputeAccountBalances } from "@/lib/accounts"
import { writeAudit } from "@/lib/audit"
import { formatReversalNo } from "@/lib/format-ids"
import { ApiError, badRequest, notFound, requireRoles, serverError } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface OriginalPayment {
  id: number
  paymentId: number | null
  accountId: number | null
  studentId: number | null
  payerName: string | null
  receiptNumber: string | null
  entryType: "payment" | "reversal"
  totalAmount: number
  hasReversal: boolean
}

interface ReverseBody {
  reason?: unknown
}

/**
 * POST /api/payments/[id]/reverse — post a reversal row that cancels a payment.
 * The original row is never updated or deleted. The reversal, the balance
 * recompute, and the audit entry commit in one transaction.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(["admin"])
  if (auth.error) return auth.error

  try {
    const { id } = await params
    const paymentRowId = Number(id)
    if (!Number.isInteger(paymentRowId) || paymentRowId <= 0) return notFound("Invalid payment id")

    const body = (await req.json().catch(() => null)) as ReverseBody | null
    const reason = typeof body?.reason === "string" ? body.reason.trim() : ""
    if (reason.length < 10) return badRequest("A reason of at least 10 characters is required")
    if (reason.length > 300) return badRequest("The reason must be 300 characters or fewer")

    const result = await withTransaction(async (client) => {
      const originalResult = await client.query<OriginalPayment>(
        `SELECT
           p.id,
           p.payment_id AS "paymentId",
           p.account_id AS "accountId",
           p.student_id AS "studentId",
           p.payer_name AS "payerName",
           p.receipt_number AS "receiptNumber",
           p.entry_type AS "entryType",
           p.total_amount::float8 AS "totalAmount",
           EXISTS (SELECT 1 FROM payments r WHERE r.reverses_payment_id = p.id) AS "hasReversal"
         FROM payments p
         WHERE p.id = $1
         FOR UPDATE`,
        [paymentRowId],
      )
      const original = originalResult.rows[0]
      if (!original) throw new ApiError(404, "Payment not found")
      if (original.entryType === "reversal") {
        throw new ApiError(409, "A reversal cannot itself be reversed.")
      }
      if (original.hasReversal) {
        throw new ApiError(409, "This payment has already been reversed.")
      }

      const idResult = await client.query<{ next_payment_id: number }>(
        `SELECT nextval('payments_payment_id_seq')::int AS next_payment_id`,
      )
      const reversalPaymentId = idResult.rows[0].next_payment_id
      const reversalReceipt = formatReversalNo(reversalPaymentId)

      const reversalResult = await client.query(
        `INSERT INTO payments (
           payment_id, account_id, student_id, payer_name, payment_date, receipt_number, payment_month, description,
           tuition_amount, computer_amount, registration_amount, miscellaneous_amount, books_amount, others_amount,
           total_amount, form_of_payment, check_date, check_number, bank_name, branch,
           amount_tendered, change_amount, posted_by, entry_type, reverses_payment_id, reason
         )
         SELECT
           $1, p.account_id, p.student_id, p.payer_name, CURRENT_DATE, $2, p.payment_month,
           'Reversal of ' || COALESCE(p.receipt_number, 'payment #' || p.id),
           -p.tuition_amount, -p.computer_amount, -p.registration_amount,
           -p.miscellaneous_amount, -p.books_amount, -p.others_amount,
           -p.total_amount, p.form_of_payment, p.check_date, p.check_number, p.bank_name, p.branch,
           -p.amount_tendered, -p.change_amount, $3, 'reversal', p.id, $4
         FROM payments p
         WHERE p.id = $5
         RETURNING id, payment_id AS "paymentId", receipt_number AS "receiptNumber",
                   total_amount::float8 AS "totalAmount",
                   TO_CHAR(payment_date, 'MM/DD/YYYY') AS "paymentDate"`,
        [reversalPaymentId, reversalReceipt, auth.user.username, reason, original.id],
      )
      const reversal = reversalResult.rows[0]

      const account = original.accountId
        ? await recomputeAccountBalances(client, original.accountId, auth.user.username)
        : null

      await writeAudit(client, auth.user, {
        action: "payment.reverse",
        entityType: "payment",
        entityId: original.paymentId ?? original.id,
        summary: `Reversed ${original.receiptNumber ?? `payment #${original.id}`} with ${reversalReceipt}`,
        details: {
          studentId: original.studentId,
          accountId: original.accountId,
          originalReceipt: original.receiptNumber,
          reversalReceipt,
          amount: original.totalAmount,
          reason,
        },
      })

      return { reversal, account }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "This payment has already been reversed." }, { status: 409 })
    }
    return serverError(error)
  }
}
