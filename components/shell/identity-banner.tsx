"use client"

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { ChevronDown, Shield, Zap, CreditCard, UserCheck, FileSpreadsheet, Users } from "lucide-react"

interface IdentityBannerProps {
  user: {
    id: string
    name: string
    email: string
    avatar_url?: string
  }
  organization: {
    id: string
    name: string
  }
  currentRole?: string
  availableRoles?: string[]
  onRoleChange?: (role: string) => void
}

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  SYSTEM_ADMIN: "System Admin",
  DIRECTOR: "Director",
  FINANCE_ADMIN: "Finance Admin",
  ORG_UNIT_LEAD: "HOD / Lead",
  DEPT_ADMIN: "Dept Admin",
  MEMBER: "Faculty",
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  SYSTEM_ADMIN: <Shield className="h-3.5 w-3.5 text-violet-500" />,
  DIRECTOR: <Zap className="h-3.5 w-3.5 text-amber-500" />,
  FINANCE_ADMIN: <CreditCard className="h-3.5 w-3.5 text-emerald-500" />,
  ORG_UNIT_LEAD: <UserCheck className="h-3.5 w-3.5 text-sky-500" />,
  DEPT_ADMIN: <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-500" />,
  MEMBER: <Users className="h-3.5 w-3.5 text-slate-500" />,
}

export function IdentityBanner({
  user,
  organization,
  currentRole = "MEMBER",
  availableRoles = [],
  onRoleChange,
}: IdentityBannerProps) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const currentDisplayName = ROLE_DISPLAY_NAMES[currentRole] || currentRole
  const currentIcon = ROLE_ICONS[currentRole] || <Users className="h-3.5 w-3.5 text-slate-500" />

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b bg-background">
      <Avatar className="h-8 w-8">
        {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name} />}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{user.name}</div>
        <div className="text-xs text-muted-foreground truncate">{organization.name}</div>
      </div>

      {availableRoles.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl hover:bg-muted cursor-pointer font-semibold border bg-card shadow-2xs">
            {currentIcon}
            <span>{currentDisplayName}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl p-1 shadow-md">
            {availableRoles.map((roleScope) => (
              <DropdownMenuItem
                key={roleScope}
                onClick={() => onRoleChange?.(roleScope)}
                className="cursor-pointer text-xs flex items-center gap-2 px-2.5 py-2 rounded-lg font-medium"
              >
                {ROLE_ICONS[roleScope]}
                <span>{ROLE_DISPLAY_NAMES[roleScope] || roleScope}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
