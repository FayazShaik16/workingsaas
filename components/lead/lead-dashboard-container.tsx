"use client"

import { useState } from "react"
import { LeadEmployeeView } from "./lead-employee-view"
import { LeadManagerView } from "./lead-manager-view"

interface SalaryApproval {
  id: string
  name: string
  designation: string
  progress: number
  tokens: number
}

interface Verification {
  id: string
  submittedBy: string
  deptName: string
  taskTitle: string
  reward: number
  submittedAt: string
}

interface LeadDashboardContainerProps {
  initialApprovals: SalaryApproval[]
  initialVerifications: Verification[]
  personalProgress: number
  earnedTokens: number
  targetTokens: number
  orgId: string
  deptName: string
  schedule: any[]
}

export function LeadDashboardContainer({
  initialApprovals,
  initialVerifications,
  personalProgress,
  earnedTokens,
  targetTokens,
  orgId,
  deptName,
  schedule
}: LeadDashboardContainerProps) {
  const [activeContext, setActiveContext] = useState<"employee" | "manager">("manager")

  return (
    <div className="space-y-8">
      {/* Title section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-foreground/90">HOD Dashboard</h1>
          <p className="text-muted-foreground font-light mt-1">{deptName || "Department Portal"}</p>
        </div>

        {/* Dual Context Toggle bar */}
        <div className="flex bg-secondary/50 p-1 rounded-xl border border-secondary shadow-2xs">
          <button
            onClick={() => setActiveContext("employee")}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all font-medium ${
              activeContext === "employee" ? "bg-background text-primary shadow-3xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Employee View
          </button>
          <button
            onClick={() => setActiveContext("manager")}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all font-medium ${
              activeContext === "manager" ? "bg-background text-primary shadow-3xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Manager View
          </button>
        </div>
      </div>

      {activeContext === "employee" ? (
        <LeadEmployeeView
          personalProgress={personalProgress}
          earnedTokens={earnedTokens}
          targetTokens={targetTokens}
          schedule={schedule}
        />
      ) : (
        <LeadManagerView
          initialApprovals={initialApprovals}
          initialVerifications={initialVerifications}
          orgId={orgId}
        />
      )}
    </div>
  )
}
