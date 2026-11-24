"use client"

import { money } from "@/lib/money"
import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { useUser } from "@/components/user-context"
import { WindowChrome } from "@/components/window-chrome"
import { canWrite } from "@/lib/roles"
import type { Assessment, Lookups } from "@/lib/types"

interface AssessmentModalProps {
  onClose: () => void
}


const toNumber = (value: string) => {
  const parsed = Number(value.replace(/,/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

const round2 = (value: number) => Math.round(value * 100) / 100

interface FeeFields {
  registrationFee: string
  tuitionFee: string
  miscellaneousFee: string
  textbooksFee: string
  computerFee: string
  fieldTripFee: string
  schoolUniformFee: string
  peUniformFee: string
  othersFee: string
}

const emptyFees: FeeFields = {
  registrationFee: "",
  tuitionFee: "",
  miscellaneousFee: "",
  textbooksFee: "",
  computerFee: "",
  fieldTripFee: "",
  schoolUniformFee: "",
  peUniformFee: "",
  othersFee: "",
}

const feesFromAssessment = (assessment: Assessment): FeeFields => ({
  registrationFee: String(assessment.registrationFee),
  tuitionFee: String(assessment.tuitionFee),
  miscellaneousFee: String(assessment.miscellaneousFee),
  textbooksFee: String(assessment.textbooksFee),
  computerFee: String(assessment.computerFee),
  fieldTripFee: String(assessment.fieldTripFee),
  schoolUniformFee: String(assessment.schoolUniformFee),
  peUniformFee: String(assessment.peUniformFee),
  othersFee: String(assessment.othersFee),
})

export function AssessmentModal({ onClose }: AssessmentModalProps) {
  const user = useUser()
  const canEdit = canWrite(user.role, "assessments")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [levelId, setLevelId] = useState("")
  const [schoolYearId, setSchoolYearId] = useState("")
  const [fees, setFees] = useState<FeeFields>(emptyFees)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    Promise.all([
      fetch("/api/lookups").then((response) => (response.ok ? response.json() : null)),
      fetch("/api/assessments").then((response) => (response.ok ? response.json() : null)),
    ])
      .then(([lookupData, assessmentData]) => {
        if (lookupData) {
          const typed = lookupData as Lookups
          setLookups(typed)
          const currentYear = typed.schoolYears.find((year) => year.isCurrent)
          const firstLevel = typed.levels[0]
          if (currentYear) setSchoolYearId(String(currentYear.id))
          if (firstLevel) setLevelId(String(firstLevel.id))
        }
        if (assessmentData) setAssessments((assessmentData as { assessments: Assessment[] }).assessments ?? [])
      })
      .catch(() => toast.error("Unable to load assessments. Check your database connection."))
  }, [])

  const assessment = useMemo(
    () =>
      assessments.find(
        (item) => String(item.levelId) === levelId && String(item.schoolYearId) === schoolYearId,
      ) ?? null,
    [assessments, levelId, schoolYearId],
  )

  useEffect(() => {
    setFees(assessment ? feesFromAssessment(assessment) : emptyFees)
  }, [assessment?.id])

  const total = useMemo(
    () => round2(Object.values(fees).reduce((sum, value) => sum + toNumber(value), 0)),
    [fees],
  )

  const uponMonthly = round2(total * 0.2)
  const payableMonthly = round2(total * 0.08)
  const uponQuarterly = round2(total * 0.3)
  const payableQuarterly = round2(total * 0.175)
  const uponSemiAnnual = round2(total * 0.5)
  const payableSemiAnnual = round2(total * 0.25)

  const hasData = assessment !== null
  const dirty =
    assessment !== null &&
    (Object.keys(fees) as (keyof FeeFields)[]).some(
      (key) => toNumber(fees[key]) !== assessment[key],
    )

  const handleUpdate = async () => {
    if (!levelId || !schoolYearId) {
      toast.error("Select a level and school year.")
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/assessments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          levelId: Number(levelId),
          schoolYearId: Number(schoolYearId),
          ...fees,
        }),
      })
      const data = (await response.json().catch(() => null)) as
        | { assessment?: Assessment; error?: string }
        | null

      if (!response.ok || !data?.assessment) {
        toast.error(data?.error ?? "Failed to save the assessment.")
        return
      }

      setAssessments((prev) => {
        const others = prev.filter((item) => item.id !== data.assessment!.id)
        return [...others, data.assessment!]
      })
      toast.success(`Assessment saved for ${data.assessment.levelName} (${data.assessment.schoolYearCode}).`)
    } catch {
      toast.error("Unable to reach the server.")
    } finally {
      setSaving(false)
    }
  }

  const feeRow = (label: string, key: keyof FeeFields, highlight = false) => (
    <p className="flex justify-between">
      <span className={highlight ? "text-az-steel" : ""}>{label}:</span>
      <input
        type="text"
        value={fees[key]}
        onChange={(event) => setFees((prev) => ({ ...prev, [key]: event.target.value }))}
        readOnly={!canEdit}
        className={`w-24 border border-[#808080] text-right p-0.5 ${
          canEdit ? "bg-[#ffffd0]" : "bg-[#e8e8e8]"
        }`}
      />
    </p>
  )

  const formatHeaderDate = (date: Date) =>
    date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "2-digit" })

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#f0f0f0] border-2 border-[#808080] w-[560px] max-h-[95vh] overflow-y-auto shadow-lg">
        <div className="sticky top-0 z-10">
          <WindowChrome title="Assessment" onClose={onClose}>

        {/* Content */}
        <div className="p-4">
          {/* Header Info */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm">
              <p className="flex items-center gap-2">
                <span className="font-bold">Assessment ID:</span>
                <span className="border border-[#808080] bg-[#e8e8e8] px-2">{assessment?.id ?? "(New)"}</span>
              </p>
              <p className="flex items-center gap-2 mt-1">
                <span className="font-bold">School Year:</span>
                <select
                  className="border border-[#808080] bg-white p-0.5"
                  value={schoolYearId}
                  onChange={(event) => setSchoolYearId(event.target.value)}
                >
                  <option value=""></option>
                  {lookups?.schoolYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.code}
                    </option>
                  ))}
                </select>
              </p>
              <p className="flex items-center gap-2 mt-1">
                <span className="font-bold">Level:</span>
                <select
                  className="border border-[#808080] bg-white p-0.5"
                  value={levelId}
                  onChange={(event) => setLevelId(event.target.value)}
                >
                  <option value=""></option>
                  {lookups?.levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </p>
            </div>
            <div className="text-right text-xs text-az-teal-deep">
              <p>{formatHeaderDate(currentTime)}</p>
              <p>{formatTime(currentTime)}</p>
              {!canEdit && <p className="text-red-600 font-bold">Read-only for {user.role}</p>}
            </div>
          </div>

          {!hasData && (
            <p className="text-sm text-red-600 font-bold mb-2">
              No assessment exists for this level and school year yet. Enter fees below and click UPDATE to create it.
            </p>
          )}

          {/* Description of Fees */}
          <div className="border-2 border-az-teal-deep bg-az-teal-light p-2 mb-4">
            <h3 className="font-bold text-center mb-2">Description of Fees</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="space-y-1">
                {feeRow("Registration", "registrationFee", true)}
                {feeRow("Tuition", "tuitionFee", true)}
                {feeRow("Miscellaneous", "miscellaneousFee", true)}
                {feeRow("Textbooks", "textbooksFee")}
                {feeRow("Computer", "computerFee")}
              </div>
              <div className="space-y-1">
                {feeRow("Field Trip", "fieldTripFee")}
                {feeRow("School Uniform", "schoolUniformFee")}
                {feeRow("PE Uniform", "peUniformFee")}
                {feeRow("Others", "othersFee")}
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="font-bold text-az-steel">TOTAL</span>
              <span className="bg-az-teal-deep text-white font-bold px-4 py-1">{money(total)}</span>
            </div>
          </div>

          {/* Upon Enrolment & Payable Amount */}
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div className="border border-[#808080] p-2 bg-white">
              <h4 className="font-bold mb-2">Upon Enrolment</h4>
              <p className="flex justify-between">
                <span>Semi-Annual:</span> <span className="font-mono">{money(uponSemiAnnual)}</span>
              </p>
              <p className="flex justify-between">
                <span>Quarterly:</span> <span className="font-mono">{money(uponQuarterly)}</span>
              </p>
              <p className="flex justify-between">
                <span>Monthly:</span> <span className="font-mono">{money(uponMonthly)}</span>
              </p>
            </div>
            <div className="border border-[#808080] p-2 bg-white">
              <h4 className="font-bold mb-2">Payable Amount</h4>
              <p className="flex justify-between">
                <span>Semi-Annual:</span> <span className="font-mono">{money(payableSemiAnnual)}</span> X 2
              </p>
              <p className="flex justify-between">
                <span>Quarterly:</span> <span className="font-mono">{money(payableQuarterly)}</span> X 4
              </p>
              <p className="flex justify-between">
                <span>Monthly:</span> <span className="font-mono">{money(payableMonthly)}</span> X 10
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-center gap-2">
            <button
              className="bg-az-teal-deep text-white border-2 border-[#808080] px-4 py-1 hover:bg-az-steel disabled:opacity-60"
              onClick={handleUpdate}
              disabled={saving || !canEdit || !levelId || !schoolYearId || (hasData && !dirty)}
            >
              {saving ? "Saving..." : hasData ? "UPDATE" : "ADD RECORD"}
            </button>
            <button
              className="bg-az-teal-light border-2 border-[#808080] px-4 py-1 hover:bg-az-teal"
              onClick={onClose}
            >
              CLOSE
            </button>
          </div>
        </div>
          </WindowChrome>
        </div>
      </div>
    </div>
  )
}
