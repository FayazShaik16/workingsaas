"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

export default function OrgSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [orgName, setOrgName] = useState("")
  const [orgType, setOrgType] = useState("")

  useEffect(() => {
    const loadOrg = async () => {
      try {
        if (!orgId) return

        const { data: orgData, error: orgError } = await (supabase as any)
          .from("organizations")
          .select("name, type")
          .eq("id", String(orgId))
          .single()

        if (orgError) throw orgError

        if (orgData) {
          setOrgName(orgData.name)
          setOrgType(orgData.type)
        }
      } catch (err) {
        console.error("Failed to load organization settings:", err)
      } finally {
        setLoading(false)
      }
    }
    loadOrg()
  }, [orgId, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setUpdating(true)

    try {
      if (!orgName.trim() || !orgType) {
        throw new Error("Organization Name and Type are required")
      }

      const { error: updateError } = await (supabase as any)
        .from("organizations")
        .update({
          name: orgName.trim(),
          type: orgType,
        })
        .eq("id", String(orgId))

      if (updateError) throw updateError

      setSuccess("Organization settings updated successfully!")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update settings")
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 max-w-xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organization Settings</h1>
        <p className="text-muted-foreground mt-2">Manage organization profile and type.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
          <CardDescription>Update name and category of your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded">
                {success}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                disabled={updating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Organization Type</Label>
              <Select value={orgType} onValueChange={setOrgType} disabled={updating}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="COLLEGE">College / University</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise / Corporate</SelectItem>
                  <SelectItem value="GOVERNMENT">Government Agency</SelectItem>
                  <SelectItem value="NGO">NGO / Non-Profit</SelectItem>
                  <SelectItem value="HOSPITAL">Hospital / Healthcare</SelectItem>
                  <SelectItem value="GENERIC">Generic Organization</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={updating}>
              {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
