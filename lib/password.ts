import { randomBytes, scryptSync, timingSafeEqual } from "crypto"

const KEY_LENGTH = 64
const PREFIX = "scrypt"

/**
 * Hash a password using scrypt (Node built-in).
 * Format: "scrypt$<salt-hex>$<hash-hex>"
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex")
  return `${PREFIX}$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$")
  if (parts.length !== 3 || parts[0] !== PREFIX) return false

  const [, salt, expectedHex] = parts
  try {
    const expected = Buffer.from(expectedHex, "hex")
    const actual = scryptSync(password, salt, expected.length)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}
