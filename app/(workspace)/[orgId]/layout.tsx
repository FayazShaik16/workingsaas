import { requireAuth } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { CanvasShell } from "@/components/shell/canvas-shell"
import { redirect } from "next/navigation"

export const metadata = {
  title: "WorkLedger",
  description: "Enterprise performance and work-accountability platform",
}

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ orgId: string }>
}

// Scope level → URL base segment
const SCOPE_TO_BASE: Record<string, string> = {
  SYSTEM_ADMIN:  "config",
  DIRECTOR:      "director",
  FINANCE_ADMIN: "finance",
  ORG_UNIT_LEAD: "lead",
  DEPT_ADMIN:    "dept-admin",
  MEMBER:        "member",
}

import { cache } from "react"

const getCachedOrg = cache(async (orgId: string) => {
  const supabase = await createClient()
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, template_key")
    .eq("id", orgId)
    .single()
  return org
})

async function getWorkspaceContext(orgId: string) {
  const user = await requireAuth()

  // STRICT multi-tenancy with dynamic invitation reconciliation
  if (user.organizationId !== orgId) {
    const supabase = await createClient()
    const { data: invite } = await supabase
      .from("invitations")
      .select("*")
      .eq("organization_id", orgId)
      .eq("email", user.email)
      .maybeSingle()

    if (invite) {
      await supabase.from("users").update({ organization_id: orgId }).eq("id", user.id)
      user.organizationId = orgId
    } else {
      const primaryScope = user.scopeLevels?.[0] || "MEMBER"
      const roleBase = SCOPE_TO_BASE[primaryScope] || "member"
      redirect(`/${user.organizationId}/${roleBase}`)
    }
  }

  // Get cached organization metadata
  const org = await getCachedOrg(orgId)

  // Dynamic role hierarchy expansion so executives can preview all subordinate dashboards
  const directScopes = user.scopeLevels || []
  const expandedRoles = new Set<string>(directScopes.length > 0 ? directScopes : ["MEMBER"])

  if (expandedRoles.has("SYSTEM_ADMIN")) {
    expandedRoles.add("DIRECTOR")
    expandedRoles.add("FINANCE_ADMIN")
    expandedRoles.add("ORG_UNIT_LEAD")
    expandedRoles.add("MEMBER")
  } else if (expandedRoles.has("DIRECTOR")) {
    expandedRoles.add("SYSTEM_ADMIN")
    expandedRoles.add("MEMBER")
  } else if (expandedRoles.has("ORG_UNIT_LEAD") || expandedRoles.has("FINANCE_ADMIN") || expandedRoles.has("DEPT_ADMIN")) {
    expandedRoles.add("MEMBER")
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: undefined,
    },
    organization: org,
    availableRoles: Array.from(expandedRoles),
  }
}

export default async function WorkspaceLayout({ children, params }: LayoutProps) {
  const { orgId } = await params
  const context = await getWorkspaceContext(orgId)

  return (
    <CanvasShell
      user={context.user}
      organization={context.organization}
      availableRoles={context.availableRoles}
      title="Dashboard"
      unreadNotifications={0}
      notifications={[]}
    >
      {children}
    </CanvasShell>
  )
}
