"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Building2,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"

interface PreviewItem {
  id: string
  name: string
  unitType: string
  userCount: number
  taskCount: number
  tmplCount: number
  canAutoDelete: boolean
  createdAt: string
}

interface Props {
  orgId: string
  initialPreview: PreviewItem[]
}

export function LegacyCleanupClient({ orgId, initialPreview }: Props) {
  const [items, setItems] = useState<PreviewItem[]>(initialPreview)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const autoDeletableCount = items.filter((i) => i.canAutoDelete).length

  const handleCleanup = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/cleanup-legacy-units", { method: "POST" })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to cleanup legacy units.")
      }

      toast.success(json.message || "Legacy setup cleaned up successfully.")
      setItems((prev) => prev.filter((i) => !json.deletedUnits?.includes(i.name)))
      setConfirming(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to cleanup.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Summary Card ── */}
      <Card className="border-border/60 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Legacy Department Audit</CardTitle>
                <CardDescription className="text-xs">
                  Scanned organization for auto-generated placeholder departments
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              {items.length} Legacy Candidate{items.length === 1 ? "" : "s"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg space-y-2">
              <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-500" />
              <p className="font-medium text-foreground">Clean Institutional Hierarchy</p>
              <p>No artificial &quot;Main&quot; or &quot;Root&quot; departments exist in this organization.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="border-b text-muted-foreground uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Unit Name</th>
                      <th className="py-2.5 px-3">Linked Users</th>
                      <th className="py-2.5 px-3">Linked Tasks</th>
                      <th className="py-2.5 px-3">Schedule Templates</th>
                      <th className="py-2.5 px-3">Cleanup Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {item.name}
                        </td>
                        <td className="py-2.5 px-3 font-mono">{item.userCount}</td>
                        <td className="py-2.5 px-3 font-mono">{item.taskCount}</td>
                        <td className="py-2.5 px-3 font-mono">{item.tmplCount}</td>
                        <td className="py-2.5 px-3">
                          {item.canAutoDelete ? (
                            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                              Safe to Delete (0 dependencies)
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10">
                              Active Dependencies Found
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {autoDeletableCount > 0 && (
                <div className="pt-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {autoDeletableCount} unused placeholder unit(s) can be safely deleted.
                  </p>
                  {!confirming ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirming(true)}
                      className="gap-1.5 text-xs self-start sm:self-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Retire Safe Placeholder Units
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirming(false)}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleCleanup}
                        disabled={loading}
                        className="gap-1 text-xs"
                      >
                        {loading && <RefreshCw className="h-3 w-3 animate-spin" />}
                        Confirm Deletion
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
