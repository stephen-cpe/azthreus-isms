"use client"

import { useState, type ReactNode } from "react"
import { Maximize2, Minimize2, X } from "lucide-react"
import { ModuleIcon, type ModuleIconName } from "@/components/module-icon"

interface WindowChromeProps {
  title: string
  onClose: () => void
  icon?: ModuleIconName
  children: ReactNode
}

export function WindowChrome({ title, onClose, icon, children }: WindowChromeProps) {
  const [minimized, setMinimized] = useState(false)

  return (
    <>
      <div className="bg-gradient-to-r from-az-steel to-az-teal-deep px-2 py-1 flex items-center justify-between">
        <span className="flex items-center gap-2 text-white text-sm">
          {icon && <ModuleIcon name={icon} className="w-5 h-5 border-0" alt="" />}
          {title}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="w-5 h-5 bg-[#c0c0c0] border border-[#808080] text-xs flex items-center justify-center"
            onClick={() => setMinimized((value) => !value)}
            title={minimized ? "Restore" : "Minimize"}
          >
            {minimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
          </button>
          <button
            type="button"
            className="w-5 h-5 bg-[#c0c0c0] border border-[#808080] text-xs flex items-center justify-center"
            onClick={onClose}
            title="Close"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
      {!minimized && children}
    </>
  )
}
