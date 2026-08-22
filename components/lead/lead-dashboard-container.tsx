"use client"

import { useState } from "react"
import { MinimalFacultyDashboard } from "@/components/member/minimal-faculty-dashboard"
import { TrustedHODManagerView } from "./trusted-hod-manager-view"
import { MemberDashboardData } from "@/lib/workledger/member-dashboard"
import { DepartmentDashboardData } from "@/lib/workledger/department-dashboard"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { User, Building2 } from "lucide-react"

interface LeadDashboardContainerProps {
  orgId: string
  personalData: MemberDashboardData
  departmentData: DepartmentDashboardData
}

export function LeadDashboardContainer({
  orgId,
  personalData,
  departmentData,
}: LeadDashboardContainerProps) {
  const [activeTab, setActiveTab] = useState<"department" | "personal">("department")

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Header & Dual Context Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {activeTab === "department" ? "Department Management" : "My Personal Work"}
            </h1>
            <Badge variant="secondary" className="font-normal text-xs">
              {departmentData.department?.name || "Academic Department"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeTab === "department"
              ? "Oversee faculty workload, review initiative proofs, and audit scheduled sessions."
              : "Track your personal teaching commitments, monthly progress, and assigned tasks."}
          </p>
        </div>

        {/* Dual Context Toggle */}
        <div className="flex items-center bg-muted p-1 rounded-lg border shrink-0">
          <button
            onClick={() => setActiveTab("department")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === "department"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Department View</span>
          </button>
          <button
            onClick={() => setActiveTab("personal")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === "personal"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>My Work</span>
          </button>
        </div>
      </div>

      {/* Render Active View */}
      {activeTab === "department" ? (
        <TrustedHODManagerView orgId={orgId} data={departmentData} />
      ) : (
        <MinimalFacultyDashboard
          orgId={orgId}
          userId={personalData.user.id}
          userName={personalData.user.name}
          userDesignation={personalData.user.designation}
          departmentName={personalData.user.departmentName}
          progress={personalData.progress}
          todayInstances={personalData.todayInstances}
          nextUpcomingInstance={personalData.nextUpcomingInstance}
          assignedTasks={personalData.assignedTasks}
          recentActivity={personalData.recentActivity}
        />
      )}
    </div>
  )
}
