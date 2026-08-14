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

async function getWorkspaceContext(orgId: string) {
  const user = await requireAuth()
  const supabase = await createClient()

  // STRICT multi-tenancy: wrong org → redirect to user's actual org
  if (user.organizationId !== orgId) {
    const primaryScope = user.scopeLevels?.[0] || "MEMBER"
    const roleBase = SCOPE_TO_BASE[primaryScope] || "member"
    redirect(`/${user.organizationId}/${roleBase}`)
  }

  // Get organization
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, template_key")
    .eq("id", orgId)
    .single()

  // Get user's roles — return scope_level (not display name) for reliable mapping
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("roles(id, name, scope_level)")
    .eq("user_id", user.id)

  // Scope levels assigned to user
  const scopeLevels: string[] = (userRoles ?? [])
    .map((ur: any) => ur.roles?.scope_level)
    .filter(Boolean)

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: undefined,
    },
    organization: org,
    // Pass user's actual assigned roles only
    availableRoles: scopeLevels,
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
