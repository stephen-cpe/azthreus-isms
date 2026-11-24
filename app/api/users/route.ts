import { NextRequest, NextResponse } from "next/server"
import { query, queryOne, withTransaction } from "@/lib/db"
import { writeAudit } from "@/lib/audit"
import { ApiError, badRequest, requireRoles, serverError } from "@/lib/auth"
import { hashPassword } from "@/lib/password"
import type { ManagedUser } from "@/lib/types"
import {
  MANAGED_USER_ROLES,
  MIN_PASSWORD_LENGTH,
  USERNAME_PATTERN,
  USERNAME_RULE,
  USER_COLUMNS,
} from "@/lib/users"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireRoles(["admin"])
  if (auth.error) return auth.error

  try {
    const users = await query<ManagedUser>(
      `SELECT ${USER_COLUMNS}
       FROM users
       ORDER BY LOWER(username)`,
    )
    return NextResponse.json({ users })
  } catch (error) {
    return serverError(error)
  }
}

interface CreateUserBody {
  username?: string
  fullName?: string
  role?: string
  password?: string
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(["admin"])
  if (auth.error) return auth.error

  try {
    const body = (await req.json().catch(() => null)) as CreateUserBody | null
    if (!body) return badRequest("Invalid request body")

    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : ""
    if (!USERNAME_PATTERN.test(username)) {
      return badRequest(USERNAME_RULE)
    }

    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : ""
    if (!fullName) return badRequest("Full name is required")
    if (fullName.length > 100) return badRequest("Full name must be 100 characters or fewer")

    const role = typeof body.role === "string" ? body.role : ""
    if (!MANAGED_USER_ROLES.includes(role as (typeof MANAGED_USER_ROLES)[number])) {
      return badRequest("Role must be administrator, registrar, or cashier")
    }

    const password = typeof body.password === "string" ? body.password : ""
    if (password.length < MIN_PASSWORD_LENGTH) {
      return badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    }
    if (password.length > 1024) return badRequest("Password must be 1024 characters or fewer")

    const existing = await queryOne<{ id: number }>(`SELECT id FROM users WHERE LOWER(username) = $1`, [username])
    if (existing) throw new ApiError(409, "That username is already in use.")

    const user = await withTransaction(async (client) => {
      const created = await client.query<ManagedUser>(
        `INSERT INTO users (username, password_hash, full_name, role, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING ${USER_COLUMNS}`,
        [username, hashPassword(password), fullName, role],
      )
      const createdUser = created.rows[0]
      await writeAudit(client, auth.user, {
        action: "user.create",
        entityType: "user",
        entityId: createdUser.id,
        summary: `Created user "${createdUser.username}" with role ${createdUser.role}`,
        details: { username: createdUser.username, role: createdUser.role },
      })
      return createdUser
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "That username is already in use." }, { status: 409 })
    }
    return serverError(error)
  }
}
