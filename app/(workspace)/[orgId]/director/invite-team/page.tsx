"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Mail, Copy, Check, UserPlus } from "lucide-react"
import { formatRole, formatDepartment } from "@/lib/utils/formatters"

export default function InviteTeamPage() {
  const params = useParams()
  const orgId = params.orgId
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [email, setEmail] = useState("")
  const [roleId, setRoleId] = useState("")
  const [orgUnitId, setOrgUnitId] = useState("")

  const [roles, setRoles] = useState<any[]>([])
  const [orgUnits, setOrgUnits] = useState<any[]>([])
  const [invitationsList, setInvitationsList] = useState<any[]>([])

  useEffect(() => {
    loadFormData()
  }, [orgId, supabase])

  const loadFormData = async () => {
    try {
      if (!orgId) return

      // Fetch roles in the organization
      const { data: rolesData } = await supabase
        .from("roles")
        .select("id, name, scope_level")
      
      const loadedRoles = (rolesData || []).map((r: any) => ({
        ...r,
        name: formatRole(r.name || r.scope_level),
      }))

      // Default fallback roles if table is empty
      if (loadedRoles.length === 0) {
        loadedRoles.push(
          { id: "role-director", name: "Director", scope_level: "DIRECTOR" },
          { id: "role-lead", name: "HOD / Dept Lead", scope_level: "ORG_UNIT_LEAD" },
          { id: "role-dept-admin", name: "Dept Admin", scope_level: "DEPT_ADMIN" },
          { id: "role-member", name: "Faculty Member", scope_level: "MEMBER" },
          { id: "role-finance", name: "Finance Admin", scope_level: "FINANCE_ADMIN" },
          { id: "role-system-admin", name: "System Admin", scope_level: "SYSTEM_ADMIN" }
        )
      }
      setRoles(loadedRoles)

      // Fetch org units in the organization
      const { data: unitsData } = await (supabase as any)
        .from("org_units")
        .select("id, name")
        .eq("organization_id", String(orgId))
      setOrgUnits(unitsData || [])

      // Fetch pending invitations
      const { data: inviteData } = await (supabase as any)
        .from("invitations")
        .select("*, roles(name, scope_level)")
        .eq("organization_id", String(orgId))
        .order("created_at", { ascending: false })
      setInvitationsList(inviteData || [])
    } catch (err) {
      console.error("Failed to load options:", err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setInviteLink(null)
    setLoading(true)

    try {
      if (!email.trim() || !roleId) {
        throw new Error("Please provide email and select a role")
      }

      const token = crypto.randomUUID()
      const { data, error: inviteError } = await (supabase as any)
        .from("invitations")
        .insert({
          organization_id: String(orgId),
          email: email.trim(),
          intended_role_id: roleId,
          org_unit_id: orgUnitId || null,
          token,
          status: "PENDING",
        })
        .select()
        .single()

      if (inviteError) throw inviteError

      const generatedLink = `${window.location.origin}/signup?invite=${token}`
      setInviteLink(generatedLink)
      setSuccess(`Invitation created for ${email}`)
      setEmail("")
      setRoleId("")
      setOrgUnitId("")
      loadFormData()
    } catch (err: any) {
      setError(err.message || "Failed to send invitation")
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Invite Team Members</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send invitation links to onboard new employees into your organization
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Send New Invitation
          </CardTitle>
          <CardDescription>Generate an onboarding invite link with assigned role & department</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive text-destructive text-sm rounded-lg">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm rounded-lg">
                {success}
              </div>
            )}

            {inviteLink && (
              <div className="p-4 bg-muted/50 border rounded-xl space-y-2">
                <Label className="text-xs text-muted-foreground uppercase font-semibold">Generated Invite Link</Label>
                <div className="flex items-center gap-2">
                  <Input value={inviteLink} readOnly className="text-xs font-mono bg-background" />
                  <Button type="button" size="sm" onClick={copyToClipboard} className="gap-1.5 flex-shrink-0">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy Link"}
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="employee@org.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={roleId} onValueChange={setRoleId} disabled={loading}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {formatRole(r.name || r.scope_level)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Department (Optional)</Label>
                <Select value={orgUnitId} onValueChange={setOrgUnitId} disabled={loading}>
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgUnits.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {formatDepartment(u.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Generate Invite Link
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Invitations List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-md">Recent Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          {invitationsList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No invitations created yet.</p>
          ) : (
            <div className="divide-y text-sm">
              {invitationsList.map((inv) => (
                <div key={inv.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">{formatRole(inv.roles?.name || inv.roles?.scope_level || "Faculty Member")}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                    inv.status === 'ACCEPTED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {inv.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
