"use client"

import { useState, useEffect, useMemo } from "react"
import { ArrowRight } from "lucide-react"
import { ModuleIcon } from "@/components/module-icon"
import { formatStudentNo } from "@/lib/format-ids"
import type { Lookups, StudentListItem } from "@/lib/types"

interface InquiryPageProps {
  onBalanceInquiry: () => void
  onSelectStudent: (studentId: number) => void
}

export function InquiryPage({ onBalanceInquiry, onSelectStudent }: InquiryPageProps) {
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [selectedLevel, setSelectedLevel] = useState("")
  const [selectedYear, setSelectedYear] = useState("")
  const [showResults, setShowResults] = useState(false)
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/lookups")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) {
          const typed = data as Lookups
          setLookups(typed)
          const currentYear = typed.schoolYears.find((year) => year.isCurrent)
          if (currentYear) setSelectedYear(String(currentYear.id))
        }
      })
      .catch(() => setError("Unable to reach the server"))
  }, [])

  const levelName = useMemo(
    () => lookups?.levels.find((level) => String(level.id) === selectedLevel)?.name ?? "",
    [lookups, selectedLevel],
  )
  const yearCode = useMemo(
    () => lookups?.schoolYears.find((year) => String(year.id) === selectedYear)?.code ?? "",
    [lookups, selectedYear],
  )

  const fetchStudents = (params: URLSearchParams) => {
    setLoading(true)
    setError(null)
    fetch(`/api/students?${params.toString()}`)
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | { students?: StudentListItem[]; error?: string }
          | null
        if (!response.ok || !data?.students) {
          setError(data?.error ?? "Failed to load students")
          return
        }
        setStudents(data.students)
        setShowResults(true)
      })
      .catch(() => setError("Unable to reach the server"))
      .finally(() => setLoading(false))
  }

  const handleGo = () => {
    if (!selectedLevel || !selectedYear) {
      setError("Please select both a level and a school year.")
      return
    }
    const params = new URLSearchParams({ levelId: selectedLevel, schoolYearId: selectedYear })
    fetchStudents(params)
  }

  const handleViewAll = () => {
    fetchStudents(new URLSearchParams())
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <ModuleIcon name="inquiry" className="w-16 h-16" alt="Inquiry" />
          <h1 className="text-az-teal-deep text-4xl font-bold">Inquiry</h1>
        </div>

        {/* Balance Inquiry shortcut */}
        <div
          className="flex flex-col items-center cursor-pointer hover:bg-[#e0e0e0] p-2 rounded"
          onClick={onBalanceInquiry}
        >
          <ModuleIcon name="inquiry" className="w-12 h-12" alt="Balance Inquiry" />
          <span className="text-az-steel text-xs underline">Balance Inquiry</span>
        </div>
      </div>

      {/* Description */}
      <p className="text-black text-sm mb-4">
        Choose a level and school year, then click Go to list enrolled students. Use View all to see every student.
      </p>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm">Enter Level:</label>
          <select
            className="border border-[#808080] bg-az-teal-light p-1 w-36"
            value={selectedLevel}
            onChange={(event) => setSelectedLevel(event.target.value)}
          >
            <option value=""></option>
            {lookups?.levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm">School Year:</label>
          <select
            className="border border-[#808080] bg-white p-1 w-32"
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
          >
            <option value=""></option>
            {lookups?.schoolYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.code}
              </option>
            ))}
          </select>
        </div>
        <button
          className="flex items-center gap-1 bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 hover:bg-[#d0d0d0] disabled:opacity-60"
          onClick={handleGo}
          disabled={loading}
        >
          <ArrowRight className="w-4 h-4 text-az-teal-deep" />
          <span className="font-bold">Go</span>
        </button>
        <button className="text-az-steel underline hover:text-az-teal-deep" onClick={handleViewAll} disabled={loading}>
          View all...
        </button>
        {loading && <span className="text-sm text-az-steel">Loading...</span>}
        {error && <span className="text-sm text-red-600 font-bold">{error}</span>}
      </div>

      {/* Results Table */}
      {showResults && (
        <div className="border border-[#808080] bg-white">
          {/* Header Row */}
          <div className="grid grid-cols-8 text-xs font-bold bg-az-steel text-white border-b border-[#808080]">
            <div className="p-1 border-r border-az-slate">LAST NAME</div>
            <div className="p-1 border-r border-az-slate">FIRST NAME</div>
            <div className="p-1 border-r border-az-slate">M.I.</div>
            <div className="p-1 border-r border-az-slate">STUDENT NO.</div>
            <div className="p-1 border-r border-az-slate">SECTION</div>
            <div className="p-1 border-r border-az-slate">GENDER</div>
            <div className="p-1 border-r border-az-slate">CLASSIFICATION</div>
            <div className="p-1">REG. NO.</div>
          </div>

          {/* Data Rows */}
          <div className="max-h-64 overflow-y-auto">
            {students.map((student) => (
              <div
                key={student.studentId}
                className={`grid grid-cols-8 text-xs border-b border-[#d0d0d0] hover:bg-az-steel-pale cursor-pointer ${
                  student.studentId % 2 === 0 ? "bg-white" : "bg-[#f5f5f5]"
                }`}
                onClick={() => onSelectStudent(student.studentId)}
              >
                <div className="p-1 text-az-steel border-r border-[#d0d0d0] font-bold underline">{student.lastName}</div>
                <div className="p-1 text-az-teal-deep border-r border-[#d0d0d0]">{student.firstName}</div>
                <div className="p-1 border-r border-[#d0d0d0]">{student.middleName ?? ""}</div>
                <div className="p-1 border-r border-[#d0d0d0]">{student.studNum ?? ""}</div>
                <div className="p-1 border-r border-[#d0d0d0]">{student.section ?? ""}</div>
                <div className="p-1 border-r border-[#d0d0d0]">{student.gender ?? ""}</div>
                <div className="p-1 text-az-teal-deep border-r border-[#d0d0d0]">{student.classif ?? ""}</div>
                <div className="p-1">{formatStudentNo(student.regNum)}</div>
              </div>
            ))}
            {students.length === 0 && <div className="p-3 text-sm text-az-steel">No students found.</div>}
          </div>

          {/* Footer */}
          <div className="bg-az-steel text-white text-xs p-1 flex items-center gap-4">
            <span>Count: {students.length}</span>
            {levelName && <span className="bg-az-teal-deep px-2">{levelName}</span>}
            {yearCode && <span className="bg-az-teal-deep px-2">{yearCode}</span>}
          </div>
        </div>
      )}

      {/* Footer instruction */}
      <p className="text-black text-sm mt-4">Select a student to open their profile.</p>
    </div>
  )
}
