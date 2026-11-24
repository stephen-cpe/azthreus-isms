export type ModuleIconName =
  | "registration"
  | "accounts"
  | "grades"
  | "inquiry"
  | "collections"
  | "logout"
  | "pay-tuition"
  | "individual-account"
  | "non-student"
  | "miscellaneous"
  | "assessment"
  | "cor"
  | "report-card"
  | "ranking"
  | "dashboard"
  | "users"
  | "audit"
  | "reversal"

interface ModuleIconProps {
  name: ModuleIconName
  className?: string
  alt?: string
}

export function ModuleIcon({ name, className = "", alt }: ModuleIconProps) {
  return (
    <div
      className={`bg-white border border-[#808080] rounded overflow-hidden flex items-center justify-center shrink-0 ${className}`}
    >
      <img src={`/images/module-${name}.png`} alt={alt ?? name} className="h-full w-full object-contain" />
    </div>
  )
}
