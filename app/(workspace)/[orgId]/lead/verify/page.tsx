import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { CheckSquare, ArrowRight, CheckCircle2 } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function LeadVerifyQueuePage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

  const admin = createAdminClient()

  // Fetch tasks submitted for verification in this org
  const { data: tasks } = await admin
    .from("tasks")
    .select(`
      id,
      title,
      token_value,
      status,
      created_at,
      assigned_to_id,
      users:assigned_to_id(
        name,
        email
      ),
      org_units(name)
    `)
    .eq("organization_id", orgId)
    .in("status", ["VERIFICATION_PENDING", "PENDING_VERIFICATION", "SUBMITTED", "IN_REVIEW"])
    .order("created_at", { ascending: false })

  const allTasks = tasks || []

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
          <CheckSquare className="h-8 w-8 text-primary" />
          Task Verification Queue
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Inspect work proofs, validate deliverables, and award non-monetary credit liquidity
        </p>
      </div>

      <Card className="rounded-2xl border-2 shadow-md">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-black text-foreground">
                Pending Proofs of Work
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Submissions awaiting cryptographic and qualitative lead verification
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-bold text-xs">
              {allTasks.length} Pending Tasks
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {allTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto opacity-70" />
              <p className="font-bold text-foreground">All Tasks Verified</p>
              <p className="text-xs">No deliverables currently pending verification in your queue.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-bold text-xs">Task Title</TableHead>
                    <TableHead className="font-bold text-xs">Assignee</TableHead>
                    <TableHead className="font-bold text-xs">Department</TableHead>
                    <TableHead className="font-bold text-xs">Token Value</TableHead>
                    <TableHead className="font-bold text-xs">Status</TableHead>
                    <TableHead className="font-bold text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allTasks.map((task: any) => (
                    <TableRow key={task.id} className="hover:bg-muted/30 transition">
                      <TableCell className="font-bold text-sm text-foreground">
                        {task.title}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-xs text-foreground">
                          {task.users?.name || "Staff Member"}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {task.users?.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-muted-foreground">
                        {(task.org_units as any)?.name || "General"}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                        +{Number(task.token_value || 0).toLocaleString()} WORK
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold">
                          {task.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/${orgId}/lead/verification/${task.id}`}>
                          <Button size="sm" className="gap-1.5 h-8 text-xs font-bold shadow-xs">
                            Verify Proof <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
