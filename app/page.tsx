"use client"

import { useState, useEffect } from "react"
import { AccountsPage } from "@/components/accounts-page"
import { CollectionsPage } from "@/components/collections-page"
import { PayTuitionModal } from "@/components/pay-tuition-modal"
import { BalanceInquiryModal } from "@/components/balance-inquiry-modal"
import { AddAccountModal } from "@/components/add-account-modal"
import { AddStudentPage } from "@/components/add-student-page"
import { DailyCollectionModal } from "@/components/daily-collection-modal"
import { DateRangeModal } from "@/components/date-range-modal"
import { WelcomePage } from "@/components/welcome-page"
import { RegistrationPage } from "@/components/registration-page"
import { GradesPage } from "@/components/grades-page"
import { InquiryPage } from "@/components/inquiry-page"
import { ViewIndividualAccountModal } from "@/components/view-individual-account-modal"
import { StudentListModal } from "@/components/student-list-modal"
import { AssessmentModal } from "@/components/assessment-modal"
import { MonthlyCollectionModal } from "@/components/monthly-collection-modal"
import { PostGradesModal } from "@/components/post-grades-modal"
import { ReportCardModal } from "@/components/report-card-modal"
import { RankingModal } from "@/components/ranking-modal"
import { StudentProfileModal } from "@/components/student-profile-modal"
import { CorModal } from "@/components/cor-modal"
import { OtherPaymentsModal } from "@/components/other-payments-modal"
import { UserAccountsModal } from "@/components/user-accounts-modal"
import { AuditLogModal } from "@/components/audit-log-modal"
import { ChangePasswordModal } from "@/components/change-password-modal"
import { DashboardKpis } from "@/components/dashboard-kpis"
import { LoginPage } from "@/components/login-page"
import { AcademyLogo } from "@/components/academy-logo"
import { ModuleIcon } from "@/components/module-icon"
import { UserProvider } from "@/components/user-context"
import { BRAND } from "@/lib/branding"
import { canAccessPage, ROLE_LABELS, type AppPage } from "@/lib/roles"
import type { ApiUser } from "@/lib/types"

type ActivePage =
  | "welcome"
  | "dashboard"
  | "accounts"
  | "collections"
  | "add-student"
  | "registration"
  | "grades"
  | "inquiry"
type ActiveModal =
  | null
  | "pay-tuition"
  | "balance-inquiry"
  | "add-account"
  | "daily-collection"
  | "date-range"
  | "view-individual-account"
  | "student-list"
  | "assessment"
  | "monthly-collection"
  | "post-grades"
  | "report-card"
  | "ranking"
  | "student-profile"
  | "cor"
  | "other-payments"
  | "user-accounts"
  | "audit-log"
  | "change-password"

function SplashScreen({ time }: { time: Date }) {
  // The clock depends on the current time, so it cannot be rendered during SSR:
  // server and client would produce different seconds and break hydration.
  // Render a stable placeholder until the component has mounted, then show the
  // live time from the parent's ticking clock.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="min-h-screen bg-[#d4d0c8] flex flex-col items-center justify-center">
      <AcademyLogo className="w-28 h-28 border-4 border-az-teal-deep" />
      <p className="mt-4 text-az-teal-deep text-xl font-bold">{BRAND.productName}</p>
      <p className="text-az-steel text-sm font-semibold">{BRAND.productSubtitle}</p>
      <p className="mt-2 text-az-steel font-mono">{mounted ? time.toLocaleTimeString("en-US") : "--:--:--"}</p>
      <p className="mt-1 text-black text-sm">Starting {BRAND.productName}, please wait...</p>
    </div>
  )
}

export default function AzthreusDashboard() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activePage, setActivePage] = useState<ActivePage>("welcome")
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)
  const [user, setUser] = useState<ApiUser | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null)
  const [gradesCategory, setGradesCategory] = useState<
    "kindergarten" | "elementary" | "junior_high" | "senior_high" | null
  >(null)
  const [reenrollStudentId, setReenrollStudentId] = useState<number | null>(null)
  const [payTuitionStudentId, setPayTuitionStudentId] = useState<number | null>(null)
  const [returnToAccountAfterPayment, setReturnToAccountAfterPayment] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) return
        const data = (await response.json()) as { user: ApiUser }
        if (!cancelled) setUser(data.user)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAuthChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const formatDate = (date: Date) => {
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  }

  const formatHeaderDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "2-digit",
    }
    const dateStr = date.toLocaleDateString("en-US", options)
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
    return { dateStr, timeStr }
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
    setUser(null)
    setActivePage("welcome")
    setActiveModal(null)
    setSelectedStudentId(null)
    setPayTuitionStudentId(null)
    setReturnToAccountAfterPayment(false)
  }

  const openStudentProfile = (studentId: number) => {
    setSelectedStudentId(studentId)
    setActiveModal("student-profile")
  }

  const openAddStudent = () => {
    setReenrollStudentId(null)
    setActivePage("add-student")
  }

  const openReenroll = (studentId: number) => {
    setReenrollStudentId(studentId)
    setActiveModal(null)
    setActivePage("add-student")
  }

  const openReportCard = (studentId?: number) => {
    if (studentId) setSelectedStudentId(studentId)
    setActiveModal("report-card")
  }

  const openViewAccount = (studentId?: number) => {
    if (studentId) setSelectedStudentId(studentId)
    setActiveModal("view-individual-account")
  }

  const openPayTuition = (studentId?: number) => {
    setPayTuitionStudentId(studentId ?? null)
    setReturnToAccountAfterPayment(Boolean(studentId))
    setActiveModal("pay-tuition")
  }

  if (!authChecked) {
    return <SplashScreen time={currentTime} />
  }

  if (!user) {
    return (
      <LoginPage
        onLoggedIn={(loggedInUser) => {
          setUser(loggedInUser)
          setActivePage("welcome")
          setAuthChecked(true)
        }}
      />
    )
  }

  if (activePage === "welcome") {
    return (
      <UserProvider user={user}>
        <WelcomePage userName={user.fullName} onEnter={() => setActivePage("dashboard")} />
      </UserProvider>
    )
  }

  const { dateStr, timeStr } = formatHeaderDate(currentTime)
  const allows = (page: AppPage) => canAccessPage(user.role, page)

  const renderMainContent = () => {
    switch (activePage) {
      case "accounts":
        return (
          <AccountsPage
            onAddAccount={() => setActiveModal("add-account")}
            onPayTuition={() => openPayTuition()}
            onOtherPayments={() => setActiveModal("other-payments")}
            onBalanceInquiry={() => setActiveModal("balance-inquiry")}
            onViewIndividualAccount={() => openViewAccount()}
          />
        )
      case "collections":
        return (
          <CollectionsPage
            onDailyCollection={() => setActiveModal("daily-collection")}
            onDateRangeCollection={() => setActiveModal("date-range")}
            onMonthlyCollection={() => setActiveModal("monthly-collection")}
          />
        )
      case "add-student":
        return (
          <AddStudentPage
            onClose={() => {
              setReenrollStudentId(null)
              setActivePage("dashboard")
            }}
            initialOldStudentId={reenrollStudentId}
          />
        )
      case "registration":
        return (
          <RegistrationPage
            onBalanceInquiry={() => setActiveModal("balance-inquiry")}
            onAddStudent={openAddStudent}
            onViewAssessment={() => setActiveModal("assessment")}
            onCertificateOfRegistration={() => setActiveModal("cor")}
          />
        )
      case "grades":
        return (
          <GradesPage
            onPostGrades={(category) => {
              setGradesCategory(category ?? null)
              setActiveModal("post-grades")
            }}
            onReportCard={() => openReportCard()}
            onRanking={() => setActiveModal("ranking")}
          />
        )
      case "inquiry":
        return (
          <InquiryPage
            onBalanceInquiry={() => setActiveModal("balance-inquiry")}
            onSelectStudent={openStudentProfile}
          />
        )
      default:
        return (
          <>
            {/* User Info */}
            <div className="mb-6">
              <p className="text-black">
                <span className="font-bold text-az-steel">Username:</span>{" "}
                <span className="text-az-steel">{user.username}</span>
              </p>
              <p className="text-black">
                <span className="font-bold text-az-steel">Signed in as:</span>{" "}
                <span className="text-az-steel">
                  {user.fullName} ({ROLE_LABELS[user.role] ?? user.role})
                </span>
              </p>
            </div>

            {/* Today */}
            <div className="flex items-center gap-3 mt-6">
              <ModuleIcon name="dashboard" className="w-12 h-12" alt="Dashboard" />
              <h2 className="text-az-teal-deep text-xl font-bold">Today</h2>
            </div>

            {/* Date and Time Display */}
            <div className="text-center mt-2">
              <p className="text-az-teal-deep text-4xl font-light">{formatDate(currentTime)}</p>
              <p className="text-az-teal-deep text-3xl font-light mt-2 font-mono">{formatTime(currentTime)}</p>
            </div>

            <DashboardKpis
              onOpenStudentDirectory={() => setActiveModal("student-list")}
              onOpenDailyCollections={() => setActiveModal("daily-collection")}
              onOpenPostGrades={() => {
                setGradesCategory(null)
                setActiveModal("post-grades")
              }}
            />

            {/* Instruction */}
            <div className="text-center mt-8">
              <p className="text-black text-lg">Choose a module from the left to begin.</p>
            </div>
          </>
        )
    }
  }

  return (
    <UserProvider user={user}>
      <div className="min-h-screen bg-[#d4d0c8] flex flex-col">
        {/* Header Section */}
        <div className="bg-white border-b-2 border-[#808080] p-4">
          <div className="flex items-start justify-between">
            {/* Logo and Title */}
            <div className="flex items-center gap-4">
              {/* Academy crest */}
              <AcademyLogo className="w-28 h-28 border-4 border-az-teal-deep" />

              <div>
                <h1 className="text-az-steel text-2xl font-bold tracking-wide">{BRAND.schoolName}</h1>
                <p className="text-az-teal-deep text-sm font-bold tracking-wide">{BRAND.addressLine}</p>
                <p className="text-black font-semibold mt-2">{user.fullName}</p>
                <button
                  type="button"
                  className="text-xs text-az-steel underline hover:text-az-teal-deep"
                  onClick={() => setActiveModal("change-password")}
                >
                  Change password
                </button>
                <h2 className="text-az-teal-deep text-xl font-bold mt-1">{BRAND.productName}</h2>
                <p className="text-az-teal-deep text-sm font-semibold">{BRAND.productSubtitle}</p>
              </div>
            </div>

            {/* Right side info */}
            <div className="text-right text-sm">
              <p className="text-az-teal-deep font-bold">{dateStr}</p>
              <p className="text-az-teal-deep font-bold">{timeStr}</p>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1">
          {/* Sidebar */}
          <div className="w-72 bg-[#f5f5f5] border-r-2 border-[#808080] p-2">
            {/* Registration */}
            {allows("registration") && (
              <div
                className="flex gap-3 mb-3 p-2 hover:bg-[#e0e0e0] cursor-pointer"
                onClick={() => setActivePage("registration")}
              >
                <ModuleIcon name="registration" className="w-16 h-16" alt="Registration" />
                <div>
                  <h3 className="text-az-teal-deep font-bold">Registration</h3>
                  <p
                    className="text-az-teal-deep text-sm hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      openAddStudent()
                    }}
                  >
                    Add Student
                  </p>
                  <p
                    className="text-az-teal-deep text-sm hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveModal("assessment")
                    }}
                  >
                    Assessment
                  </p>
                  <p
                    className="text-az-teal-deep text-sm hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveModal("cor")
                    }}
                  >
                    Certificate of Registration
                  </p>
                </div>
              </div>
            )}

            {/* Accounts */}
            {allows("accounts") && (
              <div
                className="flex gap-3 mb-3 p-2 hover:bg-[#e0e0e0] cursor-pointer"
                onClick={() => setActivePage("accounts")}
              >
                <ModuleIcon name="accounts" className="w-16 h-16" alt="Accounts" />
                <div>
                  <h3 className="text-az-teal-deep font-bold">Accounts</h3>
                  <p
                    className="text-az-teal-deep text-sm hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveModal("add-account")
                    }}
                  >
                    Add Account
                  </p>
                  <p
                    className="text-az-teal-deep text-sm hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      openPayTuition()
                    }}
                  >
                    Receive Payment
                  </p>
                  <p
                    className="text-az-teal-deep text-sm hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveModal("balance-inquiry")
                    }}
                  >
                    Balance Inquiry
                  </p>
                </div>
              </div>
            )}

            {/* Grades */}
            {allows("grades") && (
              <div
                className="flex gap-3 mb-3 p-2 hover:bg-[#e0e0e0] cursor-pointer"
                onClick={() => setActivePage("grades")}
              >
                <ModuleIcon name="grades" className="w-16 h-16" alt="Grades" />
                <div>
                  <h3 className="text-az-teal-deep font-bold">Grades</h3>
                  <p
                    className="text-az-teal-deep text-sm hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setGradesCategory(null)
                      setActiveModal("post-grades")
                    }}
                  >
                    Post Grades
                  </p>
                  <p
                    className="text-az-teal-deep text-sm hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveModal("ranking")
                    }}
                  >
                    Honors &amp; Class Ranking
                  </p>
                </div>
              </div>
            )}

            {/* Inquiry */}
            {allows("inquiry") && (
              <div
                className="flex gap-3 mb-3 p-2 hover:bg-[#e0e0e0] cursor-pointer"
                onClick={() => setActivePage("inquiry")}
              >
                <ModuleIcon name="inquiry" className="w-16 h-16" alt="Inquiry" />
                <div>
                  <h3 className="text-az-teal-deep font-bold">Inquiry</h3>
                  <p
                    className="text-az-teal-deep text-sm hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveModal("student-list")
                    }}
                  >
                    Profile Inquiry
                  </p>
                  <p
                    className="text-az-teal-deep text-sm hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveModal("balance-inquiry")
                    }}
                  >
                    Accounts Inquiry
                  </p>
                  <p
                    className="text-az-teal-deep text-sm hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      openReportCard()
                    }}
                  >
                    Grades Inquiry
                  </p>
                </div>
              </div>
            )}

            {/* Collection Report */}
            {allows("collections") && (
              <div
                className="flex gap-3 mb-3 p-2 hover:bg-[#e0e0e0] cursor-pointer"
                onClick={() => setActivePage("collections")}
              >
                <ModuleIcon name="collections" className="w-16 h-16" alt="Collection Report" />
                <div>
                  <h3 className="text-az-teal-deep font-bold">Collection Report</h3>
                  <p
                    className="text-az-teal-deep text-sm hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveModal("daily-collection")
                    }}
                  >
                    Daily Collection
                  </p>
                  <p
                    className="text-az-teal-deep text-sm hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveModal("date-range")
                    }}
                  >
                    By Date Range Collection
                  </p>
                  <p
                    className="text-az-teal-deep text-sm hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveModal("monthly-collection")
                    }}
                  >
                    By Month Collection
                  </p>
                </div>
              </div>
            )}

            {/* Administration */}
            {user.role === "admin" && (
              <div
                className="flex gap-3 mb-3 p-2 hover:bg-[#e0e0e0] cursor-pointer"
                onClick={() => setActiveModal("user-accounts")}
              >
                <ModuleIcon name="users" className="w-16 h-16" alt="Administration" />
                <div>
                  <h3 className="text-az-teal-deep font-bold">Administration</h3>
                  <p
                    className="text-az-teal-deep text-sm hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveModal("user-accounts")
                    }}
                  >
                    User Accounts
                  </p>
                  <p
                    className="text-az-teal-deep text-sm hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveModal("audit-log")
                    }}
                  >
                    Audit Log
                  </p>
                </div>
              </div>
            )}

            {/* Logout */}
            <div className="flex gap-3 p-2">
              <div className="flex flex-col items-center">
                <div className="cursor-pointer" onClick={handleLogout}>
                  <ModuleIcon name="logout" className="w-16 h-16" alt="Log Out" />
                </div>
                <span className="text-az-teal-deep text-xs underline cursor-pointer" onClick={handleLogout}>
                  Log Out
                </span>
              </div>
            </div>
          </div>

          {/* Main Panel */}
          <div className="flex-1 bg-[#f0f0f0] p-6 overflow-auto">{renderMainContent()}</div>
        </div>

        {/* Modals */}
        {activeModal === "pay-tuition" && (
          <PayTuitionModal
            initialStudentId={payTuitionStudentId}
            onReturnToAccount={
              returnToAccountAfterPayment
                ? (studentId) => {
                    setSelectedStudentId(studentId)
                    setPayTuitionStudentId(null)
                    setReturnToAccountAfterPayment(false)
                    setActiveModal("view-individual-account")
                  }
                : undefined
            }
            onClose={() => {
              setPayTuitionStudentId(null)
              setReturnToAccountAfterPayment(false)
              setActiveModal(null)
            }}
          />
        )}
        {activeModal === "balance-inquiry" && (
          <BalanceInquiryModal
            onClose={() => setActiveModal(null)}
            onViewAccounts={() => {
              setActiveModal("view-individual-account")
            }}
            onSelectStudent={openStudentProfile}
            onViewAssessment={() => setActiveModal("assessment")}
          />
        )}
        {activeModal === "add-account" && <AddAccountModal onClose={() => setActiveModal(null)} />}
        {activeModal === "daily-collection" && <DailyCollectionModal onClose={() => setActiveModal(null)} />}
        {activeModal === "date-range" && <DateRangeModal onClose={() => setActiveModal(null)} />}
        {activeModal === "view-individual-account" && (
          <ViewIndividualAccountModal
            onClose={() => setActiveModal(null)}
            initialStudentId={selectedStudentId}
            onPayTuition={(studentId) => openPayTuition(studentId)}
          />
        )}
        {activeModal === "student-list" && (
          <StudentListModal
            onClose={() => setActiveModal(null)}
            onAddStudent={() => {
              setActiveModal(null)
              openAddStudent()
            }}
            onSelectStudent={openStudentProfile}
          />
        )}
        {activeModal === "assessment" && <AssessmentModal onClose={() => setActiveModal(null)} />}
        {activeModal === "monthly-collection" && <MonthlyCollectionModal onClose={() => setActiveModal(null)} />}
        {activeModal === "post-grades" && (
          <PostGradesModal onClose={() => setActiveModal(null)} initialCategory={gradesCategory} />
        )}
        {activeModal === "report-card" && (
          <ReportCardModal
            onClose={() => setActiveModal(null)}
            initialStudentId={selectedStudentId}
            onSelectStudent={setSelectedStudentId}
          />
        )}
        {activeModal === "ranking" && (
          <RankingModal onClose={() => setActiveModal(null)} onSelectStudent={openStudentProfile} />
        )}
        {activeModal === "student-profile" && selectedStudentId && (
          <StudentProfileModal
            onClose={() => setActiveModal(null)}
            studentId={selectedStudentId}
            onViewReportCard={openReportCard}
            onViewAccount={openViewAccount}
            onReenroll={openReenroll}
          />
        )}
        {activeModal === "cor" && (
          <CorModal onClose={() => setActiveModal(null)} initialStudentId={selectedStudentId} />
        )}
        {activeModal === "other-payments" && (
          <OtherPaymentsModal onClose={() => setActiveModal(null)} />
        )}
        {activeModal === "user-accounts" && (
          <UserAccountsModal onClose={() => setActiveModal(null)} />
        )}
        {activeModal === "audit-log" && (
          <AuditLogModal onClose={() => setActiveModal(null)} />
        )}
        {activeModal === "change-password" && (
          <ChangePasswordModal onClose={() => setActiveModal(null)} />
        )}
      </div>
    </UserProvider>
  )
}
