import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { queryOne } from "@/lib/db"
import { SESSION_COOKIE, verifySessionToken, type SessionUser } from "@/lib/session"
import type { Role } from "@/lib/roles"

/**
 * Verify the cookie, then re-read the user from the database. The cookie is
 * only proof of identity; role and active status always come from the database
 * so deactivation and role changes take effect on the next request.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const session = verifySessionToken(store.get(SESSION_COOKIE)?.value)
  if (!session) return null

  return queryOne<SessionUser>(
    `SELECT id, username, COALESCE(full_name, username) AS "fullName", role
     FROM users
     WHERE id = $1 AND is_active = TRUE`,
    [session.id],
  )
}

export type AuthResult = { user: SessionUser; error?: never } | { user?: never; error: NextResponse }

export async function requireAuth(): Promise<AuthResult> {
  const user = await getSessionUser()
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return { user }
}

export async function requireRoles(roles: Role[]): Promise<AuthResult> {
  const result = await requireAuth()
  if (result.error) return result
  if (!roles.includes(result.user.role as Role)) {
    return { error: NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 }) }
  }
  return result
}

export function serverError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  // Log the real error server-side, but never return SQL text, constraint
  // names, or stack details to the client.
  console.error("[isms] API error:", error)
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

/** Error carrying an HTTP status for expected business-rule failures. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function notFound(message = "Not found"): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 })
}
