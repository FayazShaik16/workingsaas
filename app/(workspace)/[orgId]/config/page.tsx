import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatRole } from "@/lib/utils/formatters"
import { Shield, UserPlus, ArrowRight, CheckCircle2 } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function ConfigDashboardPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("SYSTEM_ADMIN", "DIRECTOR")

  const admin = createAdminClient()

  // Fetch director assignment status
  const { data: directorAssignments } = await (admin as any)
    .from("user_roles")
    .select("user_id, roles!inner(scope_level), users!inner(id, name, email)")
    .eq("roles.organization_id", orgId)
    .eq("roles.scope_level", "DIRECTOR")

  const directors: any[] = directorAssignments || []
  const currentAdminIsDirector = directors.some((d) => d.user_id === user.id)
  const externalDirector = directors.find((d) => d.user_id !== user.id)

  // Get all configuration entities
  const { data: workflows } = await admin
    .from("workflow_definitions")
    .select("id, entity_type, is_active")
    .eq("organization_id", orgId)

  const { data: businessRules } = await admin
    .from("business_rules")
    .select("id, entity_type, trigger_event, is_active")
    .eq("organization_id", orgId)

  const { data: accessRules } = await admin
    .from("access_control_rules")
    .select("id, entity_type, role_scope, operation")
    .eq("organization_id", orgId)

  const { data: qualifiers } = await admin
    .from("reference_qualifiers")
    .select("id, source_entity, target_entity")
    .eq("organization_id", orgId)

  const { data: notifications } = await admin
    .from("notification_definitions")
    .select("id, trigger_event, is_active")
    .eq("organization_id", orgId)

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Configuration</h1>
          <p className="text-muted-foreground mt-2">Configure workflows, rules, access controls, and notifications</p>
        </div>

        <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs self-start sm:self-auto">
          <Link href={`/${orgId}/config/people`}>
            <UserPlus className="h-3.5 w-3.5" />
            Manage People &amp; Roles
          </Link>
        </Button>
      </div>

      {/* ── Executive Leadership & Governance Summary ── */}
      <Card className="border-border/60 bg-linear-to-r from-card to-card/50 shadow-xs">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Shield className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <span>Executive Director Status</span>
                {currentAdminIsDirector ? (
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] py-0">
                    Dual Role: You (Admin + Director)
                  </Badge>
                ) : externalDirector ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] py-0">
                    Appointed: {externalDirector.users?.name || externalDirector.users?.email}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-[10px] py-0">
                    Not Appointed
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-[11px]">
                {currentAdminIsDirector
                  ? "Your account has dual privileges. You can switch between System Admin and Director workspaces in the sidebar."
                  : externalDirector
                  ? `Dedicated Executive Director account configured (${externalDirector.users?.email}).`
                  : "Your account is set as pure System Administrator. You can provision a separate Director or assign the Director role to yourself."}
              </p>
            </div>
          </div>

          <Button asChild size="sm" variant="ghost" className="text-xs shrink-0 gap-1 text-primary hover:text-primary">
            <Link href={`/${orgId}/config/people`}>
              Configure in People &amp; Roles
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Workflows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workflows?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">State machines configured</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Business Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{businessRules?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Rules active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Access Control</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accessRules?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Policies defined</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Qualifiers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{qualifiers?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Reference rules</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Templates configured</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="workflows" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="qualifiers">Qualifiers</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Definitions</CardTitle>
              <CardDescription>State machines for tasks, loans, and other entities</CardDescription>
            </CardHeader>
            <CardContent>
              {workflows && workflows.length > 0 ? (
                <div className="space-y-2">
                  {workflows.map((wf: any) => (
                    <div key={wf.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{wf.entity_type}</p>
                        <p className="text-xs text-muted-foreground">Workflow definition</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={wf.is_active ? "default" : "secondary"}>
                          {wf.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Button size="sm" variant="outline">Edit</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No workflows configured</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Business Rules</CardTitle>
              <CardDescription>Automatic actions triggered on events</CardDescription>
            </CardHeader>
            <CardContent>
              {businessRules && businessRules.length > 0 ? (
                <div className="space-y-2">
                  {businessRules.map((rule: any) => (
                    <div key={rule.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{rule.trigger_event}</p>
                        <p className="text-xs text-muted-foreground">On {rule.entity_type}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={rule.is_active ? "default" : "secondary"}>
                          {rule.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Button size="sm" variant="outline">Edit</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No business rules configured</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Access Control Rules</CardTitle>
              <CardDescription>Fine-grained permissions by role and entity</CardDescription>
            </CardHeader>
            <CardContent>
              {accessRules && accessRules.length > 0 ? (
                <div className="space-y-2">
                  {accessRules.map((rule: any) => (
                    <div key={rule.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{rule.operation} on {rule.entity_type}</p>
                        <p className="text-xs text-muted-foreground">Scope: {formatRole(rule.role_scope)}</p>
                      </div>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No access rules configured</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qualifiers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reference Qualifiers</CardTitle>
              <CardDescription>Data relationship and filtering rules</CardDescription>
            </CardHeader>
            <CardContent>
              {qualifiers && qualifiers.length > 0 ? (
                <div className="space-y-2">
                  {qualifiers.map((q: any) => (
                    <div key={q.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{q.source_entity} → {q.target_entity}</p>
                        <p className="text-xs text-muted-foreground">Reference qualifier</p>
                      </div>
                      <Button size="sm" variant="outline">Edit</Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No qualifiers configured</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Definitions</CardTitle>
              <CardDescription>Email and alert templates</CardDescription>
            </CardHeader>
            <CardContent>
              {notifications && notifications.length > 0 ? (
                <div className="space-y-2">
                  {notifications.map((notif: any) => (
                    <div key={notif.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{notif.trigger_event}</p>
                        <p className="text-xs text-muted-foreground">Notification template</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={notif.is_active ? "default" : "secondary"}>
                          {notif.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Button size="sm" variant="outline">Edit</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No notifications configured</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
