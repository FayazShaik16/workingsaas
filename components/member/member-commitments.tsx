"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Calendar } from "lucide-react"

interface ScheduleItem {
  id: string
  title: string
  credit_value: number
  status: string
  deadline: string | null
  description: string | null
}

interface Commitment {
  id: string
  title: string
  reward: number
  status: string
  deadline: string | null
}

interface MemberCommitmentsProps {
  commitments: Commitment[]
  schedule: ScheduleItem[]
  orgId: string
}

export function MemberCommitments({ commitments, schedule: initialSchedule, orgId }: MemberCommitmentsProps) {
  const router = useRouter()
  const supabase = createClient()
  const [schedule, setSchedule] = useState<ScheduleItem[]>(initialSchedule)
  const [actionLoading, setActionLoading] = useState(false)

  const handleMarkAttendance = async (taskId: string) => {
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "CLOSED" })
        .eq("id", taskId)

      if (error) throw error
      setSchedule(prev => prev.map(s => s.id === taskId ? { ...s, status: "CLOSED" } : s))
    } catch (err) {
      console.error("Failed to mark session:", err)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Weekly Schedule */}
      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg font-light">This Week&apos;s Schedule</CardTitle>
            <CardDescription className="font-light">Lectures and session logs</CardDescription>
          </div>
          <Calendar className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3.5">
          {schedule.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center font-light">No lectures or sessions scheduled for this week.</p>
          ) : (
            schedule.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-muted/40 bg-background/40">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    {s.deadline ? new Date(s.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "09:00"}
                  </span>
                  <div>
                    <span className="text-sm font-normal text-foreground/90 block">{s.title}</span>
                    <span className="text-[10px] text-muted-foreground font-light">{s.description || "Assigned Classroom"}</span>
                  </div>
                </div>
                {s.status === "CLOSED" || s.status === "LEAD_SIGNED" ? (
                  <Badge variant="secondary" className="text-green-700 bg-green-50 border-green-200 text-[10px] font-light rounded-md">✓ Done</Badge>
                ) : (
                  <Button 
                    size="xs" 
                    onClick={() => handleMarkAttendance(s.id)}
                    disabled={actionLoading}
                    className="rounded-lg text-xs"
                  >
                    {actionLoading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    Mark Attendance
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Active Commitments */}
      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader>
          <CardTitle className="text-lg font-light">My Active Commitments</CardTitle>
          <CardDescription className="font-light">Unstructured tasks accepted</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {commitments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center font-light">No active commitments.</p>
          ) : (
            commitments.map((ac) => (
              <div key={ac.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-muted/40 bg-background/40 gap-4">
                <div className="text-left">
                  <h4 className="text-sm font-normal text-foreground/90">{ac.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[9px] font-light">{ac.reward} tokens</Badge>
                    {ac.status === "OVERDUE" && <Badge variant="destructive" className="text-[9px] font-light rounded">Overdue</Badge>}
                  </div>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => router.push(`/${orgId}/member/tasks`)} 
                  className="rounded-xl text-xs shrink-0 shadow-xs"
                >
                  Submit Proof
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
