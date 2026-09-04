import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { getTeachingStaff } from "@/lib/queries/teaching-staff"
import {
  HODTaskManager,
  DepartmentTask,
  DepartmentFacultyMember,
} from "@/components/lead/hod-task-manager"
import { CheckSquare, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function LeadApprovalsPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN", "DEPT_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  // 1. Fetch current user profile to determine department
  const { data: userProfile } = await db
    .from("users")
    .select("org_unit_id, org_units(id, name)")
    .eq("id", user.id)
    .single()

  const deptId = userProfile?.org_unit_id || user.orgUnitId
  const deptName = (userProfile?.org_units as any)?.name || "Academic Department"

  // 2. Fetch teaching staff for assignment dropdown
  const teachingStaff = await getTeachingStaff(admin, orgId, deptId || undefined)
  const facultyMembers: DepartmentFacultyMember[] = teachingStaff.map((f) => ({
    id: f.id,
    name: f.name,
    email: f.email,
    designation: f.designation,
  }))

  // 3. Fetch all tasks for this department
  let tasksQuery = db
    .from("tasks")
    .select(`
      id,
      title,
      description,
      credit_value,
      category,
      priority,
      status,
      deadline,
      created_at,
      lead_signed_at,
      assigned_to_id,
      users:assigned_to_id (id, name, email),
      task_proofs (id, description, file_url, submitted_at)
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  if (deptId) {
    tasksQuery = tasksQuery.eq("org_unit_id", deptId)
  }

  const { data: rawTasks } = await tasksQuery

  const formattedTasks: DepartmentTask[] = (rawTasks || []).map((t: any) => {
    const proof = Array.isArray(t.task_proofs) && t.task_proofs.length > 0 ? t.task_proofs[0] : null
    const assignedUser = t.users

    return {
      id: t.id,
      title: t.title,
      description: t.description || undefined,
      creditValue: Number(t.credit_value || 0),
      penaltyValue: undefined,
      category: t.category || "UNSTRUCTURED",
      priority: t.priority || "MEDIUM",
      status: t.status,
      deadline: t.deadline || undefined,
      createdAt: t.created_at,
      completedAt: t.lead_signed_at || proof?.submitted_at || undefined,
      assignedToId: t.assigned_to_id || undefined,
      assignedToName: assignedUser?.name || undefined,
      assignedToEmail: assignedUser?.email || undefined,
      proofText: proof?.description || undefined,
      proofUrl: proof?.file_url || undefined,
    }
  })

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button asChild variant="ghost" size="xs" className="h-6 px-2 text-xs text-muted-foreground">
              <Link href={`/${orgId}/lead/tasks`}>
                <ArrowLeft className="h-3 w-3 mr-1" /> Back to Task Hub
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <CheckSquare className="h-8 w-8 text-emerald-500" />
            Task Approvals & Verification Queue
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review submitted deliverable proofs, inspect files, and endorse completed faculty assignments.
          </p>
        </div>
      </div>

      <HODTaskManager
        orgId={orgId}
        leadUserId={user.id}
        deptId={deptId}
        deptName={deptName}
        tasks={formattedTasks}
        facultyMembers={facultyMembers}
        initialTab="approvals"
        pageTitle="Verification & Sign-off Queue"
        pageDescription="Inspect deliverables submitted by department members and authorize credit release."
      />
    </div>
  )
}
