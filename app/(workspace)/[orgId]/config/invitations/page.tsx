import { requireAuth, requireRole } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mail, Clock, CheckCircle2, AlertCircle } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function ConfigInvitationsPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireRole("SYSTEM_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  const { data: invitations } = await db
    .from("invitations")
    .select(`
      id,
      email,
      status,
      created_at,
      expires_at,
      roles(name, scope_level),
      org_units(name)
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  const list = invitations || []

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Invitations Center</h1>
        <p className="text-xs text-muted-foreground">
          Track outstanding and accepted tenant invitations for institutional actors.
        </p>
      </div>

      <Card className="border-border/60 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Tenant Invitations</CardTitle>
          <CardDescription className="text-xs">
            {list.length} total invitation record{list.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground border border-dashed rounded-xl space-y-2">
              <Mail className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="font-medium text-foreground">No active invitations found.</p>
              <p>Use the People &amp; Roles page to directly provision or invite faculty and staff.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b text-muted-foreground uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Invitee Email</th>
                    <th className="py-2.5 px-3">Intended Role</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Sent Date</th>
                    <th className="py-2.5 px-3 text-right">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {list.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-muted/30">
                      <td className="py-2.5 px-3 font-mono font-medium text-foreground">{inv.email}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="text-[10px] py-0">
                          {inv.roles?.name || inv.roles?.scope_level || "Member"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {inv.org_units?.name || "Global"}
                      </td>
                      <td className="py-2.5 px-3">
                        {inv.status === "ACCEPTED" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-500 font-medium text-[11px]">
                            <CheckCircle2 className="h-3 w-3" />
                            Accepted
                          </span>
                        ) : inv.status === "PENDING" ? (
                          <span className="inline-flex items-center gap-1 text-amber-500 font-medium text-[11px]">
                            <Clock className="h-3 w-3" />
                            Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground text-[11px]">
                            <AlertCircle className="h-3 w-3" />
                            {inv.status}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground font-mono">
                        {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
