"use client"

import { useState, useEffect } from "react"
import { WindowChrome } from "@/components/window-chrome"
import { formatStudentNo } from "@/lib/format-ids"
import type { StudentListItem } from "@/lib/types"

interface StudentListModalProps {
  onClose: () => void
  onAddStudent: () => void
  onSelectStudent: (studentId: number) => void
}

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

export function StudentListModal({ onClose, onAddStudent, onSelectStudent }: StudentListModalProps) {
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/students")
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | { students?: StudentListItem[]; error?: string }
          | null
        if (!response.ok || !data?.students) {
          setError(data?.error ?? "Failed to load students")
          return
        }
        setStudents(data.students)
      })
      .catch(() => setError("Unable to reach the server"))
      .finally(() => setLoading(false))
  }, [])

  const filteredStudents = selectedLetter
    ? students.filter((student) => student.lastName.toUpperCase().startsWith(selectedLetter))
    : students

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#ffffd0] border-2 border-[#808080] w-[1100px] max-h-[92vh] overflow-auto shadow-lg">
        <WindowChrome title="List of Students" onClose={onClose}>

        {/* Content */}
        <div className="p-4">
          {/* Header */}
          <div className="bg-[#ffffd0] border border-[#808080] p-2 mb-2 flex items-center justify-between">
            <p className="font-bold text-red-600">Students: {filteredStudents.length}</p>
            {loading && <p className="text-sm text-az-steel">Loading students...</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {/* Table */}
          <div className="border border-[#808080] max-h-96 overflow-y-auto bg-white">
            <table className="w-full text-xs">
              <thead className="bg-[#ffffd0] sticky top-0">
                <tr>
                  <th className="border-r border-[#808080] p-1 text-left font-bold">Last Name</th>
                  <th className="border-r border-[#808080] p-1 text-left">First Name</th>
                  <th className="border-r border-[#808080] p-1 text-left">Student No.</th>
                  <th className="border-r border-[#808080] p-1 text-left">Reg. No.</th>
                  <th className="border-r border-[#808080] p-1 text-left">Level</th>
                  <th className="border-r border-[#808080] p-1 text-left">School Year</th>
                  <th className="border-r border-[#808080] p-1 text-left">Enrolled</th>
                  <th className="border-r border-[#808080] p-1 text-left">Classification</th>
                  <th className="border-r border-[#808080] p-1 text-left">Telephone</th>
                  <th className="border-r border-[#808080] p-1 text-left">Mobile</th>
                  <th className="p-1 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr
                    key={student.studentId}
                    className={`cursor-pointer hover:bg-az-steel-pale ${
                      student.studentId % 2 === 0 ? "bg-white" : "bg-[#ffffd0]"
                    }`}
                    onClick={() => onSelectStudent(student.studentId)}
                  >
                    <td className="border-r border-[#d0d0d0] p-1 font-bold underline text-az-steel">{student.lastName}</td>
                    <td className="border-r border-[#d0d0d0] p-1 text-az-steel">{student.firstName}</td>
                    <td className="border-r border-[#d0d0d0] p-1">{student.studNum ?? ""}</td>
                    <td className="border-r border-[#d0d0d0] p-1">{formatStudentNo(student.regNum)}</td>
                    <td className="border-r border-[#d0d0d0] p-1">{student.level ?? ""}</td>
                    <td className="border-r border-[#d0d0d0] p-1">{student.sy ?? ""}</td>
                    <td className="border-r border-[#d0d0d0] p-1">{student.enrolled ?? ""}</td>
                    <td className="border-r border-[#d0d0d0] p-1">{student.classif ?? ""}</td>
                    <td className="border-r border-[#d0d0d0] p-1">{student.telNum ?? ""}</td>
                    <td className="border-r border-[#d0d0d0] p-1">{student.celNum ?? ""}</td>
                    <td className="p-1">{student.status ?? ""}</td>
                  </tr>
                ))}
                {!loading && filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-4 text-center text-az-steel">
                      No students found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer with Alphabet Filter */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {alphabet.map((letter) => (
                <button
                  key={letter}
                  onClick={() => setSelectedLetter(selectedLetter === letter ? null : letter)}
                  className={`w-6 h-6 text-xs font-bold border border-[#808080] ${
                    selectedLetter === letter ? "bg-az-steel text-white" : "bg-[#c0c0c0] hover:bg-[#d0d0d0]"
                  }`}
                >
                  {letter}
                </button>
              ))}
              <button
                onClick={() => setSelectedLetter(null)}
                className="px-2 h-6 text-xs border border-[#808080] bg-[#c0c0c0] hover:bg-[#d0d0d0]"
              >
                All
              </button>
            </div>

            <div className="flex gap-2">
              <button
                className="bg-[#c0c0c0] border-2 border-[#808080] px-3 py-1 text-sm hover:bg-[#d0d0d0]"
                onClick={onAddStudent}
              >
                Add Student
              </button>
              <button
                className="bg-[#c0c0c0] border-2 border-[#808080] px-3 py-1 text-sm text-az-steel hover:bg-[#d0d0d0]"
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
