import { BRAND } from "./branding"

export interface PrintSection {
  label: string
  value: string
}

export interface PrintTable {
  headers: string[]
  align?: ("left" | "right")[]
  rows: string[][]
}

export interface PrintDocument {
  title: string
  subtitle?: string
  meta?: PrintSection[]
  tables?: PrintTable[]
  footer?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function openPrintWindow(document: PrintDocument): boolean {
  if (typeof window === "undefined") return false

  const meta = document.meta?.length
    ? `<div class="meta">${document.meta
        .map(
          (item) =>
            `<p><span class="label">${escapeHtml(item.label)}</span><span class="value">${escapeHtml(item.value)}</span></p>`,
        )
        .join("")}</div>`
    : ""

  const logoUrl =
    typeof window === "undefined"
      ? BRAND.academyLogoSrc
      : new URL(BRAND.academyLogoSrc, window.location.origin).toString()
  const signatures = ["Registrar", "Cashier", "Parent / Guardian"]
    .map((label) => `<div>${escapeHtml(label)}</div>`)
    .join("")

  const tables = (document.tables ?? [])
    .map((table) => {
      const align = table.align ?? table.headers.map(() => "left" as const)
      const cellClass = (index: number) => (align[index] === "right" ? "right" : "left")
      const head = table.headers
        .map((header, index) => `<th class="${cellClass(index)}">${escapeHtml(header)}</th>`)
        .join("")
      const body = table.rows
        .map(
          (row) =>
            `<tr>${row
              .map((cell, index) => `<td class="${cellClass(index)}">${escapeHtml(cell)}</td>`)
              .join("")}</tr>`,
        )
        .join("")
      return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
    })
    .join("")

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(document.title)}</title>
<style>
  :root { --az-steel: #38506c; --az-teal-deep: #35696a; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 24px; }
  .letterhead { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #808080; padding-bottom: 10px; margin-bottom: 14px; }
  .crest { width: 64px; height: 64px; object-fit: contain; }
  h1 { color: var(--az-teal-deep); font-size: 22px; margin: 0 0 2px; }
  .school-address { font-size: 11px; color: var(--az-teal-deep); font-weight: bold; margin: 0 0 2px; }
  .product { font-size: 11px; color: var(--az-steel); font-weight: bold; margin: 0 0 10px; }
  h2 { color: var(--az-steel); font-size: 16px; margin: 0 0 12px; }
  .meta { margin: 12px 0; }
  .meta p { margin: 2px 0; font-size: 13px; }
  .meta .label { display: inline-block; width: 180px; font-weight: bold; color: var(--az-steel); }
  table { border-collapse: collapse; width: 100%; margin-top: 12px; font-size: 12px; }
  th { background: var(--az-steel); color: #fff; border: 1px solid #808080; padding: 4px 6px; }
  td { border: 1px solid #808080; padding: 4px 6px; }
  .right { text-align: right; }
  .left { text-align: left; }
  .footer { margin-top: 18px; font-size: 12px; font-weight: bold; color: #cc0000; }
  .signatures { margin-top: 48px; display: flex; justify-content: space-between; font-size: 12px; }
  .signatures div { border-top: 1px solid #000; width: 30%; text-align: center; padding-top: 4px; }
</style>
</head>
<body>
<div class="letterhead">
  <img class="crest" src="${escapeHtml(logoUrl)}" alt="" />
  <div>
    <h1>${escapeHtml(BRAND.schoolName)}</h1>
    <p class="school-address">${escapeHtml(BRAND.addressLine)}</p>
    <p class="product">${escapeHtml(BRAND.productName)} &mdash; ${escapeHtml(BRAND.productSubtitle)}</p>
  </div>
</div>
<h2>${escapeHtml(document.title)}${document.subtitle ? ` &mdash; ${escapeHtml(document.subtitle)}` : ""}</h2>
${meta}
${tables}
${document.footer ? `<p class="footer">${escapeHtml(document.footer)}</p>` : ""}
<div class="signatures">${signatures}</div>
</body>
</html>`

  const printWindow = window.open("", "_blank", "width=920,height=650")
  if (!printWindow) return false
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  return true
}
