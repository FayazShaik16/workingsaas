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
  const supabase = await createClient()

  // 0. Forced password rotation guard
  const { data: authData } = await supabase.auth.getUser()
  if (authData.user?.user_metadata?.must_change_password === true) {
    redirect("/auth/change-password")
  }

  // STRICT multi-tenancy with dynamic invitation reconciliation
  if (user.organizationId !== orgId) {
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

  // Institutional roles: only SYSTEM_ADMIN gets universal preview switcher
  const isSysAdmin = (user.scopeLevels || []).includes("SYSTEM_ADMIN")
  const ALL_INSTITUTIONAL_ROLES = [
    "SYSTEM_ADMIN",
    "DIRECTOR",
    "ORG_UNIT_LEAD",
    "DEPT_ADMIN",
    "MEMBER",
    "FINANCE_ADMIN",
  ]
  const availableRoles = isSysAdmin ? ALL_INSTITUTIONAL_ROLES : (user.scopeLevels || ["MEMBER"])

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: undefined,
    },
    organization: org,
    availableRoles,
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
