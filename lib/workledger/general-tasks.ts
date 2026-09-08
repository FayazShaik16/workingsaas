import { createAdminClient } from "@/lib/supabase/admin"
import { getOrCreateDefaultTaskType } from "@/lib/workledger/default-task-type"

export type GeneralTaskCategory =
  | "COUNSELLING"
  | "MENTORSHIP"
  | "LAB_MAINTENANCE"
  | "ACCREDITATION"
  | "EVENT"
  | "OTHER"

export interface GeneralTaskTemplate {
  id: string
  title: string
  description: string
  generalCategory: GeneralTaskCategory
  hourlyRate: number
  minDurationHours: number
  maxDurationHours: number
  orgUnitId?: string | null
  orgUnitName?: string
  status: string
  createdByRole?: string
  createdAt: string
}

export interface GeneralTaskLog {
  id: string
  parentTemplateId: string
  templateTitle: string
  generalCategory: GeneralTaskCategory
  facultyId: string
  facultyName: string
  facultyEmail: string
  facultyDesignation?: string | null
  departmentId?: string | null
  departmentName?: string
  durationHours: number
  hourlyRate: number
  credits: number
  sessionDate: string
  notes: string
  proofUrl?: string
  status: "VERIFICATION_PENDING" | "LEAD_SIGNED" | "REJECTED" | string
  submittedAt: string
  approvedAt?: string
  approvedByName?: string
}

export interface GeneralProductivitySummary {
  totalHoursLogged: number
  totalTokensAwarded: number
  totalSessionsCompleted: number
  activeFacultyCount: number
  categoryBreakdown: Record<string, { hours: number; sessions: number; tokens: number }>
}

export interface FacultyProductivityRecord {
  facultyId: string
  facultyName: string
  facultyEmail: string
  facultyDesignation?: string | null
  departmentName?: string
  totalHours: number
  totalSessions: number
  totalTokensEarned: number
  lastActiveDate?: string
  logs: GeneralTaskLog[]
}

const DEFAULT_GENERAL_TEMPLATES: Array<{
  title: string
  description: string
  generalCategory: GeneralTaskCategory
  hourlyRate: number
}> = [
  {
    title: "Student Academic Counselling & Mentorship",
    description: "One-on-one and small group student counseling addressing backlog clearance, examination stress, attendance recovery, and career pathway mentoring.",
    generalCategory: "COUNSELLING",
    hourlyRate: 0.5,
  },
  {
    title: "Laboratory Equipment Maintenance & Safety Calibration",
    description: "Preventative servicing, safety protocol auditing, component replacement, and calibration of specialized departmental engineering laboratory apparatus.",
    generalCategory: "LAB_MAINTENANCE",
    hourlyRate: 0.75,
  },
  {
    title: "NAAC & NBA Accreditation Documentation Support",
    description: "Curating syllabus compliance matrices, outcome attainment calculations, course files, and department accreditation criterion dossiers.",
    generalCategory: "ACCREDITATION",
    hourlyRate: 1.0,
  },
]

/**
 * Ensures default general task templates exist for the organization / department.
 */
export async function seedDefaultGeneralTasksIfEmpty(orgId: string, deptId?: string) {
  const admin = createAdminClient()
  const db = admin as any

  // 1. Check if templates exist
  const { data: existing } = await db
    .from("tasks")
    .select("id")
    .eq("organization_id", orgId)
    .eq("custom_fields->>is_general_task_template", "true")
    .limit(1)

  if (!existing || existing.length === 0) {
    // Resolve fallback org_unit_id (tasks has NOT NULL constraint on org_unit_id)
    let resolvedOrgUnitId = deptId
    if (!resolvedOrgUnitId) {
      const { data: fallbackUnits } = await db
        .from("org_units")
        .select("id")
        .eq("organization_id", orgId)
        .limit(1)
      resolvedOrgUnitId = fallbackUnits?.[0]?.id
    }
    if (!resolvedOrgUnitId) return

    // Resolve fallback creator_id (tasks has NOT NULL constraint on creator_id)
    const { data: fallbackUser } = await db
      .from("users")
      .select("id")
      .eq("organization_id", orgId)
      .limit(1)
    const creatorId = fallbackUser?.[0]?.id
    if (!creatorId) return

    const taskTypeId = await getOrCreateDefaultTaskType(orgId)
    const nowIso = new Date().toISOString()
    const isOrgWide = !deptId

    const rowsToInsert = DEFAULT_GENERAL_TEMPLATES.map((tpl) => ({
      organization_id: orgId,
      org_unit_id: resolvedOrgUnitId,
      task_type_id: taskTypeId,
      creator_id: creatorId,
      category: "UNSTRUCTURED",
      priority: "MEDIUM",
      title: tpl.title,
      description: tpl.description,
      credit_value: tpl.hourlyRate,
      status: "OPEN",
      visibility_scope: isOrgWide ? "ORGANIZATION" : "ORG_UNIT",
      verification_mode: "MANUAL_REPORT",
      allow_nomination: false,
      custom_fields: {
        is_general_task_template: true,
        is_org_wide: isOrgWide,
        general_task_category: tpl.generalCategory,
        hourly_rate_credits: tpl.hourlyRate,
        min_duration_hours: 0.5,
        max_duration_hours: 8.0,
        requires_time_log: true,
        created_by_role: isOrgWide ? "DIRECTOR" : "ORG_UNIT_LEAD",
      },
      created_at: nowIso,
      updated_at: nowIso,
    }))

    await db.from("tasks").insert(rowsToInsert)
  }
}

/**
 * Fetch all active General Task templates available to the given department/organization.
 */
export async function getGeneralTaskTemplates(
  orgId: string,
  deptId?: string
): Promise<GeneralTaskTemplate[]> {
  await seedDefaultGeneralTasksIfEmpty(orgId, deptId)

  const admin = createAdminClient()
  const db = admin as any

  const { data: rawTemplates } = await db
    .from("tasks")
    .select(`
      id,
      title,
      description,
      credit_value,
      status,
      org_unit_id,
      custom_fields,
      created_at,
      org_units:org_unit_id(name)
    `)
    .eq("organization_id", orgId)
    .eq("custom_fields->>is_general_task_template", "true")
    .neq("status", "CANCELLED")
    .order("created_at", { ascending: true })

  const filtered = (rawTemplates || []).filter((t: any) => {
    if (!deptId) return true
    const cf = t.custom_fields || {}
    if (cf.is_org_wide === true || cf.is_org_wide === "true") return true
    return t.org_unit_id === deptId
  })

  return filtered.map((t: any) => {
    const cf = t.custom_fields || {}
    const hourlyRate = Number(cf.hourly_rate_credits || t.credit_value || 0.5)
    return {
      id: t.id,
      title: t.title,
      description: t.description || "",
      generalCategory: (cf.general_task_category || "OTHER") as GeneralTaskCategory,
      hourlyRate,
      minDurationHours: Number(cf.min_duration_hours || 0.5),
      maxDurationHours: Number(cf.max_duration_hours || 8.0),
      orgUnitId: t.org_unit_id,
      orgUnitName: cf.is_org_wide ? "Organization Wide" : t.org_units?.name || "Department",
      status: t.status,
      createdByRole: cf.created_by_role || "ADMIN",
      createdAt: t.created_at,
    }
  })
}

/**
 * Fetch all general task activity logs submitted by a specific faculty member.
 */
export async function getFacultyGeneralTaskLogs(
  orgId: string,
  userId: string
): Promise<GeneralTaskLog[]> {
  const admin = createAdminClient()
  const db = admin as any

  const { data: rawLogs } = await db
    .from("tasks")
    .select(`
      id,
      title,
      description,
      credit_value,
      status,
      created_at,
      lead_signed_at,
      custom_fields,
      users:assigned_to_id(id, name, email, designation, org_unit_id, org_units:org_unit_id(name)),
      lead:lead_signed_by(name),
      task_proofs(id, description, file_url, submitted_at)
    `)
    .eq("organization_id", orgId)
    .eq("assigned_to_id", userId)
    .eq("custom_fields->>is_general_task_log", "true")
    .order("created_at", { ascending: false })

  return (rawLogs || []).map((t: any) => {
    const cf = t.custom_fields || {}
    const proof = Array.isArray(t.task_proofs) && t.task_proofs[0] ? t.task_proofs[0] : null
    return {
      id: t.id,
      parentTemplateId: cf.parent_template_id || "",
      templateTitle: cf.parent_template_title || t.title.replace(/^\[General Task: [^\]]+\]\s*/, ""),
      generalCategory: (cf.general_task_category || "OTHER") as GeneralTaskCategory,
      facultyId: t.users?.id || userId,
      facultyName: t.users?.name || "Faculty Member",
      facultyEmail: t.users?.email || "",
      facultyDesignation: t.users?.designation || null,
      departmentId: t.users?.org_unit_id || null,
      departmentName: t.users?.org_units?.name || "Department",
      durationHours: Number(cf.duration_hours || 1),
      hourlyRate: Number(cf.hourly_rate_credits || 0.5),
      credits: Number(t.credit_value || 0),
      sessionDate: cf.session_date || t.created_at.slice(0, 10),
      notes: cf.faculty_notes || proof?.description || t.description || "",
      proofUrl: proof?.file_url || undefined,
      status: t.status,
      submittedAt: proof?.submitted_at || t.created_at,
      approvedAt: t.lead_signed_at || undefined,
      approvedByName: t.lead?.name || undefined,
    }
  })
}

/**
 * Fetch Department or Org-wide General Task Productivity and Accounting overview for Higher Authorities.
 */
export async function getDepartmentGeneralProductivity(
  orgId: string,
  deptId?: string
): Promise<{
  summary: GeneralProductivitySummary
  facultyRoster: FacultyProductivityRecord[]
  pendingApprovals: GeneralTaskLog[]
  templates: GeneralTaskTemplate[]
}> {
  const templates = await getGeneralTaskTemplates(orgId, deptId)
  const admin = createAdminClient()
  const db = admin as any

  let query = db
    .from("tasks")
    .select(`
      id,
      title,
      description,
      credit_value,
      status,
      org_unit_id,
      created_at,
      lead_signed_at,
      custom_fields,
      users:assigned_to_id(id, name, email, designation, org_unit_id, org_units:org_unit_id(name)),
      lead:lead_signed_by(name),
      task_proofs(id, description, file_url, submitted_at)
    `)
    .eq("organization_id", orgId)
    .eq("custom_fields->>is_general_task_log", "true")
    .order("created_at", { ascending: false })

  if (deptId) {
    query = query.eq("org_unit_id", deptId)
  }

  const { data: rawLogs } = await query

  const allLogs: GeneralTaskLog[] = (rawLogs || []).map((t: any) => {
    const cf = t.custom_fields || {}
    const proof = Array.isArray(t.task_proofs) && t.task_proofs[0] ? t.task_proofs[0] : null
    return {
      id: t.id,
      parentTemplateId: cf.parent_template_id || "",
      templateTitle: cf.parent_template_title || t.title.replace(/^\[General Task: [^\]]+\]\s*/, ""),
      generalCategory: (cf.general_task_category || "OTHER") as GeneralTaskCategory,
      facultyId: t.users?.id || "",
      facultyName: t.users?.name || "Faculty Member",
      facultyEmail: t.users?.email || "",
      facultyDesignation: t.users?.designation || null,
      departmentId: t.org_unit_id || t.users?.org_unit_id || null,
      departmentName: t.users?.org_units?.name || "Department",
      durationHours: Number(cf.duration_hours || 1),
      hourlyRate: Number(cf.hourly_rate_credits || 0.5),
      credits: Number(t.credit_value || 0),
      sessionDate: cf.session_date || t.created_at.slice(0, 10),
      notes: cf.faculty_notes || proof?.description || t.description || "",
      proofUrl: proof?.file_url || undefined,
      status: t.status,
      submittedAt: proof?.submitted_at || t.created_at,
      approvedAt: t.lead_signed_at || undefined,
      approvedByName: t.lead?.name || undefined,
    }
  })

  // Summary aggregation
  let totalHoursLogged = 0
  let totalTokensAwarded = 0
  let totalSessionsCompleted = 0
  const activeFacultySet = new Set<string>()
  const categoryBreakdown: Record<string, { hours: number; sessions: number; tokens: number }> = {}

  allLogs.forEach((log) => {
    totalHoursLogged += log.durationHours
    if (log.facultyId) activeFacultySet.add(log.facultyId)

    if (log.status === "LEAD_SIGNED" || log.status === "CLOSED") {
      totalTokensAwarded += log.credits
      totalSessionsCompleted += 1
    }

    const cat = log.generalCategory || "OTHER"
    if (!categoryBreakdown[cat]) {
      categoryBreakdown[cat] = { hours: 0, sessions: 0, tokens: 0 }
    }
    categoryBreakdown[cat].hours += log.durationHours
    if (log.status === "LEAD_SIGNED" || log.status === "CLOSED") {
      categoryBreakdown[cat].sessions += 1
      categoryBreakdown[cat].tokens += log.credits
    }
  })

  // Faculty roster aggregation
  const facultyMap = new Map<string, FacultyProductivityRecord>()
  allLogs.forEach((log) => {
    if (!log.facultyId) return
    let rec = facultyMap.get(log.facultyId)
    if (!rec) {
      rec = {
        facultyId: log.facultyId,
        facultyName: log.facultyName,
        facultyEmail: log.facultyEmail,
        facultyDesignation: log.facultyDesignation,
        departmentName: log.departmentName,
        totalHours: 0,
        totalSessions: 0,
        totalTokensEarned: 0,
        lastActiveDate: log.sessionDate,
        logs: [],
      }
      facultyMap.set(log.facultyId, rec)
    }

    rec.totalHours += log.durationHours
    rec.logs.push(log)
    if (log.status === "LEAD_SIGNED" || log.status === "CLOSED") {
      rec.totalSessions += 1
      rec.totalTokensEarned += log.credits
    }
    if (!rec.lastActiveDate || log.sessionDate > rec.lastActiveDate) {
      rec.lastActiveDate = log.sessionDate
    }
  })

  const facultyRoster = Array.from(facultyMap.values()).sort(
    (a, b) => b.totalHours - a.totalHours
  )

  const pendingApprovals = allLogs.filter(
    (l) => l.status === "VERIFICATION_PENDING" || l.status === "SUBMITTED"
  )

  return {
    summary: {
      totalHoursLogged: Number(totalHoursLogged.toFixed(1)),
      totalTokensAwarded: Number(totalTokensAwarded.toFixed(2)),
      totalSessionsCompleted,
      activeFacultyCount: activeFacultySet.size,
      categoryBreakdown,
    },
    facultyRoster,
    pendingApprovals,
    templates,
  }
}
