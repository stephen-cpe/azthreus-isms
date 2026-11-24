export const MANAGED_USER_ROLES = ["admin", "registrar", "cashier"] as const

export type ManagedUserRole = (typeof MANAGED_USER_ROLES)[number]

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/
export const MIN_PASSWORD_LENGTH = 10

export const USERNAME_RULE =
  "Username must be 3-30 characters using lowercase letters, numbers, dots, underscores, or hyphens."

/** Shared SELECT/RETURNING column list for the user-management screens. */
export const USER_COLUMNS = `id, username, full_name AS "fullName", role, is_active AS "isActive",
  TO_CHAR(last_login, 'MM/DD/YYYY HH12:MI AM') AS "lastLogin",
  TO_CHAR(created_at, 'MM/DD/YYYY') AS "createdAt"`
