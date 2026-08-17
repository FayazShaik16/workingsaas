"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Coins, AlertTriangle, ArrowRight } from "lucide-react"

interface MemberProgressProps {
  earnedTokens: number
  monthlyTarget: number
  activeLoanAmount: number
  loanDueDate: string | null
}

export function MemberProgress({ earnedTokens, monthlyTarget, activeLoanAmount, loanDueDate }: MemberProgressProps) {
  const safeTarget = Number(monthlyTarget) > 0 ? Number(monthlyTarget) : 50
  const progressPercent = Math.min(100, Math.round((earnedTokens / safeTarget) * 100))
  const shortfall = Math.max(0, safeTarget - earnedTokens)

  return (
    <div className="space-y-6">
      {/* Progress Circular Card */}
      <Card className="rounded-2xl border border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs text-center py-6">
        <CardContent className="flex flex-col items-center">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">My Progress</span>
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="72" cy="72" r="56" stroke="#f3f4f6" strokeWidth="10" fill="transparent" />
              <circle cx="72" cy="72" r="56" stroke="#3b82f6" strokeWidth="10" strokeDasharray="351" strokeDashoffset={351 - (351 * progressPercent) / 100} fill="transparent" />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-light">{progressPercent}%</span>
              <span className="text-[9px] text-muted-foreground font-light">Target Met</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 font-light">{earnedTokens} of {monthlyTarget} tokens earned</p>
          <Button variant="outline" size="sm" className="mt-4 rounded-xl w-full text-xs">Raise Loan Request</Button>
        </CardContent>
      </Card>

      {/* Token Balance */}
      <Card className="rounded-2xl border border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader className="pb-2">
          <span className="text-xs font-light text-muted-foreground uppercase tracking-wider block">Token Balance</span>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            <span className="text-2xl font-light tracking-tight">{earnedTokens} WORK</span>
          </div>
          <div className="text-xs text-muted-foreground font-light space-y-1">
            <div className="flex justify-between">
              <span>Tokens Earned This Month:</span>
              <span className="font-medium text-foreground">{earnedTokens}</span>
            </div>
            <div className="flex justify-between">
              <span>Required for Salary Release:</span>
              <span className="font-medium text-foreground">{monthlyTarget}</span>
            </div>
            <div className="flex justify-between text-destructive">
              <span>Shortfall:</span>
              <span className="font-semibold">{shortfall} tokens</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work Loan Alert Card */}
      {activeLoanAmount > 0 && (
        <Card className="rounded-2xl border-l-4 border-l-destructive bg-destructive/5 border-destructive/20 p-5">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div className="space-y-1 text-left">
              <h4 className="text-xs font-semibold text-destructive uppercase tracking-wider">Work Loan Alert</h4>
              <p className="text-xs text-muted-foreground font-light leading-relaxed">
                You have an active work loan of {activeLoanAmount} tokens from the previous month. Clear this by completing extra tasks.
              </p>
              <div className="flex justify-between pt-2 text-[10px] text-muted-foreground">
                <span>Loan Amount: <strong className="text-foreground">{activeLoanAmount} WORK</strong></span>
                <span>Due: <strong>{loanDueDate ? new Date(loanDueDate).toLocaleDateString() : "30 April 2026"}</strong></span>
              </div>
              <a href="#" className="text-[10px] text-primary hover:underline block pt-1.5 flex items-center gap-0.5">
                View Suggested Tasks <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
