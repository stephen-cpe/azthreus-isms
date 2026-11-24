"use client"

import { money } from "@/lib/money"
import { useState, useEffect, useMemo, useRef, type FormEvent } from "react"
import { toast } from "sonner"
import { useUser } from "@/components/user-context"
import { AcademyLogo } from "@/components/academy-logo"
import { BRAND } from "@/lib/branding"
import { formatAccountNo, formatStudentNo } from "@/lib/format-ids"
import type { Assessment, Lookups, StudentListItem, StudentProfile } from "@/lib/types"

interface AddStudentPageProps {
  onClose: () => void
  initialOldStudentId?: number | null
}

interface FormState {
  firstName: string
  middleName: string
  lastName: string
  gender: string
  birthdate: string
  birthplace: string
  birthOrder: string
  age: string
  dateEnrolled: string
  address: string
  barangay: string
  telephone: string
  cellphone: string
  classification: string
  schoolYearId: string
  levelId: string
  sectionId: string
  generalAverage: string
  studentNumber: string
  paymentModeId: string
  religionId: string
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
  preElemSchool: string
  preElemAddress: string
  elemSchool: string
  elemAddress: string
}

const emptyForm: FormState = {
  firstName: "",
  middleName: "",
  lastName: "",
  gender: "",
  birthdate: "",
  birthplace: "",
  birthOrder: "",
  age: "",
  dateEnrolled: "",
  address: "",
  barangay: "",
  telephone: "",
  cellphone: "",
  classification: "new",
  schoolYearId: "",
  levelId: "",
  sectionId: "",
  generalAverage: "",
  studentNumber: "",
  paymentModeId: "",
  religionId: "",
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
  preElemSchool: "",
  preElemAddress: "",
  elemSchool: "",
  elemAddress: "",
}


// The profile API returns birthdates as MM/DD/YYYY; <input type="date"> needs YYYY-MM-DD.
const toDateInput = (value: string | null) => {
  const match = value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return match ? `${match[3]}-${match[1]}-${match[2]}` : ""
}

const text = (value: string | number | null | undefined) =>
  value === null || value === undefined ? "" : String(value)

export function AddStudentPage({ onClose, initialOldStudentId }: AddStudentPageProps) {
  const user = useUser()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [form, setForm] = useState<FormState>(emptyForm)
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [oldStudentId, setOldStudentId] = useState("")
  const [saving, setSaving] = useState(false)
  const [prefilling, setPrefilling] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    Promise.all([
      fetch("/api/lookups").then((res) => (res.ok ? res.json() : null)),
      fetch("/api/assessments").then((res) => (res.ok ? res.json() : null)),
      fetch("/api/students").then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([lookupData, assessmentData, studentData]) => {
        if (lookupData) {
          const data = lookupData as Lookups
          setLookups(data)
          const currentYear = data.schoolYears.find((year) => year.isCurrent)
          const monthly = data.paymentModes.find((mode) => mode.name === "Monthly")
          setForm((prev) => ({
            ...prev,
            schoolYearId: prev.schoolYearId || (currentYear ? String(currentYear.id) : ""),
            paymentModeId: prev.paymentModeId || (monthly ? String(monthly.id) : ""),
          }))
        }
        if (assessmentData) setAssessments((assessmentData as { assessments: Assessment[] }).assessments ?? [])
        if (studentData) {
          const list = (studentData as { students: StudentListItem[] }).students ?? []
          setStudents(list)
          if (initialOldStudentId && list.some((student) => student.studentId === initialOldStudentId)) {
            handleMigrate(String(initialOldStudentId), list)
          }
        }
      })
      .catch(() => toast.error("Unable to load lookup data. Check your database connection."))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const selectedMode = lookups?.paymentModes.find((mode) => String(mode.id) === form.paymentModeId)

  const assessment = useMemo(() => {
    if (!form.levelId || !form.schoolYearId) return null
    return (
      assessments.find(
        (item) => String(item.levelId) === form.levelId && String(item.schoolYearId) === form.schoolYearId,
      ) ?? null
    )
  }, [assessments, form.levelId, form.schoolYearId])

  const sectionOptions = useMemo(() => {
    if (!lookups) return []
    return lookups.sections.filter(
      (section) => String(section.levelId) === form.levelId && String(section.schoolYearId) === form.schoolYearId,
    )
  }, [lookups, form.levelId, form.schoolYearId])

  const uponEnrollment = assessment
    ? selectedMode?.name === "Quarterly"
      ? assessment.uponEnrollmentQuarterly
      : selectedMode?.name === "Semi-Annual"
        ? assessment.uponEnrollmentSemiAnnual
        : selectedMode?.name === "Cash/Annual"
          ? assessment.totalFee
          : assessment.uponEnrollmentMonthly
    : 0

  const installmentPayable = assessment
    ? selectedMode?.name === "Cash/Annual"
      ? assessment.totalFee
      : selectedMode?.name === "Quarterly"
        ? assessment.payableQuarterly
        : selectedMode?.name === "Semi-Annual"
          ? assessment.payableSemiAnnual
          : assessment.payableMonthly
    : 0

  const yearsLabel =
    selectedMode?.name === "Quarterly"
      ? "X 4"
      : selectedMode?.name === "Semi-Annual"
        ? "X 2"
        : selectedMode?.name === "Cash/Annual"
          ? "X 1"
          : "X 10"

  const selectedOldStudent = students.find((student) => String(student.studentId) === oldStudentId) ?? null
  const isReEnroll = Boolean(oldStudentId)

  // Guards against a slow profile fetch overwriting the form after the
  // registrar has switched to a different student.
  const selectedStudentRef = useRef("")

  const clearOldStudent = () => {
    selectedStudentRef.current = ""
    setPrefilling(false)
    setOldStudentId("")
    setForm((prev) => ({ ...emptyForm, schoolYearId: prev.schoolYearId, paymentModeId: prev.paymentModeId }))
  }

  const handleMigrate = (studentId: string, list?: StudentListItem[]) => {
    if (!studentId) {
      clearOldStudent()
      return
    }

    const pool = list ?? students
    const student = pool.find((item) => String(item.studentId) === studentId)
    if (!student) return

    setOldStudentId(studentId)
    selectedStudentRef.current = studentId
    setForm((prev) => ({
      ...prev,
      firstName: student.firstName,
      middleName: student.middleName ?? "",
      lastName: student.lastName,
      gender: student.gender ?? "",
      classification: student.status === "dropped" || student.status === "transferred" ? "returning" : "old",
      telephone: student.telNum ?? "",
      cellphone: student.celNum ?? "",
      // Re-enrollment needs a fresh level, section, and date for the new year.
      levelId: "",
      sectionId: "",
      dateEnrolled: "",
    }))
    toast.info(
      student.status === "enrolled"
        ? `Record of ${student.lastName}, ${student.firstName} loaded. Choose the NEW level and school year below to re-enroll - their record will be updated, not duplicated.`
        : `${student.lastName}, ${student.firstName} (${student.status}) loaded. Fill in the new enrollment below.`,
    )

    // Re-enrollment writes every field back to the student record, so load the
    // complete record first. Otherwise the blank form would erase birthdate,
    // address, and parent details that this form never showed.
    setPrefilling(true)
    fetch(`/api/students/${studentId}/profile`)
      .then((response) => (response.ok ? (response.json() as Promise<StudentProfile>) : null))
      .then((profile) => {
        if (!profile || selectedStudentRef.current !== studentId) return
        const current = profile.student
        const parents = profile.parents
        setForm((prev) => ({
          ...prev,
          firstName: current.firstName,
          middleName: current.middleName ?? "",
          lastName: current.lastName,
          gender: current.gender ?? "",
          birthdate: toDateInput(current.birthdate),
          birthplace: current.birthplace ?? "",
          birthOrder: text(current.birthOrder),
          age: text(current.age),
          address: current.address ?? "",
          barangay: current.barangay ?? "",
          telephone: current.telephone ?? "",
          cellphone: current.cellphone ?? "",
          studentNumber: current.studNum ?? "",
          religionId: text(parents?.religionId),
          fatherName: parents?.fatherName ?? "",
          fatherOccupation: parents?.fatherOccupation ?? "",
          fatherAge: text(parents?.fatherAge),
          fatherEducation: parents?.fatherEducation ?? "",
          motherName: parents?.motherName ?? "",
          motherOccupation: parents?.motherOccupation ?? "",
          motherAge: text(parents?.motherAge),
          motherEducation: parents?.motherEducation ?? "",
          parentsTelephone: parents?.telephone ?? "",
          parentsMobile: parents?.mobileNumber ?? "",
        }))
      })
      .catch(() => {
        if (selectedStudentRef.current !== studentId) return
        toast.error(
          `Could not load the full record of ${student.lastName}, ${student.firstName}. Select the student again to retry; the existing record was not changed.`,
        )
        clearOldStudent()
      })
      .finally(() => {
        if (selectedStudentRef.current === studentId) setPrefilling(false)
      })
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("First name and last name are required.")
      return
    }
    if (!form.levelId || !form.schoolYearId) {
      toast.error("Level and school year are required.")
      return
    }
    if (!assessment) {
      toast.error("No assessment is configured for this level and school year. Set it up under Assessment first.")
      return
    }

    setSaving(true)
    setSavedMessage(null)

    try {
      const classification =
        form.classification === "old"
          ? "Old"
          : form.classification === "transferee"
            ? "Transferee"
            : form.classification === "returning"
              ? "Returning"
              : "New"

      const payload = isReEnroll
        ? {
            levelId: Number(form.levelId),
            schoolYearId: Number(form.schoolYearId),
            sectionId: form.sectionId ? Number(form.sectionId) : null,
            paymentModeId: form.paymentModeId ? Number(form.paymentModeId) : null,
            dateEnrolled: form.dateEnrolled,
            classification,
            firstName: form.firstName,
            middleName: form.middleName,
            lastName: form.lastName,
            gender: form.gender,
            birthdate: form.birthdate,
            birthplace: form.birthplace,
            birthOrder: form.birthOrder,
            age: form.age,
            address: form.address,
            barangay: form.barangay,
            telephone: form.telephone,
            cellphone: form.cellphone,
            studentNumber: form.studentNumber,
            religionId: form.religionId ? Number(form.religionId) : null,
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
          }
        : {
            firstName: form.firstName,
            middleName: form.middleName,
            lastName: form.lastName,
            gender: form.gender,
            birthdate: form.birthdate,
            birthplace: form.birthplace,
            birthOrder: form.birthOrder,
            age: form.age,
            dateEnrolled: form.dateEnrolled,
            address: form.address,
            barangay: form.barangay,
            telephone: form.telephone,
            cellphone: form.cellphone,
            classification,
            schoolYearId: Number(form.schoolYearId),
            levelId: Number(form.levelId),
            sectionId: form.sectionId ? Number(form.sectionId) : null,
            generalAverage: form.generalAverage,
            studentNumber: form.studentNumber,
            paymentModeId: form.paymentModeId ? Number(form.paymentModeId) : null,
            religionId: form.religionId ? Number(form.religionId) : null,
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
            schools: [
              { level: "Kindergarten", name: form.preElemSchool, address: form.preElemAddress },
              { level: "Elementary", name: form.elemSchool, address: form.elemAddress },
            ].filter((school) => school.name.trim() !== ""),
          }

      const response = await fetch(isReEnroll ? `/api/students/${oldStudentId}/re-enroll` : "/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await response.json().catch(() => null)) as
        | {
            student?: { regNumber: number | null }
            account?: { accountId: number }
            payment?: { receiptNumber: string | null }
            error?: string
          }
        | null

      if (!response.ok || !data?.student) {
        toast.error(data?.error ?? "Failed to save the student record.")
        return
      }

      if (isReEnroll) {
        toast.success(
          `Re-enrolled ${form.lastName}, ${form.firstName}. Account No. ${formatAccountNo(data.account?.accountId)}.`,
        )
        setSavedMessage(
          `Re-enrollment saved. Account No. ${formatAccountNo(data.account?.accountId)} was created for the ${
            selectedMode?.name ?? ""
          } plan. Official Receipt No. ${data.payment?.receiptNumber ?? ""}. Their previous records were kept - no duplicate student was created.`,
        )
      } else {
        toast.success(`Student saved. Registration Number: ${formatStudentNo(data.student.regNumber)}`)
        setSavedMessage(
          `Record saved successfully. Registration No.: ${formatStudentNo(data.student.regNumber)}. Account No. ${formatAccountNo(
            data.account?.accountId,
          )} was created with the selected payment plan. Official Receipt No. ${data.payment?.receiptNumber ?? ""}.`,
        )
      }
      setForm({ ...emptyForm, schoolYearId: form.schoolYearId, paymentModeId: form.paymentModeId })
      selectedStudentRef.current = ""
      setPrefilling(false)
      setOldStudentId("")
      fetch("/api/students")
        .then((res) => (res.ok ? res.json() : null))
        .then((studentData) => {
          if (studentData) setStudents((studentData as { students: StudentListItem[] }).students ?? [])
        })
        .catch(() => {})
    } catch {
      toast.error("Unable to reach the server.")
    } finally {
      setSaving(false)
    }
  }

  const formatDateTime = (date: Date) =>
    date.toLocaleString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })

  const formatHeaderDate = (date: Date) =>
    date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "2-digit" })

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })

  const inputClass = "border border-[#808080] bg-white p-1"

  return (
    <div className="bg-az-teal-pale -m-6 p-4 min-h-full">
      {/* Title Bar */}
      <div className="bg-az-teal-deep text-white p-1 mb-2 flex items-center justify-between">
        <span className="text-sm">
          Enroll a Student [User: {user.username}] {formatDateTime(currentTime)}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-4 bg-white p-4 border border-[#808080]">
        <div className="flex items-center gap-4">
          <AcademyLogo className="w-28 h-28 border-4 border-az-teal-deep" />
          <div>
            <h1 className="text-az-steel text-2xl font-bold">{BRAND.schoolName}</h1>
            <p className="text-az-teal-deep text-sm font-bold">{BRAND.addressLine}</p>
            <div className="flex items-center gap-2 mt-2">
              <h2 className="text-az-teal-deep text-xl font-bold">{isReEnroll ? "Re-enroll a Student" : "Enroll a Student"}</h2>
              <span className="ml-4 font-semibold">{user.fullName}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-az-teal-deep font-bold text-sm">{formatHeaderDate(currentTime)}</p>
          <p className="text-az-teal-deep font-bold text-sm">{formatTime(currentTime)}</p>
        </div>
      </div>

      {savedMessage && (
        <div className="mb-4 border-2 border-az-teal-deep bg-az-teal-light p-2 text-sm font-bold text-az-steel">
          {savedMessage}
        </div>
      )}

      {/* Enrolee Search */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm">Find an existing student:</span>
        <select
          className="border border-[#808080] bg-white p-1 w-64"
          value={oldStudentId}
          onChange={(event) => handleMigrate(event.target.value)}
        >
          <option value="">Select student...</option>
          {students.map((student) => (
            <option key={student.studentId} value={student.studentId}>
              {student.lastName}, {student.firstName} ({student.level}
              {student.status !== "enrolled" ? ` - ${student.status}` : ""})
            </option>
          ))}
        </select>
        <span className="text-sm">Registration No.:</span>
        <input
          type="text"
          readOnly
          value={formatStudentNo(selectedOldStudent?.regNum)}
          className="border border-[#808080] bg-az-teal-light p-1 w-24"
        />
      </div>

      {isReEnroll && selectedOldStudent && (
        <div className="mb-4 border-2 border-az-steel bg-az-sand-pale p-2 text-sm font-bold text-az-teal-deep flex items-center justify-between gap-4">
          <span>
            RE-ENROLLING {selectedOldStudent.lastName}, {selectedOldStudent.firstName} - their existing record will be
            updated and a new account created for the selected school year. No duplicate student will be created.
          </span>
          <button
            type="button"
            className="shrink-0 bg-[#c0c0c0] border-2 border-[#808080] px-3 py-1 text-xs hover:bg-[#d0d0d0]"
            onClick={clearOldStudent}
          >
            Enroll a different student
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="flex gap-4">
          {/* Left Column - Personal Info */}
          <div className="flex-1">
            <fieldset className="border-2 border-az-teal-deep p-2 mb-4">
              <legend className="text-az-teal-deep font-bold px-2">Personal Info</legend>

              <div className="flex gap-4">
                <div className="w-32">
                  <div className="w-28 h-32 border border-[#808080] bg-white flex items-center justify-center text-gray-400 text-sm">
                    Photo:
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-az-steel">First Name</label>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(event) => setField("firstName", event.target.value)}
                      className={`flex-1 ${inputClass}`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-az-steel">Middle Name</label>
                    <input
                      type="text"
                      value={form.middleName}
                      onChange={(event) => setField("middleName", event.target.value)}
                      className={`flex-1 ${inputClass}`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="w-24 text-sm text-az-steel">Last Name</label>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(event) => setField("lastName", event.target.value)}
                      className={`flex-1 ${inputClass}`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-bold">Gender</span>
                    <div className="flex gap-2 mt-1">
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={form.gender === "Male"}
                          onChange={() => setField("gender", "Male")}
                        />
                        <span className="text-sm">Male</span>
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={form.gender === "Female"}
                          onChange={() => setField("gender", "Female")}
                        />
                        <span className="text-sm">Female</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Birthdate</label>
                    <input
                      type="date"
                      value={form.birthdate}
                      onChange={(event) => setField("birthdate", event.target.value)}
                      className={`w-36 ${inputClass}`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Place</label>
                    <input
                      type="text"
                      value={form.birthplace}
                      onChange={(event) => setField("birthplace", event.target.value)}
                      className={`w-32 ${inputClass}`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Birth Order:</label>
                    <input
                      type="text"
                      value={form.birthOrder}
                      onChange={(event) => setField("birthOrder", event.target.value)}
                      className={`w-16 ${inputClass}`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Age</label>
                    <input
                      type="text"
                      value={form.age}
                      onChange={(event) => setField("age", event.target.value)}
                      className={`w-12 ${inputClass}`}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Date Enrolled</label>
                    <input
                      type="date"
                      value={form.dateEnrolled}
                      onChange={(event) => setField("dateEnrolled", event.target.value)}
                      className={`w-36 ${inputClass}`}
                    />
                  </div>
                </div>

                <fieldset className="border border-[#808080] p-2">
                  <legend className="font-bold text-sm">Classification</legend>
                  <div className="space-y-1">
                    {[
                      { value: "new", label: "New" },
                      { value: "old", label: "Old" },
                      { value: "transferee", label: "Transferee" },
                      { value: "returning", label: "Returning" },
                    ].map((option) => (
                      <label key={option.value} className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={form.classification === option.value}
                          onChange={() => setField("classification", option.value)}
                        />
                        <span className="text-sm text-az-teal-deep">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>

              {/* Address */}
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-az-steel">Address</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(event) => setField("address", event.target.value)}
                    className={`flex-1 ${inputClass}`}
                  />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <label className="text-sm">Barangay:</label>
                  <input
                    type="text"
                    value={form.barangay}
                    onChange={(event) => setField("barangay", event.target.value)}
                    className={`w-48 ${inputClass}`}
                  />
                </div>
              </div>

              {/* School Info */}
              <div className="grid grid-cols-4 gap-2 mt-2">
                <div className="flex items-center gap-1">
                  <label className="text-sm">Student Number</label>
                  <input
                    type="text"
                    value={form.studentNumber}
                    onChange={(event) => setField("studentNumber", event.target.value)}
                    className={`w-24 ${inputClass}`}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-sm">School Year</label>
                  <select
                    value={form.schoolYearId}
                    onChange={(event) => setField("schoolYearId", event.target.value)}
                    className={inputClass}
                  >
                    <option value=""></option>
                    {lookups?.schoolYears.map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-sm">Level</label>
                  <select
                    value={form.levelId}
                    onChange={(event) => {
                      setField("levelId", event.target.value)
                      setField("sectionId", "")
                    }}
                    className={inputClass}
                  >
                    <option value=""></option>
                    {lookups?.levels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-sm">Gen. Average</label>
                  <input
                    type="text"
                    value={form.generalAverage}
                    onChange={(event) => setField("generalAverage", event.target.value)}
                    className={`w-16 ${inputClass}`}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-sm">Reg. No.</label>
                  <input
                    type="text"
                    readOnly
                    value={isReEnroll ? formatStudentNo(selectedOldStudent?.regNum) || "(kept)" : "(Auto)"}
                    className={`w-24 ${isReEnroll ? "bg-az-teal-light" : "bg-[#e8e8e8]"} ${inputClass}`}
                  />
                </div>
                <div className="col-span-3 flex items-center gap-1">
                  <label className="text-sm">Section</label>
                  <select
                    value={form.sectionId}
                    onChange={(event) => setField("sectionId", event.target.value)}
                    className={`flex-1 ${inputClass}`}
                  >
                    <option value=""></option>
                    {sectionOptions.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>

            {/* Parents Section */}
            <fieldset className="border-2 border-az-teal-deep p-2 mb-4">
              <legend className="text-az-teal-deep font-bold px-2">Parents</legend>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-center">
                    <th></th>
                    <th>Name</th>
                    <th>Occupation</th>
                    <th>Age</th>
                    <th>Education</th>
                    <th>
                      Religion
                      <br />
                      (optional)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-bold">Father</td>
                    <td>
                      <input
                        type="text"
                        value={form.fatherName}
                        onChange={(event) => setField("fatherName", event.target.value)}
                        className={`w-full ${inputClass}`}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={form.fatherOccupation}
                        onChange={(event) => setField("fatherOccupation", event.target.value)}
                        className={`w-full ${inputClass}`}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={form.fatherAge}
                        onChange={(event) => setField("fatherAge", event.target.value)}
                        className={`w-12 ${inputClass}`}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={form.fatherEducation}
                        onChange={(event) => setField("fatherEducation", event.target.value)}
                        className={`w-full ${inputClass}`}
                      />
                    </td>
                    <td rowSpan={2}>
                      <select
                        value={form.religionId}
                        onChange={(event) => setField("religionId", event.target.value)}
                        className={`w-full h-12 ${inputClass}`}
                      >
                        <option value=""></option>
                        {lookups?.religions.map((religion) => (
                          <option key={religion.id} value={religion.id}>
                            {religion.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className="font-bold">Mother</td>
                    <td>
                      <input
                        type="text"
                        value={form.motherName}
                        onChange={(event) => setField("motherName", event.target.value)}
                        className={`w-full ${inputClass}`}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={form.motherOccupation}
                        onChange={(event) => setField("motherOccupation", event.target.value)}
                        className={`w-full ${inputClass}`}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={form.motherAge}
                        onChange={(event) => setField("motherAge", event.target.value)}
                        className={`w-12 ${inputClass}`}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={form.motherEducation}
                        onChange={(event) => setField("motherEducation", event.target.value)}
                        className={`w-full ${inputClass}`}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-sm">Tel No.:</span>
                <input
                  type="text"
                  value={form.parentsTelephone}
                  onChange={(event) => setField("parentsTelephone", event.target.value)}
                  className={`w-32 ${inputClass}`}
                />
                <span className="text-sm">Mobile Number</span>
                <input
                  type="text"
                  value={form.parentsMobile}
                  onChange={(event) => setField("parentsMobile", event.target.value)}
                  className={`w-32 ${inputClass}`}
                />
              </div>
            </fieldset>

            {/* Previous schools (new students only - existing students already have history) */}
            {!isReEnroll && (
              <fieldset className="border-2 border-az-teal-deep p-2">
                <legend className="text-az-teal-deep font-bold px-2">Previous schools</legend>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="w-24 text-sm">Kindergarten</label>
                  <input
                    type="text"
                    value={form.preElemSchool}
                    onChange={(event) => setField("preElemSchool", event.target.value)}
                    className={`flex-1 ${inputClass}`}
                  />
                  <label className="text-sm">Address:</label>
                  <input
                    type="text"
                    value={form.preElemAddress}
                    onChange={(event) => setField("preElemAddress", event.target.value)}
                    className={`flex-1 ${inputClass}`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="w-24 text-sm">Elementary</label>
                  <input
                    type="text"
                    value={form.elemSchool}
                    onChange={(event) => setField("elemSchool", event.target.value)}
                    className={`flex-1 ${inputClass}`}
                  />
                  <label className="text-sm">Address:</label>
                  <input
                    type="text"
                    value={form.elemAddress}
                    onChange={(event) => setField("elemAddress", event.target.value)}
                    className={`flex-1 ${inputClass}`}
                  />
                </div>
              </div>
            </fieldset>
            )}
          </div>

          {/* Right Column - Payment & Fees */}
          <div className="w-64">
            <fieldset className="border-2 border-az-teal-deep p-2 mb-4">
              <legend className="text-az-teal-deep font-bold px-2">Mode of Payment</legend>
              <div className="space-y-1">
                {lookups?.paymentModes.map((mode) => (
                  <label key={mode.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="paymentMode"
                      checked={form.paymentModeId === String(mode.id)}
                      onChange={() => setField("paymentModeId", String(mode.id))}
                    />
                    <span className="text-sm">{mode.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Fee Fields (from the level's assessment) */}
            <div className="space-y-1 text-sm">
              {!assessment && (
                <p className="text-xs text-red-600 font-bold mb-2">
                  Select a level and school year to display the assessment fees.
                </p>
              )}
              <div className="flex items-center justify-between">
                <label>Tuition:</label>
                <input type="text" readOnly value={money(assessment?.tuitionFee)} className={`w-24 text-right ${inputClass}`} />
              </div>
              <div className="flex items-center justify-between">
                <label>Miscellaneous:</label>
                <input type="text" readOnly value={money(assessment?.miscellaneousFee)} className={`w-24 text-right ${inputClass}`} />
              </div>
              <div className="flex items-center justify-between">
                <label>Textbooks:</label>
                <input type="text" readOnly value={money(assessment?.textbooksFee)} className={`w-24 text-right ${inputClass}`} />
              </div>
              <div className="flex items-center justify-between">
                <label>Computer:</label>
                <input type="text" readOnly value={money(assessment?.computerFee)} className={`w-24 text-right ${inputClass}`} />
              </div>
              <div className="flex items-center justify-between">
                <label>Registration:</label>
                <input type="text" readOnly value={money(assessment?.registrationFee)} className={`w-24 text-right ${inputClass}`} />
              </div>
              <div className="flex items-center justify-between bg-az-teal-light p-1">
                <label className="font-bold">TOTAL</label>
                <input type="text" readOnly value={money(assessment?.totalFee)} className={`w-24 text-right font-bold ${inputClass}`} />
              </div>
              <div className="flex items-center justify-between">
                <label>Upon Enrolment</label>
                <input type="text" readOnly value={money(uponEnrollment)} className={`w-24 text-right ${inputClass}`} />
              </div>
              <div className="flex items-center justify-between">
                <label>{selectedMode?.name ?? "Installment"}:</label>
                <span>{yearsLabel}</span>
                <input type="text" readOnly value={money(installmentPayable)} className={`w-16 text-right ${inputClass}`} />
              </div>
              <div className="flex items-center justify-between">
                <label>Field Trip:</label>
                <input type="text" readOnly value={money(assessment?.fieldTripFee)} className={`w-24 text-right ${inputClass}`} />
              </div>
              <div className="flex items-center justify-between">
                <label>Sch. Uniform</label>
                <input type="text" readOnly value={money(assessment?.schoolUniformFee)} className={`w-24 text-right ${inputClass}`} />
              </div>
              <div className="flex items-center justify-between">
                <label>PE Uniform</label>
                <input type="text" readOnly value={money(assessment?.peUniformFee)} className={`w-24 text-right ${inputClass}`} />
              </div>
            </div>

            <p className="text-xs text-red-600 mt-2">Monthly installments run from June through March.</p>

            {/* Action Buttons */}
            <div className="space-y-2 mt-4">
              <button
                type="submit"
                disabled={saving || (isReEnroll && prefilling)}
                className="w-full bg-[#c0c0c0] border-2 border-[#808080] py-2 text-sm font-bold hover:bg-[#d0d0d0] disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : isReEnroll
                    ? prefilling
                      ? "Loading record..."
                      : "Re-enroll Student"
                    : "Add Record"}
              </button>
              <button
                type="button"
                className="w-full bg-[#ff6666] border-2 border-[#808080] py-2 text-sm font-bold text-white hover:bg-[#ff4444]"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
