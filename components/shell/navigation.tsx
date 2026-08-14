"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface NavItem {
  label: string
  href: string
  icon?: React.ReactNode
  badge?: number
}

interface NavigationProps {
  items: NavItem[]
}

export function Navigation({ items }: NavigationProps) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 p-4">
      {items.map((item) => {
        const cleanHref = item.href.split("?")[0]
        const isRootPage = cleanHref.split("/").filter(Boolean).length === 2 // e.g. /:orgId/member
        const isActive = isRootPage
          ? pathname === cleanHref
          : pathname.startsWith(cleanHref)

        return (
          <Link key={item.href} href={item.href}>
            <Button
              variant={isActive ? "default" : "ghost"}
              className={cn("w-full justify-start gap-2 relative flex items-center")}
              size="sm"
            >
              {item.icon}
              <span className="truncate flex-1 text-left">{item.label}</span>
              {!!item.badge && (
                <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground leading-none">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
            </Button>
          </Link>
        )
      })}
    </nav>
  )
}
