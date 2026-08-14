"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"

export default function OrganizationSetup() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orgName, setOrgName] = useState("")
  const [orgType, setOrgType] = useState("EDUCATIONAL_INSTITUTION")

  useEffect(() => {
    const checkExistingOrg = async () => {
      try {
        const response = await fetch("/api/auth/get-session")
        if (response.ok) {
          const sessionData = await response.json()
          const orgId = sessionData?.user?.organizationId
          if (orgId) {
            // Check if organization has already been renamed from the default
            const { data: org } = await supabase
              .from("organizations")
              .select("name")
              .eq("id", orgId)
              .single()
              
            if (org && org.name !== "My Organization" && org.name !== "Temp Org") {
              // Already fully onboarded, redirect to director dashboard
              router.push(`/${orgId}/director`)
            }
          }
        }
      } catch (err) {
        console.error("Failed to check existing session:", err)
      }
    }
    checkExistingOrg()
  }, [router, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (!orgName.trim()) {
        throw new Error("Organization name is required")
      }

      // Get session first to get orgId
      const sessionResponse = await fetch("/api/auth/get-session")
      if (!sessionResponse.ok) throw new Error("Failed to retrieve authentication session")
      
      const sessionData = await sessionResponse.json()
      const orgId = sessionData?.user?.organizationId

      if (!orgId) throw new Error("Organization context not found. Please log in again.")

      // Update the organization name and type directly
      const { error: orgError } = await supabase
        .from("organizations")
        .update({
          name: orgName,
          type: orgType,
        })
        .eq("id", orgId)

      if (orgError) throw orgError

      // Redirect to director dashboard dynamically
      router.push(`/${orgId}/director`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to setup organization"
      setError(message)
      console.error("[onboarding/setup] Error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Your Organization</CardTitle>
          <CardDescription>
            Set up your organization to get started with WorkLedger
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive text-destructive text-sm rounded">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                type="text"
                placeholder="e.g., ABC University, TechCorp Inc."
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgType">Organization Type</Label>
              <Select value={orgType} onValueChange={setOrgType} disabled={loading}>
                <SelectTrigger id="orgType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EDUCATIONAL_INSTITUTION">Educational Institution</SelectItem>
                  <SelectItem value="CORPORATE">Corporate</SelectItem>
                  <SelectItem value="GOVERNMENT">Government</SelectItem>
                  <SelectItem value="NGO">NGO</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Organization...
                </>
              ) : (
                "Create Organization"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
