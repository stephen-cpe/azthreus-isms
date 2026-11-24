import type React from "react"
import type { Metadata } from "next"
import { Toaster } from "sonner"
import { BRAND } from "@/lib/branding"
import "./globals.css"

export const metadata: Metadata = {
  title: `${BRAND.productName} | ${BRAND.schoolName}`,
  description: `${BRAND.productSubtitle} for ${BRAND.schoolName} (fictional demo)`,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
