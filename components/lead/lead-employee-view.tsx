"use client"

import { useState } from "react"
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

interface LeadEmployeeViewProps {
  personalProgress: number
  earnedTokens: number
  targetTokens: number
  schedule: ScheduleItem[]
}

export function LeadEmployeeView({ personalProgress, earnedTokens, targetTokens, schedule: initialSchedule }: LeadEmployeeViewProps) {
  const supabase = createClient()
  const db = supabase as any
  const [schedule, setSchedule] = useState<ScheduleItem[]>(initialSchedule)
  const [actionLoading, setActionLoading] = useState(false)

  const handleMarkAttendance = async (taskId: string) => {
    setActionLoading(true)
    try {
      // Mark lecture session as closed (done) in database
      const { error } = await db
        .from("tasks")
        .update({ status: "CLOSED" })
        .eq("id", taskId)

      if (error) throw error
      setSchedule((prev) => prev.map((s) => (s.id === taskId ? { ...s, status: "CLOSED" } : s)))
    } catch (err) {
      console.error("Failed to update status:", err)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-light">My Work Status</CardTitle>
          <CardDescription className="font-light">Target progress tracker</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center py-6 text-center">
          <div className="relative w-36 h-36 flex items-center justify-center mb-4">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="72" cy="72" r="56" stroke="#f3f4f6" strokeWidth="10" fill="transparent" />
              <circle cx="72" cy="72" r="56" stroke="#3b82f6" strokeWidth="10" strokeDasharray="351" strokeDashoffset={351 - (351 * personalProgress) / 100} fill="transparent" />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-light">{personalProgress}%</span>
              <span className="text-[9px] text-muted-foreground uppercase font-light">Progress</span>
            </div>
          </div>
          <p className="text-sm font-light text-foreground/80">Earned: <span className="font-semibold">{earnedTokens}</span> / {targetTokens} tokens</p>
          <Button size="sm" className="mt-4 rounded-xl shadow-xs w-full">Raise Loan Request</Button>
          <p className="text-[10px] text-muted-foreground mt-2 font-light">You need 85% to initiate salary payment.</p>
        </CardContent>
      </Card>

      {/* Today's Schedule */}
      <Card className="lg:col-span-2 rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader className="pb-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-light">Today&apos;s Schedule</CardTitle>
            <CardDescription className="font-light">Lectures and department sessions</CardDescription>
          </div>
          <Calendar className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-4">
          {schedule.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center font-light">No lectures or sessions scheduled for today.</p>
          ) : (
            schedule.map((slot) => (
              <div key={slot.id} className="flex items-center justify-between p-3 rounded-xl border border-muted/40 bg-background/40">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    {slot.deadline ? new Date(slot.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "09:00"}
                  </span>
                  <div className="text-left">
                    <span className="text-sm font-normal text-foreground/90 block">{slot.title}</span>
                    <span className="text-[10px] text-muted-foreground font-light">{slot.description || "Assigned Classroom"}</span>
                  </div>
                </div>
                {slot.status === "CLOSED" || slot.status === "LEAD_SIGNED" ? (
                  <Badge variant="secondary" className="text-green-700 bg-green-50 border-green-200 text-[10px] font-light rounded-md">✓ Done</Badge>
                ) : (
                  <Button 
                    size="xs" 
                    variant="outline" 
                    onClick={() => handleMarkAttendance(slot.id)}
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
    </div>
  )
}
