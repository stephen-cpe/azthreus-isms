"use client"

import { ModuleIcon } from "@/components/module-icon"

interface RegistrationPageProps {
  onBalanceInquiry: () => void
  onAddStudent: () => void
  onViewAssessment: () => void
  onCertificateOfRegistration: () => void
}

export function RegistrationPage({
  onBalanceInquiry,
  onAddStudent,
  onViewAssessment,
  onCertificateOfRegistration,
}: RegistrationPageProps) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <ModuleIcon name="registration" className="w-16 h-16" alt="Registration" />
        <h1 className="text-az-teal-deep text-4xl font-bold">Registration</h1>
      </div>

      {/* Description */}
      <div className="mb-6">
        <h2 className="text-az-steel font-bold">Enrollment</h2>
        <p className="text-black text-sm mt-2">
          Enroll new and returning students, review the fee assessment for a level and school year, and issue
          certificates of registration.
        </p>
      </div>

      {/* Action Icons */}
      <div className="flex gap-8 mt-8">
        {/* Balance Inquiry */}
        <div
          className="flex flex-col items-center cursor-pointer hover:bg-[#e0e0e0] p-4 rounded"
          onClick={onBalanceInquiry}
        >
          <ModuleIcon name="inquiry" className="w-20 h-20" alt="Balance Inquiry" />
          <span className="text-az-steel text-sm mt-2 underline">Balance Inquiry</span>
        </div>

        {/* Add Student */}
        <div
          className="flex flex-col items-center cursor-pointer hover:bg-[#e0e0e0] p-4 rounded"
          onClick={onAddStudent}
        >
          <ModuleIcon name="registration" className="w-20 h-20" alt="Add Student" />
          <span className="text-az-steel text-sm mt-2 underline">Add Student</span>
        </div>

        {/* View Assessment */}
        <div
          className="flex flex-col items-center cursor-pointer hover:bg-[#e0e0e0] p-4 rounded"
          onClick={onViewAssessment}
        >
          <ModuleIcon name="assessment" className="w-20 h-20" alt="View Assessment" />
          <span className="text-az-steel text-sm mt-2 underline">View Assessment</span>
        </div>

        {/* Certificate of Registration */}
        <div
          className="flex flex-col items-center cursor-pointer hover:bg-[#e0e0e0] p-4 rounded"
          onClick={onCertificateOfRegistration}
        >
          <ModuleIcon name="cor" className="w-20 h-20" alt="Certificate of Registration" />
          <span className="text-az-steel text-sm mt-2 underline">Certificate of Registration</span>
        </div>
      </div>
    </div>
  )
}
