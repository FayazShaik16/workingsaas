"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type StatusVariant =
  | "default"
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "active"
  | "completed"
  | "failed"
  | "warning"

interface StatusPillProps {
  status: string
  variant?: StatusVariant
  className?: string
}

const STATUS_CONFIG: Record<StatusVariant, { bg: string; fg: string }> = {
  default: { bg: "bg-muted", fg: "text-muted-foreground" },
  draft: { bg: "bg-slate-100", fg: "text-slate-700" },
  pending: { bg: "bg-yellow-100", fg: "text-yellow-700" },
  approved: { bg: "bg-green-100", fg: "text-green-700" },
  rejected: { bg: "bg-red-100", fg: "text-red-700" },
  active: { bg: "bg-blue-100", fg: "text-blue-700" },
  completed: { bg: "bg-green-100", fg: "text-green-700" },
  failed: { bg: "bg-red-100", fg: "text-red-700" },
  warning: { bg: "bg-orange-100", fg: "text-orange-700" },
}

export function StatusPill({
  status,
  variant = "default",
  className,
}: StatusPillProps) {
  const config = STATUS_CONFIG[variant]

  return (
    <Badge
      variant="outline"
      className={cn(config.bg, config.fg, "border-0 font-medium", className)}
    >
      {status}
    </Badge>
  )
}
