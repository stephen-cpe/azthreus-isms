"use client"

import { money } from "@/lib/money"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useUser } from "@/components/user-context"
import { WindowChrome } from "@/components/window-chrome"
import { BRAND } from "@/lib/branding"
import { openPrintWindow } from "@/lib/print"
import { formatStudentNo } from "@/lib/format-ids"
import type { Lookups, StudentAccountDetail, StudentListItem } from "@/lib/types"

interface CorModalProps {
  onClose: () => void
  initialStudentId?: number | null
}


export function CorModal({ initialStudentId, onClose }: CorModalProps) {
  const user = useUser()
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [studentId, setStudentId] = useState(initialStudentId ? String(initialStudentId) : "")
  const [schoolYearId, setSchoolYearId] = useState("")
  const [detail, setDetail] = useState<StudentAccountDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/lookups")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return
        const typed = data as Lookups
        setLookups(typed)
        const currentYear = typed.schoolYears.find((year) => year.isCurrent) ?? typed.schoolYears[0]
        if (currentYear) setSchoolYearId(String(currentYear.id))
      })
      .catch(() => {})

    fetch("/api/students?enrolled=1")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setStudents((data as { students: StudentListItem[] }).students ?? [])
      })
      .catch(() => setError("Unable to load students"))
  }, [])

  useEffect(() => {
    if (initialStudentId) setStudentId(String(initialStudentId))
  }, [initialStudentId])

  const loadCor = async () => {
    if (!studentId) {
      setError("Select a student first.")
      return
    }
    setLoading(true)
    setError(null)
    setDetail(null)
    try {
      const query = schoolYearId ? `?schoolYearId=${encodeURIComponent(schoolYearId)}` : ""
      const response = await fetch(`/api/students/${studentId}/account${query}`)
      const data = (await response.json().catch(() => null)) as (StudentAccountDetail & { error?: string }) | null
      if (!response.ok || !data || !("student" in data)) {
        setError(data?.error ?? "Failed to build the certificate")
        setDetail(null)
        return
      }
      setDetail(data)
    } catch {
      setError("Unable to reach the server")
    } finally {
      setLoading(false)
    }
  }

  // Generate the certificate whenever the student or school year changes.
  useEffect(() => {
    if (studentId && schoolYearId) void loadCor()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, schoolYearId])

  const handlePrint = () => {
    if (!detail) {
      toast.error("Load a student first.")
      return
    }
    const assessment = detail.assessment
    openPrintWindow({
      title: "Certificate of Registration",
      subtitle: `${detail.student.schoolYear ?? ""} - ${detail.student.level ?? ""}`.trim(),
      meta: [
        { label: "Student Name", value: `${detail.student.lastName}, ${detail.student.firstName} ${detail.student.middleName ?? ""}`.trim() },
        { label: "Registration Number", value: formatStudentNo(detail.student.regNumber) },
        { label: "Level / Section", value: `${detail.student.level ?? ""} ${detail.student.section ?? ""}`.trim() },
        { label: "Classification", value: detail.student.classification ?? "" },
        { label: "Mode of Payment", value: detail.account?.modeOfPayment ?? "" },
        {
          label: "Total School Fees",
          value: detail.account ? money(detail.account.totalSchoolFees) : "",
        },
        {
          label: "Amount Paid",
          value: detail.account ? money(detail.account.totalPaymentsMade) : "",
        },
        {
          label: "Balance",
          value: detail.account ? money(detail.account.totalBalance) : "",
        },
      ],
      tables: assessment
        ? [
            {
              headers: ["Fee", "Amount"],
              align: ["left", "right"],
              rows: [
                ["Registration Fee", money(assessment.registrationFee)],
                ["Tuition Fee", money(assessment.tuitionFee)],
                ["Miscellaneous Fee", money(assessment.miscellaneousFee)],
                ["Computer Fee", money(assessment.computerFee)],
                ["Textbooks", money(assessment.textbooksFee)],
                ["Field Trip", money(assessment.fieldTripFee)],
                ["School Uniform", money(assessment.schoolUniformFee)],
                ["PE Uniform", money(assessment.peUniformFee)],
                ["Others", money(assessment.othersFee)],
                ["TOTAL", money(assessment.totalFee)],
              ],
            },
          ]
        : undefined,
      footer: "This certifies that the above-named student is officially enrolled for the school year indicated.",
    })
  }

  const assessment = detail?.assessment

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#f0f0f0] border-2 border-[#808080] w-[820px] max-h-[92vh] overflow-auto shadow-lg">
        <WindowChrome title={`Certificate of Registration - ${user.fullName}`} onClose={onClose}>
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <h1 className="text-az-teal-deep text-2xl font-bold">Certificate of Registration</h1>
              <span className="text-sm text-az-steel font-bold">Registration</span>
            </div>

            <div className="flex items-end gap-3 border border-[#808080] bg-[#e8e8e8] p-3 mb-3 text-sm">
              <label className="flex-1">
                <span className="font-bold">Student:</span>
                <select
                  className="w-full border border-[#808080] bg-white p-1 mt-1"
                  value={studentId}
                  onChange={(event) => {
                    setStudentId(event.target.value)
                    setDetail(null)
                    setError(null)
                  }}
                >
                  <option value="">Select a student...</option>
                  {students.map((student) => (
                    <option key={student.studentId} value={student.studentId}>
                      {student.lastName}, {student.firstName} ({student.level ?? ""})
                    </option>
                  ))}
                </select>
              </label>
              <label className="w-40">
                <span className="font-bold">School Year:</span>
                <select
                  className="w-full border border-[#808080] bg-white p-1 mt-1"
                  value={schoolYearId}
                  onChange={(event) => setSchoolYearId(event.target.value)}
                >
                  {lookups?.schoolYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.code}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 font-bold hover:bg-[#d0d0d0] disabled:opacity-60"
                onClick={loadCor}
                disabled={loading}
              >
                {loading ? "Loading..." : "Generate COR"}
              </button>
              <button
                className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 font-bold text-az-steel hover:bg-[#d0d0d0]"
                onClick={handlePrint}
              >
                Print
              </button>
            </div>

            {error && <p className="text-red-600 font-bold text-sm mb-2">{error}</p>}

            {detail && (
              <div className="border border-[#808080] bg-white p-4">
                <div className="text-center mb-3">
                  <p className="text-az-teal-deep text-lg font-bold">{BRAND.schoolName}</p>
                  <p className="text-az-teal-deep text-xs font-bold">{BRAND.addressLine}</p>
                  <p className="text-az-steel font-bold mt-2 underline">CERTIFICATE OF REGISTRATION</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p>
                    <span className="font-bold text-az-steel">Student Name: </span>
                    {detail.student.lastName}, {detail.student.firstName} {detail.student.middleName ?? ""}
                  </p>
                  <p>
                    <span className="font-bold text-az-steel">Registration Number: </span>
                    {formatStudentNo(detail.student.regNumber)}
                  </p>
                  <p>
                    <span className="font-bold text-az-steel">Level / Section: </span>
                    {detail.student.level ?? ""} {detail.student.section ?? ""}
                  </p>
                  <p>
                    <span className="font-bold text-az-steel">School Year: </span>
                    {detail.student.schoolYear ?? ""}
                  </p>
                  <p>
                    <span className="font-bold text-az-steel">Classification: </span>
                    {detail.student.classification ?? ""}
                  </p>
                  <p>
                    <span className="font-bold text-az-steel">Mode of Payment: </span>
                    {detail.account?.modeOfPayment ?? ""}
                  </p>
                </div>

                {assessment && (
                  <table className="w-full text-xs border-collapse mt-3">
                    <thead>
                      <tr className="bg-az-steel text-white">
                        <th className="border border-[#808080] p-1 text-left">Description of Fees</th>
                        <th className="border border-[#808080] p-1 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Registration Fee", assessment.registrationFee],
                        ["Tuition Fee", assessment.tuitionFee],
                        ["Miscellaneous Fee", assessment.miscellaneousFee],
                        ["Computer Fee", assessment.computerFee],
                        ["Textbooks", assessment.textbooksFee],
                        ["Field Trip", assessment.fieldTripFee],
                        ["School Uniform", assessment.schoolUniformFee],
                        ["PE Uniform", assessment.peUniformFee],
                        ["Others", assessment.othersFee],
                      ]
                        .filter((entry) => Number(entry[1]) > 0)
                        .map(([label, value]) => (
                          <tr key={String(label)}>
                            <td className="border border-[#808080] p-1 text-az-steel">{label}</td>
                            <td className="border border-[#808080] p-1 text-right font-mono">
                              {money(Number(value))}
                            </td>
                          </tr>
                        ))}
                      <tr className="bg-[#ffffd0] font-bold">
                        <td className="border border-[#808080] p-1 text-az-steel ">TOTAL SCHOOL FEES</td>
                        <td className="border border-[#808080] p-1 text-right font-mono">
                          {money(assessment.totalFee)}
                        </td>
                      </tr>
                      {detail.account && (
                        <>
                          <tr>
                            <td className="border border-[#808080] p-1 text-az-steel">Amount Paid</td>
                            <td className="border border-[#808080] p-1 text-right font-mono text-az-teal-deep">
                              {money(detail.account.totalPaymentsMade)}
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-[#808080] p-1 text-az-steel font-bold">Outstanding Balance</td>
                            <td className="border border-[#808080] p-1 text-right font-mono text-red-600 font-bold">
                              {money(detail.account.totalBalance)}
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                )}

                <p className="text-xs mt-3">
                  This certifies that the above-named student is officially enrolled for the stated school year under
                  the payment mode indicated.
                </p>
              </div>
            )}

            <div className="flex justify-end mt-3">
              <button
                className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 text-az-steel font-bold hover:bg-[#d0d0d0]"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </WindowChrome>
      </div>
    </div>
  )
}
