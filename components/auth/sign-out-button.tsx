"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { LogOut, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SignOutButtonProps {
  variant?: "default" | "outline" | "ghost" | "destructive" | "sidebar"
  size?: "default" | "sm" | "lg" | "icon" | "xs"
  showText?: boolean
  className?: string
}

export function SignOutButton({
  variant = "ghost",
  size = "sm",
  showText = true,
  className = "",
}: SignOutButtonProps) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSignOut = async () => {
    try {
      setLoading(true)
      await supabase.auth.signOut()
      // Also call server logout endpoint to clear cookies
      try {
        await fetch("/api/auth/logout", { method: "POST" })
      } catch (e) {
        // Ignore fetch errors if offline
      }
      window.location.href = "/login"
    } catch (err) {
      console.error("[auth] signout failed:", err)
      window.location.href = "/login"
    } finally {
      setLoading(false)
    }
  }

  if (variant === "sidebar") {
    return (
      <button
        onClick={handleSignOut}
        disabled={loading}
        className={`flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors text-left ${className}`}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : (
          <LogOut className="h-4 w-4 shrink-0" />
        )}
        {showText && <span>Sign Out</span>}
      </button>
    )
  }

  return (
    <Button
      variant={variant}
      size={size as any}
      onClick={handleSignOut}
      disabled={loading}
      className={`rounded-xl transition-colors ${className}`}
      title="Sign Out"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      ) : (
        <LogOut className="h-4 w-4 shrink-0" />
      )}
      {showText && <span className="ml-1.5 font-medium">Sign Out</span>}
    </Button>
  )
}
