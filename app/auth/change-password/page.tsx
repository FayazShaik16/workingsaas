"use client"

export const dynamic = "force-dynamic"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ShieldCheck, Lock, ArrowRight, Loader2, KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react"
import { getRedirectPath } from "@/lib/auth/get-redirect"

export default function ChangePasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const isLongEnough = newPassword.length >= 8
  const isMatching = confirmPassword.length > 0 && newPassword === confirmPassword
  const isMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false },
      })

      if (updateError) {
        throw new Error(updateError.message)
      }

      setSuccess(true)

      // Refresh session cookies and state
      router.refresh()

      // Fetch user profile and redirect to role workspace
      try {
        const res = await fetch("/api/auth/get-session")
        if (res.ok) {
          const sessionData = await res.json()
          if (sessionData?.user?.organizationId) {
            const redirectPath = getRedirectPath(sessionData.user)
            router.push(redirectPath)
            return
          }
        }
      } catch (e) {
        console.warn("[change-password] failed to fetch session path, falling back to direct query:", e)
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await (supabase as any)
          .from("users")
          .select("organization_id, user_roles(roles(scope_level))")
          .eq("id", user.id)
          .maybeSingle()

        if (profile?.organization_id) {
          const orgId = profile.organization_id
          const roles = ((profile.user_roles as any) || []).map((ur: any) => ur.roles?.scope_level).filter(Boolean)
          
          if (roles.includes("SYSTEM_ADMIN")) router.push(`/${orgId}/config`)
          else if (roles.includes("DIRECTOR")) router.push(`/${orgId}/director`)
          else if (roles.includes("ORG_UNIT_LEAD")) router.push(`/${orgId}/lead`)
          else if (roles.includes("FINANCE_ADMIN")) router.push(`/${orgId}/finance`)
          else if (roles.includes("DEPT_ADMIN")) router.push(`/${orgId}/dept-admin`)
          else router.push(`/${orgId}/member`)
          return
        }
      }

      router.push("/")
    } catch (err: any) {
      setError(err?.message || "Failed to update password. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-linear-to-b from-background to-muted/30">
      <Card className="w-full max-w-md rounded-2xl border-2 shadow-xl">
        <CardHeader className="space-y-2 text-center pb-4 border-b bg-muted/20">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-extrabold tracking-tight text-foreground">
            Set Your New Password
          </CardTitle>
          <CardDescription className="text-xs">
            For institutional security, please replace your temporary provisioning password before accessing your workspace.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-xs rounded-xl bg-destructive/10 border border-destructive/20 text-destructive font-semibold">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 text-xs rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Password updated successfully! Redirecting to your workspace...
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="newPassword" className="text-xs font-bold">
                  New Password (min 8 chars)
                </Label>
                {newPassword.length > 0 && (
                  <span className={`text-[10px] font-medium flex items-center gap-1 ${isLongEnough ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"}`}>
                    {isLongEnough ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                    {isLongEnough ? "Length met" : `${8 - newPassword.length} more chars`}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  required
                  placeholder="••••••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-9 pr-10 text-xs rounded-xl"
                  disabled={loading || success}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="confirmPassword" className="text-xs font-bold">
                  Confirm New Password
                </Label>
                {confirmPassword.length > 0 && (
                  <span className={`text-[10px] font-medium flex items-center gap-1 ${isMatching ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {isMatching ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                    {isMatching ? "Passwords match" : "Does not match"}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`pl-9 pr-10 text-xs rounded-xl ${isMismatch ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  disabled={loading || success}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || success || !isLongEnough || !isMatching}
              className="w-full rounded-xl font-bold text-xs gap-2 mt-2 shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Updating Credentials...
                </>
              ) : (
                <>
                  Confirm Password & Enter Workspace <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
