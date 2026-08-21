import { requireAuth } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function MemberDashboardPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // Get progress towards monthly target
  const { data: compensation } = await (supabase as any)
    .from("compensation_policies")
    .select("monthly_target_credits")
    .eq("organization_id", user.organizationId)
    .eq("scope_type", "ORG_WIDE")
    .single()

  // Get user's current credit balance from PERSONAL wallet
  const { data: wallet } = await (supabase as any)
    .from("wallets")
    .select("balance")
    .eq("owner_user_id", user.id)
    .eq("purpose", "PERSONAL")
    .single()

  // Get open tasks
  const { data: openTasks } = await (supabase as any)
    .from("tasks")
    .select("id, title, credit_value, deadline")
    .eq("status", "OPEN")
    .eq("organization_id", user.organizationId)
    .limit(5)

  // Get user's active nominations
  const { data: nominations } = await (supabase as any)
    .from("nominations")
    .select("id, tasks(id, title, credit_value), status")
    .eq("user_id", user.id)
    .in("status", ["PENDING", "ACCEPTED"])
    .limit(5)

  const monthlyTarget = compensation?.monthly_target_credits || 100
  const currentCredits = wallet?.balance || 0
  const progressPercentage = Math.min((currentCredits / monthlyTarget) * 100, 100)

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Member Dashboard</h1>
        <p className="text-muted-foreground mt-2">Track your progress and earnings</p>
      </div>

      {/* Monthly Progress Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Progress</CardTitle>
            <CardDescription>Credits earned this month</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{currentCredits.toFixed(2)}</span>
                <span className="text-muted-foreground">/ {monthlyTarget.toFixed(2)}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{progressPercentage.toFixed(0)}% complete</p>
            </div>
            {currentCredits >= monthlyTarget ? (
              <div className="bg-green-50 text-green-700 text-sm p-2 rounded">
                ✓ Target met - salary release eligible
              </div>
            ) : (
              <div className="bg-yellow-50 text-yellow-700 text-sm p-2 rounded">
                ⚠ {(monthlyTarget - currentCredits).toFixed(2)} credits needed
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Nominations</CardTitle>
            <CardDescription>Tasks you&apos;re working on</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{nominations?.length || 0}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {nominations?.filter((n: any) => n.status === "ACCEPTED").length || 0} accepted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Available Tasks</CardTitle>
            <CardDescription>Open marketplace tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{openTasks?.length || 0}</p>
            <Button asChild size="sm" className="mt-4 w-full">
              <Link href="/workspace/member/marketplace">Browse Tasks</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Open Tasks Section */}
      <Card>
        <CardHeader>
          <CardTitle>Open Tasks</CardTitle>
          <CardDescription>Recently posted tasks in the marketplace</CardDescription>
        </CardHeader>
        <CardContent>
          {openTasks && openTasks.length > 0 ? (
            <div className="space-y-3">
              {openTasks.map((task: any) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-sm">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-primary">{task.credit_value}</span>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/workspace/member/tasks/${task.id}`}>View</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No open tasks available</p>
          )}
        </CardContent>
      </Card>

      {/* My Nominations Section */}
      {nominations && nominations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>My Nominations</CardTitle>
            <CardDescription>Tasks you&apos;ve applied for</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {nominations.map((nom: any) => (
                <div
                  key={nom.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-sm">{nom.tasks?.title}</p>
                    <span className={`text-xs px-2 py-1 rounded mt-1 inline-block ${
                      nom.status === "ACCEPTED"
                        ? "bg-green-50 text-green-700"
                        : "bg-yellow-50 text-yellow-700"
                    }`}>
                      {nom.status === "ACCEPTED" ? "✓ Accepted" : "⏳ Pending"}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-primary">{nom.tasks?.credit_value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
