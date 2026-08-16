import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Building2, Plus, BookOpen } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DeptAdminProgrammesPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("DEPT_ADMIN", "ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

  const supabase = await createClient()

  const { data: programmes } = await supabase
    .from("org_units")
    .select("*")
    .eq("organization_id", orgId)

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Academic Programmes & Degrees</h1>
          <p className="text-muted-foreground mt-1">Manage departmental academic offerings, curricula & credits</p>
        </div>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Programme
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Active Programmes
          </CardTitle>
          <CardDescription>Structured degrees and certifications</CardDescription>
        </CardHeader>
        <CardContent>
          {(!programmes || programmes.length === 0) ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No programmes registered. Click &quot;Add Programme&quot; to configure degrees.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Programme Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programmes.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-semibold">{p.name}</TableCell>
                    <TableCell><Badge variant="outline">{p.unit_type || "Department"}</Badge></TableCell>
                    <TableCell><Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Active</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost">Edit</Button>
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
