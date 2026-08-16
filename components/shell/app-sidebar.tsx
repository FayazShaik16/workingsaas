"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ClipboardList,
  Coins,
  ShoppingBag,
  Settings,
  ChevronDown,
  CalendarDays,
  Users,
  GitBranch,
  BarChart3,
  Building2,
  CreditCard,
  UserCheck,
  FileSpreadsheet,
  Bell,
  X,
  Menu,
  Shield,
  Zap,
  BookOpen,
  CheckSquare,
  Clock,
  Wallet,
  ScrollText,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────
export interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  badge?: number
}

interface SidebarProps {
  user: { id: string; name: string; email: string; avatar_url?: string }
  organization: { id: string; name: string }
  /** scope_level strings: SYSTEM_ADMIN | DIRECTOR | FINANCE_ADMIN | ORG_UNIT_LEAD | DEPT_ADMIN | MEMBER */
  currentRole: string
  availableRoles: string[]
  navigationItems: NavItem[]
  onRoleChange: (scopeLevel: string) => void
}

// ─────────────────────────────────────────────────────────────────
// Role metadata — keyed by scope_level
// ─────────────────────────────────────────────────────────────────
export const ROLE_META: Record<string, { icon: React.ReactNode; color: string; label: string; urlBase: string }> = {
  SYSTEM_ADMIN:  { icon: <Shield size={14} />,         color: "text-violet-400",  label: "System Admin",  urlBase: "config" },
  DIRECTOR:      { icon: <Zap size={14} />,            color: "text-amber-400",   label: "Director",      urlBase: "director" },
  FINANCE_ADMIN: { icon: <CreditCard size={14} />,     color: "text-emerald-400", label: "Finance Admin", urlBase: "finance" },
  ORG_UNIT_LEAD: { icon: <UserCheck size={14} />,      color: "text-sky-400",     label: "HOD / Lead",    urlBase: "lead" },
  DEPT_ADMIN:    { icon: <FileSpreadsheet size={14} />,color: "text-indigo-400",  label: "Dept Admin",    urlBase: "dept-admin" },
  MEMBER:        { icon: <Users size={14} />,          color: "text-slate-400",   label: "Faculty",       urlBase: "member" },
}

// ─────────────────────────────────────────────────────────────────
// Nav items per scope level
// ─────────────────────────────────────────────────────────────────
export function getNavItemsForRole(
  orgId: string,
  scopeLevel: string,
  badges?: Record<string, number>
): NavItem[] {
  const urlBase = ROLE_META[scopeLevel]?.urlBase ?? "member"
  const base = `/${orgId}/${urlBase}`

  const navMap: Record<string, NavItem[]> = {
    SYSTEM_ADMIN: [
      { label: "Admin Panel",      href: base,                 icon: <Shield size={16} /> },
      { label: "Users",            href: `${base}/users`,      icon: <Users size={16} /> },
      { label: "Bulk Import",      href: `${base}/import`,     icon: <FileSpreadsheet size={16} /> },
      { label: "Org Settings",     href: `${base}/settings`,   icon: <Settings size={16} /> },
      { label: "Templates",        href: `${base}/templates`,  icon: <Building2 size={16} /> },
    ],
    DIRECTOR: [
      { label: "Overview",         href: base,                          icon: <LayoutDashboard size={16} /> },
      { label: "Org Structure",    href: `${base}/org-tree`,            icon: <GitBranch size={16} /> },
      { label: "Dept Reports",     href: `${base}/reports`,             icon: <BarChart3 size={16} /> },
      { label: "Loan Approvals",   href: `${base}/loans`,               icon: <CreditCard size={16} />, badge: badges?.loans },
      { label: "Ledger Audit",     href: `${base}/ledger`,              icon: <ScrollText size={16} /> },
      { label: "Notifications",    href: `${base}/notifications`,       icon: <Bell size={16} />, badge: badges?.notifications },
    ],
    FINANCE_ADMIN: [
      { label: "Finance Panel",    href: base,                  icon: <LayoutDashboard size={16} /> },
      { label: "Salary Release",   href: `${base}/salary`,      icon: <Wallet size={16} /> },
      { label: "Loan Overview",    href: `${base}/loans`,       icon: <Coins size={16} /> },
      { label: "Ledger Audit",     href: `${base}/audit`,       icon: <BarChart3 size={16} /> },
    ],
    ORG_UNIT_LEAD: [
      { label: "Dept Overview",    href: base,                  icon: <LayoutDashboard size={16} /> },
      { label: "Leave Queue",      href: `${base}/leaves`,      icon: <ClipboardList size={16} />, badge: badges?.leaves },
      { label: "Task Verify",      href: `${base}/verify`,      icon: <CheckSquare size={16} />, badge: badges?.verify },
      { label: "Salary Approve",   href: `${base}/salary`,      icon: <CreditCard size={16} />, badge: badges?.salary },
      { label: "Dept Schedule",    href: `${base}/schedule`,    icon: <CalendarDays size={16} /> },
      { label: "Settings",         href: `${base}/settings`,    icon: <Settings size={16} /> },
    ],
    DEPT_ADMIN: [
      { label: "Dashboard",        href: base,                       icon: <LayoutDashboard size={16} /> },
      { label: "Programmes",       href: `${base}/programmes`,       icon: <Building2 size={16} /> },
      { label: "Batches",          href: `${base}/batches`,          icon: <Users size={16} /> },
      { label: "Subjects",         href: `${base}/subjects`,         icon: <BookOpen size={16} /> },
      { label: "Timetable",        href: `${base}/timetable`,        icon: <CalendarDays size={16} /> },
      { label: "Faculty Import",   href: `${base}/import`,           icon: <FileSpreadsheet size={16} /> },
    ],
    MEMBER: [
      { label: "Dashboard",        href: base,                   icon: <LayoutDashboard size={16} /> },
      { label: "My Schedule",      href: `${base}/schedule`,     icon: <CalendarDays size={16} /> },
      { label: "Leave Request",    href: `${base}/leave`,        icon: <Clock size={16} />, badge: badges?.leave },
      { label: "Task Pool",        href: `${base}/marketplace`,  icon: <ShoppingBag size={16} /> },
      { label: "Earnings",         href: `${base}/earnings`,     icon: <Coins size={16} /> },
      { label: "Settings",         href: `${base}/settings`,     icon: <Settings size={16} /> },
    ],
  }

  return navMap[scopeLevel] ?? navMap.MEMBER
}

// ─────────────────────────────────────────────────────────────────
// Desktop sidebar — CSS hover expand (no framer-motion dependency)
// ─────────────────────────────────────────────────────────────────
function DesktopSidebar({ user, organization, currentRole, availableRoles, navigationItems, onRoleChange }: SidebarProps) {
  const [roleDropOpen, setRoleDropOpen] = useState(false)
  const pathname = usePathname()
  const meta = ROLE_META[currentRole] ?? ROLE_META.MEMBER
  const switchableRoles = availableRoles.filter((r) => r !== currentRole && ROLE_META[r])

  return (
    <aside className={cn(
      "group/sidebar relative hidden md:flex flex-col h-screen z-30 flex-shrink-0",
      "bg-[#0d0f14] border-r border-white/[0.05] overflow-hidden select-none",
      "w-16 hover:w-64",
      "transition-[width] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
    )}>
      {/* ── Logo / Org ── */}
      <div className="flex items-center gap-3 px-[14px] h-[60px] border-b border-white/[0.05] flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0 shadow-md shadow-violet-500/20">
          {organization.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 delay-75">
          <p className="text-[13px] font-semibold text-white leading-tight whitespace-nowrap">{organization.name}</p>
          <p className="text-[10px] text-white/35 leading-tight">WorkLedger</p>
        </div>
      </div>

      {/* ── Role indicator + switcher ── */}
      <div className="px-2 py-2 border-b border-white/[0.04] flex-shrink-0">
        <button
          onClick={() => setRoleDropOpen(!roleDropOpen)}
          className="w-full flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-white/[0.04] transition-colors"
        >
          <span className={cn("flex-shrink-0 w-4 h-4 flex items-center justify-center", meta.color)}>
            {meta.icon}
          </span>
          <span className="flex-1 min-w-0 text-[11px] font-medium text-white/55 truncate opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 delay-75 whitespace-nowrap text-left">
            {meta.label}
          </span>
          {switchableRoles.length > 0 && (
            <ChevronDown
              size={12}
              className={cn(
                "text-white/25 flex-shrink-0 opacity-0 group-hover/sidebar:opacity-100 transition-all duration-150",
                roleDropOpen && "rotate-180"
              )}
            />
          )}
        </button>

        {/* Role dropdown */}
        {roleDropOpen && switchableRoles.length > 0 && (
          <div className="mt-1.5 rounded-xl bg-[#181b24] border border-white/[0.07] overflow-hidden">
            {switchableRoles.map((scopeLevel) => {
              const m = ROLE_META[scopeLevel]
              return (
                <button
                  key={scopeLevel}
                  onClick={() => { onRoleChange(scopeLevel); setRoleDropOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-white/50 hover:text-white hover:bg-white/[0.04] transition-colors text-left whitespace-nowrap"
                >
                  <span className={m.color}>{m.icon}</span>
                  {m.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: "none" }}>
        {navigationItems.map((item) => {
          const cleanHref = item.href.split("?")[0]
          const isActive = cleanHref === pathname ||
            (cleanHref.length > `/${organization.id}/`.length + 5 && pathname.startsWith(cleanHref))
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={cn(
                "flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors relative",
                isActive
                  ? "bg-violet-500/10 text-white"
                  : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
              )}
            >
              {/* Active bar */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-violet-400" />
              )}

              {/* Icon + badge */}
              <span className="relative flex-shrink-0 w-4 h-4 flex items-center justify-center">
                {item.icon}
                {!!item.badge && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </span>

              {/* Label */}
              <span className="text-[13px] font-medium truncate whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 delay-75">
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* ── User footer ── */}
      <div className="border-t border-white/[0.05] px-2 py-3 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0 ring-2 ring-white/[0.08]">
            {user.name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-150 delay-75">
            <p className="text-[12px] font-semibold text-white truncate whitespace-nowrap">{user.name}</p>
            <p className="text-[10px] text-white/35 truncate whitespace-nowrap">{user.email}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────
// Mobile sidebar — hamburger + slide-in drawer (CSS animation)
// ─────────────────────────────────────────────────────────────────
function MobileSidebar({ user, organization, currentRole, availableRoles, navigationItems, onRoleChange }: SidebarProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const meta = ROLE_META[currentRole] ?? ROLE_META.MEMBER
  const switchableRoles = availableRoles.filter((r) => r !== currentRole && ROLE_META[r])

  return (
    <>
      {/* Hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 w-9 h-9 rounded-xl bg-[#0d0f14] border border-white/[0.07] flex items-center justify-center text-white/60 hover:text-white transition-colors shadow-lg"
        aria-label="Open menu"
      >
        <Menu size={17} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 bg-black/55 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        />
      )}

      {/* Drawer */}
      {open && (
        <aside className="md:hidden fixed left-0 top-0 bottom-0 w-[280px] bg-[#0d0f14] border-r border-white/[0.06] z-50 flex flex-col animate-in slide-in-from-left duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-[60px] border-b border-white/[0.05] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-[13px]">
                {organization.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">{organization.name}</p>
                <p className="text-[10px] text-white/35">WorkLedger</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Role */}
          <div className="px-4 py-3 border-b border-white/[0.04] flex-shrink-0">
            <div className={cn("flex items-center gap-1.5 text-[11px] font-semibold", meta.color)}>
              {meta.icon}
              <span>{meta.label}</span>
            </div>
            {switchableRoles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {switchableRoles.map((r) => {
                  const m = ROLE_META[r]
                  return (
                    <button
                      key={r}
                      onClick={() => { onRoleChange(r); setOpen(false) }}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                        "bg-white/[0.05] text-[10px] font-medium text-white/50",
                        "hover:text-white hover:bg-white/[0.09] transition-colors border border-white/[0.05]"
                      )}
                    >
                      <span className={m.color}>{m.icon}</span>
                      {m.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {navigationItems.map((item) => {
              const cleanHref = item.href.split("?")[0]
              const isActive = cleanHref === pathname ||
                (cleanHref.length > `/${organization.id}/`.length + 5 && pathname.startsWith(cleanHref))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                    isActive
                      ? "bg-violet-500/10 text-white border border-violet-500/15"
                      : "text-white/45 hover:text-white hover:bg-white/[0.04]"
                  )}
                >
                  <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">{item.icon}</span>
                  <span className="text-[13px] font-medium flex-1">{item.label}</span>
                  {!!item.badge && (
                    <span className="min-w-[18px] h-4 px-1 bg-red-500/90 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-white/[0.05] px-4 py-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-[12px] font-semibold ring-2 ring-white/[0.07]">
                {user.name?.charAt(0)?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-white truncate">{user.name}</p>
                <p className="text-[10px] text-white/35 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        </aside>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────
export function AppSidebar(props: SidebarProps) {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...props} />
    </>
  )
}
