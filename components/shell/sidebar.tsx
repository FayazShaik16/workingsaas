"use client"

import { IdentityBanner } from "./identity-banner"
import { Navigation } from "./navigation"
import { SearchBar } from "./search-bar"

interface NavItem {
  label: string
  href: string
  icon?: React.ReactNode
  badge?: number
}

interface SidebarProps {
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
  navigationItems: NavItem[]
  onRoleChange?: (role: string) => void
}

import { SignOutButton } from "@/components/auth/sign-out-button"

export function Sidebar({
  user,
  organization,
  currentRole,
  availableRoles,
  navigationItems,
  onRoleChange,
}: SidebarProps) {
  return (
    <div className="flex flex-col h-full w-full border-r bg-background">
      <IdentityBanner
        user={user}
        organization={organization}
        currentRole={currentRole}
        availableRoles={availableRoles}
        onRoleChange={onRoleChange}
      />
      <SearchBar />
      <div className="flex-1 overflow-y-auto">
        <Navigation items={navigationItems} />
      </div>
      <div className="p-3 border-t bg-muted/20">
        <SignOutButton variant="sidebar" showText={true} />
      </div>
    </div>
  )
}
