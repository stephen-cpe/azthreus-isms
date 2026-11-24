"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { WindowChrome } from "@/components/window-chrome"
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/lib/audit"
import type { AuditLogEntry, AuditLogPage } from "@/lib/types"

interface AuditLogModalProps {
  onClose: () => void
}

interface Filters {
  from: string
  to: string
  username: string
  entityType: string
  action: string
}

const emptyFilters: Filters = { from: "", to: "", username: "", entityType: "", action: "" }

export function AuditLogModal({ onClose }: AuditLogModalProps) {
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [applied, setApplied] = useState<Filters>(emptyFilters)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AuditLogPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<AuditLogEntry | null>(null)

  const load = (targetPage: number, activeFilters: Filters) => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(targetPage) })
    if (activeFilters.from) params.set("from", activeFilters.from)
    if (activeFilters.to) params.set("to", activeFilters.to)
    if (activeFilters.username.trim()) params.set("username", activeFilters.username.trim())
    if (activeFilters.entityType) params.set("entityType", activeFilters.entityType)
    if (activeFilters.action) params.set("action", activeFilters.action)

    fetch(`/api/audit?${params.toString()}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as (AuditLogPage & { error?: string }) | null
        if (!response.ok || !payload?.entries) {
          setError(payload?.error ?? "Unable to load the audit log.")
          return
        }
        setData(payload)
        setPage(payload.page)
      })
      .catch(() => setError("Unable to reach the server."))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(1, emptyFilters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyFilters = () => {
    setApplied(filters)
    setPage(1)
    load(1, filters)
  }

  const clearFilters = () => {
    setFilters(emptyFilters)
    setApplied(emptyFilters)
    setPage(1)
    load(1, emptyFilters)
  }

  const goToPage = (target: number) => {
    if (!data || target < 1 || target > data.totalPages) return
    setPage(target)
    load(target, applied)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#f0f0f0] border-2 border-[#808080] w-[1150px] max-h-[92vh] overflow-auto shadow-lg">
        <WindowChrome title="Audit Log" icon="audit" onClose={onClose}>
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h1 className="text-az-teal-deep text-2xl font-bold">Audit Log</h1>
                <p className="text-sm text-black">
                  Every recorded action, newest first. Filter by date, user, entity, or action, then open Details for
                  the stored JSON.
                </p>
              </div>
              <span className="text-xs text-az-steel font-bold">{data ? `${data.total} entries` : ""}</span>
            </div>

            <div className="border border-[#808080] bg-white p-2 mb-3">
              <div className="flex flex-wrap items-end gap-3 text-sm">
                <label className="block">
                  <span className="font-bold text-az-steel">From:</span>
                  <input
                    type="date"
                    className="block border border-[#808080] bg-white p-1 mt-1 w-36"
                    value={filters.from}
                    onChange={(event) => setFilters((previous) => ({ ...previous, from: event.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="font-bold text-az-steel">To:</span>
                  <input
                    type="date"
                    className="block border border-[#808080] bg-white p-1 mt-1 w-36"
                    value={filters.to}
                    onChange={(event) => setFilters((previous) => ({ ...previous, to: event.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="font-bold text-az-steel">Username:</span>
                  <input
                    type="text"
                    className="block border border-[#808080] bg-white p-1 mt-1 w-40"
                    value={filters.username}
                    onChange={(event) => setFilters((previous) => ({ ...previous, username: event.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="font-bold text-az-steel">Entity:</span>
                  <select
                    className="block border border-[#808080] bg-white p-1 mt-1 w-36"
                    value={filters.entityType}
                    onChange={(event) => setFilters((previous) => ({ ...previous, entityType: event.target.value }))}
                  >
                    <option value="">(All)</option>
                    {AUDIT_ENTITY_TYPES.map((entity) => (
                      <option key={entity} value={entity}>
                        {entity}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="font-bold text-az-steel">Action:</span>
                  <select
                    className="block border border-[#808080] bg-white p-1 mt-1 w-48"
                    value={filters.action}
                    onChange={(event) => setFilters((previous) => ({ ...previous, action: event.target.value }))}
                  >
                    <option value="">(All)</option>
                    {AUDIT_ACTIONS.map((action) => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="bg-az-teal-deep text-white border-2 border-[#808080] px-4 py-1 font-bold hover:bg-az-teal disabled:opacity-60"
                  onClick={applyFilters}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Apply"}
                </button>
                <button
                  className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 font-bold text-az-steel hover:bg-[#d0d0d0]"
                  onClick={clearFilters}
                  disabled={loading}
                >
                  Clear
                </button>
              </div>
            </div>

            {error && <p className="mb-2 text-sm text-red-600 font-bold">{error}</p>}

            <div className="border border-[#808080] bg-white max-h-[46vh] overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-az-steel text-white sticky top-0">
                  <tr>
                    <th className="p-1 text-left border-r border-az-slate w-36">When</th>
                    <th className="p-1 text-left border-r border-az-slate w-28">User</th>
                    <th className="p-1 text-left border-r border-az-slate w-44">Action</th>
                    <th className="p-1 text-left border-r border-az-slate w-40">Entity</th>
                    <th className="p-1 text-left border-r border-az-slate">Summary</th>
                    <th className="p-1 text-left w-16">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.entries.map((entry, index) => (
                    <tr key={entry.id} className={index % 2 === 0 ? "bg-white" : "bg-[#f5f5f5]"}>
                      <td className="p-1 border-r border-[#d0d0d0] whitespace-nowrap">{entry.occurredAt}</td>
                      <td className="p-1 border-r border-[#d0d0d0] font-mono">{entry.username ?? "-"}</td>
                      <td className="p-1 border-r border-[#d0d0d0] font-mono text-az-teal-deep">{entry.action}</td>
                      <td className="p-1 border-r border-[#d0d0d0] font-mono">
                        {entry.entityType}
                        {entry.entityId ? ` #${entry.entityId}` : ""}
                      </td>
                      <td className="p-1 border-r border-[#d0d0d0]">{entry.summary}</td>
                      <td className="p-1">
                        <button
                          className="bg-[#c0c0c0] border border-[#808080] px-1.5 py-0.5 hover:bg-[#d0d0d0]"
                          onClick={() => setSelected(entry)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && data && data.entries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-az-steel">
                        No audit entries match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-3 text-sm">
              <p className="text-az-steel">
                Page {data?.page ?? 1} of {data?.totalPages ?? 1} - {data?.total ?? 0} entries
              </p>
              <div className="flex gap-2">
                <button
                  className="bg-[#c0c0c0] border-2 border-[#808080] px-3 py-1 font-bold text-az-steel hover:bg-[#d0d0d0] disabled:opacity-50"
                  onClick={() => goToPage(page - 1)}
                  disabled={!data || page <= 1 || loading}
                >
                  Previous
                </button>
                <button
                  className="bg-[#c0c0c0] border-2 border-[#808080] px-3 py-1 font-bold text-az-steel hover:bg-[#d0d0d0] disabled:opacity-50"
                  onClick={() => goToPage(page + 1)}
                  disabled={!data || page >= data.totalPages || loading}
                >
                  Next
                </button>
                <button
                  className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 font-bold text-az-steel hover:bg-[#d0d0d0]"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </WindowChrome>
      </div>

      {selected && (
        <div className="fixed inset-0 z-[70] flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative h-full w-[520px] bg-[#f0f0f0] border-l-2 border-[#808080] shadow-lg overflow-auto">
            <div className="bg-gradient-to-r from-az-steel to-az-teal-deep px-2 py-1 flex items-center justify-between">
              <span className="text-white text-sm">Audit Entry #{selected.id}</span>
              <button
                className="w-5 h-5 bg-[#c0c0c0] border border-[#808080] flex items-center justify-center"
                onClick={() => setSelected(null)}
                title="Close details"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="p-3 text-xs space-y-2">
              <p>
                <span className="font-bold text-az-steel">When:</span> {selected.occurredAt}
              </p>
              <p>
                <span className="font-bold text-az-steel">User:</span> {selected.username ?? "-"}
                {selected.userId ? ` (#${selected.userId})` : ""}
              </p>
              <p>
                <span className="font-bold text-az-steel">Action:</span> {selected.action}
              </p>
              <p>
                <span className="font-bold text-az-steel">Entity:</span> {selected.entityType}
                {selected.entityId ? ` #${selected.entityId}` : ""}
              </p>
              <p>
                <span className="font-bold text-az-steel">Summary:</span> {selected.summary}
              </p>
              <div>
                <p className="font-bold text-az-steel mb-1">Details (JSON)</p>
                <pre className="border border-[#808080] bg-white p-2 text-[11px] whitespace-pre-wrap break-words">
                  {selected.details ? JSON.stringify(selected.details, null, 2) : "No details recorded."}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
