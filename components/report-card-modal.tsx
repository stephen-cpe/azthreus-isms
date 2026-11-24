"use client"

import { money } from "@/lib/money"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useUser } from "@/components/user-context"
import { WindowChrome } from "@/components/window-chrome"
import { BRAND } from "@/lib/branding"
import { openPrintWindow } from "@/lib/print"
import { formatStudentNo } from "@/lib/format-ids"
import type { Lookups, ReportCard, StudentListItem } from "@/lib/types"

interface ReportCardModalProps {
  onClose: () => void
  initialStudentId?: number | null
  onSelectStudent?: (studentId: number) => void
}


export function ReportCardModal({ onClose, initialStudentId, onSelectStudent }: ReportCardModalProps) {
  const user = useUser()
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [studentId, setStudentId] = useState(initialStudentId ? String(initialStudentId) : "")
  const [schoolYearId, setSchoolYearId] = useState("")
  const [report, setReport] = useState<ReportCard | null>(null)
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

    fetch("/api/students")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setStudents((data as { students: StudentListItem[] }).students ?? [])
      })
      .catch(() => setError("Unable to load students"))
  }, [])

  useEffect(() => {
    if (initialStudentId) setStudentId(String(initialStudentId))
  }, [initialStudentId])

  const loadReport = async () => {
    if (!studentId) {
      setError("Select a student first.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ mode: "report-card", studentId })
      if (schoolYearId) params.set("schoolYearId", schoolYearId)
      const response = await fetch(`/api/grades?${params.toString()}`)
      const data = (await response.json().catch(() => null)) as
        | { reportCard?: ReportCard; error?: string }
        | null
      if (!response.ok || !data?.reportCard) {
        setError(data?.error ?? "Failed to build the report card")
        setReport(null)
        return
      }
      setReport(data.reportCard)
    } catch {
      setError("Unable to reach the server")
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    if (!report) {
      toast.error("Load a report card first.")
      return
    }
    openPrintWindow({
      title: "Report Card",
      subtitle: `${report.schoolYear} - ${report.student.level ?? ""}`,
      meta: [
        { label: "Student", value: `${report.student.lastName}, ${report.student.firstName} ${report.student.middleName ?? ""}`.trim() },
        { label: "Registration Number", value: formatStudentNo(report.student.regNumber) },
        { label: "Level / Section", value: `${report.student.level ?? ""} ${report.student.section ?? ""}`.trim() },
        { label: "Adviser", value: report.student.adviser ?? "" },
        { label: "General Average", value: report.generalAverage !== null ? money(report.generalAverage) : "" },
        { label: "Remarks", value: report.remarks ?? "" },
        { label: "Rank", value: report.rank ? `${report.rank} of ${report.classSize}` : "" },
        { label: "Achievement", value: report.honors ?? "" },
      ],
      tables: [
        {
          headers: ["Subject", ...report.periods.map((period) => period.name), "Average", "Remarks"],
          align: ["left", ...report.periods.map(() => "right" as const), "right", "left"],
          rows: [
            ...report.rows.map((row) => [
              row.subjectName,
              ...row.grades.map((grade) => (grade === null ? "" : money(grade))),
              row.subjectAverage !== null ? money(row.subjectAverage) : "",
              row.remarks ?? "",
            ]),
            [
              "GENERAL AVERAGE",
              ...report.periodAverages.map((average) => (average === null ? "" : money(average))),
              report.generalAverage !== null ? money(report.generalAverage) : "",
              report.remarks ?? "",
            ],
          ],
        },
      ],
      footer: "This document is a system-generated report card summary.",
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#f0f0f0] border-2 border-[#808080] w-[980px] max-h-[92vh] overflow-auto shadow-lg">
        <WindowChrome title={`Report Card - ${user.fullName}`} onClose={onClose}>
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <h1 className="text-az-teal-deep text-2xl font-bold">Report Card</h1>
              <span className="text-sm text-az-steel font-bold">Quarter grades</span>
            </div>

            <div className="flex items-end gap-3 border border-[#808080] bg-[#e8e8e8] p-3 mb-3 text-sm">
              <label className="flex-1">
                <span className="font-bold">Student:</span>
                <select
                  className="w-full border border-[#808080] bg-white p-1 mt-1"
                  value={studentId}
                  onChange={(event) => {
                    setStudentId(event.target.value)
                    if (onSelectStudent && event.target.value) onSelectStudent(Number(event.target.value))
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
                onClick={loadReport}
                disabled={loading}
              >
                {loading ? "Loading..." : "View Report Card"}
              </button>
              <button
                className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 font-bold text-az-steel hover:bg-[#d0d0d0]"
                onClick={handlePrint}
              >
                Print
              </button>
            </div>

            {error && <p className="text-red-600 font-bold text-sm mb-2">{error}</p>}

            {report && (
              <div className="border border-[#808080] bg-white p-3">
                <div className="text-center mb-2">
                  <p className="text-az-teal-deep font-bold">{BRAND.schoolName}</p>
                  <p className="text-az-steel font-bold text-sm">Individual Report Card - {report.schoolYear}</p>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs mb-2 border-b border-[#808080] pb-2">
                  <p>
                    <span className="font-bold text-az-steel">Student: </span>
                    {report.student.lastName}, {report.student.firstName} {report.student.middleName ?? ""}
                  </p>
                  <p>
                    <span className="font-bold text-az-steel">Reg No: </span>
                    {formatStudentNo(report.student.regNumber)}
                  </p>
                  <p>
                    <span className="font-bold text-az-steel">Level: </span>
                    {report.student.level ?? ""} {report.student.section ?? ""}
                  </p>
                  <p>
                    <span className="font-bold text-az-steel">Adviser: </span>
                    {report.student.adviser ?? ""}
                  </p>
                </div>

                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-az-steel text-white">
                      <th className="border border-[#808080] p-1 text-left">SUBJECT</th>
                      {report.periods.map((period) => (
                        <th key={period.id} className="border border-[#808080] p-1 text-right">
                          {period.name}
                        </th>
                      ))}
                      <th className="border border-[#808080] p-1 text-right">AVERAGE</th>
                      <th className="border border-[#808080] p-1 text-left">REMARKS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row, index) => (
                      <tr key={row.subjectId} className={index % 2 === 0 ? "bg-white" : "bg-[#f5f5f5]"}>
                        <td className="border border-[#808080] p-1 text-az-steel font-bold">{row.subjectName}</td>
                        {row.grades.map((grade, gradeIndex) => (
                          <td key={gradeIndex} className="border border-[#808080] p-1 text-right font-mono">
                            {grade !== null ? money(grade) : ""}
                          </td>
                        ))}
                        <td className="border border-[#808080] p-1 text-right font-mono font-bold">
                          {row.subjectAverage !== null ? money(row.subjectAverage) : ""}
                        </td>
                        <td
                          className={`border border-[#808080] p-1 font-bold ${
                            row.remarks === "Failed" ? "text-red-600" : "text-az-teal-deep"
                          }`}
                        >
                          {row.remarks ?? ""}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#ffffd0] font-bold">
                      <td className="border border-[#808080] p-1 text-az-steel">GENERAL AVERAGE</td>
                      {report.periodAverages.map((average, index) => (
                        <td key={index} className="border border-[#808080] p-1 text-right font-mono">
                          {average !== null ? money(average) : ""}
                        </td>
                      ))}
                      <td className="border border-[#808080] p-1 text-right font-mono">
                        {report.generalAverage !== null ? money(report.generalAverage) : ""}
                      </td>
                      <td
                        className={`border border-[#808080] p-1 ${
                          report.remarks === "Failed" ? "text-red-600" : "text-az-teal-deep"
                        }`}
                      >
                        {report.remarks ?? ""}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="flex justify-between text-xs mt-2">
                  <p>
                    <span className="font-bold text-az-steel">Rank in Class: </span>
                    {report.rank ? `${report.rank} of ${report.classSize}` : "Not ranked"}
                  </p>
                  <p>
                    <span className="font-bold text-az-steel">Achievement: </span>
                    {report.honors ?? "None"}
                  </p>
                </div>
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
