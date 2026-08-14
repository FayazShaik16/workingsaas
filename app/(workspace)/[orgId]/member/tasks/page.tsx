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

        // Get user's nominated tasks that were accepted
        const { data: nominations, error: nomError } = await supabase
          .from("nominations")
          .select(
            `
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
          .eq("status", "ACCEPTED")

        if (nomError) throw nomError

        const taskList = nominations?.map((n: any) => n.tasks).filter(Boolean) || []
        setTasks(taskList)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch tasks"
        setError(message)
        console.error("[my-tasks] fetch failed:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()
  }, [supabase])

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
      cell: ({ row }) => (
        <Badge className={statusColors[row.original.status] || ""}>
          {row.original.status}
        </Badge>
      ),
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
        <p className="text-muted-foreground mt-2">Tasks you&apos;ve accepted and are working on</p>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground mb-4">No accepted tasks yet</p>
            <Button asChild>
              <Link href={`/${orgId}/member/marketplace`}>Browse Marketplace</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Accepted Tasks ({tasks.length})</CardTitle>
            <CardDescription>Track your work progress</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTablePrimitive columns={columns} data={tasks} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
