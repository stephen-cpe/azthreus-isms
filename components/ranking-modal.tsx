"use client"

import { money } from "@/lib/money"
import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { useUser } from "@/components/user-context"
import { WindowChrome } from "@/components/window-chrome"
import { openPrintWindow } from "@/lib/print"
import type { Lookups, RankingReport } from "@/lib/types"

interface RankingModalProps {
  onClose: () => void
  onSelectStudent?: (studentId: number) => void
}


export function RankingModal({ onClose, onSelectStudent }: RankingModalProps) {
  const user = useUser()
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [schoolYearId, setSchoolYearId] = useState("")
  const [levelId, setLevelId] = useState("")
  const [sectionId, setSectionId] = useState("")
  const [gradePeriodId, setGradePeriodId] = useState("")
  const [report, setReport] = useState<RankingReport | null>(null)
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
      .catch(() => setError("Unable to load lookup data"))
  }, [])

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
    setSectionId("")
  }, [levelId])

  const loadRanking = async () => {
    if (!levelId || !schoolYearId) {
      setError("Select a school year and level.")
      return
    }
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ mode: "ranking", levelId, schoolYearId })
    if (sectionId) params.set("sectionId", sectionId)
    if (gradePeriodId) params.set("gradePeriodId", gradePeriodId)

    try {
      const response = await fetch(`/api/grades?${params.toString()}`)
      const data = (await response.json().catch(() => null)) as (RankingReport & { error?: string }) | null
      if (!response.ok || !data) {
        setError(data?.error ?? "Failed to generate the ranking")
        return
      }
      setReport(data)
    } catch {
      setError("Unable to reach the server")
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    if (!report) {
      toast.error("Generate a ranking first.")
      return
    }
    openPrintWindow({
      title: "Honors & Class Ranking",
      subtitle: `${report.schoolYear} - ${report.level ?? ""} ${report.section ?? ""}`.trim(),
      meta: [{ label: "Grading Period", value: report.period?.name ?? "All Periods (General Average)" }],
      tables: [
        {
          headers: ["Rank", "Last Name", "First Name", "Level", "Section", "Average", "Remarks", "Achievement"],
          align: ["right", "left", "left", "left", "left", "right", "left", "left"],
          rows: report.rows.map((row) => [
            String(row.rank),
            row.lastName,
            row.firstName,
            row.level ?? "",
            row.section ?? "",
            row.average !== null ? money(row.average) : "",
            row.remarks ?? "",
            row.honors ?? "",
          ]),
        },
      ],
      footer: "Ranking is computed from posted quarter grades, highest average first.",
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#f0f0f0] border-2 border-[#808080] w-[980px] max-h-[92vh] overflow-auto shadow-lg">
        <WindowChrome title={`Honors & Class Ranking - ${user.fullName}`} onClose={onClose}>
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <h1 className="text-az-teal-deep text-2xl font-bold">Honors &amp; Class Ranking</h1>
              <span className="text-sm text-az-steel font-bold">Ranked from posted quarter grades</span>
            </div>

            <div className="flex items-end gap-3 border border-[#808080] bg-[#e8e8e8] p-3 mb-3 text-sm">
              <label className="w-36">
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
              <label className="w-36">
                <span className="font-bold">Level:</span>
                <select
                  className="w-full border border-[#808080] bg-white p-1 mt-1"
                  value={levelId}
                  onChange={(event) => setLevelId(event.target.value)}
                >
                  <option value="">Select level...</option>
                  {lookups?.levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="w-40">
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
              <label className="w-44">
                <span className="font-bold">Grading Period:</span>
                <select
                  className="w-full border border-[#808080] bg-white p-1 mt-1"
                  value={gradePeriodId}
                  onChange={(event) => setGradePeriodId(event.target.value)}
                >
                  <option value="">All Periods (General Average)</option>
                  {periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 font-bold hover:bg-[#d0d0d0] disabled:opacity-60"
                onClick={loadRanking}
                disabled={loading}
              >
                {loading ? "Loading..." : "Generate Ranking"}
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
              <div className="border border-[#808080] bg-white max-h-96 overflow-y-auto">
                <div className="bg-az-steel text-white text-xs p-1 flex justify-between">
                  <span>
                    {report.level} {report.section ?? ""} - {report.period?.name ?? "General Average"}
                  </span>
                  <span>{report.rows.length} student(s)</span>
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-[#ffffd0] sticky top-0">
                    <tr>
                      <th className="p-1 text-right border-r border-[#808080]">Rank</th>
                      <th className="p-1 text-left border-r border-[#808080]">Last Name</th>
                      <th className="p-1 text-left border-r border-[#808080]">First Name</th>
                      <th className="p-1 text-left border-r border-[#808080]">Section</th>
                      <th className="p-1 text-right border-r border-[#808080]">Average</th>
                      <th className="p-1 text-left border-r border-[#808080]">Remarks</th>
                      <th className="p-1 text-left">Achievement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr
                        key={row.studentId}
                        className={`border-b border-[#d0d0d0] cursor-pointer hover:bg-az-steel-pale ${
                          row.rank <= 3 ? "bg-[#ffffd0]" : row.rank % 2 === 0 ? "bg-white" : "bg-[#f5f5f5]"
                        }`}
                        onClick={() => onSelectStudent?.(row.studentId)}
                      >
                        <td className="p-1 text-right font-bold text-az-teal-deep">{row.rank}</td>
                        <td className="p-1 font-bold text-az-steel">{row.lastName}</td>
                        <td className="p-1">{row.firstName}</td>
                        <td className="p-1">{row.section ?? ""}</td>
                        <td className="p-1 text-right font-mono">
                          {row.average !== null ? money(row.average) : ""}
                        </td>
                        <td className={`p-1 font-bold ${row.remarks === "Failed" ? "text-red-600" : "text-az-teal-deep"}`}>
                          {row.remarks ?? ""}
                        </td>
                        <td className="p-1 text-az-steel font-bold">{row.honors ?? ""}</td>
                      </tr>
                    ))}
                    {report.rows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-az-steel">
                          No grades posted for this selection.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-black mt-2">
              Click a row to open the student&apos;s profile. Honors: 90-94 With Honors, 95-97 With High Honors, 98+
              With Highest Honors.
            </p>

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
