import { NextRequest, NextResponse } from "next/server"
import { withTransaction } from "@/lib/db"
import { writeAudit } from "@/lib/audit"
import { ApiError, badRequest, requireRoles, serverError } from "@/lib/auth"
import { hashPassword } from "@/lib/password"
import type { ManagedUser } from "@/lib/types"
import { MANAGED_USER_ROLES, MIN_PASSWORD_LENGTH, USER_COLUMNS } from "@/lib/users"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface TargetUser {
  id: number
  fullName: string | null
  role: string
  isActive: boolean
  passwordHash: string
}

interface PatchUserBody {
  fullName?: unknown
  role?: unknown
  isActive?: unknown
  resetPassword?: unknown
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(["admin"])
  if (auth.error) return auth.error

  try {
    const { id } = await params
    const userId = Number(id)
    if (!Number.isInteger(userId) || userId <= 0) return badRequest("Invalid user id")

    const body = (await req.json().catch(() => null)) as PatchUserBody | null
    if (!body) return badRequest("Invalid request body")

    const hasFullName = body.fullName !== undefined
    const hasRole = body.role !== undefined
    const hasIsActive = body.isActive !== undefined
    const hasResetPassword = body.resetPassword !== undefined

    if (!hasFullName && !hasRole && !hasIsActive && !hasResetPassword) {
      return badRequest("No changes were provided")
    }

    let nextFullName: string | null | undefined
    if (hasFullName) {
      if (typeof body.fullName !== "string" || !body.fullName.trim()) {
        return badRequest("Full name is required")
      }
      if (body.fullName.trim().length > 100) return badRequest("Full name must be 100 characters or fewer")
      nextFullName = body.fullName.trim()
    }

    let nextRole: string | undefined
    if (hasRole) {
      if (typeof body.role !== "string" || !MANAGED_USER_ROLES.includes(body.role as (typeof MANAGED_USER_ROLES)[number])) {
        return badRequest("Role must be administrator, registrar, or cashier")
      }
      nextRole = body.role
    }

    let nextIsActive: boolean | undefined
    if (hasIsActive) {
      if (typeof body.isActive !== "boolean") return badRequest("Active status must be true or false")
      nextIsActive = body.isActive
    }

    let nextPasswordHash: string | undefined
    if (hasResetPassword) {
      if (typeof body.resetPassword !== "string" || body.resetPassword.length < MIN_PASSWORD_LENGTH) {
        return badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      }
      if (body.resetPassword.length > 1024) return badRequest("Password must be 1024 characters or fewer")
      nextPasswordHash = hashPassword(body.resetPassword)
    }

    const user = await withTransaction(async (client) => {
      // Serialize admin-role changes so two concurrent requests cannot remove
      // the last active administrator.
      await client.query(`SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE FOR UPDATE`)

      const targetResult = await client.query<TargetUser>(
        `SELECT id, full_name AS "fullName", role, is_active AS "isActive", password_hash AS "passwordHash"
         FROM users
         WHERE id = $1
         FOR UPDATE`,
        [userId],
      )
      const target = targetResult.rows[0]
      if (!target) throw new ApiError(404, "User not found")

      const resolvedFullName = hasFullName ? (nextFullName ?? null) : target.fullName
      const resolvedRole = nextRole ?? target.role
      const resolvedActive = nextIsActive ?? target.isActive
      const resolvedHash = nextPasswordHash ?? target.passwordHash

      if (target.id === auth.user.id) {
        if (!resolvedActive) throw new ApiError(400, "You cannot deactivate your own account.")
        if (target.role === "admin" && resolvedRole !== "admin") {
          throw new ApiError(400, "You cannot change your own administrator role.")
        }
      }

      const wasActiveAdmin = target.role === "admin" && target.isActive
      const remainsActiveAdmin = resolvedRole === "admin" && resolvedActive
      if (wasActiveAdmin && !remainsActiveAdmin) {
        const otherAdmins = await client.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count
           FROM users
           WHERE role = 'admin' AND is_active = TRUE AND id <> $1`,
          [userId],
        )
        if (otherAdmins.rows[0].count === 0) {
          throw new ApiError(409, "The system must keep at least one active administrator.")
        }
      }

      const updated = await client.query<ManagedUser>(
        `UPDATE users
         SET full_name = $2, role = $3, is_active = $4, password_hash = $5
         WHERE id = $1
         RETURNING ${USER_COLUMNS}`,
        [target.id, resolvedFullName, resolvedRole, resolvedActive, resolvedHash],
      )
      const updatedUser = updated.rows[0]

      if (hasResetPassword) {
        await writeAudit(client, auth.user, {
          action: "user.password_reset",
          entityType: "user",
          entityId: target.id,
          summary: `Reset the password for user "${updatedUser.username}"`,
        })
      } else if (hasIsActive && target.isActive && !resolvedActive) {
        await writeAudit(client, auth.user, {
          action: "user.deactivate",
          entityType: "user",
          entityId: target.id,
          summary: `Deactivated user "${updatedUser.username}"`,
        })
      } else {
        const changedFields = [
          ...(hasFullName ? ["fullName"] : []),
          ...(hasRole ? ["role"] : []),
          ...(hasIsActive ? ["isActive"] : []),
        ]
        await writeAudit(client, auth.user, {
          action: "user.update",
          entityType: "user",
          entityId: target.id,
          summary: `Updated user "${updatedUser.username}" (${changedFields.join(", ")})`,
          details: { changed: changedFields, isActive: resolvedActive },
        })
      }

      return updatedUser
    })

    return NextResponse.json({ user })
  } catch (error) {
    return serverError(error)
  }
}
