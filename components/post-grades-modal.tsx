"use client"

import { money } from "@/lib/money"
import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { useUser } from "@/components/user-context"
import { WindowChrome } from "@/components/window-chrome"
import { gradeRemarks } from "@/lib/grades"
import { canWrite } from "@/lib/roles"
import type { GradeGridRow, Lookups, RankingRow } from "@/lib/types"

interface PostGradesModalProps {
  onClose: () => void
  initialCategory?: "kindergarten" | "elementary" | "junior_high" | "senior_high" | null
}


export function PostGradesModal({ onClose, initialCategory }: PostGradesModalProps) {
  const user = useUser()
  const canEdit = canWrite(user.role, "grades")

  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [schoolYearId, setSchoolYearId] = useState("")
  const [levelId, setLevelId] = useState("")
  const [sectionId, setSectionId] = useState("")
  const [subjectId, setSubjectId] = useState("")
  const [gradePeriodId, setGradePeriodId] = useState("")
  const [rows, setRows] = useState<GradeGridRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState("Select a school year, level, subject, and grading period, then click Load Class.")

  const [classAverages, setClassAverages] = useState<{ rank: number; name: string; average: number }[]>([])

  useEffect(() => {
    fetch("/api/lookups")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return
        const typed = data as Lookups
        setLookups(typed)
        const currentYear = typed.schoolYears.find((year) => year.isCurrent) ?? typed.schoolYears[0]
        if (currentYear) setSchoolYearId(String(currentYear.id))
        if (initialCategory) {
          const match = typed.levels.find((level) => level.category === initialCategory)
          if (match) setLevelId(String(match.id))
        }
      })
      .catch(() => toast.error("Unable to load lookup data."))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const levels = useMemo(() => lookups?.levels ?? [], [lookups])

  const selectedLevel = useMemo(
    () => lookups?.levels.find((level) => String(level.id) === levelId) ?? null,
    [lookups, levelId],
  )

  const subjects = useMemo(() => {
    if (!lookups || !selectedLevel) return []
    return lookups.subjects.filter(
      (subject) => subject.category === null || subject.category === selectedLevel.category,
    )
  }, [lookups, selectedLevel])

  const sections = useMemo(() => {
    if (!lookups || !levelId || !schoolYearId) return []
    return lookups.sections.filter(
      (section) => String(section.levelId) === levelId && String(section.schoolYearId) === schoolYearId,
    )
  }, [lookups, levelId, schoolYearId])

  const periods = useMemo(() => {
    if (!lookups || !schoolYearId) return []
    return lookups.gradePeriods.filter((period) => String(period.schoolYearId) === schoolYearId)
  }, [lookups, schoolYearId])

  useEffect(() => {
    setSubjectId("")
    setSectionId("")
    setRows([])
    setDirty(false)
  }, [levelId, schoolYearId])

  useEffect(() => {
    if (!subjectId && subjects.length > 0) setSubjectId(String(subjects[0].id))
  }, [subjects, subjectId])

  useEffect(() => {
    if (!gradePeriodId && periods.length > 0) setGradePeriodId(String(periods[0].id))
    if (gradePeriodId && periods.length > 0 && !periods.some((period) => String(period.id) === gradePeriodId)) {
      setGradePeriodId(String(periods[0].id))
    }
  }, [periods, gradePeriodId])

  const loadClass = async () => {
    if (!levelId || !schoolYearId || !subjectId || !gradePeriodId) {
      setMessage("Select a school year, level, subject, and grading period first.")
      return
    }
    setLoading(true)
    setDirty(false)
    try {
      const params = new URLSearchParams({ subjectId, gradePeriodId, levelId, schoolYearId })
      if (sectionId) params.set("sectionId", sectionId)
      const response = await fetch(`/api/grades?${params.toString()}`)
      const data = (await response.json().catch(() => null)) as
        | { rows?: GradeGridRow[]; error?: string }
        | null
      if (!response.ok || !data?.rows) {
        setMessage(data?.error ?? "Failed to load the class list.")
        return
      }
      setRows(data.rows)
      setMessage(
        data.rows.length > 0
          ? `Loaded ${data.rows.length} student(s). Enter grades then click Save Grades.`
          : "No enrolled students found for this level/section.",
      )
      await loadAverages()
    } catch {
      setMessage("Unable to reach the server.")
    } finally {
      setLoading(false)
    }
  }

  const loadAverages = async () => {
    if (!levelId || !schoolYearId) return
    const params = new URLSearchParams({ mode: "ranking", levelId, schoolYearId })
    if (sectionId) params.set("sectionId", sectionId)
    if (gradePeriodId) params.set("gradePeriodId", gradePeriodId)
    const response = await fetch(`/api/grades?${params.toString()}`)
    if (!response.ok) return
    const data = (await response.json().catch(() => null)) as { rows?: RankingRow[] } | null
    if (!data?.rows) return
    setClassAverages(
      data.rows
        .filter((row) => row.average !== null)
        .slice(0, 5)
        .map((row) => ({
          rank: row.rank,
          name: `${row.lastName}, ${row.firstName}`,
          average: row.average as number,
        })),
    )
  }

  const updateRow = (studentId: number, value: string) => {
    setDirty(true)
    setRows((previous) =>
      previous.map((row) =>
        row.studentId === studentId ? { ...row, numericGrade: value === "" ? null : Number(value) } : row,
      ),
    )
  }

  const saveGrades = async () => {
    if (!canEdit) {
      toast.error("Your role cannot post grades.")
      return
    }
    const invalid = rows.find(
      (row) => row.numericGrade !== null && (!Number.isFinite(row.numericGrade) || row.numericGrade < 0 || row.numericGrade > 100),
    )
    if (invalid) {
      toast.error(`Invalid grade for ${invalid.lastName}, ${invalid.firstName}. Use 0-100.`)
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/grades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grades: rows.map((row) => ({
            studentId: row.studentId,
            subjectId: Number(subjectId),
            gradePeriodId: Number(gradePeriodId),
            numericGrade: row.numericGrade,
          })),
        }),
      })
      const data = (await response.json().catch(() => null)) as { saved?: number; error?: string } | null
      if (!response.ok || data?.saved === undefined) {
        toast.error(data?.error ?? "Failed to save grades.")
        return
      }
      toast.success(`Saved grades for ${data.saved} student(s).`)
      setDirty(false)
      await loadClass()
    } catch {
      toast.error("Unable to reach the server.")
    } finally {
      setSaving(false)
    }
  }

  const periodName = periods.find((period) => String(period.id) === gradePeriodId)?.name ?? ""
  const levelName = selectedLevel?.name ?? ""

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#f0f0f0] border-2 border-[#808080] w-[1080px] max-h-[92vh] overflow-auto shadow-lg">
        <WindowChrome title={`Post Grades - ${user.fullName}`} onClose={onClose}>
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h1 className="text-az-teal-deep text-2xl font-bold">Post Grades</h1>
                <p className="text-az-steel text-sm font-bold">Quarter Grade Entry</p>
              </div>
              {!canEdit && (
                <span className="text-red-600 font-bold text-sm">Read-only for {user.role}</span>
              )}
            </div>

            {/* Filters */}
            <div className="border border-[#808080] bg-[#e8e8e8] p-3 mb-3 grid grid-cols-5 gap-2 text-sm">
              <label className="block">
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
              <label className="block">
                <span className="font-bold">Level:</span>
                <select
                  className="w-full border border-[#808080] bg-white p-1 mt-1"
                  value={levelId}
                  onChange={(event) => setLevelId(event.target.value)}
                >
                  <option value="">Select level...</option>
                  {levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="font-bold">Section:</span>
                <select
                  className="w-full border border-[#808080] bg-white p-1 mt-1"
                  value={sectionId}
                  onChange={(event) => setSectionId(event.target.value)}
                >
                  <option value="">All sections</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="font-bold">Subject:</span>
                <select
                  className="w-full border border-[#808080] bg-white p-1 mt-1"
                  value={subjectId}
                  onChange={(event) => setSubjectId(event.target.value)}
                >
                  <option value="">Select subject...</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="font-bold">Grading Period:</span>
                <select
                  className="w-full border border-[#808080] bg-white p-1 mt-1"
                  value={gradePeriodId}
                  onChange={(event) => setGradePeriodId(event.target.value)}
                >
                  {periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <button
                className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 font-bold hover:bg-[#d0d0d0] disabled:opacity-60"
                onClick={loadClass}
                disabled={loading}
              >
                {loading ? "Loading..." : "Load Class"}
              </button>
              <button
                className="bg-az-teal-deep text-white border-2 border-[#808080] px-4 py-1 font-bold hover:bg-az-steel disabled:opacity-60"
                onClick={saveGrades}
                disabled={saving || !canEdit || rows.length === 0 || !dirty}
              >
                {saving ? "Saving..." : "Save Grades"}
              </button>
              <span className="text-sm text-az-steel">{message}</span>
            </div>

            {/* Class grid */}
            <div className="border border-[#808080] bg-white max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-az-steel text-white sticky top-0">
                  <tr>
                    <th className="p-1 text-left border-r border-az-slate">#</th>
                    <th className="p-1 text-left border-r border-az-slate">Last Name</th>
                    <th className="p-1 text-left border-r border-az-slate">First Name</th>
                    <th className="p-1 text-left border-r border-az-slate">{periodName || "Quarter Grade"}</th>
                    <th className="p-1 text-left border-r border-az-slate">Remarks</th>
                    <th className="p-1 text-left">Posted By</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.studentId} className={index % 2 === 0 ? "bg-white" : "bg-[#f5f5f5]"}>
                      <td className="p-1 border-r border-[#d0d0d0]">{index + 1}</td>
                      <td className="p-1 border-r border-[#d0d0d0] font-bold text-az-steel">{row.lastName}</td>
                      <td className="p-1 border-r border-[#d0d0d0]">{row.firstName}</td>
                      <td className="p-1 border-r border-[#d0d0d0]">
                        {canEdit ? (
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={row.numericGrade ?? ""}
                            onChange={(event) => updateRow(row.studentId, event.target.value)}
                            className="w-20 border border-[#808080] bg-[#ffffd0] p-0.5 text-right"
                          />
                        ) : (
                          <span className="font-mono">{row.numericGrade !== null ? money(row.numericGrade) : ""}</span>
                        )}
                      </td>
                      <td className="p-1 border-r border-[#d0d0d0]">
                        {row.numericGrade === null ? (
                          ""
                        ) : row.numericGrade >= 75 ? (
                          <span className="text-az-teal-deep font-bold">{gradeRemarks(row.numericGrade)}</span>
                        ) : (
                          <span className="text-red-600 font-bold">{gradeRemarks(row.numericGrade)}</span>
                        )}
                      </td>
                      <td className="p-1">{row.postedBy ?? ""}</td>
                    </tr>
                  ))}
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-az-steel">
                        No class loaded. Select the filters above and click Load Class.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Class top averages */}
            <div className="mt-3 border border-[#808080] bg-[#ffffd0] p-2 text-xs">
              <p className="font-bold text-az-steel">
                Top 5 - {levelName} {sectionId ? sections.find((s) => String(s.id) === sectionId)?.name : ""} ({periodName || "All Periods"})
              </p>
              {classAverages.length === 0 ? (
                <p className="text-black">Load a class to view top averages.</p>
              ) : (
                <div className="flex gap-6 mt-1">
                  {classAverages.map((entry) => (
                    <span key={`${entry.rank}-${entry.name}`} className="text-black">
                      <span className="font-bold text-az-teal-deep">#{entry.rank}</span> {entry.name}{" "}
                      <span className="font-mono">{money(entry.average)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

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
