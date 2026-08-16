import { requireAuth, requireScope } from "@/lib/auth/protect"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CalendarDays, Sparkles, Download } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DeptAdminTimetablePage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("DEPT_ADMIN", "ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Department Timetable Matrix</h1>
          <p className="text-muted-foreground mt-1">
            Weekly class schedule, lecture hall allocations & automated substitute conflict resolution
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-1.5">
            <Download className="h-4 w-4" /> Export Grid
          </Button>
          <Button className="gap-1.5">
            <Sparkles className="h-4 w-4" /> Auto-Generate Schedule
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> Master Schedule Grid
          </CardTitle>
          <CardDescription>Visual weekly schedule per room and faculty member</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground text-sm">
            Timetable is clear. Use the Auto-Generate button to automatically construct conflict-free schedules.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
