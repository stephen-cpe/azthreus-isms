"use client"

import { BRAND } from "@/lib/branding"

interface WelcomePageProps {
  onEnter: () => void
  userName?: string
}

export function WelcomePage({ onEnter, userName }: WelcomePageProps) {
  return (
    <div className="min-h-screen bg-[#d4d0c8] flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-white border-2 border-[#808080] shadow-lg max-w-4xl flex">
          {/* Left Panel - Title and Image */}
          <div className="w-96 p-4 border-r-4 border-az-teal-deep">
            <h1 className="text-az-teal-deep text-3xl font-bold leading-tight mb-1">{BRAND.schoolShortName}</h1>
            <p className="text-az-steel text-sm font-semibold">{BRAND.productSubtitle}</p>

            {/* Illustration */}
            <div className="relative w-full h-72 flex items-center justify-center">
              <img
                src="/images/welcome-hero.png"
                alt="Illustration for Azthreus ISMS"
                className="w-full h-full object-contain"
              />
            </div>

            <p className="mt-4 text-black">
              <span className="font-bold">Welcome,</span> {userName ?? ""}
            </p>

            <button
              onClick={onEnter}
              className="mt-4 bg-[#c0c0c0] border-2 border-[#808080] px-6 py-2 font-bold hover:bg-[#d0d0d0] shadow-md"
            >
              Open {BRAND.productName}
            </button>
          </div>

          {/* Right Panel - Description */}
          <div className="flex-1 p-4">
            <p className="text-sm mb-4">
              This demo shows the Academy&apos;s daily work: enrolling students, setting assessments, receiving
              payments, posting grades, and printing collection reports. Every screen reads and writes the same
              PostgreSQL database, so balances and reports update as you work.
            </p>

            <p className="text-sm mb-4">
              Use the sidebar to move between modules. What you enter here is saved immediately and is visible to
              every signed-in user.
            </p>

            <p className="mt-6 border-t border-[#808080] pt-3 text-sm font-bold text-red-600">
              All data in this demo is fictional.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
