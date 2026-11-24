import { createHmac, timingSafeEqual } from "crypto"

export interface SessionUser {
  id: number
  username: string
  fullName: string
  role: string
}

export const SESSION_COOKIE = "isms_session"
const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours
export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000

const DEV_SECRET = "isms-dev-secret-change-me"
let warnedAboutDevSecret = false

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32) {
      throw new Error(
        "SESSION_SECRET must be set to at least 32 characters in production. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      )
    }
    return secret
  }

  if (!secret || secret.length < 32) {
    if (!warnedAboutDevSecret) {
      console.warn("[isms] SESSION_SECRET is missing or shorter than 32 characters; using the development fallback.")
      warnedAboutDevSecret = true
    }
    return DEV_SECRET
  }
  return secret
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url")
}

export function createSessionToken(user: SessionUser): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      exp: Date.now() + SESSION_TTL_MS,
    }),
  ).toString("base64url")

  return `${payload}.${sign(payload)}`
}

export function verifySessionToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null

  const [payload, signature] = token.split(".")
  if (!payload || !signature) return null

  const expected = Buffer.from(sign(payload))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      uid: number
      username: string
      fullName: string
      role: string
      exp: number
    }
    if (!data.exp || data.exp < Date.now()) return null
    return { id: data.uid, username: data.username, fullName: data.fullName, role: data.role }
  } catch {
    return null
  }
}
