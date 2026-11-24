"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useUser } from "@/components/user-context"
import { WindowChrome } from "@/components/window-chrome"
import { canWrite, ROLE_LABELS } from "@/lib/roles"
import { formatStudentNo } from "@/lib/format-ids"
import type { Lookups, StudentProfile } from "@/lib/types"

interface EditStudentModalProps {
  studentId: number
  onClose: () => void
  onSaved: () => void
  onReenroll?: (studentId: number) => void
}

interface EditFormState {
  firstName: string
  middleName: string
  lastName: string
  gender: string
  birthdate: string
  age: string
  birthplace: string
  address: string
  barangay: string
  telephone: string
  cellphone: string
  studentNumber: string
  status: string
  classification: string
  levelId: string
  schoolYearId: string
  sectionId: string
  generalAverage: string
  fatherName: string
  fatherOccupation: string
  fatherAge: string
  fatherEducation: string
  motherName: string
  motherOccupation: string
  motherAge: string
  motherEducation: string
  parentsTelephone: string
  parentsMobile: string
  religionId: string
}

const emptyForm: EditFormState = {
  firstName: "",
  middleName: "",
  lastName: "",
  gender: "",
  birthdate: "",
  age: "",
  birthplace: "",
  address: "",
  barangay: "",
  telephone: "",
  cellphone: "",
  studentNumber: "",
  status: "enrolled",
  classification: "New",
  levelId: "",
  schoolYearId: "",
  sectionId: "",
  generalAverage: "",
  fatherName: "",
  fatherOccupation: "",
  fatherAge: "",
  fatherEducation: "",
  motherName: "",
  motherOccupation: "",
  motherAge: "",
  motherEducation: "",
  parentsTelephone: "",
  parentsMobile: "",
  religionId: "",
}

/** Profile returns MM/DD/YYYY; the date input needs YYYY-MM-DD. */
function toIsoDate(display: string | null): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display ?? "")
  return match ? `${match[3]}-${match[1]}-${match[2]}` : ""
}

export function EditStudentModal({ studentId, onClose, onSaved, onReenroll }: EditStudentModalProps) {
  const user = useUser()
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [form, setForm] = useState<EditFormState>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canEdit = canWrite(user.role, "students")

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch("/api/lookups").then((res) => (res.ok ? res.json() : null)),
      fetch(`/api/students/${studentId}/profile`).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([lookupData, profileData]) => {
        if (cancelled) return
        if (lookupData) setLookups(lookupData as Lookups)
        if (!profileData?.student) {
          setError((profileData as { error?: string } | null)?.error ?? "Failed to load the student record")
          return
        }
        const data = profileData as StudentProfile
        setProfile(data)
        const student = data.student
        const parents = data.parents
        const religionId = parents
          ? (lookupData as Lookups | null)?.religions.find((religion) => religion.name === parents.religion)?.id
          : undefined
        const levelId = (lookupData as Lookups | null)?.levels.find((level) => level.name === student.level)?.id
        const schoolYearId = (lookupData as Lookups | null)?.schoolYears.find((year) => year.code === student.schoolYear)?.id
        const sectionId = levelId && schoolYearId
          ? (lookupData as Lookups | null)?.sections.find(
              (section) =>
                section.name === student.section &&
                section.levelId === levelId &&
                section.schoolYearId === schoolYearId,
            )?.id
          : undefined
        setForm({
          ...emptyForm,
          firstName: student.firstName,
          middleName: student.middleName ?? "",
          lastName: student.lastName,
          gender: student.gender ?? "",
          birthdate: toIsoDate(student.birthdate),
          age: student.age !== null ? String(student.age) : "",
          birthplace: student.birthplace ?? "",
          address: student.address ?? "",
          barangay: student.barangay ?? "",
          telephone: student.telephone ?? "",
          cellphone: student.cellphone ?? "",
          studentNumber: student.studNum ?? "",
          status: student.status ?? "enrolled",
          classification: student.classification ?? "New",
          levelId: levelId ? String(levelId) : "",
          schoolYearId: schoolYearId ? String(schoolYearId) : "",
          sectionId: sectionId ? String(sectionId) : "",
          generalAverage: student.generalAverage !== null ? String(student.generalAverage) : "",
          fatherName: parents?.fatherName ?? "",
          fatherOccupation: parents?.fatherOccupation ?? "",
          fatherAge: parents?.fatherAge !== null && parents?.fatherAge !== undefined ? String(parents.fatherAge) : "",
          fatherEducation: parents?.fatherEducation ?? "",
          motherName: parents?.motherName ?? "",
          motherOccupation: parents?.motherOccupation ?? "",
          motherAge: parents?.motherAge !== null && parents?.motherAge !== undefined ? String(parents.motherAge) : "",
          motherEducation: parents?.motherEducation ?? "",
          parentsTelephone: parents?.telephone ?? "",
          parentsMobile: parents?.mobileNumber ?? "",
          religionId: religionId ? String(religionId) : "",
        })
      })
      .catch(() => {
        if (!cancelled) setError("Unable to reach the server")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [studentId])

  const setField = <K extends keyof EditFormState>(key: K, value: EditFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const sectionOptions = useMemo(() => {
    if (!lookups) return []
    return lookups.sections.filter(
      (section) => String(section.levelId) === form.levelId && String(section.schoolYearId) === form.schoolYearId,
    )
  }, [lookups, form.levelId, form.schoolYearId])

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First name and last name are required.")
      return
    }
    setSaving(true)
    try {
      const response = await fetch(`/api/students/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          middleName: form.middleName,
          lastName: form.lastName,
          gender: form.gender,
          birthdate: form.birthdate,
          age: form.age,
          birthplace: form.birthplace,
          address: form.address,
          barangay: form.barangay,
          telephone: form.telephone,
          cellphone: form.cellphone,
          studentNumber: form.studentNumber,
          status: form.status,
          classification: form.classification,
          levelId: form.levelId || undefined,
          schoolYearId: form.schoolYearId || undefined,
          sectionId: form.sectionId ? Number(form.sectionId) : null,
          generalAverage: form.generalAverage,
          fatherName: form.fatherName,
          fatherOccupation: form.fatherOccupation,
          fatherAge: form.fatherAge,
          fatherEducation: form.fatherEducation,
          motherName: form.motherName,
          motherOccupation: form.motherOccupation,
          motherAge: form.motherAge,
          motherEducation: form.motherEducation,
          parentsTelephone: form.parentsTelephone,
          parentsMobile: form.parentsMobile,
          religionId: form.religionId ? Number(form.religionId) : null,
        }),
      })
      const data = (await response.json().catch(() => null)) as { student?: { id: number }; error?: string } | null
      if (!response.ok || !data?.student) {
        toast.error(data?.error ?? "Failed to save the student record.")
        return
      }
      toast.success(`Record of ${form.lastName}, ${form.firstName} updated.`)
      onSaved()
    } catch {
      toast.error("Unable to reach the server.")
    } finally {
      setSaving(false)
    }
  }

  const inputClass = `border border-[#808080] bg-white p-1 ${canEdit ? "" : "bg-[#e8e8e8] text-[#606060]"}`

  const textInput = (label: string, key: keyof EditFormState, width = "w-40") => (
    <label className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0">{label}</span>
      <input
        type="text"
        className={`${inputClass} ${width}`}
        value={form[key] as string}
        readOnly={!canEdit}
        onChange={(event) => setField(key, event.target.value as never)}
      />
    </label>
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-[#f0f0f0] border-2 border-[#808080] w-[900px] max-h-[92vh] overflow-auto shadow-lg">
        <WindowChrome
          title={`Edit Student Record - ${profile ? `${profile.student.lastName}, ${profile.student.firstName}` : "Loading..."}`}
          onClose={onClose}
        >
          <div className="p-4">
            {loading && <p className="text-az-steel font-bold">Loading record...</p>}
            {error && <p className="text-red-600 font-bold">{error}</p>}

            {!loading && !error && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs">
                    <span className="font-bold text-az-steel">Reg No: </span>
                    {formatStudentNo(profile?.student.regNumber)}
                  </p>
                  {!canEdit && (
                    <p className="text-xs text-red-600 font-bold">Read-only for {ROLE_LABELS[user.role] ?? user.role}</p>
                  )}
                </div>

                <fieldset className="border-2 border-az-teal-deep p-2 mb-3">
                  <legend className="text-az-teal-deep font-bold px-2">Personal Information</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {textInput("First Name", "firstName")}
                    {textInput("Middle Name", "middleName")}
                    {textInput("Last Name", "lastName")}
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-28 shrink-0">Gender</span>
                      <select
                        className={`${inputClass} w-40`}
                        value={form.gender}
                        disabled={!canEdit}
                        onChange={(event) => setField("gender", event.target.value)}
                      >
                        <option value="">(none)</option>
                        <option>Male</option>
                        <option>Female</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-28 shrink-0">Birthdate</span>
                      <input
                        type="date"
                        className={`${inputClass} w-40`}
                        value={form.birthdate}
                        readOnly={!canEdit}
                        onChange={(event) => setField("birthdate", event.target.value)}
                      />
                    </label>
                    {textInput("Age", "age", "w-16")}
                    {textInput("Birthplace", "birthplace")}
                    {textInput("Address", "address", "w-52")}
                    {textInput("Barangay", "barangay")}
                    {textInput("Telephone", "telephone")}
                    {textInput("Cellphone", "cellphone")}
                    {textInput("Student Number", "studentNumber")}
                  </div>
                </fieldset>

                <fieldset className="border-2 border-az-teal-deep p-2 mb-3">
                  <legend className="text-az-teal-deep font-bold px-2">Enrollment</legend>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-24 shrink-0">Status</span>
                      <select
                        className={inputClass}
                        value={form.status}
                        disabled={!canEdit}
                        onChange={(event) => setField("status", event.target.value)}
                      >
                        <option value="enrolled">enrolled</option>
                        <option value="dropped">dropped</option>
                        <option value="graduated">graduated</option>
                        <option value="transferred">transferred</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-24 shrink-0">Classification</span>
                      <select
                        className={inputClass}
                        value={form.classification}
                        disabled={!canEdit}
                        onChange={(event) => setField("classification", event.target.value)}
                      >
                        <option>New</option>
                        <option>Old</option>
                        <option>Transferee</option>
                        <option>Returning</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-24 shrink-0">Gen. Average</span>
                      <input
                        type="text"
                        className={`${inputClass} w-20`}
                        value={form.generalAverage}
                        readOnly={!canEdit}
                        onChange={(event) => setField("generalAverage", event.target.value)}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-24 shrink-0">Level</span>
                      <select
                        className={inputClass}
                        value={form.levelId}
                        disabled={!canEdit}
                        onChange={(event) => {
                          setField("levelId", event.target.value)
                          setField("sectionId", "")
                        }}
                      >
                        <option value="">(none)</option>
                        {lookups?.levels.map((level) => (
                          <option key={level.id} value={level.id}>
                            {level.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-24 shrink-0">School Year</span>
                      <select
                        className={inputClass}
                        value={form.schoolYearId}
                        disabled={!canEdit}
                        onChange={(event) => {
                          setField("schoolYearId", event.target.value)
                          setField("sectionId", "")
                        }}
                      >
                        <option value="">(none)</option>
                        {lookups?.schoolYears.map((year) => (
                          <option key={year.id} value={year.id}>
                            {year.code}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-24 shrink-0">Section</span>
                      <select
                        className={inputClass}
                        value={form.sectionId}
                        disabled={!canEdit || !form.levelId || !form.schoolYearId}
                        onChange={(event) => setField("sectionId", event.target.value)}
                      >
                        <option value="">(none)</option>
                        {sectionOptions.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </fieldset>

                <fieldset className="border-2 border-az-teal-deep p-2 mb-3">
                  <legend className="text-az-teal-deep font-bold px-2">Parents / Guardian</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {textInput("Father", "fatherName", "w-52")}
                    {textInput("Occupation", "fatherOccupation")}
                    {textInput("Age", "fatherAge", "w-16")}
                    {textInput("Education", "fatherEducation")}
                    {textInput("Mother", "motherName", "w-52")}
                    {textInput("Occupation", "motherOccupation")}
                    {textInput("Age", "motherAge", "w-16")}
                    {textInput("Education", "motherEducation")}
                    {textInput("Tel Number", "parentsTelephone")}
                    {textInput("Mobile Number", "parentsMobile")}
                    <label className="flex items-center gap-2 text-xs">
                      <span className="w-28 shrink-0">Religion (optional)</span>
                      <select
                        className={inputClass}
                        value={form.religionId}
                        disabled={!canEdit}
                        onChange={(event) => setField("religionId", event.target.value)}
                      >
                        <option value="">(none)</option>
                        {lookups?.religions.map((religion) => (
                          <option key={religion.id} value={religion.id}>
                            {religion.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </fieldset>

                <div className="flex justify-end gap-2">
                  {canEdit && form.status !== "enrolled" && onReenroll && (
                    <button
                      className="bg-az-steel text-white border-2 border-[#808080] px-4 py-1 text-sm font-bold hover:bg-az-navy"
                      onClick={() => onReenroll(studentId)}
                    >
                      Re-enroll this Student...
                    </button>
                  )}
                  <button
                    className="bg-az-teal-deep text-white border-2 border-[#808080] px-4 py-1 text-sm font-bold hover:bg-az-steel disabled:opacity-60"
                    onClick={handleSave}
                    disabled={saving || !canEdit}
                  >
                    {saving ? "Saving..." : "Save Record"}
                  </button>
                  <button
                    className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 text-sm font-bold text-az-steel hover:bg-[#d0d0d0]"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </WindowChrome>
      </div>
    </div>
  )
}
