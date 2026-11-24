"use client"

import { ModuleIcon } from "@/components/module-icon"

type GradeCategory = "kindergarten" | "elementary" | "junior_high" | "senior_high"

interface GradesPageProps {
  onPostGrades: (category?: GradeCategory) => void
  onReportCard: () => void
  onRanking: () => void
}

const options: { label: string; category?: GradeCategory }[] = [
  { label: "Post Grades" },
  { label: "Add Kindergarten", category: "kindergarten" },
  { label: "Add Elementary", category: "elementary" },
  { label: "Add Junior High", category: "junior_high" },
  { label: "Add Senior High", category: "senior_high" },
]

export function GradesPage({ onPostGrades, onReportCard, onRanking }: GradesPageProps) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <ModuleIcon name="grades" className="w-16 h-16" alt="Grades" />
        <h1 className="text-az-teal-deep text-4xl font-bold">Grades</h1>
      </div>

      {/* Description */}
      <div className="mb-6">
        <h2 className="text-az-steel font-bold">Quarter Grades</h2>
        <p className="text-black text-sm mt-2">
          Post grades by level, section, subject, and grading period. Report cards and class rankings are computed
          from the posted quarter grades.
        </p>
      </div>

      {/* Grade Options Grid - one icon per posting shortcut, matching the original module */}
      <div className="grid grid-cols-2 gap-4 mt-8 max-w-xl">
        {options.map((option) => (
          <div
            key={option.label}
            className="flex items-center gap-4 cursor-pointer hover:bg-[#e0e0e0] p-3 rounded"
            onClick={() => onPostGrades(option.category)}
          >
            <ModuleIcon name="grades" className="w-14 h-14" alt={option.label} />
            <span className="text-az-steel font-semibold underline">{option.label}</span>
          </div>
        ))}
      </div>

      {/* Reports */}
      <div className="grid grid-cols-2 gap-4 mt-6 max-w-xl">
        <div
          className="flex items-center gap-4 cursor-pointer hover:bg-[#e0e0e0] p-3 rounded"
          onClick={onReportCard}
        >
          <ModuleIcon name="report-card" className="w-14 h-14" alt="Report Card" />
          <span className="text-az-steel font-semibold underline">Report Card</span>
        </div>

        <div
          className="flex items-center gap-4 cursor-pointer hover:bg-[#e0e0e0] p-3 rounded"
          onClick={onRanking}
        >
          <ModuleIcon name="ranking" className="w-14 h-14" alt="Honors & Class Ranking" />
          <span className="text-az-steel font-semibold underline">Honors &amp; Class Ranking</span>
        </div>
      </div>

      <p className="text-black text-sm mt-6">
        The Administrator and Registrar can post grades and view report cards. The Ranking window is available to those
        two roles as well.
      </p>
    </div>
  )
}
