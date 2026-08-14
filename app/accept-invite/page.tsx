"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function AcceptInvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [tokenInput, setTokenInput] = useState(searchParams.get("token") || "")
  const [user, setUser] = useState<any>(null)
  const [invitationInfo, setInvitationInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [fetchingInvite, setFetchingInvite] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // 1. Check if user is logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data.user)
    }
    checkUser()
  }, [supabase])

  // 2. Fetch invitation info whenever token changes
  useEffect(() => {
    const fetchInvite = async () => {
      if (!tokenInput.trim()) {
        setInvitationInfo(null)
        return
      }

      setFetchingInvite(true)
      setError(null)
      try {
        const { data, error: fetchError } = await supabase
          .from("invitations")
          .select("*, organizations(name)")
          .eq("token", tokenInput.trim())
          .eq("status", "PENDING")
          .single()

        if (fetchError || !data) {
          throw new Error("Invalid or expired invitation token.")
        }

        setInvitationInfo(data)
      } catch (err) {
        setInvitationInfo(null)
        console.error("Fetch invite failed:", err)
      } finally {
        setFetchingInvite(false)
      }
    }

    fetchInvite()
  }, [tokenInput, supabase])

  const handleAccept = async () => {
    if (!tokenInput.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/onboarding/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput.trim() }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to accept invitation")
      }

      setSuccess(true)
      setTimeout(() => {
        router.push("/")
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-green-200 bg-green-50/50">
          <CardHeader className="text-center">
            <CardTitle className="text-green-800">Invitation Accepted!</CardTitle>
            <CardDescription className="text-green-600">
              Welcome to the organization. Redirecting you to the dashboard...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin text-green-700" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg border">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Accept Invitation</CardTitle>
          <CardDescription>Join your team on WorkLedger</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded border border-destructive/20">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="token">Invitation Token</Label>
            <Input
              id="token"
              placeholder="Enter your invitation token..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              disabled={loading}
            />
          </div>

          {fetchingInvite && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying token...
            </div>
          )}

          {invitationInfo && (
            <div className="p-4 bg-muted/50 rounded-lg border text-sm space-y-2">
              <div>
                <span className="font-semibold text-muted-foreground block text-xs uppercase tracking-wider">
                  Organization
                </span>
                <span className="text-base font-semibold">
                  {(invitationInfo as any).organizations?.name || "Your Invited Organization"}
                </span>
              </div>
              <div>
                <span className="font-semibold text-muted-foreground block text-xs uppercase tracking-wider">
                  Invited Email
                </span>
                <span>{invitationInfo.email}</span>
              </div>
            </div>
          )}

          {!user ? (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-muted-foreground text-center">
                An account is required to accept this invitation.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/login?token=${tokenInput}`)}
                  className="w-full"
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => router.push(`/signup?token=${tokenInput}`)}
                  className="w-full"
                >
                  Sign Up
                </Button>
              </div>
            </div>
          ) : (
            <div className="pt-2">
              {invitationInfo && user.email.toLowerCase() !== invitationInfo.email.toLowerCase() ? (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded border border-amber-200">
                    Warning: You are currently signed in as <strong>{user.email}</strong>, but this invitation was sent to <strong>{invitationInfo.email}</strong>.
                  </div>
                  <Button
                    onClick={handleAccept}
                    className="w-full"
                    disabled={loading || fetchingInvite}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Accept Anyway
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleAccept}
                  className="w-full"
                  disabled={loading || fetchingInvite || !invitationInfo}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Join Organization
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
