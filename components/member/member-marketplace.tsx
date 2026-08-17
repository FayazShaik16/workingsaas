"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"

interface UnstructuredTask {
  id: string
  title: string
  reward: number
  volunteers: number
}

interface MemberMarketplaceProps {
  initialTasks: UnstructuredTask[]
  userId: string
}

export function MemberMarketplace({ initialTasks, userId }: MemberMarketplaceProps) {
  const supabase = createClient()
  const db = supabase as any
  const [tasks, setTasks] = useState<UnstructuredTask[]>(initialTasks)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleNominate = async (taskId: string) => {
    if (!userId) return
    setActionLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const { error: insertError } = await db
        .from("task_applications")
        .insert({
          task_id: taskId,
          user_id: userId,
          status: "PENDING",
        })
      if (insertError) throw insertError
      setSuccess("Self-nomination submitted successfully!")
      // Remove or mark as nominated
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
    } catch (err) {
      setError("Failed to nominate: " + (err instanceof Error ? err.message : ""))
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <Card className="rounded-2xl border border-muted/80 bg-background/50 backdrop-blur-xs">
      <CardHeader>
        <CardTitle className="text-xl font-light">Open Unstructured Tasks</CardTitle>
        <CardDescription className="font-light">Self-nominate to earn extra tokens and improve your target progress</CardDescription>
      </CardHeader>

      {error && <div className="mx-6 mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-xl">{error}</div>}
      {success && <div className="mx-6 mb-4 p-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl">{success}</div>}

      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tasks.length === 0 ? (
          <div className="col-span-3 text-center py-6 text-muted-foreground font-light">No open tasks available.</div>
        ) : (
          tasks.map((t) => (
            <div key={t.id} className="p-5 rounded-2xl border border-muted/80 bg-background/60 shadow-2xs flex flex-col justify-between gap-4">
              <div>
                <h4 className="text-sm font-normal text-foreground/90 mb-2 truncate">{t.title}</h4>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary" className="text-[9px] font-light">{t.reward} tokens</Badge>
                  <span className="text-[10px] text-muted-foreground font-light">{t.volunteers} volunteers needed</span>
                </div>
              </div>
              <Button size="sm" onClick={() => handleNominate(t.id)} disabled={actionLoading} className="rounded-xl text-xs w-full shadow-xs">
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Nominate Myself"}
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
