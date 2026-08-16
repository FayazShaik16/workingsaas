import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bell, CheckCircle2, AlertTriangle, Info, Clock } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DirectorNotificationsPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("DIRECTOR", "SYSTEM_ADMIN")

  const supabase = await createClient()

  // Fetch notifications
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50)

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organization Notifications</h1>
        <p className="text-muted-foreground mt-1">
          System events, verification alerts, leave escalations & financial milestones
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Activity & System Alerts
          </CardTitle>
          <CardDescription>Live notifications stream for your organization</CardDescription>
        </CardHeader>
        <CardContent>
          {(!notifications || notifications.length === 0) ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-60" />
              All caught up! No unread notifications or system alerts.
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n: any) => (
                <div key={n.id} className="py-4 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted text-primary mt-0.5">
                    {n.type === "WARNING" ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Info className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">{n.title || "System Event"}</h4>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(n.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
