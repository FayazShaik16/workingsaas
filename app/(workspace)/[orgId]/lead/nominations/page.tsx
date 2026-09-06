import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { HODNominationsClient, NominationItem } from "@/components/lead/hod-nominations-client"
import { Users } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function LeadNominationsPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN", "DEPT_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  // 1. Fetch user department
  const { data: userProfile } = await db
    .from("users")
    .select("org_unit_id, org_units(id, name)")
    .eq("id", user.id)
    .single()

  const deptId = userProfile?.org_unit_id || user.orgUnitId
  const deptName = (userProfile?.org_units as any)?.name || "Department"

  // 2. Query nominations for tasks in this organization and department
  let query = db
    .from("nominations")
    .select(`
      id,
      task_id,
      user_id,
      status,
      message,
      created_at,
      tasks!inner(
        id,
        title,
        description,
        credit_value,
        priority,
        category,
        deadline,
        status,
        organization_id,
        org_unit_id
      ),
      users!inner(
        id,
        name,
        email,
        designation
      )
    `)
    .eq("tasks.organization_id", orgId)
    .order("created_at", { ascending: false })

  if (deptId) {
    query = query.eq("tasks.org_unit_id", deptId)
  }

  const { data: rawNominations, error } = await query

  if (error) {
    console.error("[LeadNominationsPage] Query error:", error)
  }

  const nominations: NominationItem[] = (rawNominations || []).map((n: any) => ({
    id: n.id,
    taskId: n.task_id,
    taskTitle: n.tasks?.title || "Untitled Task",
    taskDescription: n.tasks?.description,
    creditValue: Number(n.tasks?.credit_value || 0),
    priority: n.tasks?.priority || "MEDIUM",
    category: n.tasks?.category || "UNSTRUCTURED",
    deadline: n.tasks?.deadline,
    taskStatus: n.tasks?.status || "OPEN",
    userId: n.user_id,
    userName: n.users?.name || "Unknown Faculty",
    userEmail: n.users?.email || "",
    userDesignation: n.users?.designation,
    deptName: deptName,
    nominationStatus: n.status || "PENDING",
    message: n.message,
    createdAt: n.created_at,
  }))

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            {deptName}
          </span>
          <span className="text-xs text-muted-foreground">Task Marketplace Review</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground mt-1">
          Faculty Nominations & Applications
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
          Review faculty volunteers for department initiatives, assign responsibilities, or manage task pool applications.
        </p>
      </div>

      <HODNominationsClient orgId={orgId} deptName={deptName} nominations={nominations} />
    </div>
  )
}
