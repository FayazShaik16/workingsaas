"use client"

import { useState, useEffect } from "react"
import { Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotificationBell } from "./notification-bell"
import { SignOutButton } from "@/components/auth/sign-out-button"

interface HeaderProps {
  title?: string
  unreadNotifications?: number
  notifications?: Array<{
    id: string
    title: string
    message: string
    createdAt: string
  }>
}

export function Header({
  title,
  unreadNotifications = 0,
  notifications = [],
}: HeaderProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    // Initial theme set from localStorage or pref scheme
    const isDark = document.documentElement.classList.contains("dark") || 
      localStorage.getItem("theme") === "dark" ||
      (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches)
    
    if (isDark) {
      document.documentElement.classList.add("dark")
      document.documentElement.classList.remove("light")
      setTheme("dark")
    } else {
      document.documentElement.classList.remove("dark")
      document.documentElement.classList.add("light")
      setTheme("light")
    }
  }, [])

  const toggleTheme = () => {
    if (theme === "light") {
      document.documentElement.classList.add("dark")
      document.documentElement.classList.remove("light")
      localStorage.setItem("theme", "dark")
      setTheme("dark")
    } else {
      document.documentElement.classList.remove("dark")
      document.documentElement.classList.add("light")
      localStorage.setItem("theme", "light")
      setTheme("light")
    }
  }

  return (
    <div className="flex items-center justify-between px-8 py-5 border-b bg-background/80 backdrop-blur-md transition-all duration-200">
      <h1 className="text-2xl font-light tracking-tight text-foreground/90">{title || "Dashboard"}</h1>
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleTheme} 
          className="text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-full w-9 h-9 transition-all"
          title="Toggle Light/Dark Mode"
        >
          {theme === "light" ? <Moon className="h-[1.1rem] w-[1.1rem]" /> : <Sun className="h-[1.1rem] w-[1.1rem]" />}
        </Button>
        <NotificationBell unreadCount={unreadNotifications} notifications={notifications} />
        <div className="h-5 w-px bg-border/60 mx-0.5" />
        <SignOutButton variant="outline" size="sm" showText={true} className="text-xs h-8 px-2.5 rounded-lg border-muted/80 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30" />
      </div>
    </div>
  )
}
