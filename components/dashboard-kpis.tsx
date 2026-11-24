"use client"

import { money } from "@/lib/money"
import { useEffect, useState, type ReactNode } from "react"
import type { DashboardData } from "@/lib/types"

interface DashboardKpisProps {
  onOpenStudentDirectory: () => void
  onOpenDailyCollections: () => void
  onOpenPostGrades: () => void
}


function KpiBox({
  title,
  actionLabel,
  onAction,
  children,
}: {
  title: string
  actionLabel: string
  onAction: () => void
  children: ReactNode
}) {
  return (
    <section className="border-2 border-[#808080] bg-white p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-az-teal-deep font-bold">{title}</h2>
        <button className="text-az-steel text-xs underline hover:text-az-teal-deep" onClick={onAction}>
          {actionLabel}
        </button>
      </div>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[#808080] bg-[#f5f5f5] p-1 text-center">
      <p className="text-az-steel font-bold text-sm">{value}</p>
      <p className="text-[10px] text-black">{label}</p>
    </div>
  )
}

function Bar({
  label,
  value,
  max,
  display,
}: {
  label: string
  value: number
  max: number
  display: string
}) {
  const width = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className="grid grid-cols-[110px_1fr_80px] items-center gap-2 text-xs">
      <span className="truncate" title={label}>
        {label}
      </span>
      <div className="h-3 border border-[#808080] bg-[#e8e8e8]">
        <div className="h-full bg-az-teal" style={{ width: `${width}%` }} />
      </div>
      <span className="text-right font-mono">{display}</span>
    </div>
  )
}

export function DashboardKpis({ onOpenStudentDirectory, onOpenDailyCollections, onOpenPostGrades }: DashboardKpisProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as (DashboardData & { error?: string }) | null
        if (!response.ok || !payload) {
          setError(payload?.error ?? "Unable to load the dashboard.")
          return
        }
        setData(payload)
      })
      .catch(() => setError("Unable to reach the server."))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="mt-6 text-sm text-az-steel">Loading dashboard summary...</p>
  }
  if (error) {
    return <p className="mt-6 text-sm text-red-600 font-bold">{error}</p>
  }
  if (!data) return null

  const enrollment = data.enrollment
  const moneySection = data.money
  const grades = data.grades

  const enrollmentMax = enrollment ? Math.max(...enrollment.byLevel.map((row) => row.count), 1) : 1
  const moneyMax = moneySection
    ? Math.max(moneySection.today, moneySection.month, moneySection.schoolYear, 1)
    : 1

  if (!enrollment && !moneySection && !grades) {
    return <p className="mt-6 text-sm text-az-steel">No dashboard sections are available for this role.</p>
  }

  return (
    <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
      {enrollment && (
        <KpiBox title={`Enrollment - ${data.schoolYear ?? ""}`} actionLabel="Student Directory" onAction={onOpenStudentDirectory}>
          <div className="grid grid-cols-5 gap-2 mb-3">
            <Stat label="Enrolled" value={enrollment.enrolled} />
            <Stat label="New" value={enrollment.newStudents} />
            <Stat label="Returning" value={enrollment.returning} />
            <Stat label="Dropped" value={enrollment.dropped} />
            <Stat label="Transferred" value={enrollment.transferred} />
          </div>
          <p className="text-xs font-bold text-az-steel mb-1">Enrolled by level</p>
          <div className="space-y-1">
            {enrollment.byLevel.map((row) => (
              <Bar key={row.level} label={row.level} value={row.count} max={enrollmentMax} display={String(row.count)} />
            ))}
          </div>
        </KpiBox>
      )}

      {grades && (
        <KpiBox
          title={grades.period ? `Grades - ${grades.period}` : "Grades"}
          actionLabel="Post Grades"
          onAction={onOpenPostGrades}
        >
          {!grades.period ? (
            <p className="text-sm text-black">No quarter has started for the current school year.</p>
          ) : (
            <>
              <div className="border border-[#808080] bg-[#f5f5f5] p-2 mb-3 text-xs">
                <p className="font-bold text-az-steel">Overall posted grade slots</p>
                <p className="font-mono text-sm">
                  {grades.overall.posted} of {grades.overall.slots} ({grades.overall.percent ?? 0}%)
                </p>
                <div className="mt-1 h-3 border border-[#808080] bg-[#e8e8e8]">
                  <div className="h-full bg-az-teal-deep" style={{ width: `${grades.overall.percent ?? 0}%` }} />
                </div>
              </div>
              <p className="text-xs font-bold text-az-steel mb-1">Posted share by level</p>
              <div className="space-y-1">
                {grades.byLevel.map((row) => (
                  <Bar
                    key={row.level}
                    label={row.level}
                    value={row.percent ?? 0}
                    max={100}
                    display={`${row.percent ?? 0}%`}
                  />
                ))}
              </div>
            </>
          )}
        </KpiBox>
      )}

      {moneySection && (
        <div className="xl:col-span-2">
          <KpiBox title={`Money - ${data.schoolYear ?? ""}`} actionLabel="Daily Collections" onAction={onOpenDailyCollections}>
            <div className="grid grid-cols-5 gap-2 mb-3">
              <Stat label="Collected today" value={money(moneySection.today)} />
              <Stat label="This month" value={money(moneySection.month)} />
              <Stat label="This school year" value={money(moneySection.schoolYear)} />
              <Stat label="Outstanding balance" value={money(moneySection.outstanding)} />
              <Stat label="Accounts with unpaid months" value={moneySection.accountsWithDues} />
            </div>

            <div className="space-y-1 mb-3">
              <Bar label="Today" value={moneySection.today} max={moneyMax} display={money(moneySection.today)} />
              <Bar label="This month" value={moneySection.month} max={moneyMax} display={money(moneySection.month)} />
              <Bar
                label="This school year"
                value={moneySection.schoolYear}
                max={moneyMax}
                display={money(moneySection.schoolYear)}
              />
            </div>

            <p className="text-xs font-bold text-az-steel mb-1">Most recent payments</p>
            <div className="border border-[#808080] overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#e8e8e8]">
                  <tr>
                    <th className="p-1 text-left border-r border-[#d0d0d0]">Date</th>
                    <th className="p-1 text-left border-r border-[#d0d0d0]">Student / payer</th>
                    <th className="p-1 text-left border-r border-[#d0d0d0]">Receipt</th>
                    <th className="p-1 text-left border-r border-[#d0d0d0]">Posted by</th>
                    <th className="p-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {moneySection.recentPayments.map((payment, index) => (
                    <tr key={payment.id} className={index % 2 === 0 ? "bg-white" : "bg-[#f5f5f5]"}>
                      <td className="p-1 border-r border-[#d0d0d0]">{payment.date}</td>
                      <td className="p-1 border-r border-[#d0d0d0]">{payment.payer}</td>
                      <td className="p-1 border-r border-[#d0d0d0] font-mono">
                        {payment.receipt ?? ""}
                        {payment.entryType === "reversal" && (
                          <span className="ml-1 border border-red-400 bg-red-100 px-1 text-[9px] font-bold text-red-700">
                            Reversal
                          </span>
                        )}
                      </td>
                      <td className="p-1 border-r border-[#d0d0d0]">{payment.postedBy ?? ""}</td>
                      <td className={`p-1 text-right font-mono ${payment.entryType === "reversal" ? "text-red-700" : ""}`}>
                        {money(payment.amount)}
                      </td>
                    </tr>
                  ))}
                  {moneySection.recentPayments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-2 text-center text-az-steel">
                        No payments recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </KpiBox>
        </div>
      )}
    </div>
  )
}
