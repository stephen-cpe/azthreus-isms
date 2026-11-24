// Shared API payload types used by both route handlers and client components.

export interface ApiUser {
  id: number
  username: string
  fullName: string
  role: string
}

export interface ManagedUser {
  id: number
  username: string
  fullName: string | null
  role: string
  isActive: boolean
  lastLogin: string | null
  createdAt: string | null
}

export interface LookupLevel {
  id: number
  name: string
  order: number
  category: string
}

export interface LookupSchoolYear {
  id: number
  code: string
  isCurrent: boolean
  startDate: string | null
  endDate: string | null
}

export interface LookupPaymentMode {
  id: number
  name: string
  installments: number
}

export interface LookupReligion {
  id: number
  name: string
}

export interface LookupSection {
  id: number
  name: string
  levelId: number
  schoolYearId: number
}

export interface LookupSubject {
  id: number
  name: string
  category: string | null
  order: number
}

export interface LookupGradePeriod {
  id: number
  name: string
  order: number
  schoolYearId: number
}

export interface Lookups {
  levels: LookupLevel[]
  schoolYears: LookupSchoolYear[]
  paymentModes: LookupPaymentMode[]
  religions: LookupReligion[]
  sections: LookupSection[]
  subjects: LookupSubject[]
  gradePeriods: LookupGradePeriod[]
}

export interface Assessment {
  id: number
  schoolYearId: number
  levelId: number
  levelName: string
  schoolYearCode: string
  registrationFee: number
  tuitionFee: number
  miscellaneousFee: number
  textbooksFee: number
  computerFee: number
  fieldTripFee: number
  schoolUniformFee: number
  peUniformFee: number
  othersFee: number
  totalFee: number
  uponEnrollmentMonthly: number
  payableMonthly: number
  uponEnrollmentQuarterly: number
  payableQuarterly: number
  uponEnrollmentSemiAnnual: number
  payableSemiAnnual: number
}

export interface StudentListItem {
  studentId: number
  lastName: string
  firstName: string
  middleName: string | null
  studNum: string | null
  regNum: number | null
  levelId: number | null
  schoolYearId: number | null
  level: string | null
  section: string | null
  sy: string | null
  enrolled: string | null
  classif: string | null
  gender: string | null
  telNum: string | null
  celNum: string | null
  status: string | null
  balance: number
}

export interface PaymentRow {
  id: number
  accountId: number | null
  months: string | null
  date: string
  receipt: string | null
  description: string | null
  tuition: number
  computer: number
  reg: number
  misc: number
  books: number
  others: number
  total: number
  postedBy: string | null
  entryType: "payment" | "reversal"
  reversesPaymentId: number | null
  reversalReceipt: string | null
  reason: string | null
}

export interface StudentAccountDetail {
  student: {
    id: number
    regNumber: number | null
    studNum: string | null
    firstName: string
    middleName: string | null
    lastName: string
    level: string | null
    section: string | null
    schoolYear: string | null
    classification: string | null
    status: string | null
  }
  account: {
    id: number
    accountId: number | null
    accountNumber: number | null
    schoolYearId: number | null
    levelId: number | null
    schoolYear: string | null
    levelName: string | null
    modeOfPayment: string
    totalSchoolFees: number
    tuitionFee: number
    monthlyTuition: number
    initialPayment: number
    discount: number
    totalPaymentsMade: number
    totalBalance: number
    monthsNotPaid: number
    currentDues: number
    dueDate: string | null
    lastUpdated: string | null
    postedBy: string | null
  } | null
  assessment: Assessment | null
  payments: PaymentRow[]
  totals: {
    tuition: number
    computer: number
    reg: number
    misc: number
    books: number
    others: number
    total: number
    count: number
  }
}

export interface CollectionRow {
  studentName: string
  level: string | null
  months: string | null
  date: string
  receipt: string | null
  description: string | null
  tuition: number
  computer: number
  reg: number
  misc: number
  books: number
  others: number
  total: number
  postedBy: string | null
  entryType: "payment" | "reversal"
  reversesReceipt: string | null
}

export interface CollectionTotals {
  tuition: number
  computer: number
  reg: number
  misc: number
  books: number
  others: number
  total: number
}

export interface CollectionReport {
  rows: CollectionRow[]
  totals: CollectionTotals
  count: number
}

export interface GradeGridRow {
  studentId: number
  lastName: string
  firstName: string
  middleName: string | null
  gradeId: number | null
  numericGrade: number | null
  remarks: string | null
  postedBy: string | null
}

export interface ReportCardRow {
  subjectId: number
  subjectName: string
  grades: (number | null)[]
  subjectAverage: number | null
  remarks: string | null
}

export interface ReportCard {
  student: {
    id: number
    regNumber: number | null
    firstName: string
    middleName: string | null
    lastName: string
    level: string | null
    section: string | null
    adviser: string | null
  }
  schoolYear: string
  periods: LookupGradePeriod[]
  rows: ReportCardRow[]
  periodAverages: (number | null)[]
  generalAverage: number | null
  remarks: string | null
  rank: number | null
  classSize: number
  honors: string | null
}

export interface RankingRow {
  rank: number
  studentId: number
  lastName: string
  firstName: string
  middleName: string | null
  level: string | null
  section: string | null
  average: number | null
  remarks: string | null
  honors: string | null
}

export interface RankingReport {
  period: LookupGradePeriod | null
  schoolYear: string
  level: string | null
  section: string | null
  rows: RankingRow[]
}

export interface StudentProfile {
  student: {
    id: number
    regNumber: number | null
    studNum: string | null
    firstName: string
    middleName: string | null
    lastName: string
    gender: string | null
    birthdate: string | null
    birthplace: string | null
    birthOrder: number | null
    age: number | null
    address: string | null
    barangay: string | null
    telephone: string | null
    cellphone: string | null
    classification: string | null
    status: string | null
    level: string | null
    section: string | null
    schoolYear: string | null
    dateEnrolled: string | null
    generalAverage: number | null
  }
  parents: {
    fatherName: string | null
    fatherOccupation: string | null
    fatherAge: number | null
    fatherEducation: string | null
    motherName: string | null
    motherOccupation: string | null
    motherAge: number | null
    motherEducation: string | null
    telephone: string | null
    mobileNumber: string | null
    religionId: number | null
    religion: string | null
  } | null
  schoolHistory: { schoolLevel: string | null; schoolName: string | null; schoolAddress: string | null }[]
  account: {
    accountId: number | null
    accountNumber: number | null
    modeOfPayment: string | null
    totalSchoolFees: number
    totalPaymentsMade: number
    totalBalance: number
    monthsNotPaid: number
    currentDues: number
    lastUpdated: string | null
  } | null
  payments: PaymentRow[]
  gradeSummary: { period: string; average: number | null; subjects: number }[]
  generalAverage: number | null
  honors: string | null
}

export interface DashboardEnrollment {
  enrolled: number
  newStudents: number
  returning: number
  dropped: number
  transferred: number
  byLevel: { level: string; count: number }[]
}

export interface DashboardMoney {
  today: number
  month: number
  schoolYear: number
  outstanding: number
  accountsWithDues: number
  recentPayments: {
    id: number
    payer: string
    date: string
    amount: number
    receipt: string | null
    postedBy: string | null
    entryType: "payment" | "reversal"
  }[]
}

export interface DashboardGrades {
  period: string | null
  overall: { slots: number; posted: number; percent: number | null }
  byLevel: { level: string; slots: number; posted: number; percent: number | null }[]
}

export interface DashboardData {
  schoolYear: string | null
  enrollment?: DashboardEnrollment
  money?: DashboardMoney
  grades?: DashboardGrades
}

export interface AuditLogEntry {
  id: number
  occurredAt: string
  userId: number | null
  username: string | null
  action: string
  entityType: string
  entityId: string | null
  summary: string
  details: Record<string, unknown> | null
}

export interface AuditLogPage {
  entries: AuditLogEntry[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}
