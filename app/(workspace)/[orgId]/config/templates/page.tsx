import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default async function AdminTemplatesPage() {
  await requireAuth()
  await requireScope("SYSTEM_ADMIN")

  const supabase = await createClient()

  const { data: templates } = await supabase
    .from("organization_templates")
    .select("*")

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organization Templates</h1>
        <p className="text-muted-foreground mt-1">Available domain templates and structural settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-md">Active Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template Key</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Default Unit Types</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(templates || []).map((t: any) => (
                <TableRow key={t.id || t.key}>
                  <TableCell className="font-mono font-medium">{t.key}</TableCell>
                  <TableCell>{t.label}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {Array.isArray(t.default_unit_types) &&
                        t.default_unit_types.map((unit: string) => (
                          <Badge key={unit} variant="secondary" className="text-xs">
                            {unit}
                          </Badge>
                        ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
