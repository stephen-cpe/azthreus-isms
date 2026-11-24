"use client"

import { money } from "@/lib/money"
import { localDateIso } from "@/lib/date"
import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { useUser } from "@/components/user-context"
import { WindowChrome } from "@/components/window-chrome"
import { BRAND } from "@/lib/branding"
import { openPrintWindow } from "@/lib/print"
import { formatReceiptNo } from "@/lib/format-ids"
import type { StudentListItem } from "@/lib/types"

interface OtherPaymentsModalProps {
  onClose: () => void
}

type PayerMode = "student" | "nonstudent"


const toNumber = (value: string) => {
  const parsed = Number(value.replace(/,/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

export function OtherPaymentsModal({ onClose }: OtherPaymentsModalProps) {
  const user = useUser()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [payerMode, setPayerMode] = useState<PayerMode>("nonstudent")
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [payerName, setPayerName] = useState("")
  const [paymentDate, setPaymentDate] = useState(() => localDateIso())
  const [description, setDescription] = useState("Other Payment")
  const [amounts, setAmounts] = useState({ tuition: "", computer: "", registration: "", miscellaneous: "", books: "", others: "" })
  const [tendered, setTendered] = useState("")
  const [formOfPayment, setFormOfPayment] = useState("Cash")
  const [checkDate, setCheckDate] = useState("")
  const [checkNumber, setCheckNumber] = useState("")
  const [bankName, setBankName] = useState("")
  const [branch, setBranch] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("Post a payment for a student account or for a payer without one.")

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetch("/api/students?enrolled=1&hasAccount=yes")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setStudents((data as { students: StudentListItem[] }).students ?? [])
      })
      .catch(() => toast.error("Unable to load students"))
  }, [])

  const selectedStudent = students.find((student) => String(student.studentId) === selectedStudentId)
  const payerDisplay =
    payerMode === "student"
      ? selectedStudent
        ? `${selectedStudent.lastName}, ${selectedStudent.firstName}`
        : ""
      : payerName.trim()

  const total = useMemo(
    () =>
      toNumber(amounts.tuition) +
      toNumber(amounts.computer) +
      toNumber(amounts.registration) +
      toNumber(amounts.miscellaneous) +
      toNumber(amounts.books) +
      toNumber(amounts.others),
    [amounts],
  )
  const tenderedNumber = toNumber(tendered)
  const change = Math.max(tenderedNumber - total, 0)

  const handlePost = async () => {
    if (payerMode === "student" && !selectedStudentId) {
      toast.error("Select a student account.")
      return
    }
    if (payerMode === "nonstudent" && !payerName.trim()) {
      toast.error("Enter the payer's name.")
      return
    }
    if (total <= 0) {
      toast.error("Enter a payment amount greater than zero.")
      return
    }
    if (tenderedNumber < total) {
      toast.error("Amount tendered is less than the total payment.")
      return
    }
    if (formOfPayment === "Check" && !checkNumber.trim()) {
      toast.error("Enter the check number for check payments.")
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(payerMode === "student"
            ? { studentId: Number(selectedStudentId) }
            : { payerName: payerName.trim() }),
          paymentDate,
          description: description.trim() || "Other Payment",
          tuition: amounts.tuition,
          computer: amounts.computer,
          registration: amounts.registration,
          miscellaneous: amounts.miscellaneous,
          books: amounts.books,
          others: amounts.others,
          formOfPayment,
          checkDate: checkDate || undefined,
          checkNumber: checkNumber || undefined,
          bankName: bankName || undefined,
          branch: branch || undefined,
          amountTendered: tendered,
        }),
      })
      const data = (await response.json().catch(() => null)) as
        | { payment?: { paymentId: number; receiptNumber?: string | null }; error?: string }
        | null
      if (!response.ok || !data?.payment) {
        toast.error(data?.error ?? "Failed to post the payment.")
        setMessage(data?.error ?? "Failed to post the payment.")
        return
      }

      const receipt = data.payment.receiptNumber ?? formatReceiptNo(data.payment.paymentId)
      toast.success(`Payment posted. OR No. ${receipt}`)
      setMessage(`Payment posted. OR No. ${receipt}.`)
      openPrintWindow({
        title: "Official Receipt",
        subtitle: `OR No. ${receipt}`,
        meta: [
          { label: "Received From", value: payerDisplay },
          { label: "Payment Date", value: paymentDate },
          { label: "Particulars", value: description.trim() || "Other Payment" },
          { label: "Form of Payment", value: formOfPayment },
          { label: "Posted By", value: user.fullName },
        ],
        tables: [
          {
            headers: ["Particulars", "Amount"],
            align: ["left", "right"],
            rows: [
              ...Object.entries(amounts)
                .filter(([, value]) => toNumber(value) > 0)
                .map(([key, value]) => [key.charAt(0).toUpperCase() + key.slice(1), money(toNumber(value))]),
              ["TOTAL", money(total)],
              ["Amount Tendered", money(tenderedNumber)],
              ["Change", money(change)],
            ],
          },
        ],
        footer: "Thank you. Please keep this receipt for your records.",
      })

      if (payerMode === "nonstudent") setPayerName("")
      setDescription("Other Payment")
      setAmounts({ tuition: "", computer: "", registration: "", miscellaneous: "", books: "", others: "" })
      setTendered("")
      setCheckDate("")
      setCheckNumber("")
      setBankName("")
      setBranch("")
    } catch {
      toast.error("Unable to reach the server.")
    } finally {
      setSaving(false)
    }
  }

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#f0f0f0] border-2 border-[#808080] w-[800px] max-h-[92vh] overflow-auto shadow-lg">
        <WindowChrome title="Other Payments" onClose={onClose}>
          <div className="p-4 bg-az-teal-pale">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h1 className="text-az-steel text-xl font-bold">{BRAND.schoolName}</h1>
                <h2 className="text-az-teal-deep text-lg font-bold">Other Payments</h2>
              </div>
              <div className="text-right text-xs text-az-teal-deep font-bold">
                <p>{formatTime(currentTime)}</p>
                <p>Posted by: {user.fullName}</p>
              </div>
            </div>

            <div className="border border-[#808080] bg-white p-2 mb-3">
              <p className="text-sm font-bold mb-1">Payer:</p>
              <div className="flex gap-6 text-sm">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="other-payments-payer"
                    checked={payerMode === "student"}
                    onChange={() => setPayerMode("student")}
                  />
                  <span>Student account</span>
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="other-payments-payer"
                    checked={payerMode === "nonstudent"}
                    onChange={() => setPayerMode("nonstudent")}
                  />
                  <span>Non-student payer</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {payerMode === "student" ? (
                <label className="block">
                  <span className="font-bold">Student:</span>
                  <select
                    className="w-full border border-[#808080] bg-white p-1 mt-1"
                    value={selectedStudentId}
                    onChange={(event) => setSelectedStudentId(event.target.value)}
                  >
                    <option value="">Select a student...</option>
                    {students.map((student) => (
                      <option key={student.studentId} value={student.studentId}>
                        {student.lastName}, {student.firstName} ({student.level ?? ""})
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="block">
                  <span className="font-bold">Payer Name:</span>
                  <input
                    type="text"
                    className="w-full border border-[#808080] bg-white p-1 mt-1"
                    value={payerName}
                    onChange={(event) => setPayerName(event.target.value)}
                  />
                </label>
              )}
              <label className="block">
                <span className="font-bold">Date:</span>
                <input
                  type="date"
                  className="w-full border border-[#808080] bg-white p-1 mt-1"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                />
              </label>
              <label className="block col-span-2">
                <span className="font-bold">Particulars / Description:</span>
                <input
                  type="text"
                  className="w-full border border-[#808080] bg-white p-1 mt-1"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
            </div>

            <table className="w-full border-collapse text-sm mt-3">
              <tbody>
                {(
                  [
                    ["TUITION FEE", "tuition"],
                    ["COMPUTER FEE", "computer"],
                    ["REGISTRATION FEE", "registration"],
                    ["MISCELLANEOUS FEE", "miscellaneous"],
                    ["TEXTBOOKS", "books"],
                    ["OTHERS:", "others"],
                  ] as const
                ).map(([label, key]) => (
                  <tr key={key}>
                    <td className="border border-[#808080] p-1 bg-[#e8e8e8]">{label}</td>
                    <td className="border border-[#808080] p-1 bg-white">
                      <input
                        type="text"
                        value={amounts[key]}
                        onChange={(event) => setAmounts((previous) => ({ ...previous, [key]: event.target.value }))}
                        className="w-full bg-transparent text-right outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-center mt-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">Amount Tendered:</span>
                <input
                  type="text"
                  className="border border-[#808080] bg-az-teal-light p-1 w-28 text-right"
                  value={tendered}
                  onChange={(event) => setTendered(event.target.value)}
                />
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-az-steel">TOTAL</p>
                <p className="text-2xl font-bold text-az-teal-deep">{money(total)}</p>
                <p className="text-xs text-red-600 font-bold">Change: {money(change)}</p>
              </div>
            </div>

            <div className="border border-[#808080] p-2 bg-white mt-3">
              <p className="text-center font-bold text-sm mb-2">Form of Payment</p>
              <div className="flex gap-4 justify-center">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="other-payments-form"
                    checked={formOfPayment === "Cash"}
                    onChange={() => setFormOfPayment("Cash")}
                  />
                  <span>Cash</span>
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="other-payments-form"
                    checked={formOfPayment === "Check"}
                    onChange={() => setFormOfPayment("Check")}
                  />
                  <span>Check</span>
                </label>
              </div>
              {formOfPayment === "Check" && (
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <label className="flex items-center gap-1">
                    <span className="w-24">Check Date:</span>
                    <input
                      type="date"
                      className="flex-1 border border-[#808080] bg-white p-0.5"
                      value={checkDate}
                      onChange={(event) => setCheckDate(event.target.value)}
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="w-24">Check Number:</span>
                    <input
                      type="text"
                      className="flex-1 border border-[#808080] bg-white p-0.5"
                      value={checkNumber}
                      onChange={(event) => setCheckNumber(event.target.value)}
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="w-24">Bank:</span>
                    <input
                      type="text"
                      className="flex-1 border border-[#808080] bg-white p-0.5"
                      value={bankName}
                      onChange={(event) => setBankName(event.target.value)}
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="w-24">Branch:</span>
                    <input
                      type="text"
                      className="flex-1 border border-[#808080] bg-white p-0.5"
                      value={branch}
                      onChange={(event) => setBranch(event.target.value)}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-3">
              <p className="text-sm text-black">
                <span className="text-red-600 font-bold">Message: </span>
                {message}
              </p>
              <div className="flex gap-2">
                <button
                  className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 font-bold hover:bg-[#d0d0d0] disabled:opacity-60"
                  onClick={handlePost}
                  disabled={saving}
                >
                  {saving ? "Posting..." : "Post Payment"}
                </button>
                <button
                  className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 font-bold text-az-steel hover:bg-[#d0d0d0]"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </WindowChrome>
      </div>
    </div>
  )
}
