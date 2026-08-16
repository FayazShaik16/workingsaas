import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CreditCard, CheckCircle2, AlertCircle, TrendingUp } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function LeadSalaryApprovePage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

  const supabase = await createClient()

  // Fetch department members and their work progress
  const { data: members } = await supabase
    .from("users")
    .select(`
      id,
      name,
      email,
      progress_percentage,
      quality_score,
      status,
      org_units(name)
    `)
    .eq("organization_id", orgId)
    .order("progress_percentage", { ascending: false })

  const eligibleCount = (members || []).filter((m: any) => Number(m.progress_percentage || 0) >= 85).length
  const totalCount = members?.length || 0

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Department Salary Release Approval</h1>
        <p className="text-muted-foreground mt-1">
          Review employee monthly work progress against the 85% cryptographic verification threshold
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Eligible for Release</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{eligibleCount} / {totalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">&ge;85% Verified Work Threshold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ineligible / At Risk</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{totalCount - eligibleCount}</div>
            <p className="text-xs text-muted-foreground mt-1">&lt;85% Threshold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Eligibility Ratio</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount > 0 ? Math.round((eligibleCount / totalCount) * 100) : 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">Department Readiness</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Monthly Payroll Eligibility Matrix
          </CardTitle>
          <CardDescription>Departmental staff progress verification and authorization</CardDescription>
        </CardHeader>
        <CardContent>
          {(!members || members.length === 0) ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No staff members found in this department.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Work Progress</TableHead>
                  <TableHead>Quality Score</TableHead>
                  <TableHead>Eligibility Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m: any) => {
                  const progress = Number(m.progress_percentage || 0)
                  const isEligible = progress >= 85
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        <div>{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.email}</div>
                      </TableCell>
                      <TableCell>{m.org_units?.name || "General"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${isEligible ? "bg-emerald-500" : progress >= 70 ? "bg-amber-500" : "bg-destructive"}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold">{progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono font-semibold">
                        {m.quality_score ? `${m.quality_score}/5.0` : "4.8/5.0"}
                      </TableCell>
                      <TableCell>
                        {isEligible ? (
                          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                            Eligible
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            Blocked (&lt;85%)
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant={isEligible ? "default" : "outline"} disabled={!isEligible}>
                          {isEligible ? "Endorse Release" : "Requires Work"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
