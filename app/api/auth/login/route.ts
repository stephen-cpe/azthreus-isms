import { NextRequest, NextResponse } from "next/server"
import { queryOne, withTransaction } from "@/lib/db"
import { writeAudit } from "@/lib/audit"
import { verifyPassword } from "@/lib/password"
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session"
import { badRequest, serverError } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface UserRecord {
  id: number
  username: string
  password_hash: string
  full_name: string | null
  role: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { username?: string; password?: string } | null
    const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : ""
    const password = typeof body?.password === "string" ? body.password : ""

    if (!username || !password) {
      return badRequest("Username and password are required")
    }
    if (username.length > 50 || password.length > 1024) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 })
    }

    const user = await queryOne<UserRecord>(
      `SELECT id, username, password_hash, full_name, role
       FROM users
       WHERE LOWER(username) = $1 AND is_active = TRUE`,
      [username],
    )

    if (!user || !verifyPassword(password, user.password_hash)) {
      try {
        await withTransaction(async (client) => {
          await writeAudit(
            client,
            { id: null, username: username || "(blank)" },
            {
              action: "login.failure",
              entityType: "user",
              summary: `Failed sign-in attempt for "${username || "(blank)"}"`,
            },
          )
        })
      } catch (auditError) {
        // A failed audit write must not change the outcome of a failed sign-in.
        console.error("[isms] login.failure audit error:", auditError)
      }
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 })
    }

    const sessionUser = await withTransaction(async (client) => {
      await client.query(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`, [user.id])
      const signedIn = {
        id: user.id,
        username: user.username,
        fullName: user.full_name || user.username,
        role: user.role,
      }
      await writeAudit(
        client,
        { id: user.id, username: user.username },
        {
          action: "login.success",
          entityType: "user",
          entityId: user.id,
          summary: `Signed in as "${user.username}"`,
        },
      )
      return signedIn
    })

    const response = NextResponse.json({ user: sessionUser })
    response.cookies.set({
      name: SESSION_COOKIE,
      value: createSessionToken(sessionUser),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    })
    return response
  } catch (error) {
    return serverError(error)
  }
}
