"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Coins, Search, Edit3, ShieldCheck, Users, Building2 } from "lucide-react"
import { FacultySalaryDialog } from "@/components/compensation/faculty-salary-dialog"
import { useRouter } from "next/navigation"

export interface DirectorFacultySalaryItem {
  id: string
  name: string
  email: string
  designation: string
  departmentId?: string
  departmentName: string
  baseSalary: number
  currency: string
  targetCredits: number
  progressPercentage: number
  isEligible: boolean
  isCustomConfigured: boolean
}

interface DirectorFacultySalaryConsoleProps {
  orgId: string
  facultyList: DirectorFacultySalaryItem[]
  departments: Array<{ id: string; name: string }>
}

export function DirectorFacultySalaryConsole({
  orgId,
  facultyList: initialList,
  departments,
}: DirectorFacultySalaryConsoleProps) {
  const router = useRouter()

  const [facultyList, setFacultyList] = useState<DirectorFacultySalaryItem[]>(initialList)
  const [search, setSearch] = useState("")
  const [deptFilter, setDeptFilter] = useState("ALL")
  const [selectedFaculty, setSelectedFaculty] = useState<any | null>(null)

  const filtered = facultyList.filter((f) => {
    if (deptFilter !== "ALL" && f.departmentId !== deptFilter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q) || f.departmentName.toLowerCase().includes(q)
    }
    return true
  })

  const currencySymbols: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
  }

  return (
    <Card className="rounded-2xl border-2 shadow-xs overflow-hidden">
      <CardHeader className="pb-3 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Institutional Salary Component Governance
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Configure base salary components and monthly WORK token targets for any member across the organization.
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search member..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs pl-8 w-44"
            />
          </div>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="h-8 px-2.5 rounded-md bg-background border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
            <Users className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="font-semibold text-foreground">No faculty members found</p>
            <p className="text-muted-foreground">Try adjusting your search query or department filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground font-mono text-[11px]">
                  <th className="py-3 px-4 font-semibold">Faculty Member</th>
                  <th className="py-3 px-4 font-semibold">Department</th>
                  <th className="py-3 px-4 font-semibold">Monthly Base Salary</th>
                  <th className="py-3 px-4 font-semibold">Token Target</th>
                  <th className="py-3 px-4 font-semibold">Progress</th>
                  <th className="py-3 px-4 font-semibold">Payroll Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((f) => {
                  const currSym = currencySymbols[f.currency] || f.currency
                  return (
                    <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground">
                        <div className="font-bold">{f.name}</div>
                        <span className="text-[11px] text-muted-foreground font-mono">{f.email}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          <Building2 className="h-3 w-3 mr-1 text-muted-foreground" />
                          {f.departmentName}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-foreground">
                        {currSym}{f.baseSalary.toLocaleString()}
                        <span className="block text-[10px] text-muted-foreground font-sans font-normal">
                          {f.isCustomConfigured ? "Configured" : "Default"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-primary">
                        {f.targetCredits.toFixed(1)} WORK
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${
                                f.progressPercentage >= 85
                                  ? "bg-emerald-500"
                                  : f.progressPercentage >= 50
                                  ? "bg-amber-500"
                                  : "bg-destructive"
                              }`}
                              style={{ width: `${Math.min(100, f.progressPercentage)}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-semibold">
                            {f.progressPercentage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {f.isEligible ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-bold">
                            85% Met
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            In Progress
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs font-semibold gap-1"
                          onClick={() =>
                            setSelectedFaculty({
                              id: f.id,
                              name: f.name,
                              email: f.email,
                              designation: f.designation,
                              departmentName: f.departmentName,
                              currentBaseSalary: f.baseSalary,
                              currentCurrency: f.currency,
                              currentTargetCredits: f.targetCredits,
                              currentThresholdPercentage: 85,
                            })
                          }
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>Set Salary</span>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Salary Component Dialog */}
      <FacultySalaryDialog
        isOpen={Boolean(selectedFaculty)}
        onClose={() => setSelectedFaculty(null)}
        faculty={selectedFaculty}
        onSuccess={(updated) => {
          setSelectedFaculty(null)
          if (updated) {
            setFacultyList((prev) =>
              prev.map((item) =>
                item.id === updated.userId
                  ? {
                      ...item,
                      baseSalary: updated.baseSalary,
                      currency: updated.currency,
                      targetCredits: updated.targetCredits,
                      isCustomConfigured: true,
                    }
                  : item
              )
            )
          }
          router.refresh()
        }}
      />
    </Card>
  )
}
