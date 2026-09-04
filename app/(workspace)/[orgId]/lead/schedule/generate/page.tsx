"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

export default function RecurringScheduleGenerator() {
  const router = useRouter()
  const params = useParams()
  const orgId = params.orgId
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form states
  const [taskTitle, setTaskTitle] = useState("")
  const [creditValue, setCreditValue] = useState("10")
  const [assignedUserId, setAssignedUserId] = useState("")
  const [taskTypeId, setTaskTypeId] = useState("")
  const [weeks, setWeeks] = useState("4")
  const [dayOfWeek, setDayOfWeek] = useState("1") // 1 = Monday, etc.
  const [startTime, setStartTime] = useState("09:15")
  const [endTime, setEndTime] = useState("10:15")

  // Database option states
  const [users, setUsers] = useState<any[]>([])
  const [taskTypes, setTaskTypes] = useState<any[]>([])
  const [orgUnitId, setOrgUnitId] = useState<string | null>(null)

  useEffect(() => {
    const loadFormData = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        if (!authData?.user) return

        // Get user's org unit
        const { data: userDetails } = await supabase
          .from("users")
          .select("org_unit_id")
          .eq("id", authData.user.id)
          .single()

        if (userDetails?.org_unit_id) {
          setOrgUnitId(userDetails.org_unit_id)
        }

        // Fetch members in this org unit
        const { data: members } = await (supabase as any)
          .from("users")
          .select("id, name, email")
          .eq("organization_id", orgId)
          .eq("org_unit_id", userDetails?.org_unit_id || "")
        setUsers(members || [])

        // Fetch structured task types
        const { data: types } = await (supabase as any)
          .from("task_type_definitions")
          .select("id, label")
          .eq("organization_id", orgId)
          .eq("category", "STRUCTURED")
        setTaskTypes(types || [])
      } catch (err) {
        console.error("Failed to load form dependencies:", err)
      }
    }
    loadFormData()
  }, [orgId, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    try {
      if (!taskTitle.trim() || !assignedUserId || !taskTypeId || !orgUnitId) {
        throw new Error("All fields are required.")
      }

      if (startTime >= endTime) {
        throw new Error("Start time must be strictly earlier than end time.")
      }

      const numWeeks = parseInt(weeks)
      const tasksToInsert = []

      // Generate task records for each week and check for collisions
      for (let i = 0; i < numWeeks; i++) {
        const date = new Date()
        const currentDay = date.getDay()
        const targetDay = parseInt(dayOfWeek)
        let daysToAdd = targetDay - currentDay
        if (daysToAdd <= 0) daysToAdd += 7
        daysToAdd += i * 7 // Add weeks offset

        date.setDate(date.getDate() + daysToAdd)
        const dateStr = date.toISOString().split("T")[0]

        // 1. Collision check against existing tasks for this faculty on this date
        const dayStart = `${dateStr}T00:00:00.000Z`
        const dayEnd = `${dateStr}T23:59:59.999Z`
        const { data: existingTasks } = await (supabase as any)
          .from("tasks")
          .select("id, title")
          .eq("assigned_to_id", assignedUserId)
          .gte("deadline", dayStart)
          .lte("deadline", dayEnd)
          .in("status", ["OPEN", "ASSIGNED", "IN_PROGRESS", "PENDING_VERIFICATION", "LEAD_SIGNED", "CLOSED"])

        const duplicate = (existingTasks || []).find((ext: any) =>
          ext.title.toLowerCase().includes(taskTitle.trim().toLowerCase())
        )

        if (duplicate) {
          throw new Error(
            `Scheduling conflict on ${dateStr}: Faculty is already assigned to "${duplicate.title}". Multiple assignments for the same task on the same date are prohibited.`
          )
        }

        // 2. Collision check against scheduled_work_instances for this faculty on this date
        const { data: existingInstances } = await (supabase as any)
          .from("scheduled_work_instances")
          .select("id, scheduled_start, scheduled_end, status")
          .eq("assigned_to_id", assignedUserId)
          .eq("work_date", dateStr)
          .neq("status", "CANCELLED")

        const hasTimeOverlap = (existingInstances || []).some((inst: any) => {
          const sDate = new Date(inst.scheduled_start)
          const eDate = new Date(inst.scheduled_end)
          const instStart = !isNaN(sDate.getTime()) ? sDate.toISOString().slice(11, 16) : ""
          const instEnd = !isNaN(eDate.getTime()) ? eDate.toISOString().slice(11, 16) : ""
          if (instStart && instEnd) {
            return instStart < endTime && startTime < instEnd
          }
          return false
        })

        if (hasTimeOverlap) {
          throw new Error(
            `Time slot conflict on ${dateStr}: Faculty already has a scheduled class/session overlapping with ${startTime}-${endTime}. Multiple assignments at overlapping time slots are prohibited.`
          )
        }

        tasksToInsert.push({
          organization_id: orgId,
          org_unit_id: orgUnitId,
          task_type_id: taskTypeId,
          category: "STRUCTURED",
          title: `${taskTitle.trim()} (Week ${i + 1}, ${startTime}-${endTime})`,
          credit_value: parseFloat(creditValue),
          assigned_to_id: assignedUserId,
          status: "ASSIGNED",
          deadline: `${dateStr}T${endTime}:00.000Z`,
        })
      }

      const { error: insertError } = await (supabase as any)
        .from("tasks")
        .insert(tasksToInsert)

      if (insertError) throw insertError

      setSuccess(true)
      setTaskTitle("")
      setTimeout(() => {
        router.push(`/${orgId}/lead/schedule`)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to bulk generate tasks")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Schedule Generator</h1>
        <p className="text-muted-foreground mt-2">Bulk allocate recurring structured classes/tasks.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generator Details</CardTitle>
          <CardDescription>Setup weekly task parameters</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 bg-destructive/10 text-destructive text-sm rounded">{error}</div>}
            {success && <div className="p-3 bg-green-50 text-green-700 text-sm rounded">Tasks generated successfully! Redirecting...</div>}

            <div className="space-y-2">
              <Label htmlFor="title">Base Task Title</Label>
              <Input
                id="title"
                placeholder="e.g. CS101 Lecture"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="credit">Credits per Class</Label>
                <Input
                  id="credit"
                  type="number"
                  value={creditValue}
                  onChange={(e) => setCreditValue(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weeks">Duration (Weeks)</Label>
                <Select value={weeks} onValueChange={setWeeks} disabled={loading}>
                  <SelectTrigger id="weeks">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 Weeks</SelectItem>
                    <SelectItem value="8">8 Weeks</SelectItem>
                    <SelectItem value="12">12 Weeks</SelectItem>
                    <SelectItem value="16">16 Weeks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="day">Day of the Week</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek} disabled={loading}>
                <SelectTrigger id="day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                  <SelectItem value="0">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time (24h)</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  disabled={loading}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endTime">End Time (24h)</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  disabled={loading}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Task Type Template</Label>
              <Select value={taskTypeId} onValueChange={setTaskTypeId} disabled={loading}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select structured type..." />
                </SelectTrigger>
                <SelectContent>
                  {taskTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignee">Assign To Faculty</Label>
              <Select value={assignedUserId} onValueChange={setAssignedUserId} disabled={loading}>
                <SelectTrigger id="assignee">
                  <SelectValue placeholder="Select faculty member..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Schedule
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
