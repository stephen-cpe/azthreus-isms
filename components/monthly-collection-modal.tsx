"use client"

import { money } from "@/lib/money"
import { useState, useEffect } from "react"
import { Printer } from "lucide-react"
import { useUser } from "@/components/user-context"
import { WindowChrome } from "@/components/window-chrome"
import { AcademyLogo } from "@/components/academy-logo"
import { BRAND } from "@/lib/branding"
import { openPrintWindow } from "@/lib/print"
import type { CollectionReport, Lookups } from "@/lib/types"

interface MonthlyCollectionModalProps {
  onClose: () => void
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]


export function MonthlyCollectionModal({ onClose }: MonthlyCollectionModalProps) {
  const user = useUser()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [lookups, setLookups] = useState<Lookups | null>(null)
  const [month, setMonth] = useState(() => new Date().toLocaleString("en-US", { month: "long" }))
  const [year, setYear] = useState(() => String(new Date().getFullYear()))
  const [schoolYearId, setSchoolYearId] = useState("")
  const [report, setReport] = useState<CollectionReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetch("/api/lookups")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setLookups(data as Lookups)
      })
      .catch(() => {})
  }, [])

  const loadReport = () => {
    const monthNumber = MONTHS.indexOf(month) + 1
    if (!monthNumber || !/^\d{4}$/.test(year)) {
      setError("Select a month and a valid year.")
      return
    }
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ type: "monthly", month: String(monthNumber), year })
    if (schoolYearId) params.set("schoolYearId", schoolYearId)

    fetch(`/api/collections?${params.toString()}`)
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as (CollectionReport & { error?: string }) | null
        if (!response.ok || !data) {
          setError(data?.error ?? "Failed to generate the report")
          return
        }
        setReport(data)
      })
      .catch(() => setError("Unable to reach the server"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatHeaderDate = (date: Date) =>
    date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "2-digit" })

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })

  const printReport = () => {
    if (!report) return
    openPrintWindow({
      title: "Monthly Collection Report",
      subtitle: `${month} ${year}`,
      meta: [
        { label: "School Year", value: lookups?.schoolYears.find((entry) => String(entry.id) === schoolYearId)?.code ?? "All" },
        { label: "Rows", value: String(report.count) },
        { label: "Grand Total", value: money(report.totals.total) },
      ],
      tables: [
        {
          headers: ["Names", "Level", "Months", "Date", "Receipt", "Tuition", "Computer", "Reg.", "Misc", "Books", "Others", "Total", "Posted By"],
          align: ["left", "left", "left", "left", "left", "right", "right", "right", "right", "right", "right", "right", "left"],
          rows: [
            ...report.rows.map((payment) => [
              payment.entryType === "reversal"
                ? `Reversal of ${payment.reversesReceipt ?? payment.description ?? "payment"} - ${payment.studentName}`
                : payment.studentName,
              payment.level ?? "",
              payment.months ?? "",
              payment.date,
              payment.receipt ?? "",
              money(payment.tuition),
              money(payment.computer),
              money(payment.reg),
              money(payment.misc),
              money(payment.books),
              money(payment.others),
              money(payment.total),
              payment.postedBy ?? "",
            ]),
            [
              "TOTAL",
              "",
              "",
              "",
              "",
              money(report.totals.tuition),
              money(report.totals.computer),
              money(report.totals.reg),
              money(report.totals.misc),
              money(report.totals.books),
              money(report.totals.others),
              money(report.totals.total),
              "",
            ],
          ],
        },
      ],
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#f0f0f0] border-2 border-[#808080] w-[1100px] max-h-[92vh] overflow-auto shadow-lg">
        <WindowChrome title="Monthly Collections" onClose={onClose}>

        {/* Content */}
        <div className="p-4 bg-az-teal-pale">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <AcademyLogo className="w-20 h-20 border-4 border-az-teal-deep" />
              <div>
                <h1 className="text-az-steel text-xl font-bold">{BRAND.schoolName}</h1>
                <p className="text-az-teal-deep text-sm font-bold">{BRAND.addressLine}</p>
                <h2 className="text-az-teal-deep text-lg font-bold mt-1">Monthly Collections</h2>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-red-600 font-bold">{user.fullName}</span>
              <div className="text-right text-xs text-az-teal-deep font-bold">
                <p>{formatHeaderDate(currentTime)}</p>
                <p>{formatTime(currentTime)}</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm">Month:</span>
              <select
                className="border border-[#808080] bg-white p-1 w-32"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              >
                {MONTHS.map((monthName) => (
                  <option key={monthName}>{monthName}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Year:</span>
              <input
                type="text"
                className="border border-[#808080] bg-white p-1 w-20"
                value={year}
                onChange={(event) => setYear(event.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">School Year:</span>
              <select
                className="border border-[#808080] bg-white p-1 w-32"
                value={schoolYearId}
                onChange={(event) => setSchoolYearId(event.target.value)}
              >
                <option value="">(All)</option>
                {lookups?.schoolYears.map((yearOption) => (
                  <option key={yearOption.id} value={yearOption.id}>
                    {yearOption.code}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 text-sm font-bold hover:bg-[#d0d0d0] disabled:opacity-60"
              onClick={loadReport}
              disabled={loading}
            >
              {loading ? "Loading..." : "Go"}
            </button>
            <button className="p-1 bg-[#c0c0c0] border border-[#808080]" onClick={printReport}>
              <Printer className="w-5 h-5" />
            </button>
            <button
              className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 text-az-steel hover:bg-[#d0d0d0]"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          {error && <p className="text-sm text-red-600 font-bold mb-2">{error}</p>}

          {/* Data Grid */}
          <div className="border border-[#808080] bg-white">
            <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] text-xs font-bold bg-[#c0c0c0] border-b border-[#808080]">
              <div className="p-1 border-r border-[#808080] col-span-2">Names</div>
              <div className="p-1 border-r border-[#808080]">Level</div>
              <div className="p-1 border-r border-[#808080]">Months</div>
              <div className="p-1 border-r border-[#808080]">Date</div>
              <div className="p-1 border-r border-[#808080]">Receipt</div>
              <div className="p-1 border-r border-[#808080]">Tuition</div>
              <div className="p-1 border-r border-[#808080]">Computer</div>
              <div className="p-1 border-r border-[#808080]">Reg.</div>
              <div className="p-1 border-r border-[#808080]">Misc</div>
              <div className="p-1 border-r border-[#808080]">Books</div>
              <div className="p-1 border-r border-[#808080]">Others</div>
              <div className="p-1 border-r border-[#808080]">TOTAL</div>
              <div className="p-1">Posted by</div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {report?.rows.map((payment, index) => (
                <div
                  key={index}
                  className={`grid grid-cols-[repeat(14,minmax(0,1fr))] text-xs border-b border-[#d0d0d0] ${
                    payment.entryType === "reversal"
                      ? "bg-[#f7e2e2] text-[#7a2f2f]"
                      : index % 2 === 0
                        ? "bg-white"
                        : "bg-[#f5f5f5]"
                  }`}
                >
                  <div className="p-1 border-r border-[#d0d0d0] col-span-2 text-az-steel">
                    {payment.studentName}
                    {payment.entryType === "reversal" && (
                      <span className="block text-[10px] font-bold text-red-700">
                        Reversal of {payment.reversesReceipt ?? payment.description ?? "payment"}
                      </span>
                    )}
                  </div>
                  <div className="p-1 border-r border-[#d0d0d0]">{payment.level ?? ""}</div>
                  <div className="p-1 border-r border-[#d0d0d0]">{payment.months ?? ""}</div>
                  <div className="p-1 border-r border-[#d0d0d0]">{payment.date}</div>
                  <div className="p-1 border-r border-[#d0d0d0]">{payment.receipt ?? ""}</div>
                  <div className="p-1 border-r border-[#d0d0d0] text-right">{money(payment.tuition)}</div>
                  <div className="p-1 border-r border-[#d0d0d0] text-right">{money(payment.computer)}</div>
                  <div className="p-1 border-r border-[#d0d0d0] text-right">{money(payment.reg)}</div>
                  <div className="p-1 border-r border-[#d0d0d0] text-right">{money(payment.misc)}</div>
                  <div className="p-1 border-r border-[#d0d0d0] text-right">{money(payment.books)}</div>
                  <div className="p-1 border-r border-[#d0d0d0] text-right">{money(payment.others)}</div>
                  <div className="p-1 border-r border-[#d0d0d0] text-right font-bold">{money(payment.total)}</div>
                  <div className="p-1">{payment.postedBy ?? ""}</div>
                </div>
              ))}
              {report && report.rows.length === 0 && (
                <div className="p-3 text-sm text-az-steel">
                  No collections posted for this month.
                </div>
              )}
            </div>

            {report && (
              <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] text-xs font-bold bg-az-steel text-white border-t border-[#808080]">
                <div className="p-1 col-span-6">TOTAL ({report.count} rows)</div>
                <div className="p-1 text-right">{money(report.totals.tuition)}</div>
                <div className="p-1 text-right">{money(report.totals.computer)}</div>
                <div className="p-1 text-right">{money(report.totals.reg)}</div>
                <div className="p-1 text-right">{money(report.totals.misc)}</div>
                <div className="p-1 text-right">{money(report.totals.books)}</div>
                <div className="p-1 text-right">{money(report.totals.others)}</div>
                <div className="p-1 text-right">{money(report.totals.total)}</div>
                <div className="p-1"></div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-2 text-az-teal-deep text-sm flex justify-between">
            <span className="underline">Count: {report?.count ?? 0}</span>
            <span className="font-bold">Grand Total: {money(report?.totals.total ?? 0)}</span>
          </div>
        </div>
        </WindowChrome>
      </div>
    </div>
  )
}
