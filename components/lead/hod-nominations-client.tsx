"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Search,
  ExternalLink,
  Coins,
  Calendar,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import Link from "next/link"

export interface NominationItem {
  id: string
  taskId: string
  taskTitle: string
  taskDescription?: string
  creditValue: number
  priority: string
  category: string
  deadline?: string
  taskStatus: string
  userId: string
  userName: string
  userEmail: string
  userDesignation?: string
  deptName?: string
  nominationStatus: string
  message?: string
  createdAt: string
  requiredPeople?: number
  acceptedCount?: number
}

interface Props {
  orgId: string
  deptName: string
  nominations: NominationItem[]
}

export function HODNominationsClient({ orgId, deptName, nominations: initialNominations }: Props) {
  const router = useRouter()
  const [nominations, setNominations] = useState<NominationItem[]>(initialNominations)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "ALL">("PENDING")
  const [processingId, setProcessingId] = useState<string | null>(null)

  const filtered = nominations.filter((n) => {
    if (statusFilter === "PENDING" && n.nominationStatus !== "PENDING") {
      return false
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      const matchTask = n.taskTitle.toLowerCase().includes(q)
      const matchUser = n.userName.toLowerCase().includes(q) || n.userEmail.toLowerCase().includes(q)
      if (!matchTask && !matchUser) return false
    }
    return true
  })

  const handleAssign = async (nom: NominationItem) => {
    try {
      setProcessingId(nom.id)
      const res = await fetch("/api/tasks/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: nom.taskId,
          facultyId: nom.userId,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to assign task.")

      const isFullyAssigned = data.isFullyAssigned ?? true
      const newAcceptedCount = data.acceptedCount ?? ((nom.acceptedCount || 0) + 1)
      const requiredPeople = data.requiredPeople ?? (nom.requiredPeople || 1)

      if (isFullyAssigned) {
        toast.success(data.message || `Assigned "${nom.taskTitle}" to ${nom.userName}! All ${requiredPeople} positions filled.`)
      } else {
        const remaining = Math.max(0, requiredPeople - newAcceptedCount)
        toast.success(data.message || `Assigned ${nom.userName}! (${newAcceptedCount}/${requiredPeople} filled — ${remaining} slot(s) remaining)`)
      }

      setNominations((prev) =>
        prev.map((item) => {
          if (item.taskId !== nom.taskId) return item
          if (item.id === nom.id) {
            return {
              ...item,
              nominationStatus: "ACCEPTED",
              taskStatus: isFullyAssigned ? "ASSIGNED" : item.taskStatus,
              acceptedCount: newAcceptedCount,
              requiredPeople,
            }
          }
          if (isFullyAssigned) {
            return item.nominationStatus === "PENDING"
              ? { ...item, nominationStatus: "REJECTED", acceptedCount: newAcceptedCount, requiredPeople }
              : { ...item, acceptedCount: newAcceptedCount, requiredPeople }
          }
          return { ...item, acceptedCount: newAcceptedCount, requiredPeople }
        })
      )
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || "Failed to assign nominee.")
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (nom: NominationItem) => {
    try {
      setProcessingId(nom.id)
      const res = await fetch("/api/tasks/reject-nomination", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nominationId: nom.id,
          taskId: nom.taskId,
          userId: nom.userId,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to reject nomination.")

      toast.success(`Rejected nomination from ${nom.userName}.`)
      setNominations((prev) =>
        prev.map((item) => (item.id === nom.id ? { ...item, nominationStatus: "REJECTED" } : item))
      )
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || "Failed to reject nomination.")
    } finally {
      setProcessingId(null)
    }
  }

  const renderPriorityBadge = (priority: string) => {
    const p = (priority || "MEDIUM").toUpperCase()
    switch (p) {
      case "URGENT":
        return <Badge variant="destructive" className="text-[10px]">Urgent</Badge>
      case "HIGH":
        return <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20">High</Badge>
      case "LOW":
        return <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Low</Badge>
      default:
        return <Badge variant="secondary" className="text-[10px]">Medium</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={statusFilter === "PENDING" ? "default" : "outline"}
            onClick={() => setStatusFilter("PENDING")}
            className="text-xs h-8"
          >
            Pending Review ({nominations.filter((n) => n.nominationStatus === "PENDING").length})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "ALL" ? "default" : "outline"}
            onClick={() => setStatusFilter("ALL")}
            className="text-xs h-8"
          >
            All History ({nominations.length})
          </Button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter by faculty or task..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-8"
          />
        </div>
      </div>

      {/* Nominations List */}
      {filtered.length === 0 ? (
        <Card className="rounded-2xl border-dashed p-12 text-center">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <h3 className="text-sm font-semibold text-foreground">No nominations found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {statusFilter === "PENDING"
              ? "There are currently no pending self-nominations awaiting department assignment."
              : "No nomination records match your search filter."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((nom) => (
            <Card
              key={nom.id}
              className={`rounded-2xl border transition-all ${
                nom.nominationStatus === "ACCEPTED"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : nom.nominationStatus === "REJECTED"
                  ? "border-rose-500/20 bg-rose-500/5 opacity-70"
                  : "border-border/70 bg-card hover:border-primary/40"
              }`}
            >
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left: Task & Faculty Info */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{nom.taskTitle}</span>
                    {renderPriorityBadge(nom.priority)}
                    <Badge variant="outline" className="text-[10px] gap-1 font-mono">
                      <Coins className="h-3 w-3 text-amber-500" />
                      +{nom.creditValue} WORK
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        nom.nominationStatus === "ACCEPTED"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                          : nom.nominationStatus === "REJECTED"
                          ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                          : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                      }`}
                    >
                      {nom.nominationStatus === "ACCEPTED"
                        ? "Assigned / Accepted"
                        : nom.nominationStatus === "REJECTED"
                        ? "Rejected"
                        : "Awaiting Review"}
                    </Badge>

                    {nom.requiredPeople && nom.requiredPeople > 1 ? (
                      <Badge
                        variant="secondary"
                        className={`text-[10px] gap-1 font-medium ${
                          (nom.acceptedCount || 0) >= nom.requiredPeople
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                            : "bg-sky-500/10 text-sky-600 border border-sky-500/30"
                        }`}
                      >
                        <Users className="h-3 w-3" />
                        {nom.acceptedCount || 0}/{nom.requiredPeople} Positions Filled
                        {(nom.acceptedCount || 0) < nom.requiredPeople && (
                          <span className="opacity-80">
                            ({nom.requiredPeople - (nom.acceptedCount || 0)} Open)
                          </span>
                        )}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] gap-1 font-medium text-muted-foreground">
                        <Users className="h-3 w-3" /> 1 Person Task
                      </Badge>
                    )}
                  </div>

                  {nom.taskDescription && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{nom.taskDescription}</p>
                  )}

                  {/* Nominee Profile Box */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        <span className="font-semibold text-foreground">{nom.userName}</span>
                        <span className="text-muted-foreground text-[11px]">({nom.userDesignation || "Faculty"})</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        Applied {new Date(nom.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {nom.message && (
                      <p className="text-[11px] text-muted-foreground italic bg-background/50 p-2 rounded-lg mt-1 border">
                        "{nom.message}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-row md:flex-col items-center md:items-end gap-2 shrink-0">
                  {nom.nominationStatus === "PENDING" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleAssign(nom)}
                        disabled={processingId === nom.id}
                        className="text-xs h-8 gap-1.5 bg-primary hover:bg-primary/90"
                      >
                        {processingId === nom.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        <span>Assign Task</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(nom)}
                        disabled={processingId === nom.id}
                        className="text-xs h-8 gap-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </Button>
                    </>
                  )}

                  <Link href={`/${orgId}/lead/tasks`}>
                    <Button variant="ghost" size="sm" className="text-[11px] h-7 gap-1 text-muted-foreground">
                      <ExternalLink className="h-3 w-3" /> View All Tasks
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
