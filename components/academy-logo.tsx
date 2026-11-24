import { BRAND } from "@/lib/branding"

interface AcademyLogoProps {
  className?: string
}

export function AcademyLogo({ className = "" }: AcademyLogoProps) {
  return (
    <div className={`rounded-full bg-white overflow-hidden flex items-center justify-center shrink-0 ${className}`}>
      <img src={BRAND.academyLogoSrc} alt="Azthreus Academy crest" className="h-full w-full object-cover" />
    </div>
  )
}
