"use client"

import { money } from "@/lib/money"
import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useUser } from "@/components/user-context"
import { WindowChrome } from "@/components/window-chrome"
import { ReversePaymentModal } from "@/components/reverse-payment-modal"
import { AcademyLogo } from "@/components/academy-logo"
import { BRAND } from "@/lib/branding"
import { openPrintWindow } from "@/lib/print"
import { formatAccountNo, formatStudentNo } from "@/lib/format-ids"
import type { PaymentRow, StudentAccountDetail, StudentListItem } from "@/lib/types"

interface ViewIndividualAccountModalProps {
  onClose: () => void
  initialStudentId?: number | null
  onPayTuition?: (studentId: number) => void
}


const amountText = (value: number) =>
  value === 0 ? "" : value < 0 ? `(${money(Math.abs(value))})` : money(value)

export function ViewIndividualAccountModal({ onClose, initialStudentId, onPayTuition }: ViewIndividualAccountModalProps) {
  const user = useUser()
  const canReverse = user.role === "admin"
  const [currentTime, setCurrentTime] = useState(new Date())
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [detail, setDetail] = useState<StudentAccountDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAssessment, setShowAssessment] = useState(false)
  const [reverseTarget, setReverseTarget] = useState<PaymentRow | null>(null)
  const [reverseStudentName, setReverseStudentName] = useState("")

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetch("/api/students")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) {
          const list = (data as { students: StudentListItem[] }).students ?? []
          setStudents(list)
          if (list.length > 0) {
            const index = initialStudentId
              ? Math.max(list.findIndex((student) => student.studentId === initialStudentId), 0)
              : 0
            setSelectedIndex(index)
          }
        }
      })
      .catch(() => setError("Unable to reach the server"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedStudent = students[selectedIndex]

  const loadDetail = (studentId: number) => {
    setLoading(true)
    setError(null)
    setDetail(null)
    fetch(`/api/students/${studentId}/account`)
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as (StudentAccountDetail & { error?: string }) | null
        if (!response.ok || !data || !("student" in data)) {
          setError(data?.error ?? "Failed to load the account")
          setDetail(null)
          return
        }
        setDetail(data)
      })
      .catch(() => setError("Unable to reach the server"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (selectedStudent) {
      loadDetail(selectedStudent.studentId)
      setShowAssessment(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudent?.studentId])

  const account = detail?.account
  const totals = detail?.totals
  const canPay = Boolean(
    detail &&
      account &&
      detail.student.status === "enrolled" &&
      account.schoolYear &&
      detail.student.schoolYear === account.schoolYear,
  )

  const handlePrintSoa = () => {
    if (!detail) {
      toast.error("Load a student account first.")
      return
    }
    openPrintWindow({
      title: "Statement of Account",
      subtitle: `${detail.student.lastName}, ${detail.student.firstName}`,
      meta: [
        { label: "Registration Number", value: formatStudentNo(detail.student.regNumber) },
        { label: "Level / Section", value: `${detail.student.level ?? ""} ${detail.student.section ?? ""}`.trim() },
        { label: "School Year", value: detail.student.schoolYear ?? "" },
        { label: "Mode of Payment", value: account?.modeOfPayment ?? "" },
        { label: "Total School Fees", value: money(account?.totalSchoolFees ?? 0) },
        { label: "Total Payments Made", value: money(account?.totalPaymentsMade ?? 0) },
        { label: "Outstanding Balance", value: money(account?.totalBalance ?? 0) },
        { label: "Months Not Paid", value: String(account?.monthsNotPaid ?? 0) },
        { label: "Current Dues", value: money(account?.currentDues ?? 0) },
      ],
      tables: [
        {
          headers: ["Date", "Receipt", "Description", "Tuition", "Computer", "Reg.", "Misc.", "Books", "Others", "Total"],
          align: ["left", "left", "left", "right", "right", "right", "right", "right", "right", "right"],
          rows: detail.payments.map((payment) => [
            payment.date,
            payment.receipt ?? "",
            payment.description ?? "",
            money(payment.tuition),
            money(payment.computer),
            money(payment.reg),
            money(payment.misc),
            money(payment.books),
            money(payment.others),
            money(payment.total),
          ]),
        },
      ],
      footer: `Rows recorded: ${detail.totals.count}`,
    })
  }

  const handlePrintRegistration = () => {
    if (!detail) {
      toast.error("Load a student account first.")
      return
    }
    openPrintWindow({
      title: "Certificate of Registration",
      subtitle: `${detail.student.schoolYear ?? ""} - ${detail.student.level ?? ""}`.trim(),
      meta: [
        { label: "Student Name", value: `${detail.student.lastName}, ${detail.student.firstName} ${detail.student.middleName ?? ""}`.trim() },
        { label: "Registration Number", value: formatStudentNo(detail.student.regNumber) },
        { label: "Level / Section", value: `${detail.student.level ?? ""} ${detail.student.section ?? ""}`.trim() },
        { label: "Classification", value: detail.student.classification ?? "" },
        { label: "Mode of Payment", value: account?.modeOfPayment ?? "" },
        { label: "Amount Paid", value: money(account?.totalPaymentsMade ?? 0) },
        { label: "Outstanding Balance", value: money(account?.totalBalance ?? 0) },
      ],
      tables: detail.assessment
        ? [
            {
              headers: ["Description of Fees", "Amount"],
              align: ["left", "right"],
              rows: [
                ["Registration Fee", money(detail.assessment.registrationFee)],
                ["Tuition Fee", money(detail.assessment.tuitionFee)],
                ["Miscellaneous Fee", money(detail.assessment.miscellaneousFee)],
                ["Computer Fee", money(detail.assessment.computerFee)],
                ["TOTAL", money(detail.assessment.totalFee)],
              ],
            },
          ]
        : undefined,
      footer: "This certifies that the above-named student is officially enrolled.",
    })
  }

  const formatDateTime = (date: Date) => {
    const dateStr = date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "2-digit",
    })
    const timeStr = date.toLocaleTimeString("en-US")
    return `${dateStr} ${timeStr}`
  }

  const assessmentRows = useMemo(() => {
    if (!detail?.assessment) return []
    const fee = detail.assessment
    return [
      { label: "Registration Fee", value: fee.registrationFee },
      { label: "Tuition Fee", value: fee.tuitionFee },
      { label: "Miscellaneous Fee", value: fee.miscellaneousFee },
      { label: "Textbooks", value: fee.textbooksFee },
      { label: "Computer Fee", value: fee.computerFee },
      { label: "Field Trip", value: fee.fieldTripFee },
      { label: "School Uniform", value: fee.schoolUniformFee },
      { label: "PE Uniform", value: fee.peUniformFee },
      { label: "Others", value: fee.othersFee },
    ]
  }, [detail])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#f0f0f0] border-2 border-[#808080] w-[1100px] max-h-[95vh] overflow-y-auto shadow-lg">
        <div className="sticky top-0 z-10">
          <WindowChrome title="Individual Account" onClose={onClose}>

        {/* Header */}
        <div className="bg-az-teal-light p-3 border-b border-[#808080]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <AcademyLogo className="w-16 h-16 border-2 border-az-teal-deep" />
              <div>
                <p className="text-az-steel font-bold">{BRAND.schoolShortName}</p>
                <p className="text-az-steel text-xs">{BRAND.addressLine}</p>
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-az-steel text-xl font-bold italic">{BRAND.productName}</h1>
              <p className="text-az-steel font-bold">Individual Accounts</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-xs font-bold">Student:</span>
                <select
                  className="border border-[#808080] bg-white p-1 text-xs w-56"
                  value={selectedIndex}
                  onChange={(event) => setSelectedIndex(Number(event.target.value))}
                >
                  {students.map((student, index) => (
                    <option key={student.studentId} value={index}>
                      {student.lastName}, {student.firstName} ({formatStudentNo(student.regNum)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1 justify-end mt-1">
                <button
                  className="bg-[#c0c0c0] border border-[#808080] p-0.5 disabled:opacity-50"
                  disabled={selectedIndex <= 0}
                  onClick={() => setSelectedIndex((index) => Math.max(index - 1, 0))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  className="bg-[#c0c0c0] border border-[#808080] p-0.5 disabled:opacity-50"
                  disabled={selectedIndex >= students.length - 1}
                  onClick={() => setSelectedIndex((index) => Math.min(index + 1, students.length - 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Student Name Banner */}
        <div className="bg-az-teal-deep text-white p-2 flex justify-between items-center">
          <h2 className="text-xl font-bold">
            {detail ? `${detail.student.lastName}, ${detail.student.firstName}` : "Select a student..."}
          </h2>
          <div className="flex gap-8 text-sm">
            <span>
              Registration Number: <span className="font-bold">{formatStudentNo(detail?.student.regNumber)}</span>
            </span>
            <span>{user.fullName}</span>
            <span>{formatDateTime(currentTime)}</span>
          </div>
        </div>

        {error && <div className="bg-red-100 border-b border-red-400 p-2 text-sm text-red-700 font-bold">{error}</div>}
        {loading && <div className="bg-[#ffffd0] border-b border-[#808080] p-2 text-sm text-az-steel">Loading account...</div>}

        {detail && (
          <div className="p-4 flex gap-4">
            {/* Left Panel - Account Info */}
            <div className="flex-1">
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <p>
                    <span className="font-bold">Account ID:</span> {formatAccountNo(account?.accountId) || "-"}
                  </p>
                  <p>
                    <span className="font-bold">Registration Number:</span> {formatStudentNo(account?.accountNumber) || "-"}
                  </p>
                  <p>
                    <span className="font-bold">Student Number:</span> {detail.student.studNum ?? ""}
                  </p>
                  <p>
                    <span className="font-bold">Mode of Payment:</span> {account?.modeOfPayment ?? "-"}
                  </p>
                  <p>
                    <span className="font-bold">Level:</span> {detail.student.level ?? "-"}
                  </p>
                  <p>
                    <span className="font-bold">School Year:</span> {detail.student.schoolYear ?? "-"}
                  </p>
                </div>
                <div>
                  <div className="border border-[#808080] p-2 bg-white">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="font-bold text-az-steel">{account?.modeOfPayment ?? "-"}</span>
                    </div>
                    <div className="mt-2 text-right">
                      <p className="font-bold">Tuition Fee:</p>
                      <p className="text-2xl font-bold border border-[#808080] bg-white px-2">
                        {money(account?.tuitionFee ?? 0)}
                      </p>
                      <p className="text-sm">Installment: {money(account?.monthlyTuition ?? 0)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <p className="flex justify-between">
                    <span className="font-bold">Initial Payment (Upon Enrol):</span>{" "}
                    <span className="border border-[#808080] bg-az-teal-light px-2 w-28 text-right">
                      {money(account?.initialPayment ?? 0)}
                    </span>
                  </p>
                  <p className="flex justify-between">
                    <span className="font-bold">Discount:</span>{" "}
                    <span className="border border-[#808080] bg-white px-2 w-28 text-right">
                      {money(account?.discount ?? 0)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <p className="flex justify-between">
                    <span className="font-bold">Total School Fees:</span>{" "}
                    <span className="border border-[#808080] bg-white px-2 w-28 text-right">
                      {money(account?.totalSchoolFees ?? 0)}
                    </span>
                  </p>
                  <p className="flex justify-between">
                    <span className="font-bold">Total Payments Made:</span>{" "}
                    <span className="border border-[#808080] bg-white px-2 w-28 text-right">
                      {money(account?.totalPaymentsMade ?? 0)}
                    </span>
                  </p>
                  <p className="flex justify-between">
                    <span className="font-bold">Total Balance:</span>{" "}
                    <span className="text-red-600 font-bold">({money(account?.totalBalance ?? 0)})</span>
                  </p>
                </div>
                <div className="text-right">
                  <button
                    className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 font-bold underline hover:bg-[#d0d0d0]"
                    onClick={() => selectedStudent && loadDetail(selectedStudent.studentId)}
                  >
                    REFRESH
                  </button>
                  <p className="text-xs text-az-teal-deep underline cursor-pointer mt-1" onClick={() => setShowAssessment((value) => !value)}>
                    {showAssessment ? "Hide Assessment" : "Click to View Assessment"}
                  </p>
                </div>
              </div>

              {showAssessment && detail.assessment && (
                <div className="border-2 border-az-teal-deep bg-az-teal-faint p-2 mb-4 text-sm">
                  <p className="font-bold text-az-teal-deep mb-1">
                    Assessment - {detail.assessment.levelName} ({detail.assessment.schoolYearCode})
                  </p>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                    {assessmentRows.map((row) => (
                      <p key={row.label} className="flex justify-between border-b border-[#d0d0d0]">
                        <span>{row.label}:</span> <span>{money(row.value)}</span>
                      </p>
                    ))}
                  </div>
                  <p className="font-bold text-right mt-1">
                    TOTAL: <span className="bg-az-teal-deep text-white px-2">{money(detail.assessment.totalFee)}</span>
                  </p>
                </div>
              )}

              {/* Record of Payments */}
              <div className="border-t-2 border-[#808080] pt-2">
                <div className="flex items-center gap-4 mb-2">
                  <span className="font-bold text-az-steel underline">RECORD OF PAYMENTS</span>
                  <span className="text-sm">
                    Last Updated: <span className="font-bold">{account?.lastUpdated ?? "-"}</span>
                  </span>
                  <span className="text-sm">
                    Total Balance: <span className="text-red-600 font-bold">{money(account?.totalBalance ?? 0)}</span>
                  </span>
                </div>

                {/* Payments Table */}
                <div className="border border-[#808080] max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-[#c0c0c0] sticky top-0">
                      <tr>
                        <th className="border-r border-[#808080] p-1">Months</th>
                        <th className="border-r border-[#808080] p-1">Date</th>
                        <th className="border-r border-[#808080] p-1">Receipt</th>
                        <th className="border-r border-[#808080] p-1">Description</th>
                        <th className="border-r border-[#808080] p-1">Tuition</th>
                        <th className="border-r border-[#808080] p-1">Computer</th>
                        <th className="border-r border-[#808080] p-1">Reg.</th>
                        <th className="border-r border-[#808080] p-1">Misc</th>
                        <th className="border-r border-[#808080] p-1">Books</th>
                        <th className="border-r border-[#808080] p-1">Others</th>
                        <th className="border-r border-[#808080] p-1">TOTAL</th>
                        <th className="border-r border-[#808080] p-1">Status</th>
                        <th className="p-1">Posted by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.payments.map((payment, index) => {
                        const isReversal = payment.entryType === "reversal"
                        const isReversed = Boolean(payment.reversalReceipt)
                        const rowClass = isReversal
                          ? "bg-[#f7e2e2] text-[#7a2f2f]"
                          : isReversed
                            ? "bg-[#fff7e0]"
                            : index % 2 === 0
                              ? "bg-white"
                              : "bg-[#f5f5f5]"
                        return (
                          <tr key={payment.id} className={rowClass}>
                            <td className="border-r border-[#d0d0d0] p-1">{payment.months ?? ""}</td>
                            <td className="border-r border-[#d0d0d0] p-1">{payment.date}</td>
                            <td className="border-r border-[#d0d0d0] p-1 font-mono">{payment.receipt ?? ""}</td>
                            <td className="border-r border-[#d0d0d0] p-1">{payment.description ?? ""}</td>
                            <td className="border-r border-[#d0d0d0] p-1 text-right">{amountText(payment.tuition)}</td>
                            <td className="border-r border-[#d0d0d0] p-1 text-right">{amountText(payment.computer)}</td>
                            <td className="border-r border-[#d0d0d0] p-1 text-right">{amountText(payment.reg)}</td>
                            <td className="border-r border-[#d0d0d0] p-1 text-right">{amountText(payment.misc)}</td>
                            <td className="border-r border-[#d0d0d0] p-1 text-right">{amountText(payment.books)}</td>
                            <td className="border-r border-[#d0d0d0] p-1 text-right">{amountText(payment.others)}</td>
                            <td className="border-r border-[#d0d0d0] p-1 text-right font-bold">{amountText(payment.total)}</td>
                            <td className="border-r border-[#d0d0d0] p-1">
                              {isReversal ? (
                                <span className="inline-block border border-red-400 bg-red-100 px-1 text-[10px] font-bold text-red-700">
                                  Reversal
                                </span>
                              ) : isReversed ? (
                                <span className="inline-block border border-[#b08a3e] bg-[#fff2cc] px-1 text-[10px] font-bold text-[#7a5a16]">
                                  Reversed by {payment.reversalReceipt}
                                </span>
                              ) : canReverse ? (
                                <button
                                  className="bg-[#c0c0c0] border border-[#808080] px-1.5 py-0.5 text-[10px] hover:bg-[#d0d0d0]"
                                  onClick={() => {
                                    setReverseStudentName(
                                      detail ? `${detail.student.lastName}, ${detail.student.firstName}` : "",
                                    )
                                    setReverseTarget(payment)
                                  }}
                                >
                                  Reverse
                                </button>
                              ) : (
                                <span className="text-[10px] text-az-steel">Posted</span>
                              )}
                            </td>
                            <td className="p-1">{payment.postedBy ?? ""}</td>
                          </tr>
                        )
                      })}
                      {detail.payments.length === 0 && (
                        <tr>
                          <td colSpan={13} className="p-3 text-center text-az-steel">
                            No payments posted yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-az-steel text-white">
                      <tr>
                        <td colSpan={4} className="p-1">
                          Rows: {totals?.count ?? 0}
                        </td>
                        <td className="p-1 text-right">{money(totals?.tuition ?? 0)}</td>
                        <td className="p-1 text-right">{money(totals?.computer ?? 0)}</td>
                        <td className="p-1 text-right">{money(totals?.reg ?? 0)}</td>
                        <td className="p-1 text-right">{money(totals?.misc ?? 0)}</td>
                        <td className="p-1 text-right">{money(totals?.books ?? 0)}</td>
                        <td className="p-1 text-right">{money(totals?.others ?? 0)}</td>
                        <td className="p-1 text-right">{money(totals?.total ?? 0)}</td>
                        <td></td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Panel - Statement of Account */}
            <div className="w-56 border border-[#808080] bg-[#ffffd0] p-2 self-start">
              <h3 className="text-red-600 font-bold text-center mb-2">Statement of Account</h3>
              <div className="text-sm space-y-1">
                <p>Summary</p>
                <p className="flex justify-between">
                  <span>Installments not paid:</span> <span className="font-bold">{account?.monthsNotPaid ?? 0}</span>
                </p>
                <p className="flex justify-between">
                  <span>Initial Payment:</span>{" "}
                  <span className="border border-[#808080] bg-az-teal-light px-1">{money(account?.initialPayment ?? 0)}</span>
                </p>
                <p className="flex justify-between">
                  <span>Outstanding balance:</span>{" "}
                  <span className="border border-[#808080] bg-white px-1">{money(account?.totalBalance ?? 0)}</span>
                </p>
              </div>

              <div className="mt-2 border border-[#808080] bg-white">
                <div className="grid grid-cols-2 text-xs border-b border-[#808080]">
                  <div className="p-1 border-r border-[#808080]">Description</div>
                  <div className="p-1">Amount</div>
                </div>
                <div className="p-1 text-xs">
                  <p className="flex justify-between">
                    <span>Total Fees</span> <span>{money(account?.totalSchoolFees ?? 0)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Less: Payments</span> <span>{money(account?.totalPaymentsMade ?? 0)}</span>
                  </p>
                  <p className="flex justify-between font-bold border-t border-[#d0d0d0] mt-1 pt-1">
                    <span>Balance</span> <span>{money(account?.totalBalance ?? 0)}</span>
                  </p>
                </div>
              </div>

              <div className="mt-2 text-sm">
                <p className="flex justify-between">
                  <span className="text-red-600 font-bold">Current Dues</span>{" "}
                  <span className="text-red-600">P</span>{" "}
                  <span className="bg-az-teal-light px-1">{money(account?.currentDues ?? 0)}</span>
                </p>
                <p className="text-xs">Date Due: {account?.dueDate ?? "—"}</p>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <button
                  className="bg-az-teal-deep text-white text-xs py-1 border border-[#808080]"
                  onClick={() => setShowAssessment((value) => !value)}
                >
                  {showAssessment ? "Hide Assessment" : "View Assessment"}
                </button>
                <button
                  className="bg-az-teal-deep text-white text-xs py-1 border border-[#808080]"
                  onClick={handlePrintSoa}
                >
                  Print SOA
                </button>
              </div>
            </div>

            {/* Far Right - Action Buttons */}
            <div className="w-28 space-y-2 self-start">
              <button
                className="w-full bg-[#c0c0c0] border-2 border-[#808080] py-1 text-sm hover:bg-[#d0d0d0]"
                onClick={() => selectedStudent && loadDetail(selectedStudent.studentId)}
              >
                Refresh
              </button>
              <button
                className="w-full bg-[#c0c0c0] border-2 border-[#808080] py-1 text-sm hover:bg-[#d0d0d0]"
                onClick={handlePrintRegistration}
              >
                Print COR
              </button>
              <button
                className="w-full bg-[#c0c0c0] border-2 border-[#808080] py-1 text-sm hover:bg-[#d0d0d0] disabled:opacity-50"
                onClick={() => detail && onPayTuition?.(detail.student.id)}
                disabled={!detail || !onPayTuition || !canPay}
                title={detail && !canPay ? "Payments can only be posted to an enrolled student's current account." : undefined}
              >
                Pay
              </button>
              <button
                className="w-full bg-[#c0c0c0] border-2 border-[#808080] py-1 text-sm text-az-steel hover:bg-[#d0d0d0]"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        )}
          </WindowChrome>
        </div>
      </div>
      {reverseTarget && (
        <ReversePaymentModal
          payment={reverseTarget}
          studentName={reverseStudentName}
          onClose={() => setReverseTarget(null)}
          onReversed={() => {
            if (selectedStudent) loadDetail(selectedStudent.studentId)
          }}
        />
      )}
    </div>
  )
}
