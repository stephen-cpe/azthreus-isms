import { NextRequest, NextResponse } from "next/server"
import { queryOne, withTransaction } from "@/lib/db"
import { writeAudit } from "@/lib/audit"
import { badRequest, requireAuth, serverError } from "@/lib/auth"
import { hashPassword, verifyPassword } from "@/lib/password"
import { MIN_PASSWORD_LENGTH } from "@/lib/users"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface ChangePasswordBody {
  currentPassword?: string
  newPassword?: string
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const body = (await req.json().catch(() => null)) as ChangePasswordBody | null
    if (!body) return badRequest("Invalid request body")

    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : ""
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : ""

    if (!currentPassword) return badRequest("Current password is required")
    if (currentPassword.length > 1024) return badRequest("Current password is too long")
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return badRequest(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    }
    if (newPassword.length > 1024) return badRequest("New password must be 1024 characters or fewer")

    const user = await queryOne<{ passwordHash: string }>(
      `SELECT password_hash AS "passwordHash" FROM users WHERE id = $1 AND is_active = TRUE`,
      [auth.user.id],
    )
    if (!user) return badRequest("Account not found")
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return badRequest("Current password is incorrect")
    }

    await withTransaction(async (client) => {
      await client.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [
        auth.user.id,
        hashPassword(newPassword),
      ])
      await writeAudit(client, auth.user, {
        action: "user.password_change",
        entityType: "user",
        entityId: auth.user.id,
        summary: `Changed own password for "${auth.user.username}"`,
      })
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return serverError(error)
  }
}
