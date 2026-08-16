import { requireAuth, requireScope } from "@/lib/auth/protect"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Plus } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DeptAdminSubjectsPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("DEPT_ADMIN", "ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Courses & Curriculum Subjects</h1>
          <p className="text-muted-foreground mt-1">Manage departmental course codes, syllabus requirements & credit weights</p>
        </div>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Subject
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Registered Courses
          </CardTitle>
          <CardDescription>Academic subjects assigned to faculty members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground text-sm">
            No subjects registered yet. Click &quot;Add Subject&quot; to configure your department curriculum.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
