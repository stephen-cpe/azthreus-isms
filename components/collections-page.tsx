"use client"

import { ModuleIcon } from "@/components/module-icon"

interface CollectionsPageProps {
  onDailyCollection: () => void
  onDateRangeCollection: () => void
  onMonthlyCollection: () => void
}

export function CollectionsPage({
  onDailyCollection,
  onDateRangeCollection,
  onMonthlyCollection,
}: CollectionsPageProps) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <ModuleIcon name="collections" className="w-16 h-16" alt="Collection Report" />
        <h1 className="text-az-teal-deep text-4xl font-bold">Collections</h1>
      </div>

      {/* Collection Options */}
      <div className="space-y-6 mt-8">
        {/* Daily Collections */}
        <div
          className="flex items-center gap-6 cursor-pointer hover:bg-[#e0e0e0] p-4 rounded"
          onClick={onDailyCollection}
        >
          <ModuleIcon name="collections" className="w-16 h-16" alt="Daily Collections" />
          <span className="text-az-steel text-xl font-semibold underline">Daily Collections</span>
        </div>

        {/* Monthly Collections */}
        <div
          className="flex items-center gap-6 cursor-pointer hover:bg-[#e0e0e0] p-4 rounded"
          onClick={onMonthlyCollection}
        >
          <ModuleIcon name="collections" className="w-16 h-16" alt="Monthly Collections" />
          <span className="text-az-steel text-xl font-semibold underline">Monthly Collections</span>
        </div>

        {/* Date Range Collections */}
        <div
          className="flex items-center gap-6 cursor-pointer hover:bg-[#e0e0e0] p-4 rounded"
          onClick={onDateRangeCollection}
        >
          <ModuleIcon name="collections" className="w-16 h-16" alt="Date Range Collections" />
          <span className="text-az-steel text-xl font-semibold underline">Date Range Collections</span>
        </div>
      </div>
    </div>
  )
}
