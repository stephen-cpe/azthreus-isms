"use client"

import { useState, type FormEvent } from "react"
import { KeyRound, User } from "lucide-react"
import { AcademyLogo } from "@/components/academy-logo"
import { BRAND } from "@/lib/branding"
import type { ApiUser } from "@/lib/types"

interface LoginPageProps {
  onLoggedIn: (user: ApiUser) => void
}

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      const data = (await response.json().catch(() => null)) as { user?: ApiUser; error?: string } | null

      if (!response.ok || !data?.user) {
        setError(data?.error ?? "Login failed. Please try again.")
        return
      }
      onLoggedIn(data.user)
    } catch {
      setError("Unable to reach the server. Please check your database connection.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#d4d0c8] flex flex-col">
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-white border-2 border-[#808080] shadow-lg w-[820px] flex">
          {/* Left Panel - Branding */}
          <div className="w-80 p-6 border-r-4 border-az-teal-deep bg-az-teal-pale flex flex-col items-center text-center">
            <AcademyLogo className="w-28 h-28 border-4 border-az-teal-deep" />

            <h1 className="text-az-teal-deep text-xl font-bold leading-tight mt-4">{BRAND.schoolName}</h1>
            <p className="text-az-teal-deep text-xs font-bold tracking-wide mt-1">{BRAND.addressLine}</p>

            <div className="mt-6 border border-[#808080] bg-white p-3 text-left text-xs w-full">
              <p className="font-bold text-az-steel">{BRAND.productName}</p>
              <p className="text-az-steel">{BRAND.productSubtitle}</p>
              <p className="mt-1 text-black">
                Access is limited to authorized staff. Roles are Administrator, Registrar, and Cashier.
              </p>
            </div>

            <div className="mt-4 flex items-center gap-1 text-[10px] text-az-steel">
              <img src={BRAND.systemsLogoSrc} alt="" className="h-4 w-4 object-contain" />
              <span>{BRAND.parentCompany}</span>
            </div>
          </div>

          {/* Right Panel - Login Form */}
          <div className="flex-1 p-6">
            <div className="bg-gradient-to-r from-az-steel to-az-teal-deep px-3 py-1">
              <span className="text-white text-sm font-bold">{BRAND.productName} Sign In</span>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 max-w-sm">
              <fieldset className="border-2 border-az-teal-deep p-4">
                <legend className="text-az-teal-deep font-bold px-2">User Log On</legend>

                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm font-bold text-black">
                      <u>U</u>ser ID:
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="w-4 h-4 text-az-steel" />
                      <input
                        type="text"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        autoFocus
                        autoComplete="username"
                        className="flex-1 border border-[#808080] bg-white p-1 text-sm"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="text-sm font-bold text-black">
                      <u>P</u>assword:
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <KeyRound className="w-4 h-4 text-az-steel" />
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        className="flex-1 border border-[#808080] bg-white p-1 text-sm"
                      />
                    </div>
                  </label>
                </div>

                {error && (
                  <p className="mt-3 text-sm text-red-600 font-bold border border-red-400 bg-red-50 p-2">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 w-full bg-[#c0c0c0] border-2 border-[#808080] px-6 py-2 font-bold hover:bg-[#d0d0d0] disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </fieldset>
            </form>

            {/* Demo credentials hint */}
            <div className="mt-6 bg-[#ffffd0] border border-[#808080] p-3 text-xs">
              <p className="font-bold text-az-steel">Demo accounts (seeded by init_db.sql):</p>
              <table className="mt-1 text-black">
                <tbody>
                  <tr>
                    <td className="pr-3 font-mono">admin</td>
                    <td className="pr-3 font-mono">ADMINpassword</td>
                    <td className="text-az-teal-deep font-bold">Administrator</td>
                  </tr>
                  <tr>
                    <td className="pr-3 font-mono">registrar</td>
                    <td className="pr-3 font-mono">REGISTRARpassword</td>
                    <td className="text-az-teal-deep font-bold">Registrar</td>
                  </tr>
                  <tr>
                    <td className="pr-3 font-mono">cashier</td>
                    <td className="pr-3 font-mono">CASHIERpassword</td>
                    <td className="text-az-teal-deep font-bold">Cashier</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
