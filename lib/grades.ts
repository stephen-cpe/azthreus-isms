export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function gradeRemarks(grade: number | null): string | null {
  if (grade === null) return null
  return grade >= 75 ? "Passed" : "Failed"
}

export function honorsLabel(average: number | null): string | null {
  if (average === null) return null
  if (average >= 98) return "With Highest Honors"
  if (average >= 95) return "With High Honors"
  if (average >= 90) return "With Honors"
  return null
}

export function averageOf(values: (number | null | undefined)[]): number | null {
  const present = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  if (present.length === 0) return null
  return round2(present.reduce((sum, value) => sum + value, 0) / present.length)
}
