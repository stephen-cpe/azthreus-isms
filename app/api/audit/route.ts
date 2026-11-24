import { NextRequest, NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { badRequest, requireRoles, serverError } from "@/lib/auth"
import { isValidIsoDate } from "@/lib/date"
import type { AuditLogEntry, AuditLogPage } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  const auth = await requireRoles(["admin"])
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(req.url)
    const where: string[] = []
    const params: unknown[] = []

    const from = searchParams.get("from")
    if (from && isValidIsoDate(from)) {
      params.push(from)
      where.push(`a.occurred_at::date >= $${params.length}::date`)
    }
    const to = searchParams.get("to")
    if (to && isValidIsoDate(to)) {
      params.push(to)
      where.push(`a.occurred_at::date <= $${params.length}::date`)
    }
    const username = searchParams.get("username")?.trim()
    if (username) {
      if (username.length > 50) return badRequest("The username filter is too long")
      params.push(`%${username}%`)
      where.push(`a.username ILIKE $${params.length}`)
    }
    const entityType = searchParams.get("entityType")?.trim()
    if (entityType) {
      if (entityType.length > 30) return badRequest("The entity filter is too long")
      params.push(entityType)
      where.push(`a.entity_type = $${params.length}`)
    }
    const action = searchParams.get("action")?.trim()
    if (action) {
      if (action.length > 40) return badRequest("The action filter is too long")
      params.push(action)
      where.push(`a.action = $${params.length}`)
    }
    const entityId = searchParams.get("entityId")?.trim()
    if (entityId) {
      if (entityId.length > 40) return badRequest("The entity id filter is too long")
      params.push(entityId)
      where.push(`a.entity_id = $${params.length}`)
    }

    const pageInput = Number(searchParams.get("page"))
    const page = Number.isInteger(pageInput) && pageInput > 0 ? pageInput : 1
    const filter = where.length ? `WHERE ${where.join(" AND ")}` : ""

    const totalRow = await queryOne<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM audit_log a ${filter}`,
      params,
    )
    const total = totalRow?.total ?? 0
    const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1)
    const resolvedPage = Math.min(page, totalPages)

    const pageParams = [...params, PAGE_SIZE, (resolvedPage - 1) * PAGE_SIZE]
    const entries = await query<AuditLogEntry>(
      `SELECT
         a.id,
         TO_CHAR(a.occurred_at, 'MM/DD/YYYY HH12:MI:SS AM') AS "occurredAt",
         a.user_id AS "userId",
         a.username,
         a.action,
         a.entity_type AS "entityType",
         a.entity_id AS "entityId",
         a.summary,
         a.details
       FROM audit_log a
       ${filter}
       ORDER BY a.occurred_at DESC, a.id DESC
       LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
      pageParams,
    )

    const payload: AuditLogPage = { entries, page: resolvedPage, pageSize: PAGE_SIZE, total, totalPages }
    return NextResponse.json(payload)
  } catch (error) {
    return serverError(error)
  }
}
