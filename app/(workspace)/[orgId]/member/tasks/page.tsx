"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { DataTablePrimitive } from "@/components/shared/data-table-primitive"
import { ColumnDef } from "@tanstack/react-table"

interface AssignedTask {
  id: string
  title: string
  credit_value: number
  status: string
  deadline?: string
  category: string
  isNominated?: boolean
  nominationStatus?: string
}

export default function MyTasksPage() {
  const supabase = createClient()
  const params = useParams()
  const orgId = params.orgId
  const [tasks, setTasks] = useState<AssignedTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        if (!authData?.user) throw new Error("Not authenticated")

        // 1. Get all tasks directly assigned to this faculty member (both structured and unstructured)
        const { data: assignedTasks, error: assignError } = await (supabase as any)
          .from("tasks")
          .select("id, title, credit_value, status, deadline, category, scheduled_date")
          .eq("organization_id", orgId)
          .eq("assigned_to_id", authData.user.id)
          .not("status", "in", '("CLOSED","CANCELLED","REJECTED")')
          .order("deadline", { ascending: true })

        if (assignError) {
          console.warn("[my-tasks] assigned query note:", assignError.message || assignError)
        }

        // 2. Get user's nominated tasks that are pending or accepted
        const { data: nominations, error: nomError } = await supabase
          .from("nominations")
          .select(
            `
            status,
            tasks(
              id,
              title,
              credit_value,
              status,
              deadline,
              category
            )
          `
          )
          .eq("user_id", authData.user.id)
          .in("status", ["PENDING", "ACCEPTED"])

        if (nomError) {
          console.warn("[my-tasks] nominations query note:", nomError.message || nomError)
        }

        // Merge & deduplicate
        const taskMap = new Map<string, AssignedTask>()

        for (const t of assignedTasks || []) {
          taskMap.set(t.id, {
            ...t,
            credit_value: Number(t.credit_value || 0),
            isNominated: false,
            nominationStatus: undefined,
          })
        }

        for (const n of (nominations || []) as any[]) {
          const t = n.tasks
          if (!t) continue
          if (taskMap.has(t.id)) {
            const existing = taskMap.get(t.id)!
            existing.isNominated = true
            existing.nominationStatus = n.status
          } else {
            taskMap.set(t.id, {
              ...t,
              credit_value: Number(t.credit_value || 0),
              status: n.status === "PENDING" ? "NOMINATED" : t.status,
              isNominated: true,
              nominationStatus: n.status,
            })
          }
        }

        setTasks(Array.from(taskMap.values()))
      } catch (err: any) {
        const message = err?.message || "Failed to fetch tasks"
        setError(message)
        console.error("[my-tasks] fetch failed:", message)
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()
  }, [supabase, orgId])

  const statusColors: { [key: string]: string } = {
    DRAFT: "bg-gray-50 text-gray-700",
    OPEN: "bg-blue-50 text-blue-700",
    NOMINATED: "bg-purple-50 text-purple-700",
    ASSIGNED: "bg-cyan-50 text-cyan-700",
    IN_PROGRESS: "bg-orange-50 text-orange-700",
    VERIFICATION_PENDING: "bg-yellow-50 text-yellow-700",
    PEER_APPROVED: "bg-green-50 text-green-700",
    LEAD_SIGNED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-50 text-red-700",
    CLOSED: "bg-gray-100 text-gray-800",
  }

  const columns: ColumnDef<AssignedTask>[] = [
    {
      accessorKey: "title",
      header: "Task",
      cell: ({ row }) => (
        <Link
          href={`/${orgId}/member/tasks/${row.original.id}`}
          className="text-primary hover:underline"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
    },
    {
      accessorKey: "credit_value",
      header: "Credits",
      cell: ({ row }) => <span className="font-bold">{row.original.credit_value.toFixed(2)}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const isPendingNom = row.original.isNominated && row.original.nominationStatus === "PENDING"
        if (isPendingNom) {
          return (
            <Badge className="bg-purple-50 text-purple-700 border border-purple-200">
              NOMINATED (PENDING)
            </Badge>
          )
        }
        return (
          <Badge className={statusColors[row.original.status] || ""}>
            {row.original.status}
          </Badge>
        )
      },
    },
    {
      accessorKey: "deadline",
      header: "Deadline",
      cell: ({ row }) =>
        row.original.deadline ? new Date(row.original.deadline).toLocaleDateString() : "N/A",
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button asChild size="sm" variant="outline">
          <Link href={`/${orgId}/member/tasks/${row.original.id}`}>View</Link>
        </Button>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Tasks</h1>
        <p className="text-muted-foreground mt-2">Tasks assigned to you or nominated from the Task Pool</p>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">No assigned or nominated tasks yet</p>
            <Button asChild>
              <Link href={`/${orgId}/member/marketplace`}>Browse Task Pool</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Assigned & Nominated Tasks ({tasks.length})</CardTitle>
            <CardDescription>Track your active assignments and pending nominations</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTablePrimitive columns={columns} data={tasks} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
