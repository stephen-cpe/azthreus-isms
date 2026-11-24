import { ApiError } from "@/lib/auth"
import { isValidIsoDate } from "@/lib/date"
import { round2 } from "@/lib/grades"

/**
 * Input validation shared by the write routes. Helpers return null for an
 * omitted or blank optional value and throw a 400 ApiError for anything that
 * cannot be stored safely. Callers decide whether a value is required.
 */

export const MAX_AMOUNT = 99_999_999.99

export function readText(value: unknown, maxLength: number, label: string): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") throw new ApiError(400, `${label} must be text.`)
  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    throw new ApiError(400, `${label} must be ${maxLength} characters or fewer.`)
  }
  return trimmed === "" ? null : trimmed
}

export function readInt(
  value: unknown,
  label: string,
  options: { min?: number; max?: number } = {},
): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new ApiError(400, `${label} must be a whole number.`)
  }
  if (options.min !== undefined && parsed < options.min) {
    throw new ApiError(400, `${label} must be at least ${options.min}.`)
  }
  if (options.max !== undefined && parsed > options.max) {
    throw new ApiError(400, `${label} must be at most ${options.max}.`)
  }
  return parsed
}

export function readId(value: unknown, label: string): number | null {
  return readInt(value, label, { min: 1 })
}

export function readDate(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value !== "string" || !isValidIsoDate(value)) {
    throw new ApiError(400, `${label} must be a valid date (YYYY-MM-DD).`)
  }
  return value
}

export function readAmount(
  value: unknown,
  label: string,
  options: { allowNegative?: boolean } = {},
): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed =
    typeof value === "number" ? value : Number(String(value).replace(/,/g, "").trim())
  if (!Number.isFinite(parsed)) throw new ApiError(400, `${label} must be a number.`)
  if (!options.allowNegative && parsed < 0) {
    throw new ApiError(400, `${label} cannot be negative.`)
  }
  if (Math.abs(parsed) > MAX_AMOUNT) {
    throw new ApiError(400, `${label} is larger than the system can store.`)
  }
  return round2(parsed)
}

export function readEnum(value: unknown, allowed: readonly string[], label: string): string | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new ApiError(400, `${label} must be one of: ${allowed.join(", ")}.`)
  }
  return value
}
