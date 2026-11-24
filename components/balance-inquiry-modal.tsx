"use client"

import { useState, useEffect } from "react"
import { BRAND } from "@/lib/branding"
import { money } from "@/lib/money"
import { formatStudentNo } from "@/lib/format-ids"
import type { StudentListItem } from "@/lib/types"

interface BalanceInquiryModalProps {
  onClose: () => void
  onViewAccounts?: () => void
  onSelectStudent?: (studentId: number) => void
  onViewAssessment?: () => void
}

export function BalanceInquiryModal({ onClose, onViewAccounts, onSelectStudent, onViewAssessment }: BalanceInquiryModalProps) {
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStudents = () => {
    setLoading(true)
    setError(null)
    fetch("/api/students")
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | { students?: StudentListItem[]; error?: string }
          | null
        if (!response.ok || !data?.students) {
          setError(data?.error ?? "Failed to load balances")
          return
        }
        setStudents(data.students)
      })
      .catch(() => setError("Unable to reach the server"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadStudents()
  }, [])

  const term = searchTerm.trim().toLowerCase()
  const filteredStudents = term
    ? students.filter((student) => student.lastName.toLowerCase().includes(term))
    : students

  const handleDisplayAll = () => {
    setSearchTerm("")
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-az-teal-light border-2 border-[#808080] w-[750px] shadow-lg">
        {/* Window Title Bar */}
        <div className="bg-gradient-to-r from-az-steel to-az-teal-deep px-2 py-1 flex items-center justify-between">
          <span className="text-white text-sm">Balance Inquiry</span>
          <button className="text-white hover:bg-red-500 px-2" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Header */}
        <div className="bg-az-teal-light p-2 text-center">
          <p className="text-az-steel font-bold">{BRAND.schoolName}</p>
        </div>

        {/* Content */}
        <div className="flex bg-az-teal-light p-2">
          {/* Left Panel */}
          <div className="w-56 bg-az-teal-light p-2">
            <p className="text-black mb-2">Search by last name, or refresh to load every student.</p>

            <div className="mb-4">
              <label className="font-bold">Last name:</label>
              <input
                type="text"
                className="w-full border border-[#808080] bg-white p-1 mt-1"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <button
                className="w-full bg-[#c0c0c0] border-2 border-[#808080] py-1 font-bold hover:bg-[#d0d0d0]"
                onClick={handleDisplayAll}
              >
                Display All
              </button>
              <button
                className="w-full bg-[#c0c0c0] border-2 border-[#808080] py-1 font-bold text-az-steel hover:bg-[#d0d0d0]"
                onClick={loadStudents}
              >
                Refresh
              </button>
            </div>

            {error && <p className="mt-3 text-xs text-red-700 font-bold">{error}</p>}
          </div>

          {/* Right Panel - Data Grid */}
          <div className="flex-1">
            <div className="bg-az-steel border border-[#808080]">
              {/* Header Row */}
              <div className="grid grid-cols-7 text-white text-xs font-bold border-b border-[#808080]">
                <div className="p-1 border-r border-[#808080]">LAST NAME</div>
                <div className="p-1 border-r border-[#808080]">FIRST NAME</div>
                <div className="p-1 border-r border-[#808080]">SCHOOL YEAR</div>
                <div className="p-1 border-r border-[#808080]">REG. NO.</div>
                <div className="p-1 border-r border-[#808080]">LEVEL</div>
                <div className="p-1 border-r border-[#808080]">SECTION</div>
                <div className="p-1">BALANCE</div>
              </div>

              {/* Data Rows */}
              <div className="bg-black max-h-80 overflow-y-auto">
                {loading && <div className="p-2 text-az-teal-light text-xs">Loading balances...</div>}
                {!loading &&
                  filteredStudents.map((student) => (
                    <div
                      key={student.studentId}
                      className="grid grid-cols-7 text-xs border-b border-[#404040] hover:bg-az-steel cursor-pointer"
                      onClick={() => onSelectStudent?.(student.studentId)}
                    >
                      <div className="p-1 text-az-teal-light border-r border-[#404040]">{student.lastName}</div>
                      <div className="p-1 text-az-teal-light border-r border-[#404040]">{student.firstName}</div>
                      <div className="p-1 text-white border-r border-[#404040]">{student.sy ?? ""}</div>
                      <div className="p-1 text-az-teal-light border-r border-[#404040]">{formatStudentNo(student.regNum)}</div>
                      <div className="p-1 text-az-teal-light border-r border-[#404040]">{student.level ?? ""}</div>
                      <div className="p-1 text-white border-r border-[#404040]">{student.section ?? ""}</div>
                      <div className="p-1 text-az-teal-light text-right">
                        {money(student.balance)}
                      </div>
                    </div>
                  ))}
                {!loading && filteredStudents.length === 0 && (
                  <div className="p-2 text-az-teal-light text-xs">No matching records found.</div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between bg-[#c0c0c0] p-1 border border-[#808080] border-t-0">
              <span className="text-sm font-bold">{filteredStudents.length}</span>
              <button
                className="bg-[#c0c0c0] border border-[#808080] px-4 py-0.5 text-sm"
                onClick={loadStudents}
              >
                Refresh
              </button>
              <button className="text-az-steel underline text-sm" onClick={onViewAccounts}>
                View Accounts
              </button>
            </div>
            <p
              className="text-center text-az-steel underline mt-2 cursor-pointer"
              onClick={onViewAssessment}
            >
              View Assessment
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
