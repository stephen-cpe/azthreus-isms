import type { PoolClient } from "pg"

/**
 * Audit Log helpers. Every call takes the transaction client so the audit row
 * commits or rolls back with the change it describes. Never put password
 * hashes, session tokens, or full personal records in details.
 */

export const AUDIT_ACTIONS = [
  "login.success",
  "login.failure",
  "user.create",
  "user.update",
  "user.deactivate",
  "user.password_reset",
  "user.password_change",
  "student.create",
  "student.update",
  "student.status_change",
  "student.reenroll",
  "account.create",
  "payment.post",
  "payment.reverse",
  "assessment.create",
  "assessment.update",
  "grades.save",
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const AUDIT_ENTITY_TYPES = [
  "user",
  "student",
  "account",
  "payment",
  "assessment",
  "grades",
] as const

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number]

export interface AuditActor {
  id: number | null
  username: string
}

export interface AuditEntry {
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string | number | null
  summary: string
  details?: Record<string, unknown> | null
}

export async function writeAudit(client: PoolClient, actor: AuditActor, entry: AuditEntry): Promise<void> {
  await client.query(
    `INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, summary, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      actor.id,
      actor.username,
      entry.action,
      entry.entityType,
      entry.entityId === null || entry.entityId === undefined ? null : String(entry.entityId),
      entry.summary,
      entry.details ? JSON.stringify(entry.details) : null,
    ],
  )
}
