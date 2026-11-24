import type { PoolClient } from "pg"

export interface AccountBalanceSummary {
  totalPaymentsMade: number
  totalBalance: number
  currentDues: number
  monthsNotPaid: number
  unpaidAccounts: number
  dueDate: string | null
}

export async function recomputeAccountBalances(
  client: PoolClient,
  accountId: number,
  postedBy: string,
): Promise<AccountBalanceSummary> {
  const result = await client.query<AccountBalanceSummary>(
    `UPDATE accounts a SET
       total_payments_made = COALESCE(p.paid, 0),
       total_balance = GREATEST(a.total_school_fees - a.discount - COALESCE(p.paid, 0), 0),
       unpaid_accounts = GREATEST(a.total_school_fees - a.discount - COALESCE(p.paid, 0), 0),
       months_not_paid = CASE
         WHEN pm.mode_name = 'Monthly'
           THEN GREATEST(COALESCE(pm.installments, 10) - COALESCE(p.tuition_payments, 0), 0)
         ELSE 0
       END,
       current_dues = CASE
         WHEN pm.mode_name = 'Monthly'
           AND GREATEST(COALESCE(pm.installments, 10) - COALESCE(p.tuition_payments, 0), 0) > 0
           AND COALESCE(p.paid, 0) < (a.total_school_fees - a.discount)
           THEN a.monthly_tuition
         ELSE 0
       END,
       due_date = CASE
         WHEN GREATEST(a.total_school_fees - a.discount - COALESCE(p.paid, 0), 0) > 0
           THEN CURRENT_DATE + INTERVAL '15 days'
         ELSE NULL
       END,
       last_updated = CURRENT_TIMESTAMP,
       posted_by = $2
     FROM payment_modes pm,
          (SELECT COALESCE(SUM(p.total_amount), 0) AS paid,
                  COUNT(*) FILTER (
                    WHERE p.entry_type = 'payment'
                      AND p.description = 'Tuition'
                      AND NOT EXISTS (SELECT 1 FROM payments r WHERE r.reverses_payment_id = p.id)
                  ) AS tuition_payments
           FROM payments p WHERE p.account_id = $1) p
     WHERE a.id = $1 AND pm.id = a.payment_mode_id
     RETURNING
       a.total_payments_made::float8 AS "totalPaymentsMade",
       a.total_balance::float8 AS "totalBalance",
       a.current_dues::float8 AS "currentDues",
       a.months_not_paid AS "monthsNotPaid",
       a.unpaid_accounts::float8 AS "unpaidAccounts",
       TO_CHAR(a.due_date, 'MM/DD/YYYY') AS "dueDate"`,
    [accountId, postedBy],
  )

  return result.rows[0]
}
