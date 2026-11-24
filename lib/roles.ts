export type Role = "admin" | "registrar" | "cashier"

export type AppPage =
  | "dashboard"
  | "accounts"
  | "collections"
  | "add-student"
  | "registration"
  | "grades"
  | "inquiry"

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  registrar: "Registrar",
  cashier: "Cashier",
}

const PAGE_ACCESS: Record<Role, AppPage[]> = {
  admin: ["dashboard", "accounts", "collections", "add-student", "registration", "grades", "inquiry"],
  registrar: ["dashboard", "add-student", "registration", "grades", "inquiry"],
  cashier: ["dashboard", "accounts", "collections"],
}

export function canAccessPage(role: string, page: AppPage): boolean {
  const allowed = PAGE_ACCESS[role as Role] ?? []
  return allowed.includes(page)
}

export type WriteArea = "students" | "accounts" | "payments" | "assessments" | "grades"

const WRITE_ACCESS: Record<WriteArea, Role[]> = {
  students: ["admin", "registrar"],
  accounts: ["admin", "cashier"],
  payments: ["admin", "cashier"],
  assessments: ["admin", "registrar"],
  grades: ["admin", "registrar"],
}

export function canWrite(role: string, area: WriteArea): boolean {
  return WRITE_ACCESS[area].includes(role as Role)
}
