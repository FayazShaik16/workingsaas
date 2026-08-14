"use client"

import { Bell } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

interface NotificationBellProps {
  unreadCount?: number
  notifications?: Array<{
    id: string
    title: string
    message: string
    createdAt: string
  }>
}

export function NotificationBell({ unreadCount = 0, notifications = [] }: NotificationBellProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative flex items-center justify-center p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
        ) : (
          <>
            {notifications.slice(0, 5).map((notif, idx) => (
              <div key={notif.id}>
                <div className="p-3 hover:bg-muted cursor-pointer">
                  <div className="font-medium text-sm">{notif.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{notif.message}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(notif.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {idx < Math.min(notifications.length - 1, 4) && <DropdownMenuSeparator />}
              </div>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
