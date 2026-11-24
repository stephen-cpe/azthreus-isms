// Display formats for the sequence-based record numbers. The database stores
// plain integers; every screen and printout uses these helpers so the same
// number always reads the same way.

export function formatStudentNo(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return ""
  return `AA-${value}`
}

export function formatAccountNo(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return ""
  return `AC-${value}`
}

export function formatReceiptNo(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return ""
  return `AZR-${String(value).padStart(6, "0")}`
}

export function formatReversalNo(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return ""
  return `AZV-${String(value).padStart(6, "0")}`
}
