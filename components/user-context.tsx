"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { ApiUser } from "@/lib/types"

const UserContext = createContext<ApiUser | null>(null)

export function UserProvider({ user, children }: { user: ApiUser; children: ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

export function useUser(): ApiUser {
  const user = useContext(UserContext)
  if (!user) {
    throw new Error("useUser must be used inside a UserProvider")
  }
  return user
}
