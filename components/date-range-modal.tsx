"use client"

import { money } from "@/lib/money"
import { useState, useEffect } from "react"
import { Calendar, Printer } from "lucide-react"
import { WindowChrome } from "@/components/window-chrome"
import { openPrintWindow } from "@/lib/print"
import type { CollectionReport, CollectionRow, Lookups } from "@/lib/types"

interface DateRangeModalProps {
  onClose: () => void
}


export function DateRangeModal({ onClose }: DateRangeModalProps) {
  const [beginDate, setBeginDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [report, setReport] = useState<CollectionReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Default the range to the current school year once lookups load.
  useEffect(() => {
    fetch("/api/lookups")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return
        const lookups = data as Lookups
        const current = lookups.schoolYears.find((year) => year.isCurrent)
        setBeginDate((prev) => prev || (current?.startDate ?? ""))
        setEndDate((prev) => prev || (current?.endDate ?? ""))
      })
      .catch(() => {})
  }, [])

  const loadReport = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(beginDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      setError("Enter valid beginning and ending dates.")
      return
    }
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ type: "range", from: beginDate, to: endDate })

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

  const row = (payment: CollectionRow, index: number) => {
    const isReversal = payment.entryType === "reversal"
    return (
      <div
        key={index}
        className={`grid grid-cols-12 text-xs border-b border-[#d0d0d0] ${
          isReversal ? "bg-[#f7e2e2] text-[#7a2f2f]" : index % 2 === 0 ? "bg-white" : "bg-[#f5f5f5]"
        }`}
      >
        <div className="p-1 border-r border-[#d0d0d0] col-span-2 text-az-steel">
          {payment.studentName}
          {isReversal && (
            <span className="block text-[10px] font-bold text-red-700">
              Reversal of {payment.reversesReceipt ?? payment.description ?? "payment"}
            </span>
          )}
        </div>
        <div className="p-1 border-r border-[#d0d0d0]">{payment.level ?? ""}</div>
        <div className="p-1 border-r border-[#d0d0d0]">{payment.date}</div>
        <div className="p-1 border-r border-[#d0d0d0]">{payment.receipt ?? ""}</div>
        <div className="p-1 border-r border-[#d0d0d0] text-right">{money(payment.tuition)}</div>
        <div className="p-1 border-r border-[#d0d0d0] text-right">{money(payment.computer)}</div>
        <div className="p-1 border-r border-[#d0d0d0] text-right">{money(payment.reg)}</div>
        <div className="p-1 border-r border-[#d0d0d0] text-right">{money(payment.misc)}</div>
        <div className="p-1 border-r border-[#d0d0d0] text-right">{money(payment.books)}</div>
        <div className="p-1 border-r border-[#d0d0d0] text-right">{money(payment.others)}</div>
        <div className="p-1 text-right font-bold">{money(payment.total)}</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className={`bg-[#f0f0f0] border-2 border-[#808080] shadow-lg ${
          report ? "w-[1000px] max-h-[92vh] overflow-auto" : "w-[380px]"
        }`}
      >
        <WindowChrome title="Collection Report By Date Range" onClose={onClose}>

        {/* Content */}
        <div className="p-4">
          <div className="border border-[#808080] p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <label className="w-36 text-sm">Beginning date:</label>
              <input
                type="date"
                className="flex-1 border border-[#808080] bg-white p-1"
                value={beginDate}
                onChange={(event) => setBeginDate(event.target.value)}
              />
              <Calendar className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <label className="w-36 text-sm">Ending date:</label>
              <input
                type="date"
                className="flex-1 border border-[#808080] bg-white p-1"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
              <Calendar className="w-4 h-4" />
            </div>
            {error && <p className="text-sm text-red-600 font-bold mt-3">{error}</p>}
          </div>

          <div className="flex justify-center gap-4 mb-4">
            <button
              className="bg-[#c0c0c0] border-2 border-[#808080] px-8 py-1 text-sm hover:bg-[#d0d0d0] disabled:opacity-60"
              onClick={loadReport}
              disabled={loading}
            >
              {loading ? "Loading..." : "OK"}
            </button>
            <button
              className="bg-[#c0c0c0] border-2 border-[#808080] px-6 py-1 text-sm hover:bg-[#d0d0d0]"
              onClick={report ? () => setReport(null) : onClose}
            >
              {report ? "Back" : "Cancel"}
            </button>
            {report && (
              <button
                className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 text-sm hover:bg-[#d0d0d0]"
                onClick={() =>
                  openPrintWindow({
                    title: "Collection Report By Date Range",
                    subtitle: `${beginDate} to ${endDate}`,
                    meta: [
                      { label: "Rows", value: String(report.count) },
                      { label: "Grand Total", value: money(report.totals.total) },
                    ],
                    tables: [
                      {
                        headers: ["Names", "Level", "Date", "Receipt", "Tuition", "Computer", "Reg.", "Misc", "Books", "Others", "Total"],
                        align: ["left", "left", "left", "left", "right", "right", "right", "right", "right", "right", "right"],
                        rows: [
                          ...report.rows.map((payment) => [
                            payment.entryType === "reversal"
                              ? `Reversal of ${payment.reversesReceipt ?? payment.description ?? "payment"} - ${payment.studentName}`
                              : payment.studentName,
                            payment.level ?? "",
                            payment.date,
                            payment.receipt ?? "",
                            money(payment.tuition),
                            money(payment.computer),
                            money(payment.reg),
                            money(payment.misc),
                            money(payment.books),
                            money(payment.others),
                            money(payment.total),
                          ]),
                          [
                            "TOTAL",
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
                          ],
                        ],
                      },
                    ],
                  })
                }
              >
                <Printer className="w-4 h-4" />
              </button>
            )}
          </div>

          {report && (
            <div className="border border-[#808080] bg-white">
              <div className="grid grid-cols-12 text-xs font-bold bg-[#c0c0c0] border-b border-[#808080]">
                <div className="p-1 border-r border-[#808080] col-span-2">Names</div>
                <div className="p-1 border-r border-[#808080]">Level</div>
                <div className="p-1 border-r border-[#808080]">Date</div>
                <div className="p-1 border-r border-[#808080]">Receipt</div>
                <div className="p-1 border-r border-[#808080]">Tuition</div>
                <div className="p-1 border-r border-[#808080]">Computer</div>
                <div className="p-1 border-r border-[#808080]">Reg.</div>
                <div className="p-1 border-r border-[#808080]">Misc</div>
                <div className="p-1 border-r border-[#808080]">Books</div>
                <div className="p-1 border-r border-[#808080]">Others</div>
                <div className="p-1">TOTAL</div>
              </div>

              <div className="max-h-72 overflow-y-auto">
                {report.rows.map((payment, index) => row(payment, index))}
                {report.rows.length === 0 && (
                  <div className="p-3 text-sm text-az-steel">No collections found in this date range.</div>
                )}
              </div>

              <div className="grid grid-cols-12 text-xs font-bold bg-az-steel text-white border-t border-[#808080]">
                <div className="p-1 col-span-4">TOTAL ({report.count} rows)</div>
                <div className="p-1"></div>
                <div className="p-1 text-right">{money(report.totals.tuition)}</div>
                <div className="p-1 text-right">{money(report.totals.computer)}</div>
                <div className="p-1 text-right">{money(report.totals.reg)}</div>
                <div className="p-1 text-right">{money(report.totals.misc)}</div>
                <div className="p-1 text-right">{money(report.totals.books)}</div>
                <div className="p-1 text-right">{money(report.totals.others)}</div>
                <div className="p-1 text-right">{money(report.totals.total)}</div>
              </div>
            </div>
          )}
        </div>
        </WindowChrome>
      </div>
    </div>
  )
}
