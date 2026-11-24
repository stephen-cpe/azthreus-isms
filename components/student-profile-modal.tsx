"use client"

import { money } from "@/lib/money"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useUser } from "@/components/user-context"
import { WindowChrome } from "@/components/window-chrome"
import { EditStudentModal } from "@/components/edit-student-modal"
import { openPrintWindow } from "@/lib/print"
import { formatAccountNo, formatStudentNo } from "@/lib/format-ids"
import { canAccessPage, canWrite } from "@/lib/roles"
import type { AuditLogEntry, StudentProfile } from "@/lib/types"

interface StudentProfileModalProps {
  onClose: () => void
  studentId: number
  onViewReportCard?: (studentId: number) => void
  onViewAccount?: (studentId: number) => void
  onReenroll?: (studentId: number) => void
}


const STATUS_COLORS: Record<string, string> = {
  enrolled: "text-az-teal-deep",
  dropped: "text-red-600",
  graduated: "text-az-steel",
  transferred: "text-az-steel",
}

export function StudentProfileModal({ onClose, studentId, onViewReportCard, onViewAccount, onReenroll }: StudentProfileModalProps) {
  const user = useUser()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [history, setHistory] = useState<AuditLogEntry[]>([])

  const loadProfile = () => {
    setLoading(true)
    setError(null)
    fetch(`/api/students/${studentId}/profile`)
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as (StudentProfile & { error?: string }) | null
        if (!response.ok || !data?.student) {
          setError(data?.error ?? "Failed to load the student profile")
          return
        }
        setProfile(data)
      })
      .catch(() => setError("Unable to reach the server"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  useEffect(() => {
    if (user.role !== "admin") return
    fetch(`/api/audit?entityType=student&entityId=${studentId}&page=1`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setHistory(((data as { entries?: AuditLogEntry[] }).entries ?? []).slice(0, 10))
      })
      .catch(() => {})
  }, [studentId, user.role])

  const canEditStudent = canWrite(user.role, "students")
  const canViewGrades = canAccessPage(user.role, "grades")

  const handlePrint = () => {
    if (!profile) {
      toast.error("Profile is not loaded yet.")
      return
    }
    const student = profile.student
    openPrintWindow({
      title: "Student Profile Inquiry",
      subtitle: `${student.schoolYear ?? ""} - ${student.level ?? ""}`.trim(),
      meta: [
        { label: "Name", value: `${student.lastName}, ${student.firstName} ${student.middleName ?? ""}`.trim() },
        { label: "Registration Number", value: formatStudentNo(student.regNumber) },
        { label: "Classification", value: student.classification ?? "" },
        { label: "Status", value: student.status ?? "" },
        { label: "Gender", value: student.gender ?? "" },
        { label: "Birthdate / Age", value: `${student.birthdate ?? ""} ${student.age ? `(${student.age})` : ""}`.trim() },
        { label: "Address", value: `${student.address ?? ""} ${student.barangay ?? ""}`.trim() },
        { label: "Contact", value: `${student.telephone ?? ""} ${student.cellphone ?? ""}`.trim() },
        { label: "Level / Section", value: `${student.level ?? ""} ${student.section ?? ""}`.trim() },
        { label: "School Year", value: student.schoolYear ?? "" },
        { label: "Date Enrolled", value: student.dateEnrolled ?? "" },
        { label: "Father", value: profile.parents?.fatherName ?? "" },
        { label: "Mother", value: profile.parents?.motherName ?? "" },
        {
          label: "Account Balance",
          value: profile.account ? money(profile.account.totalBalance) : "No account",
        },
        ...(canViewGrades
          ? [
              {
                label: "General Average",
                value: profile.generalAverage !== null ? money(profile.generalAverage) : "",
              },
              { label: "Achievement", value: profile.honors ?? "" },
            ]
          : []),
      ],
      tables: [
        ...(canViewGrades
          ? [
              {
                headers: ["Grading Period", "Average", "Subjects"],
                align: ["left", "right", "right"] as ("left" | "right")[],
                rows: profile.gradeSummary.map((row) => [
                  row.period,
                  row.average !== null ? money(row.average) : "",
                  String(row.subjects),
                ]),
              },
            ]
          : []),
        {
          headers: ["Date", "Receipt", "Description", "Amount", "Posted By"],
          align: ["left", "left", "left", "right", "left"],
          rows: profile.payments.map((payment) => [
            payment.date,
            payment.receipt ?? "",
            payment.description ?? "",
            money(payment.total),
            payment.postedBy ?? "",
          ]),
        },
      ],
      footer: "System-generated student profile.",
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#f0f0f0] border-2 border-[#808080] w-[1000px] max-h-[92vh] overflow-auto shadow-lg">
        <WindowChrome title={`Profile Inquiry - ${user.fullName}`} onClose={onClose}>
          <div className="p-4">
            {loading && <p className="text-az-steel font-bold">Loading profile...</p>}
            {error && <p className="text-red-600 font-bold">{error}</p>}

            {profile && (
              <>
                {/* Header */}
                <div className="flex items-start justify-between border-b-2 border-[#808080] pb-2 mb-3">
                  <div>
                    <h1 className="text-az-teal-deep text-2xl font-bold">
                      {profile.student.lastName}, {profile.student.firstName} {profile.student.middleName ?? ""}
                    </h1>
                    <p className="text-az-steel text-sm font-bold">
                      {profile.student.level ?? ""} {profile.student.section ?? ""} - {profile.student.schoolYear ?? ""}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p>
                      <span className="font-bold text-az-steel">Reg No: </span>
                      {formatStudentNo(profile.student.regNumber)}
                    </p>
                    <p>
                      <span className="font-bold text-az-steel">Status: </span>
                      <span className={`font-bold ${STATUS_COLORS[profile.student.status ?? ""] ?? ""}`}>
                        {profile.student.status ?? ""}
                      </span>{" "}
                      / {profile.student.classification ?? ""}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  {/* Personal Info */}
                  <div className="border border-[#808080] bg-white p-2">
                    <p className="font-bold text-az-steel bg-[#ffffd0] px-1 mb-1">Personal Information</p>
                    <p>
                      <span className="font-bold">Gender: </span>
                      {profile.student.gender ?? ""}
                    </p>
                    <p>
                      <span className="font-bold">Birthdate: </span>
                      {profile.student.birthdate ?? ""} {profile.student.age ? `(${profile.student.age})` : ""}
                    </p>
                    <p>
                      <span className="font-bold">Birthplace: </span>
                      {profile.student.birthplace ?? ""}
                    </p>
                    <p>
                      <span className="font-bold">Address: </span>
                      {profile.student.address ?? ""} {profile.student.barangay ?? ""}
                    </p>
                    <p>
                      <span className="font-bold">Tel: </span>
                      {profile.student.telephone ?? ""}
                    </p>
                    <p>
                      <span className="font-bold">Cell: </span>
                      {profile.student.cellphone ?? ""}
                    </p>
                    <p>
                      <span className="font-bold">Date Enrolled: </span>
                      {profile.student.dateEnrolled ?? ""}
                    </p>
                  </div>

                  {/* Parents */}
                  <div className="border border-[#808080] bg-white p-2">
                    <p className="font-bold text-az-steel bg-[#ffffd0] px-1 mb-1">Parents / Guardian</p>
                    {profile.parents ? (
                      <>
                        <p>
                          <span className="font-bold">Father: </span>
                          {profile.parents.fatherName ?? ""}{" "}
                          {profile.parents.fatherOccupation ? `(${profile.parents.fatherOccupation})` : ""}
                        </p>
                        <p>
                          <span className="font-bold">Mother: </span>
                          {profile.parents.motherName ?? ""}{" "}
                          {profile.parents.motherOccupation ? `(${profile.parents.motherOccupation})` : ""}
                        </p>
                        <p>
                          <span className="font-bold">Contact: </span>
                          {profile.parents.telephone ?? ""} {profile.parents.mobileNumber ?? ""}
                        </p>
                        <p>
                          <span className="font-bold">Religion: </span>
                          {profile.parents.religion ?? ""}
                        </p>
                      </>
                    ) : (
                      <p>No parent record on file.</p>
                    )}
                  </div>

                  {/* Account */}
                  <div className="border border-[#808080] bg-white p-2">
                    <p className="font-bold text-az-steel bg-[#ffffd0] px-1 mb-1">Account Summary</p>
                    {profile.account ? (
                      <>
                        <p>
                          <span className="font-bold">Account ID: </span>
                          {formatAccountNo(profile.account.accountId)}
                        </p>
                        <p>
                          <span className="font-bold">Mode: </span>
                          {profile.account.modeOfPayment ?? ""}
                        </p>
                        <p>
                          <span className="font-bold">Total Fees: </span>
                          {money(profile.account.totalSchoolFees)}
                        </p>
                        <p>
                          <span className="font-bold">Paid: </span>
                          {money(profile.account.totalPaymentsMade)}
                        </p>
                        <p className="font-bold text-red-600">
                          Balance: {money(profile.account.totalBalance)}
                        </p>
                        <p>
                          <span className="font-bold">Months Not Paid: </span>
                          {profile.account.monthsNotPaid}
                        </p>
                        <p>
                          <span className="font-bold">Current Dues: </span>
                          {money(profile.account.currentDues)}
                        </p>
                      </>
                    ) : (
                      <p>No account on file.</p>
                    )}
                  </div>
                </div>

                {/* School History */}
                <div className="border border-[#808080] bg-white p-2 mt-3 text-xs">
                  <p className="font-bold text-az-steel bg-[#ffffd0] px-1 mb-1">Previous schools</p>
                  {profile.schoolHistory.length === 0 ? (
                    <p>No school history on file.</p>
                  ) : (
                    <table className="w-full">
                      <tbody>
                        {profile.schoolHistory.map((school, index) => (
                          <tr key={index}>
                            <td className="p-0.5 font-bold text-az-steel w-32">{school.schoolLevel ?? ""}</td>
                            <td className="p-0.5">{school.schoolName ?? ""}</td>
                            <td className="p-0.5 text-az-steel">{school.schoolAddress ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Grades Summary (academic roles only) */}
                {canViewGrades && (
                  <div className="border border-[#808080] bg-white p-2 mt-3 text-xs">
                    <div className="flex justify-between">
                      <p className="font-bold text-az-steel bg-[#ffffd0] px-1 mb-1">Grades Summary</p>
                      <p>
                        <span className="font-bold text-az-steel">General Average: </span>
                        <span className="font-mono font-bold text-az-teal-deep">
                          {profile.generalAverage !== null ? money(profile.generalAverage) : "N/A"}
                        </span>
                        {profile.honors && <span className="text-az-steel font-bold"> - {profile.honors}</span>}
                      </p>
                    </div>
                    {profile.gradeSummary.length === 0 ? (
                      <p>No grades posted.</p>
                    ) : (
                      <div className="flex gap-4 mt-1">
                        {profile.gradeSummary.map((row) => (
                          <span key={row.period} className="border border-[#808080] bg-[#f5f5f5] px-2 py-1">
                            <span className="font-bold text-az-steel">{row.period}: </span>
                            <span className="font-mono">{row.average !== null ? money(row.average) : "N/A"}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Audit history (administrators only) */}
                {user.role === "admin" && (
                  <div className="border border-[#808080] bg-white p-2 mt-3 text-xs">
                    <p className="font-bold text-az-steel bg-[#ffffd0] px-1 mb-1">History</p>
                    {history.length === 0 ? (
                      <p>No audit entries recorded for this student.</p>
                    ) : (
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-az-steel">
                            <th className="p-0.5 w-40">When</th>
                            <th className="p-0.5 w-40">Action</th>
                            <th className="p-0.5">Summary</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((entry) => (
                            <tr key={entry.id} className="border-t border-[#e0e0e0]">
                              <td className="p-0.5 whitespace-nowrap">{entry.occurredAt}</td>
                              <td className="p-0.5 font-mono text-az-teal-deep">{entry.action}</td>
                              <td className="p-0.5">{entry.summary}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Payments */}
                <div className="border border-[#808080] bg-white p-2 mt-3">
                  <p className="font-bold text-az-steel bg-[#ffffd0] px-1 mb-1 text-xs">Record of Payments (latest 20)</p>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-az-steel text-white sticky top-0">
                        <tr>
                          <th className="p-1 text-left border-r border-az-slate">Months</th>
                          <th className="p-1 text-left border-r border-az-slate">Date</th>
                          <th className="p-1 text-left border-r border-az-slate">Receipt</th>
                          <th className="p-1 text-left border-r border-az-slate">Description</th>
                          <th className="p-1 text-right border-r border-az-slate">Total</th>
                          <th className="p-1 text-left">Posted By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.payments.map((payment, index) => (
                          <tr
                            key={payment.id}
                            className={
                              payment.entryType === "reversal"
                                ? "bg-[#f7e2e2] text-[#7a2f2f]"
                                : index % 2 === 0
                                  ? "bg-white"
                                  : "bg-[#f5f5f5]"
                            }
                          >
                            <td className="p-1 border-r border-[#d0d0d0]">{payment.months ?? ""}</td>
                            <td className="p-1 border-r border-[#d0d0d0]">{payment.date}</td>
                            <td className="p-1 border-r border-[#d0d0d0] font-mono">
                              {payment.receipt ?? ""}
                              {payment.entryType === "reversal" && (
                                <span className="ml-1 border border-red-400 bg-red-100 px-1 text-[9px] font-bold text-red-700">
                                  Reversal
                                </span>
                              )}
                            </td>
                            <td className="p-1 border-r border-[#d0d0d0]">{payment.description ?? ""}</td>
                            <td className="p-1 border-r border-[#d0d0d0] text-right font-mono">{money(payment.total)}</td>
                            <td className="p-1">{payment.postedBy ?? ""}</td>
                          </tr>
                        ))}
                        {profile.payments.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-2 text-center text-az-steel">
                              No payments recorded.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 mt-3">
                  {canEditStudent && (
                    <button
                      className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 text-sm font-bold text-az-steel hover:bg-[#d0d0d0]"
                      onClick={() => setShowEdit(true)}
                    >
                      Edit Record
                    </button>
                  )}
                  {canEditStudent && onReenroll && profile.student.status !== "enrolled" && (
                    <button
                      className="bg-az-steel text-white border-2 border-[#808080] px-4 py-1 text-sm font-bold hover:bg-az-navy"
                      onClick={() => onReenroll(studentId)}
                    >
                      Re-enroll
                    </button>
                  )}
                  {canViewGrades && (
                    <button
                      className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 text-sm font-bold text-az-steel hover:bg-[#d0d0d0]"
                      onClick={() => onViewReportCard?.(studentId)}
                    >
                      Report Card
                    </button>
                  )}
                  <button
                    className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 text-sm font-bold text-az-steel hover:bg-[#d0d0d0]"
                    onClick={() => onViewAccount?.(studentId)}
                  >
                    View Account
                  </button>
                  <button
                    className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 text-sm font-bold text-az-steel hover:bg-[#d0d0d0]"
                    onClick={handlePrint}
                  >
                    Print
                  </button>
                  <button
                    className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 text-sm font-bold text-az-steel hover:bg-[#d0d0d0]"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>

                {showEdit && (
                  <EditStudentModal
                    studentId={studentId}
                    onClose={() => setShowEdit(false)}
                    onSaved={() => {
                      setShowEdit(false)
                      loadProfile()
                    }}
                    onReenroll={onReenroll}
                  />
                )}
              </>
            )}
          </div>
        </WindowChrome>
      </div>
    </div>
  )
}
