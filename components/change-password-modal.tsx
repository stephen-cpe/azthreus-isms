"use client"

import { useState } from "react"
import { toast } from "sonner"
import { WindowChrome } from "@/components/window-chrome"
import { useUser } from "@/components/user-context"
import { MIN_PASSWORD_LENGTH } from "@/lib/users"

interface ChangePasswordModalProps {
  onClose: () => void
}

export function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const user = useUser()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    if (!currentPassword) {
      setError("Enter your current password.")
      return
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (newPassword !== confirmPassword) {
      setError("The new password and confirmation do not match.")
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        setError(data?.error ?? "Unable to change the password.")
        return
      }
      toast.success("Password changed.")
      onClose()
    } catch {
      setError("Unable to reach the server.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#f0f0f0] border-2 border-[#808080] w-[440px] shadow-lg">
        <WindowChrome title="Change Password" onClose={onClose}>
          <div className="p-4">
            <h1 className="text-az-teal-deep text-xl font-bold">Change Password</h1>
            <p className="text-sm text-black mt-1">
              Signed in as <span className="font-bold">{user.username}</span>.
            </p>

            <div className="mt-4 space-y-3 text-sm">
              <label className="block">
                <span className="font-bold">Current Password:</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  className="w-full border border-[#808080] bg-white p-1 mt-1"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="font-bold">New Password:</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="w-full border border-[#808080] bg-white p-1 mt-1"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="font-bold">Confirm New Password:</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="w-full border border-[#808080] bg-white p-1 mt-1"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              <p className="text-xs text-black">Use at least {MIN_PASSWORD_LENGTH} characters.</p>
            </div>

            {error && <p className="mt-3 text-sm text-red-600 font-bold">{error}</p>}

            <div className="flex justify-end gap-2 mt-4">
              <button
                className="bg-az-teal-deep text-white border-2 border-[#808080] px-4 py-1 text-sm font-bold hover:bg-az-steel disabled:opacity-60"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? "Saving..." : "Change Password"}
              </button>
              <button
                className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 text-sm font-bold text-az-steel hover:bg-[#d0d0d0]"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </div>
        </WindowChrome>
      </div>
    </div>
  )
}
