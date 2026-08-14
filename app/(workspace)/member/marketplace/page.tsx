"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Loader2 } from "lucide-react"

export default function MarketplacePage() {
  const router = useRouter()
  const supabase = createClient()

  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        let query = supabase
          .from("tasks")
          .select(
            `
            id,
            title,
            description,
            credit_value,
            deadline,
            priority,
            category,
            task_type_definitions(label, verification_mode),
            org_units(name)
          `
          )
          .eq("status", "OPEN")

        if (searchQuery) {
          query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        }

        if (selectedCategory) {
          query = query.eq("category", selectedCategory)
        }

        const { data, error: fetchError } = await query.order("deadline", {
          ascending: true,
        })

        if (fetchError) throw fetchError

        setTasks(data || [])
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch tasks"
        setError(message)
        console.error("[marketplace] fetch failed:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchTasks()
  }, [supabase, searchQuery, selectedCategory])

  const priorityColors: { [key: string]: string } = {
    LOW: "bg-blue-50 text-blue-700",
    MEDIUM: "bg-yellow-50 text-yellow-700",
    HIGH: "bg-orange-50 text-orange-700",
    URGENT: "bg-red-50 text-red-700",
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Task Marketplace</h1>
        <p className="text-muted-foreground mt-2">Discover and apply for tasks to earn credits</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Input
              placeholder="Search tasks by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="flex gap-2 flex-wrap">
              {["STRUCTURED", "UNSTRUCTURED"].map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No tasks available matching your filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((task: any) => (
            <Card key={task.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg line-clamp-2">{task.title}</CardTitle>
                    <CardDescription className="line-clamp-2">{task.org_units?.name}</CardDescription>
                  </div>
                  <Badge className={priorityColors[task.priority] || ""}>
                    {task.priority}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-3">{task.description}</p>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Credits</span>
                    <span className="font-bold text-primary">{task.credit_value.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium">{task.category}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deadline</span>
                    <span className="font-medium">
                      {task.deadline ? new Date(task.deadline).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                </div>

                <Button asChild className="w-full mt-4">
                  <Link href={`/workspace/member/marketplace/${task.id}`}>View Details</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
