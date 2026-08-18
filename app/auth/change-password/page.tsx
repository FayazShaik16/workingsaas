"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ShieldCheck, Lock, ArrowRight, Loader2, KeyRound } from "lucide-react"

export default function ChangePasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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

      // Fetch user profile and redirect to role workspace
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("organization_id, user_roles(roles(scope_level))")
          .eq("id", user.id)
          .maybeSingle()

        if (profile?.organization_id) {
          const orgId = profile.organization_id
          const roles = ((profile.user_roles as any[]) || []).map((ur) => ur.roles?.scope_level).filter(Boolean)
          
          if (roles.includes("DIRECTOR")) router.push(`/${orgId}/director`)
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
              <Label htmlFor="newPassword" className="text-xs font-bold">
                New Password (min 8 chars)
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-9 text-xs rounded-xl"
                  disabled={loading || success}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-xs font-bold">
                Confirm New Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-9 text-xs rounded-xl"
                  disabled={loading || success}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || success}
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
