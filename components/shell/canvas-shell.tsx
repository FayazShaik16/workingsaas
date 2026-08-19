"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Header } from "./header"
import { Sidebar } from "./sidebar"
import {
  LayoutDashboard,
  ClipboardList,
  Coins,
  ShoppingBag,
  Settings,
  CalendarDays,
  Users,
  GitBranch,
  BarChart3,
  Building2,
  CreditCard,
  UserCheck,
  FileSpreadsheet,
  Bell,
  BookOpen,
  CheckSquare,
  Clock,
  Wallet,
  ScrollText,
  Shield,
  Sparkles,
} from "lucide-react"

interface NavItem {
  label: string
  href: string
  icon?: React.ReactNode
  badge?: number
}

interface CanvasShellProps {
  user: {
    id: string
    name: string
    email: string
    avatar_url?: string
  }
  organization: {
    id: string
    name: string
  } | null
  currentRole?: string
  availableRoles?: string[]
  title?: string
  children: React.ReactNode
  unreadNotifications?: number
  notifications?: Array<{
    id: string
    title: string
    message: string
    createdAt: string
  }>
  badges?: Record<string, number>
}

// Scope level → URL base mapping
const SCOPE_TO_BASE: Record<string, string> = {
  SYSTEM_ADMIN: "config",
  DIRECTOR: "director",
  FINANCE_ADMIN: "finance",
  ORG_UNIT_LEAD: "lead",
  DEPT_ADMIN: "dept-admin",
  MEMBER: "member",
}

// URL base → Scope level (reverse mapping)
const BASE_TO_SCOPE: Record<string, string> = {
  config: "SYSTEM_ADMIN",
  director: "DIRECTOR",
  finance: "FINANCE_ADMIN",
  lead: "ORG_UNIT_LEAD",
  "dept-admin": "DEPT_ADMIN",
  member: "MEMBER",
}

export function getNavItemsForRole(
  orgId: string,
  scopeLevel: string,
  badges?: Record<string, number>
): NavItem[] {
  const urlBase = SCOPE_TO_BASE[scopeLevel] ?? "member"
  const base = `/${orgId}/${urlBase}`

  const navMap: Record<string, NavItem[]> = {
    SYSTEM_ADMIN: [
      { label: "Admin Panel", href: base, icon: <Shield className="h-4 w-4" /> },
      { label: "Users", href: `${base}/users`, icon: <Users className="h-4 w-4" /> },
      { label: "Bulk Import", href: `${base}/import`, icon: <FileSpreadsheet className="h-4 w-4" /> },
      { label: "Org Settings", href: `${base}/settings`, icon: <Settings className="h-4 w-4" /> },
      { label: "Templates", href: `${base}/templates`, icon: <Building2 className="h-4 w-4" /> },
    ],
    DIRECTOR: [
      { label: "Overview", href: base, icon: <LayoutDashboard className="h-4 w-4" /> },
      { label: "Org Structure", href: `${base}/org-tree`, icon: <GitBranch className="h-4 w-4" /> },
      { label: "Post Task", href: `${base}/tasks/new`, icon: <Sparkles className="h-4 w-4" /> },
      { label: "Invite Team", href: `${base}/invite-team`, icon: <Users className="h-4 w-4" /> },
      { label: "Dept Reports", href: `${base}/reports`, icon: <BarChart3 className="h-4 w-4" /> },
      { label: "Loan Approvals", href: `${base}/loans`, icon: <CreditCard className="h-4 w-4" />, badge: badges?.loans },
      { label: "Ledger Audit", href: `${base}/ledger`, icon: <ScrollText className="h-4 w-4" /> },
      { label: "Notifications", href: `${base}/notifications`, icon: <Bell className="h-4 w-4" />, badge: badges?.notifications },
    ],
    FINANCE_ADMIN: [
      { label: "Finance Panel", href: base, icon: <LayoutDashboard className="h-4 w-4" /> },
      { label: "Salary Release", href: `${base}/salary`, icon: <Wallet className="h-4 w-4" /> },
      { label: "Loan Overview", href: `${base}/loans`, icon: <Coins className="h-4 w-4" /> },
      { label: "Ledger Audit", href: `${base}/audit`, icon: <BarChart3 className="h-4 w-4" /> },
    ],
    ORG_UNIT_LEAD: [
      { label: "Dept Overview", href: base, icon: <LayoutDashboard className="h-4 w-4" /> },
      { label: "Post Task", href: `${base}/tasks/new`, icon: <Sparkles className="h-4 w-4" /> },
      { label: "Leave Queue", href: `${base}/leaves`, icon: <ClipboardList className="h-4 w-4" />, badge: badges?.leaves },
      { label: "Attendance & Verify", href: `${base}/verify`, icon: <CheckSquare className="h-4 w-4" />, badge: badges?.verify },
      { label: "Salary Approve", href: `${base}/salary`, icon: <CreditCard className="h-4 w-4" />, badge: badges?.salary },
      { label: "Dept Schedule", href: `${base}/schedule`, icon: <CalendarDays className="h-4 w-4" /> },
      { label: "Settings", href: `${base}/settings`, icon: <Settings className="h-4 w-4" /> },
    ],
    DEPT_ADMIN: [
      { label: "Dashboard", href: base, icon: <LayoutDashboard className="h-4 w-4" /> },
      { label: "Programmes", href: `${base}/programmes`, icon: <Building2 className="h-4 w-4" /> },
      { label: "Batches", href: `${base}/batches`, icon: <Users className="h-4 w-4" /> },
      { label: "Subjects", href: `${base}/subjects`, icon: <BookOpen className="h-4 w-4" /> },
      { label: "Timetable", href: `${base}/timetable`, icon: <CalendarDays className="h-4 w-4" /> },
      { label: "Faculty Import", href: `${base}/import`, icon: <FileSpreadsheet className="h-4 w-4" /> },
    ],
    MEMBER: [
      { label: "Dashboard", href: base, icon: <LayoutDashboard className="h-4 w-4" /> },
      { label: "My Schedule", href: `${base}/schedule`, icon: <CalendarDays className="h-4 w-4" /> },
      { label: "Leave Request", href: `${base}/leave`, icon: <Clock className="h-4 w-4" />, badge: badges?.leave },
      { label: "Task Pool", href: `${base}/marketplace`, icon: <ShoppingBag className="h-4 w-4" /> },
      { label: "Earnings", href: `${base}/earnings`, icon: <Coins className="h-4 w-4" /> },
      { label: "Settings", href: `${base}/settings`, icon: <Settings className="h-4 w-4" /> },
    ],
  }

  return navMap[scopeLevel] ?? navMap.MEMBER
}

export function CanvasShell({
  user,
  organization,
  availableRoles = [],
  title,
  children,
  unreadNotifications,
  notifications,
  badges,
}: CanvasShellProps) {
  const pathname = usePathname()
  const router = useRouter()

  if (!organization) {
    return <>{children}</>
  }

  // Determine active role base from pathname URL segment
  const pathSegments = pathname.split("/").filter(Boolean)
  const urlRoleBase = pathSegments[1] || "member"
  const currentRole = BASE_TO_SCOPE[urlRoleBase] || "MEMBER"

  // Get navigation items for current role scope
  const navigationItems = getNavItemsForRole(organization.id, currentRole, badges)

  // Fast prefetch for instant, seamless navigation
  useEffect(() => {
    if (!organization?.id) return
    availableRoles.forEach((role) => {
      const roleBase = SCOPE_TO_BASE[role] || "member"
      router.prefetch(`/${organization.id}/${roleBase}`)
    })
    navigationItems.forEach((item) => {
      router.prefetch(item.href)
    })
  }, [availableRoles, organization?.id, navigationItems, router])

  // Handle role switching via dropdown select
  const handleRoleChange = (roleScope: string) => {
    const roleBase = SCOPE_TO_BASE[roleScope] || "member"
    router.push(`/${organization.id}/${roleBase}`)
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 hidden md:flex flex-col">
        <Sidebar
          user={user}
          organization={organization}
          currentRole={currentRole}
          availableRoles={availableRoles}
          navigationItems={navigationItems}
          onRoleChange={handleRoleChange}
        />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {availableRoles.includes("SYSTEM_ADMIN") && currentRole !== "SYSTEM_ADMIN" && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-300 flex items-center justify-between font-medium z-20">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Viewing as <strong>{currentRole}</strong> — Setup Mode (Verification Preview Only)</span>
            </div>
            <button
              onClick={() => handleRoleChange("SYSTEM_ADMIN")}
              className="text-[11px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 px-2 py-0.5 rounded transition-colors"
            >
              Exit to Admin Panel
            </button>
          </div>
        )}
        <Header
          title={title}
          unreadNotifications={unreadNotifications}
          notifications={notifications}
        />
        <div className="flex-1 overflow-auto bg-background">
          <div className="h-full">{children}</div>
        </div>
      </main>
    </div>
  )
}
