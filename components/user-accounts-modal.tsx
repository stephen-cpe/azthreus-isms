"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useUser } from "@/components/user-context"
import { WindowChrome } from "@/components/window-chrome"
import { ROLE_LABELS } from "@/lib/roles"
import { MANAGED_USER_ROLES, MIN_PASSWORD_LENGTH, USERNAME_PATTERN, USERNAME_RULE } from "@/lib/users"
import type { ManagedUser } from "@/lib/types"

interface UserAccountsModalProps {
  onClose: () => void
}

type Mode = "list" | "add" | "edit" | "reset"

interface FormState {
  username: string
  fullName: string
  role: string
  password: string
  confirmPassword: string
}

const emptyForm: FormState = {
  username: "",
  fullName: "",
  role: "registrar",
  password: "",
  confirmPassword: "",
}

export function UserAccountsModal({ onClose }: UserAccountsModalProps) {
  const currentUser = useUser()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>("list")
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = () => {
    setLoading(true)
    fetch("/api/users")
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { users?: ManagedUser[]; error?: string } | null
        if (!response.ok || !data?.users) {
          setError(data?.error ?? "Unable to load users.")
          return
        }
        setUsers(data.users)
      })
      .catch(() => setError("Unable to reach the server."))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [])

  const backToList = () => {
    setMode("list")
    setSelectedUser(null)
    setForm(emptyForm)
    setError(null)
  }

  const startAdd = () => {
    setSelectedUser(null)
    setForm(emptyForm)
    setError(null)
    setMode("add")
  }

  const startEdit = (user: ManagedUser) => {
    setSelectedUser(user)
    setForm({
      username: user.username,
      fullName: user.fullName ?? "",
      role: user.role,
      password: "",
      confirmPassword: "",
    })
    setError(null)
    setMode("edit")
  }

  const startReset = (user: ManagedUser) => {
    setSelectedUser(user)
    setForm({ ...emptyForm, username: user.username })
    setError(null)
    setMode("reset")
  }

  const handleSubmit = async () => {
    setError(null)
    const trimmedFullName = form.fullName.trim()

    if (mode === "add") {
      if (!USERNAME_PATTERN.test(form.username.trim().toLowerCase())) {
        setError(USERNAME_RULE)
        return
      }
      if (!trimmedFullName) {
        setError("Full name is required.")
        return
      }
      if (form.password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
        return
      }
      if (form.password !== form.confirmPassword) {
        setError("The password and confirmation do not match.")
        return
      }
    }

    if (mode === "edit" && !trimmedFullName) {
      setError("Full name is required.")
      return
    }

    if (mode === "reset") {
      if (form.password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
        return
      }
      if (form.password !== form.confirmPassword) {
        setError("The password and confirmation do not match.")
        return
      }
    }

    setSaving(true)
    try {
      let response: Response
      if (mode === "add") {
        response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: form.username.trim().toLowerCase(),
            fullName: trimmedFullName,
            role: form.role,
            password: form.password,
          }),
        })
      } else if (mode === "edit" && selectedUser) {
        response = await fetch(`/api/users/${selectedUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName: trimmedFullName, role: form.role }),
        })
      } else if (mode === "reset" && selectedUser) {
        response = await fetch(`/api/users/${selectedUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resetPassword: form.password }),
        })
      } else {
        setError("Nothing to save.")
        return
      }

      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        setError(data?.error ?? "Unable to save the user.")
        return
      }

      toast.success(
        mode === "add"
          ? `User ${form.username.trim().toLowerCase()} created.`
          : mode === "reset"
            ? `Password reset for ${selectedUser?.username}.`
            : `User ${selectedUser?.username} updated.`,
      )
      backToList()
      reload()
    } catch {
      setError("Unable to reach the server.")
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (user: ManagedUser) => {
    if (user.id === currentUser.id) return
    const action = user.isActive ? "Deactivate" : "Activate"
    if (!window.confirm(`${action} ${user.username}?`)) return

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        toast.error(data?.error ?? "Unable to update the user.")
        return
      }
      toast.success(`${action}d ${user.username}.`)
      reload()
    } catch {
      toast.error("Unable to reach the server.")
    }
  }

  const modeTitle = mode === "add" ? "Add User" : mode === "edit" ? "Edit User" : mode === "reset" ? "Reset Password" : ""

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#f0f0f0] border-2 border-[#808080] w-[1020px] max-h-[92vh] overflow-auto shadow-lg">
        <WindowChrome title="User Accounts" onClose={onClose}>
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h1 className="text-az-teal-deep text-2xl font-bold">User Accounts</h1>
                <p className="text-sm text-black">
                  Staff accounts, roles, and access. Password resets take effect on the user&apos;s next sign-in.
                </p>
              </div>
              <button
                className="bg-az-teal-deep text-white border-2 border-[#808080] px-4 py-1 text-sm font-bold hover:bg-az-steel"
                onClick={startAdd}
              >
                Add User
              </button>
            </div>

            {mode !== "list" && (
              <div className="border-2 border-az-teal-deep bg-white p-3 mb-3">
                <h2 className="text-az-steel font-bold mb-2">{modeTitle}</h2>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <label className="block">
                    <span className="font-bold">Username:</span>
                    <input
                      type="text"
                      className="w-full border border-[#808080] bg-white p-1 mt-1 disabled:bg-[#e8e8e8]"
                      value={form.username}
                      disabled={mode !== "add"}
                      onChange={(event) => setForm((previous) => ({ ...previous, username: event.target.value }))}
                    />
                  </label>
                  {mode !== "reset" && (
                    <>
                      <label className="block">
                        <span className="font-bold">Full Name:</span>
                        <input
                          type="text"
                          className="w-full border border-[#808080] bg-white p-1 mt-1"
                          value={form.fullName}
                          onChange={(event) => setForm((previous) => ({ ...previous, fullName: event.target.value }))}
                        />
                      </label>
                      <label className="block">
                        <span className="font-bold">Role:</span>
                        <select
                          className="w-full border border-[#808080] bg-white p-1 mt-1 disabled:bg-[#e8e8e8]"
                          value={form.role}
                          disabled={mode === "edit" && selectedUser?.id === currentUser.id}
                          onChange={(event) => setForm((previous) => ({ ...previous, role: event.target.value }))}
                        >
                          {MANAGED_USER_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role] ?? role}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}
                  {(mode === "add" || mode === "reset") && (
                    <>
                      <label className="block">
                        <span className="font-bold">{mode === "add" ? "Initial Password:" : "New Password:"}</span>
                        <input
                          type="password"
                          autoComplete="new-password"
                          className="w-full border border-[#808080] bg-white p-1 mt-1"
                          value={form.password}
                          onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
                        />
                      </label>
                      <label className="block">
                        <span className="font-bold">Confirm Password:</span>
                        <input
                          type="password"
                          autoComplete="new-password"
                          className="w-full border border-[#808080] bg-white p-1 mt-1"
                          value={form.confirmPassword}
                          onChange={(event) =>
                            setForm((previous) => ({ ...previous, confirmPassword: event.target.value }))
                          }
                        />
                      </label>
                      <p className="col-span-2 text-xs text-black">Use at least {MIN_PASSWORD_LENGTH} characters.</p>
                    </>
                  )}
                </div>

                {error && <p className="mt-2 text-sm text-red-600 font-bold">{error}</p>}

                <div className="flex justify-end gap-2 mt-3">
                  <button
                    className="bg-az-teal-deep text-white border-2 border-[#808080] px-4 py-1 text-sm font-bold hover:bg-az-steel disabled:opacity-60"
                    onClick={handleSubmit}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 text-sm font-bold text-az-steel hover:bg-[#d0d0d0]"
                    onClick={backToList}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {error && mode === "list" && <p className="mb-2 text-sm text-red-600 font-bold">{error}</p>}

            <div className="border border-[#808080] bg-white max-h-96 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-az-steel text-white sticky top-0">
                  <tr>
                    <th className="p-1 text-left border-r border-az-slate">Username</th>
                    <th className="p-1 text-left border-r border-az-slate">Full Name</th>
                    <th className="p-1 text-left border-r border-az-slate">Role</th>
                    <th className="p-1 text-left border-r border-az-slate">Active</th>
                    <th className="p-1 text-left border-r border-az-slate">Last Login</th>
                    <th className="p-1 text-left border-r border-az-slate">Created</th>
                    <th className="p-1 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, index) => (
                    <tr key={user.id} className={index % 2 === 0 ? "bg-white" : "bg-[#f5f5f5]"}>
                      <td className="p-1 border-r border-[#d0d0d0] font-mono font-bold text-az-steel">
                        {user.username}
                        {user.id === currentUser.id ? " (you)" : ""}
                      </td>
                      <td className="p-1 border-r border-[#d0d0d0]">{user.fullName ?? ""}</td>
                      <td className="p-1 border-r border-[#d0d0d0]">{ROLE_LABELS[user.role] ?? user.role}</td>
                      <td
                        className={`p-1 border-r border-[#d0d0d0] font-bold ${
                          user.isActive ? "text-az-teal-deep" : "text-red-600"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </td>
                      <td className="p-1 border-r border-[#d0d0d0]">{user.lastLogin ?? "—"}</td>
                      <td className="p-1 border-r border-[#d0d0d0]">{user.createdAt ?? "—"}</td>
                      <td className="p-1">
                        <div className="flex flex-wrap gap-1">
                          <button
                            className="bg-[#c0c0c0] border border-[#808080] px-1.5 py-0.5 hover:bg-[#d0d0d0]"
                            onClick={() => startEdit(user)}
                          >
                            Edit
                          </button>
                          <button
                            className="bg-[#c0c0c0] border border-[#808080] px-1.5 py-0.5 hover:bg-[#d0d0d0]"
                            onClick={() => startReset(user)}
                          >
                            Reset Password
                          </button>
                          <button
                            className="bg-[#c0c0c0] border border-[#808080] px-1.5 py-0.5 hover:bg-[#d0d0d0] disabled:opacity-50"
                            onClick={() => toggleActive(user)}
                            disabled={user.id === currentUser.id}
                            title={user.id === currentUser.id ? "You cannot deactivate your own account." : undefined}
                          >
                            {user.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && users.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-az-steel">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {loading && <p className="mt-2 text-sm text-az-steel">Loading users...</p>}

            <div className="flex justify-between items-center mt-3">
              <p className="text-xs text-black">
                An administrator cannot deactivate or demote their own account, and at least one active administrator
                must remain.
              </p>
              <button
                className="bg-[#c0c0c0] border-2 border-[#808080] px-4 py-1 text-sm font-bold text-az-steel hover:bg-[#d0d0d0]"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </WindowChrome>
      </div>
    </div>
  )
}
