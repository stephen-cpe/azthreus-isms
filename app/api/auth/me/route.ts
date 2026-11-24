import { NextResponse } from "next/server"
import { getSessionUser, serverError } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ user })
  } catch (error) {
    return serverError(error)
  }
}
