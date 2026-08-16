import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ClipboardList, Check, X, Clock, CalendarDays } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function LeadLeavesPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

  const supabase = await createClient()

  // Fetch department leave requests
  const { data: leaves } = await supabase
    .from("leave_requests")
    .select(`
      id,
      start_date,
      end_date,
      type,
      reason,
      status,
      created_at,
      users:applicant_user_id(
        id,
        name,
        email,
        org_units(name)
      )
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Department Leave Queue</h1>
        <p className="text-muted-foreground mt-1">
          Review faculty and employee leave applications with automatic substitute and schedule validation
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Pending & Recent Leave Requests
          </CardTitle>
          <CardDescription>Leave applications requiring department lead approval</CardDescription>
        </CardHeader>
        <CardContent>
          {(!leaves || leaves.length === 0) ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <CalendarDays className="h-8 w-8 text-primary mx-auto mb-2 opacity-60" />
              No leave applications submitted in your department yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">
                      <div>{l.users?.name || "Staff Member"}</div>
                      <div className="text-xs text-muted-foreground">{l.users?.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{l.type || "Casual"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(l.start_date).toLocaleDateString()} - {new Date(l.end_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{l.reason || "Personal"}</TableCell>
                    <TableCell>
                      {l.status === "PENDING" ? (
                        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Pending</Badge>
                      ) : l.status === "APPROVED" ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Approved</Badge>
                      ) : (
                        <Badge variant="destructive">Rejected</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.status === "PENDING" ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" className="text-emerald-500 hover:text-emerald-600 gap-1">
                            <Check className="h-4 w-4" /> Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive gap-1">
                            <X className="h-4 w-4" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Decided</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
