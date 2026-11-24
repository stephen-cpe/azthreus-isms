"use client"

import { ModuleIcon } from "@/components/module-icon"

interface AccountsPageProps {
  onAddAccount: () => void
  onPayTuition: () => void
  onOtherPayments: () => void
  onBalanceInquiry: () => void
  onViewIndividualAccount: () => void
}

export function AccountsPage({
  onAddAccount,
  onPayTuition,
  onOtherPayments,
  onBalanceInquiry,
  onViewIndividualAccount,
}: AccountsPageProps) {
  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <ModuleIcon name="accounts" className="w-16 h-16" alt="Accounts" />
        <h1 className="text-az-teal-deep text-4xl font-bold">Accounts</h1>
      </div>

      {/* Description */}
      <div className="mb-6">
        <h2 className="text-az-steel font-bold underline">Student Accounts</h2>
        <p className="text-black text-sm mt-2">
          Create accounts, receive payments, and review balances. Each tile opens one task; every change is saved to
          the database and appears in the related reports.
        </p>
      </div>

      {/* Action Icons Grid */}
      <div className="grid grid-cols-4 gap-6 mt-8">
        {/* Add Account */}
        <div
          className="flex flex-col items-center cursor-pointer hover:bg-[#e0e0e0] p-2 rounded"
          onClick={onAddAccount}
        >
          <ModuleIcon name="accounts" className="w-20 h-20" alt="Add Account" />
          <span className="text-az-steel text-sm mt-2 underline">Add Account</span>
        </div>

        {/* Receive Payment */}
        <div
          className="flex flex-col items-center cursor-pointer hover:bg-[#e0e0e0] p-2 rounded"
          onClick={onPayTuition}
        >
          <ModuleIcon name="pay-tuition" className="w-20 h-20" alt="Receive Payment" />
          <span className="text-az-steel text-sm mt-2 underline">Receive Payment</span>
        </div>

        {/* View Individual Account */}
        <div
          className="flex flex-col items-center cursor-pointer hover:bg-[#e0e0e0] p-2 rounded"
          onClick={onViewIndividualAccount}
        >
          <ModuleIcon name="individual-account" className="w-20 h-20" alt="View Individual Account" />
          <span className="text-az-steel text-sm mt-2 text-center underline">
            View Individual
            <br />
            Account
          </span>
        </div>

        {/* Balance Inquiry */}
        <div
          className="flex flex-col items-center cursor-pointer hover:bg-[#e0e0e0] p-2 rounded"
          onClick={onBalanceInquiry}
        >
          <ModuleIcon name="inquiry" className="w-20 h-20" alt="Balance Inquiry" />
          <span className="text-az-steel text-sm mt-2 underline">Balance Inquiry</span>
        </div>

        {/* Other payments */}
        <div
          className="flex flex-col items-center cursor-pointer hover:bg-[#e0e0e0] p-2 rounded"
          onClick={onOtherPayments}
        >
          <ModuleIcon name="non-student" className="w-20 h-20" alt="Other payments" />
          <span className="text-az-steel text-sm mt-2 underline">Other payments</span>
        </div>

        {/* Miscellaneous Payment */}
        <div
          className="flex flex-col items-center cursor-pointer hover:bg-[#e0e0e0] p-2 rounded"
          onClick={onOtherPayments}
        >
          <ModuleIcon name="miscellaneous" className="w-20 h-20" alt="Miscellaneous Payment" />
          <span className="text-az-steel text-sm mt-2 underline">Miscellaneous Payment</span>
        </div>
      </div>
    </div>
  )
}
