"use client"

import { money } from "@/lib/money"
import { useState } from "react"
import { toast } from "sonner"
import { useUser } from "@/components/user-context"
import { WindowChrome } from "@/components/window-chrome"
import { openPrintWindow } from "@/lib/print"
import { formatReversalNo } from "@/lib/format-ids"
import type { PaymentRow } from "@/lib/types"

interface ReversePaymentModalProps {
  payment: PaymentRow
  studentName: string
  onClose: () => void
  onReversed: () => void
}

interface ReversalResult {
  paymentId: number
  receiptNumber: string | null
  totalAmount: number
  paymentDate: string
}


const MIN_REASON = 10
const MAX_REASON = 300

export function ReversePaymentModal({ payment, studentName, onClose, onReversed }: ReversePaymentModalProps) {
  const user = useUser()
  const [step, setStep] = useState<"reason" | "confirm" | "done">("reason")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ReversalResult | null>(null)

  const reasonLength = reason.trim().length
  const originalReceipt = payment.receipt ?? `payment #${payment.id}`

  const handleReverse = async () => {
    if (reasonLength < MIN_REASON) {
      setError(`Enter a reason of at least ${MIN_REASON} characters.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/payments/${payment.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      const data = (await response.json().catch(() => null)) as
        | { reversal?: ReversalResult; error?: string }
        | null
      if (!response.ok || !data?.reversal) {
        setError(data?.error ?? "Unable to reverse the payment.")
        toast.error(data?.error ?? "Unable to reverse the payment.")
        return
      }
      setResult(data.reversal)
      setStep("done")
      toast.success(`Reversed ${originalReceipt}. Reversal ${data.reversal.receiptNumber ?? ""}.`)
      onReversed()
    } catch {
      setError("Unable to reach the server.")
    } finally {
      setSaving(false)
    }
  }

  const printSlip = () => {
    if (!result) return
    const reversalReceipt = result.receiptNumber ?? formatReversalNo(result.paymentId)
    const lineRows: [string, string][] = [
      ["Tuition Fee", money(-payment.tuition)],
      ["Computer Fee", money(-payment.computer)],
      ["Registration Fee", money(-payment.reg)],
      ["Miscellaneous Fee", money(-payment.misc)],
      ["Textbooks", money(-payment.books)],
      ["Others", money(-payment.others)],
    ]
    const lines = lineRows.filter(([, amount]) => Number(amount.replace(/,/g, "")) !== 0)

    openPrintWindow({
      title: "Reversal Slip",
      subtitle: `${reversalReceipt} - cancels ${originalReceipt}`,
      meta: [
        { label: "Student", value: studentName },
        { label: "Original Receipt", value: originalReceipt },
        { label: "Date Reversed", value: result.paymentDate ?? "" },
        { label: "Amount Reversed", value: money(Math.abs(result.totalAmount ?? payment.total)) },
        { label: "Reason", value: reason.trim() },
        { label: "Posted By", value: user.fullName },
      ],
      tables: [
        {
          headers: ["Particulars", "Amount"],
          align: ["left", "right"],
          rows: [...lines, ["TOTAL", money(-payment.total)] as [string, string]],
        },
      ],
      footer: "This slip cancels the original payment. The original receipt remains in the record.",
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-[#f0f0f0] border-2 border-[#808080] w-[620px] max-h-[92vh] overflow-auto shadow-lg">
        <WindowChrome title="Reverse Payment" icon="reversal" onClose={onClose}>
          <div className="p-4 bg-az-teal-pale">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h1 className="text-az-steel text-xl font-bold">Reverse Payment</h1>
                <p className="text-az-teal-deep text-sm font-bold">
                  {studentName} - {originalReceipt}
                </p>
              </div>
              <p className="text-xs text-az-steel font-bold">Posted by: {user.fullName}</p>
            </div>

            <div className="border border-[#808080] bg-white p-2 mb-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <p>
                  <span className="font-bold">Date:</span> {payment.date}
                </p>
                <p>
                  <span className="font-bold">Receipt:</span> {payment.receipt ?? "-"}
                </p>
                <p>
                  <span className="font-bold">Description:</span> {payment.description ?? "-"}
                </p>
                <p>
                  <span className="font-bold">Posted by:</span> {payment.postedBy ?? "-"}
                </p>
                <p className="col-span-2 border-t border-[#d0d0d0] pt-1">
                  <span className="font-bold">Total:</span>{" "}
                  <span className="font-mono font-bold text-az-teal-deep">{money(payment.total)}</span>
                </p>
              </div>
            </div>

            {step === "reason" && (
              <>
                <p className="text-sm mb-2">
                  A reversal is a new record that cancels this payment. The original row is never edited or
                  deleted. The reversal is posted today and is marked on the payment history.
                </p>
                <label className="block text-sm font-bold mb-1" htmlFor="reverse-reason">
                  Reason (required, {MIN_REASON}-{MAX_REASON} characters):
                </label>
                <textarea
                  id="reverse-reason"
                  className="w-full border border-[#808080] bg-white p-2 text-sm h-24"
                  maxLength={MAX_REASON}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <p className="text-right text-xs text-az-steel">{reasonLength}/{MAX_REASON}</p>
                {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    className="bg-az-teal-deep text-white border-2 border-[#808080] px-4 py-1 text-sm font-bold hover:bg-az-teal disabled:opacity-60"
                    onClick={() => {
                      if (reasonLength < MIN_REASON) {
                        setError(`Enter a reason of at least ${MIN_REASON} characters.`)
                        return
                      }
                      setError(null)
                      setStep("confirm")
                    }}
                    disabled={reasonLength < MIN_REASON}
                  >
                    Continue
                  </button>
                  <button
                    className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 text-sm font-bold text-az-steel hover:bg-[#d0d0d0]"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {step === "confirm" && (
              <>
                <div className="border-2 border-red-400 bg-[#fff4f4] p-3 text-sm mb-3">
                  <p className="font-bold text-red-700 mb-1">Confirm the effect</p>
                  <p>
                    Reversing {originalReceipt} will reduce total payments by{" "}
                    <span className="font-mono font-bold">{money(payment.total)}</span> and increase the balance of the
                    account it belongs to by the same amount. A reversal row is posted today with its own AZV number.
                    The original payment stays in the record and is marked as reversed. A reversal cannot be reversed
                    again.
                  </p>
                  <p className="mt-2">
                    <span className="font-bold">Reason:</span> {reason.trim()}
                  </p>
                </div>
                {error && <p className="text-sm text-red-600 font-bold">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    className="bg-red-700 text-white border-2 border-[#808080] px-4 py-1 text-sm font-bold hover:bg-red-800 disabled:opacity-60"
                    onClick={handleReverse}
                    disabled={saving}
                  >
                    {saving ? "Reversing..." : "Confirm Reversal"}
                  </button>
                  <button
                    className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 text-sm font-bold text-az-steel hover:bg-[#d0d0d0]"
                    onClick={() => setStep("reason")}
                    disabled={saving}
                  >
                    Back
                  </button>
                </div>
              </>
            )}

            {step === "done" && result && (
              <>
                <div className="border-2 border-az-teal-deep bg-white p-3 text-sm mb-3">
                  <p className="font-bold text-az-teal-deep mb-1">Reversal posted</p>
                  <p>
                    Reversal receipt:{" "}
                    <span className="font-mono font-bold">
                      {result.receiptNumber ?? formatReversalNo(result.paymentId)}
                    </span>
                  </p>
                  <p>
                    Original receipt: <span className="font-mono">{originalReceipt}</span>
                  </p>
                  <p>
                    Amount reversed: <span className="font-mono font-bold">{money(Math.abs(result.totalAmount))}</span>
                  </p>
                  <p className="mt-1 text-az-steel">
                    The account balance, months not paid, collections, and dashboard now include this reversal.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 text-sm font-bold text-az-steel hover:bg-[#d0d0d0]"
                    onClick={printSlip}
                  >
                    Print Reversal Slip
                  </button>
                  <button
                    className="bg-az-teal-deep text-white border-2 border-[#808080] px-4 py-1 text-sm font-bold hover:bg-az-teal"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </WindowChrome>
      </div>
    </div>
  )
}
