"use client"

import { money } from "@/lib/money"
import { localDateIso } from "@/lib/date"
import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { useUser } from "@/components/user-context"
import { WindowChrome } from "@/components/window-chrome"
import { AcademyLogo } from "@/components/academy-logo"
import { BRAND } from "@/lib/branding"
import { openPrintWindow } from "@/lib/print"
import { formatReceiptNo, formatStudentNo } from "@/lib/format-ids"
import type { StudentAccountDetail, StudentListItem } from "@/lib/types"

interface PayTuitionModalProps {
  onClose: () => void
  initialStudentId?: number | null
  onReturnToAccount?: (studentId: number) => void
}

const MONTHS = ["June", "July", "August", "September", "October", "November", "December", "January", "February", "March"]


const toNumber = (value: string) => {
  const parsed = Number(value.replace(/,/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

export function PayTuitionModal({ onClose, initialStudentId, onReturnToAccount }: PayTuitionModalProps) {
  const user = useUser()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [detail, setDetail] = useState<StudentAccountDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [systemMessage, setSystemMessage] = useState("Select a student to begin posting a payment.")

  const [paymentDate, setPaymentDate] = useState(() => localDateIso())
  const [month, setMonth] = useState("")
  const [amounts, setAmounts] = useState({ tuition: "", computer: "", registration: "", miscellaneous: "", books: "", others: "" })
  const [tendered, setTendered] = useState("")
  const [formOfPayment, setFormOfPayment] = useState("Cash")
  const [checkDate, setCheckDate] = useState("")
  const [checkNumber, setCheckNumber] = useState("")
  const [bankName, setBankName] = useState("")
  const [branch, setBranch] = useState("")
  const [lastReceipt, setLastReceipt] = useState<{
    receiptNumber: string
    studentName: string
    paymentDate: string
    month: string
    lines: { label: string; amount: number }[]
    total: number
    tendered: number
    change: number
    formOfPayment: string
    checkNumber: string
  } | null>(null)

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

  const loadDetail = async (studentId: string) => {
    setLoadingDetail(true)
    setDetail(null)
    try {
      const response = await fetch(`/api/students/${studentId}/account`)
      const data = (await response.json().catch(() => null)) as (StudentAccountDetail & { error?: string }) | null
      if (!response.ok || !data) {
        setSystemMessage(data?.error ?? "Failed to load the student account.")
        return
      }
      setDetail(data)
      setSystemMessage(`Account of ${data.student.lastName}, ${data.student.firstName} loaded.`)

      const mode = data.account?.modeOfPayment ?? "Monthly"
      const installments = mode === "Monthly" ? 10 : mode === "Quarterly" ? 4 : mode === "Semi-Annual" ? 2 : 1
      const due =
        mode === "Monthly"
          ? (data.assessment?.payableMonthly ?? 0)
          : mode === "Quarterly"
            ? (data.assessment?.payableQuarterly ?? 0)
            : mode === "Semi-Annual"
              ? (data.assessment?.payableSemiAnnual ?? 0)
              : (data.account?.totalBalance ?? 0)
      const computerShare = data.assessment ? Math.round((data.assessment.computerFee / installments) * 100) / 100 : 0

      setAmounts({
        tuition: due > 0 ? String(Math.max(Math.round((due - computerShare) * 100) / 100, 0)) : "",
        computer: computerShare > 0 ? String(computerShare) : "",
        registration: "",
        miscellaneous: "",
        books: "",
        others: "",
      })
      setTendered(due > 0 ? String(due) : "")
    } catch {
      setSystemMessage("Unable to reach the server.")
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId)
    setMonth("")
    if (studentId) {
      loadDetail(studentId)
    } else {
      setDetail(null)
    }
  }

  // Opened from the individual account view: preselect that student and load
  // their account immediately.
  useEffect(() => {
    if (!initialStudentId) return
    const id = String(initialStudentId)
    setSelectedStudentId(id)
    setMonth("")
    void loadDetail(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStudentId])

  const handleClose = () => {
    if (onReturnToAccount && selectedStudentId) {
      onReturnToAccount(Number(selectedStudentId))
      return
    }
    onClose()
  }

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
  const balanceAfter = Math.max((detail?.account?.totalBalance ?? 0) - total, 0)

  const handlePost = async () => {
    if (!selectedStudentId) {
      toast.error("Please select a student first.")
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
          studentId: Number(selectedStudentId),
          paymentDate,
          paymentMonth: month || undefined,
          description: month ? "Tuition" : "Payment",
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
        setSystemMessage(data?.error ?? "Failed to post the payment.")
        toast.error(data?.error ?? "Failed to post the payment.")
        return
      }

      const receipt = data.payment.receiptNumber ?? formatReceiptNo(data.payment.paymentId)
      toast.success(`Payment posted. OR No. ${receipt}`)
      setSystemMessage(`Payment posted successfully. OR No. ${receipt}. Change: ${money(change)}`)
      setLastReceipt({
        receiptNumber: receipt,
        studentName: detail ? `${detail.student.lastName}, ${detail.student.firstName}` : "",
        paymentDate,
        month: month || "N/A",
        lines: [
          { label: "Tuition Fee", amount: toNumber(amounts.tuition) },
          { label: "Computer Fee", amount: toNumber(amounts.computer) },
          { label: "Registration Fee", amount: toNumber(amounts.registration) },
          { label: "Miscellaneous Fee", amount: toNumber(amounts.miscellaneous) },
          { label: "Textbooks", amount: toNumber(amounts.books) },
          { label: "Others", amount: toNumber(amounts.others) },
        ].filter((line) => line.amount > 0),
        total,
        tendered: tenderedNumber,
        change,
        formOfPayment,
        checkNumber: checkNumber,
      })
      setMonth("")
      setAmounts({ tuition: "", computer: "", registration: "", miscellaneous: "", books: "", others: "" })
      setTendered("")
      setCheckDate("")
      setCheckNumber("")
      setBankName("")
      setBranch("")
      await loadDetail(selectedStudentId)
    } catch {
      toast.error("Unable to reach the server.")
    } finally {
      setSaving(false)
    }
  }

  const handlePrintReceipt = () => {
    if (!lastReceipt) {
      toast.error("Post a payment first. The Official Receipt can be printed after posting.")
      return
    }
    openPrintWindow({
      title: "Official Receipt",
      subtitle: `OR No. ${lastReceipt.receiptNumber}`,
      meta: [
        { label: "Received From", value: lastReceipt.studentName || "N/A" },
        { label: "Payment Date", value: lastReceipt.paymentDate },
        { label: "Month Covered", value: lastReceipt.month },
        { label: "Form of Payment", value: lastReceipt.formOfPayment },
        { label: "Check Number", value: lastReceipt.formOfPayment === "Check" ? lastReceipt.checkNumber : "" },
        { label: "Posted By", value: user.fullName },
      ],
      tables: [
        {
          headers: ["Particulars", "Amount"],
          align: ["left", "right"],
          rows: [
            ...lastReceipt.lines.map((line) => [line.label, money(line.amount)]),
            ["TOTAL", money(lastReceipt.total)],
            ["Amount Tendered", money(lastReceipt.tendered)],
            ["Change", money(lastReceipt.change)],
          ],
        },
      ],
      footer: "Thank you. Please keep this receipt for your records.",
    })
  }

  const formatHeaderDate = (date: Date) =>
    date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "2-digit" })

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })

  const feeRow = (label: string, key: keyof typeof amounts, highlight = false) => (
    <tr>
      <td className="border border-[#808080] p-1"></td>
      <td className="border border-[#808080] p-1 bg-[#e8e8e8]">{label}</td>
      <td className={`border border-[#808080] p-1 ${highlight ? "bg-yellow-100" : "bg-white"}`}>
        <input
          type="text"
          value={amounts[key]}
          onChange={(event) => setAmounts((prev) => ({ ...prev, [key]: event.target.value }))}
          className="w-full bg-transparent text-right outline-none"
        />
      </td>
    </tr>
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#f0f0f0] border-2 border-[#808080] w-[980px] max-h-[92vh] overflow-auto shadow-lg">
        <WindowChrome title="Receive Payment" onClose={handleClose}>

        {/* Content */}
        <div className="p-4 bg-az-teal-pale">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <AcademyLogo className="w-24 h-24 border-4 border-az-teal-deep" />
              <div>
                <h1 className="text-az-steel text-2xl font-bold">{BRAND.schoolName}</h1>
                <p className="text-az-teal-deep text-sm font-bold">{BRAND.addressLine}</p>
                <p className="text-black font-semibold mt-1">{user.fullName}</p>
                <h2 className="text-az-teal-deep text-xl font-bold">Receive Payment</h2>
              </div>
            </div>
            <div className="text-right">
              <p className="text-az-teal-deep font-bold text-sm mt-2">{formatHeaderDate(currentTime)}</p>
              <p className="text-az-teal-deep font-bold text-sm">{formatTime(currentTime)}</p>
            </div>
          </div>

          {/* Main Form */}
          <div className="flex gap-4">
            {/* Left Panel */}
            <div className="w-44 bg-az-teal-pale p-3 border border-[#808080]">
              <p className="text-xs text-center leading-tight">
                Select a student, enter the payment amounts, then click Post Payment. The payment is saved to the
                student account and the collection reports.
              </p>
              {detail?.account && (
                <div className="mt-3 text-xs space-y-1 border border-[#808080] bg-white p-2">
                  <p className="font-bold text-az-steel">Account Summary</p>
                  <p className="flex justify-between">
                    <span>Fees:</span> <span>{money(detail.account.totalSchoolFees)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Paid:</span> <span>{money(detail.account.totalPaymentsMade)}</span>
                  </p>
                  <p className="flex justify-between font-bold text-red-600">
                    <span>Balance:</span> <span>{money(detail.account.totalBalance)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Mode:</span> <span>{detail.account.modeOfPayment}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Center Form */}
            <div className="flex-1">
              {/* Student Selection Row */}
              <div className="flex items-end gap-4 mb-4">
                <div className="flex-1">
                  <label className="text-sm font-bold">
                    Student:
                  </label>
                  <select
                    className="w-full border border-[#808080] bg-white p-1 mt-1"
                    value={selectedStudentId}
                    onChange={(event) => handleSelectStudent(event.target.value)}
                  >
                    <option value="">Select a student...</option>
                    {selectedStudentId &&
                      detail &&
                      !students.some((student) => String(student.studentId) === selectedStudentId) && (
                        <option value={selectedStudentId}>
                          {detail.student.lastName}, {detail.student.firstName}
                        </option>
                      )}
                    {students.map((student) => (
                      <option key={student.studentId} value={student.studentId}>
                        {student.lastName}, {student.firstName} ({student.level})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold">
                    Date:
                  </label>
                  <input
                    type="date"
                    className="border border-[#808080] bg-white p-1 w-36 mt-1"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                  />
                </div>
              </div>

              {/* Fee Table */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="border border-[#808080] bg-[#c0c0c0] p-1 text-left">MONTH</th>
                        <th className="border border-[#808080] bg-[#c0c0c0] p-1 text-left" colSpan={2}>
                          TUITION FEE
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-[#808080] p-1">
                          <select
                            className="w-full bg-white border-0"
                            value={month}
                            onChange={(event) => setMonth(event.target.value)}
                          >
                            <option value="">(Month)</option>
                            {MONTHS.map((monthName) => (
                              <option key={monthName}>{monthName}</option>
                            ))}
                          </select>
                        </td>
                        <td className="border border-[#808080] p-1 bg-[#e8e8e8]">TUITION FEE</td>
                        <td className="border border-[#808080] p-1 bg-yellow-100">
                          <input
                            type="text"
                            value={amounts.tuition}
                            onChange={(event) => setAmounts((prev) => ({ ...prev, tuition: event.target.value }))}
                            className="w-full bg-transparent text-right outline-none"
                          />
                        </td>
                      </tr>
                      {feeRow("COMPUTER FEE", "computer", true)}
                      {feeRow("REGISTRATION FEE", "registration")}
                      {feeRow("MISCELLANEOUS FEE", "miscellaneous")}
                      {feeRow("TEXTBOOKS", "books", true)}
                      {feeRow("OTHERS:", "others", true)}
                    </tbody>
                  </table>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm font-bold">Amount Tendered:</span>
                    <input
                      type="text"
                      className="border border-[#808080] bg-az-teal-light p-1 w-28 text-right"
                      value={tendered}
                      onChange={(event) => setTendered(event.target.value)}
                    />
                  </div>
                </div>

                {/* Sub-Total Box */}
                <div className="w-40">
                  <div className="bg-az-teal-deep text-white text-center py-1 font-bold border border-[#808080]">
                    SUB-TOTAL
                  </div>
                  <div className="bg-white border border-[#808080] border-t-0 p-2 text-center">
                    <p className="text-3xl font-bold text-az-teal-deep">{money(total)}</p>
                    <p className="text-xs italic">Balance after: {money(balanceAfter)}</p>
                    <p className="text-xs text-red-600 font-bold mt-1">Change: {money(change)}</p>
                  </div>
                </div>
              </div>

              {/* Student Info Row */}
              <div className="flex gap-4 mt-4">
                <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <span>Registration No.:</span>
                    <input
                      type="text"
                      readOnly
                      value={formatStudentNo(detail?.student.regNumber)}
                      className="flex-1 border border-[#808080] bg-[#e8e8e8] p-1"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Student Num:</span>
                    <input
                      type="text"
                      readOnly
                      value={detail?.student.studNum ?? ""}
                      className="flex-1 border border-[#808080] bg-[#e8e8e8] p-1"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>School Year:</span>
                    <input
                      type="text"
                      readOnly
                      value={detail?.student.schoolYear ?? ""}
                      className="flex-1 border border-[#808080] bg-[#e8e8e8] p-1"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Level:</span>
                    <input
                      type="text"
                      readOnly
                      value={detail?.student.level ?? ""}
                      className="flex-1 border border-[#808080] bg-[#e8e8e8] p-1"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Mode:</span>
                    <input
                      type="text"
                      readOnly
                      value={detail?.account?.modeOfPayment ?? ""}
                      className="flex-1 border border-[#808080] bg-[#e8e8e8] p-1"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Posted By:</span>
                    <input
                      type="text"
                      readOnly
                      value={user.username}
                      className="flex-1 border border-[#808080] bg-[#e8e8e8] p-1"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Balance:</span>
                    <input
                      type="text"
                      readOnly
                      value={detail?.account ? money(detail.account.totalBalance) : ""}
                      className="flex-1 border border-[#808080] bg-[#e8e8e8] p-1 text-right"
                    />
                  </div>
                </div>

                {/* Form of Payment */}
                <div className="border border-[#808080] p-2 bg-white">
                  <p className="text-center font-bold text-sm mb-2">Form of Payment</p>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="payment"
                        checked={formOfPayment === "Cash"}
                        onChange={() => setFormOfPayment("Cash")}
                      />
                      <span>Cash</span>
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name="payment"
                        checked={formOfPayment === "Check"}
                        onChange={() => setFormOfPayment("Check")}
                      />
                      <span>Check</span>
                    </label>
                  </div>
                  <div className="mt-2 text-sm space-y-1">
                    <div className="flex items-center gap-1">
                      <span>Check Date:</span>
                      <input
                        type="date"
                        disabled={formOfPayment !== "Check"}
                        value={checkDate}
                        onChange={(event) => setCheckDate(event.target.value)}
                        className="flex-1 border border-[#808080] bg-white p-0.5 disabled:bg-[#e8e8e8]"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span>Check Number:</span>
                      <input
                        type="text"
                        disabled={formOfPayment !== "Check"}
                        value={checkNumber}
                        onChange={(event) => setCheckNumber(event.target.value)}
                        className="flex-1 border border-[#808080] bg-white p-0.5 disabled:bg-[#e8e8e8]"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span>Bank:</span>
                      <input
                        type="text"
                        disabled={formOfPayment !== "Check"}
                        value={bankName}
                        onChange={(event) => setBankName(event.target.value)}
                        className="flex-1 border border-[#808080] bg-white p-0.5 disabled:bg-[#e8e8e8]"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span>Branch:</span>
                      <input
                        type="text"
                        disabled={formOfPayment !== "Check"}
                        value={branch}
                        onChange={(event) => setBranch(event.target.value)}
                        className="flex-1 border border-[#808080] bg-white p-0.5 disabled:bg-[#e8e8e8]"
                      />
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div className="text-sm space-y-1">
                  <div className="flex items-center gap-1">
                    <span>Total Payments:</span>
                    <input
                      type="text"
                      readOnly
                      value={money(total)}
                      className="w-24 border border-[#808080] bg-[#e8e8e8] p-1 text-right"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Amount Tendered:</span>
                    <input
                      type="text"
                      value={tendered}
                      onChange={(event) => setTendered(event.target.value)}
                      className="w-24 border border-[#808080] bg-white p-1 text-right"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span>Change:</span>
                    <input
                      type="text"
                      readOnly
                      value={money(change)}
                      className="w-24 border border-[#808080] bg-[#e8e8e8] p-1 text-right"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Buttons */}
            <div className="w-36 space-y-2">
              <button
                className="w-full bg-[#c0c0c0] border-2 border-[#808080] py-2 text-sm font-bold hover:bg-[#d0d0d0] disabled:opacity-60"
                onClick={handlePost}
                disabled={saving || loadingDetail}
              >
                {saving ? "Posting..." : loadingDetail ? "Loading..." : "Post Payment"}
              </button>
              <button
                className="w-full bg-[#c0c0c0] border-2 border-[#808080] py-2 text-sm font-bold text-az-steel underline hover:bg-[#d0d0d0]"
                onClick={handlePrintReceipt}
              >
                Print OR
              </button>
              <button
                className="w-full bg-[#c0c0c0] border-2 border-[#808080] py-2 text-sm font-bold text-az-steel hover:bg-[#d0d0d0]"
                onClick={handleClose}
              >
                Close
              </button>
            </div>
          </div>

          {/* System Message */}
          <div className="mt-4 border-t-2 border-[#808080] pt-2">
            <span className="text-red-600 font-bold">Message:</span>
            <p className="text-black">{systemMessage}</p>
          </div>
        </div>
        </WindowChrome>
      </div>
    </div>
  )
}
