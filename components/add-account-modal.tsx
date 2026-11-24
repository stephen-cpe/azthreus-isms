"use client"

import { money } from "@/lib/money"
import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { useUser } from "@/components/user-context"
import { WindowChrome } from "@/components/window-chrome"
import { formatAccountNo, formatStudentNo } from "@/lib/format-ids"
import type { Assessment, Lookups, StudentListItem } from "@/lib/types"

interface AddAccountModalProps {
  onClose: () => void
}


export function AddAccountModal({ onClose }: AddAccountModalProps) {
  const user = useUser()
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [schoolYearId, setSchoolYearId] = useState("")
  const [paymentModeId, setPaymentModeId] = useState("")
  const [discount, setDiscount] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/lookups").then((response) => (response.ok ? response.json() : null)),
      fetch("/api/assessments").then((response) => (response.ok ? response.json() : null)),
      fetch("/api/students?hasAccount=no").then((response) => (response.ok ? response.json() : null)),
    ])
      .then(([lookupData, assessmentData, studentData]) => {
        if (lookupData) {
          const typed = lookupData as Lookups
          setLookups(typed)
          const currentYear = typed.schoolYears.find((year) => year.isCurrent)
          const monthly = typed.paymentModes.find((mode) => mode.name === "Monthly")
          if (currentYear) setSchoolYearId(String(currentYear.id))
          if (monthly) setPaymentModeId(String(monthly.id))
        }
        if (assessmentData) setAssessments((assessmentData as { assessments: Assessment[] }).assessments ?? [])
        if (studentData) setStudents((studentData as { students: StudentListItem[] }).students ?? [])
      })
      .catch(() => toast.error("Unable to load data. Check your database connection."))
  }, [])

  const selectedStudent = students.find((student) => String(student.studentId) === selectedStudentId)

  useEffect(() => {
    if (selectedStudent?.schoolYearId) {
      setSchoolYearId(String(selectedStudent.schoolYearId))
    }
  }, [selectedStudent?.studentId])

  const assessment = useMemo(() => {
    if (!selectedStudent?.levelId || !schoolYearId) return null
    return (
      assessments.find(
        (item) => item.levelId === selectedStudent.levelId && String(item.schoolYearId) === schoolYearId,
      ) ?? null
    )
  }, [assessments, selectedStudent?.levelId, schoolYearId])

  const modeName = lookups?.paymentModes.find((mode) => String(mode.id) === paymentModeId)?.name ?? "Monthly"
  const initialPayment = assessment
    ? modeName === "Quarterly"
      ? assessment.uponEnrollmentQuarterly
      : modeName === "Semi-Annual"
        ? assessment.uponEnrollmentSemiAnnual
        : modeName === "Cash/Annual"
          ? assessment.totalFee
          : assessment.uponEnrollmentMonthly
    : 0
  const discountValue = Number(discount.replace(/,/g, "")) || 0
  const balance = assessment ? Math.max(assessment.totalFee - discountValue, 0) : 0

  const handleSubmit = async () => {
    if (!selectedStudentId) {
      toast.error("Please select a student.")
      return
    }
    if (discount.trim() !== "" && !Number.isFinite(Number(discount.replace(/,/g, "")))) {
      toast.error("Discount must be a number.")
      return
    }
    if (discountValue < 0) {
      toast.error("Discount cannot be negative.")
      return
    }
    if (assessment && discountValue > assessment.totalFee) {
      toast.error("Discount cannot exceed the total school fees.")
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: Number(selectedStudentId),
          schoolYearId: Number(schoolYearId),
          paymentModeId: Number(paymentModeId),
          discount: discountValue,
        }),
      })
      const data = (await response.json().catch(() => null)) as
        | { account?: { accountId: number }; error?: string }
        | null

      if (!response.ok || !data?.account) {
        toast.error(data?.error ?? "Failed to create the account.")
        return
      }
      toast.success(
        `Account ${formatAccountNo(data.account.accountId)} created for ${selectedStudent?.lastName}, ${selectedStudent?.firstName}.`,
      )
      onClose()
    } catch {
      toast.error("Unable to reach the server.")
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full border border-[#808080] bg-az-teal-light p-1 mt-1"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#f0f0f0] border-2 border-[#808080] w-[520px] max-h-[92vh] overflow-auto shadow-lg">
        <WindowChrome title="Add Account" onClose={onClose}>

        {/* Content */}
        <div className="p-4">
          {/* Signed-in user */}
          <div className="mb-4">
            <span className="font-bold">Signed in:</span>
            <span className="ml-2">{user.fullName}</span>
          </div>

          {/* Student Selection */}
          <div className="bg-az-slate text-white p-2 mb-4">
            <label className="font-bold">
              Student:
            </label>
          </div>
          <select
            className="w-full border border-[#808080] bg-white p-2 mb-2"
            value={selectedStudentId}
            onChange={(event) => setSelectedStudentId(event.target.value)}
          >
            <option value="">Select a student...</option>
            {students.map((student) => (
              <option key={student.studentId} value={student.studentId}>
                {student.lastName}, {student.firstName} ({student.level} - {student.sy})
              </option>
            ))}
          </select>

          {students.length === 0 && (
            <p className="text-sm text-az-steel mb-4">
              No student is waiting for a current-year account. Enrollment and re-enrollment create the account
              automatically; use this window only when a student&apos;s current-year account is missing.
            </p>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-bold">
                <u>A</u>ccount Number:
              </label>
              <input type="text" readOnly value={formatStudentNo(selectedStudent?.regNum)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-bold">Total School Fees:</label>
              <input type="text" readOnly value={assessment ? money(assessment.totalFee) : ""} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-bold">Student Number:</label>
              <input
                type="text"
                readOnly
                value={selectedStudent?.studNum ?? formatStudentNo(selectedStudent?.regNum)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-sm font-bold">School Year:</label>
              <select
                className="w-full border border-[#808080] bg-[#e8e8e8] p-1 mt-1 text-[#606060]"
                value={schoolYearId}
                disabled
              >
                <option value=""></option>
                {lookups?.schoolYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold">Reg. Number:</label>
              <input type="text" readOnly value={formatStudentNo(selectedStudent?.regNum)} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-bold">Level:</label>
              <input type="text" readOnly value={selectedStudent?.level ?? ""} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-bold">Account ID:</label>
              <input type="text" readOnly value="(New)" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-bold">Mode of Payment:</label>
              <select
                className="w-full border border-[#808080] bg-white p-1 mt-1"
                value={paymentModeId}
                onChange={(event) => setPaymentModeId(event.target.value)}
              >
                <option value=""></option>
                {lookups?.paymentModes.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold">Upon Enrolment:</label>
              <input type="text" readOnly value={assessment ? money(initialPayment) : ""} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-bold">Discount:</label>
              <input
                type="text"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                className={inputClass}
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-bold">Initial Balance:</label>
              <input type="text" readOnly value={assessment ? money(balance) : ""} className={inputClass} />
            </div>
          </div>

          {selectedStudent && !assessment && (
            <p className="text-sm text-red-600 font-bold mb-4">
              No assessment is configured for this student's level and school year.
            </p>
          )}

          <p className="text-sm mb-4">An account will be created using the level assessment and selected payment plan.</p>
          <p className="text-xs text-black mb-4">
            Accounts are created for the student&apos;s current school year. Use Re-enrollment to move a student to a
            different year.
          </p>

          {/* Buttons */}
          <div className="flex gap-2 justify-end">
            <button
              className="bg-az-teal-light border-2 border-[#808080] px-4 py-1 text-sm hover:bg-az-teal disabled:opacity-60"
              onClick={handleSubmit}
              disabled={saving || !selectedStudentId || !assessment}
            >
              {saving ? "Creating..." : "Add Record"}
            </button>
            <button
              className="bg-az-sand border-2 border-[#808080] px-4 py-1 text-sm hover:bg-az-terra"
              onClick={onClose}
            >
              CLOSE
            </button>
          </div>
        </div>
        </WindowChrome>
      </div>
    </div>
  )
}
