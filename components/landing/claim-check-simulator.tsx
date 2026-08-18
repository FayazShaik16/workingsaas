"use client"

import React, { useState } from "react"
import {
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Zap,
  Calculator,
  RefreshCw,
  Coins,
  Send,
  Lock,
} from "lucide-react"

export function ClaimCheckSimulator() {
  // State for interactive simulation
  const [weeklyLectures, setWeeklyLectures] = useState<number>(4) // 4 hrs/wk
  const [weeklyLabs, setWeeklyLabs] = useState<number>(2) // 2 labs/wk (3.0 pts each)
  const [examDuties, setExamDuties] = useState<number>(2) // 2 exam duties/mo (2.0 pts each)
  const [unstructuredCompleted, setUnstructuredCompleted] = useState<number>(14) // completed points
  const [attendanceCompliance, setAttendanceCompliance] = useState<number>(90) // % of lectures/labs attended

  const WEEKS_PER_MONTH = 4
  const LECTURE_RATE = 1.0
  const LAB_RATE = 3.0 // 2hr lab @ 1.5 multiplier
  const EXAM_RATE = 2.0

  // 1. Calculate Structured Baseline
  const totalStructuredHours =
    weeklyLectures * WEEKS_PER_MONTH * LECTURE_RATE +
    weeklyLabs * WEEKS_PER_MONTH * LAB_RATE +
    examDuties * EXAM_RATE

  // 2. Calculate Unstructured Quota (approx 18% of structured baseline)
  const unstructuredQuota = Math.round(totalStructuredHours * 0.2)

  // 3. The Denominator (C_target)
  const cTarget = totalStructuredHours + unstructuredQuota

  // 4. The Numerator (C_earned)
  const structuredEarned = Math.round((totalStructuredHours * attendanceCompliance) / 100)
  const cEarned = structuredEarned + unstructuredCompleted

  // 5. Progress Calculation
  const progressPercent = Math.min(100, Math.round((cEarned / cTarget) * 100))
  const isEligibleForSalary = progressPercent >= 85

  // Simulation steps
  const [simulatedStatus, setSimulatedStatus] = useState<"idle" | "initiated" | "signed" | "reconciled">("idle")

  const handleSimulateAction = () => {
    if (isEligibleForSalary) {
      setSimulatedStatus("initiated")
      setTimeout(() => {
        setSimulatedStatus("signed")
      }, 900)
      setTimeout(() => {
        setSimulatedStatus("reconciled")
      }, 1900)
    } else {
      setSimulatedStatus("initiated")
      setTimeout(() => {
        setSimulatedStatus("signed")
      }, 1200)
    }
  }

  const handleReset = () => {
    setSimulatedStatus("idle")
  }

  return (
    <div className="bg-white rounded-3xl p-8 md:p-12 border border-black/10 shadow-sm max-w-[88rem] mx-auto my-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 pb-6 border-b border-black/5 gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 text-xs font-mono font-medium text-black mb-3">
            <Calculator className="w-3.5 h-3.5" />
            Zero-Sum Claim-Check Protocol Engine
          </div>
          <h3
            className="text-3xl md:text-4xl font-medium tracking-tight text-black"
            style={{ letterSpacing: "-0.03em" }}
          >
            The Mathematical Denominator in Action
          </h3>
          <p className="text-black/60 text-base max-w-2xl mt-2 leading-relaxed">
            Experience how WorkLedger dynamically derives an immutable monthly target (<code className="font-mono bg-black/5 px-1 py-0.5 rounded text-black text-xs font-medium">C_target</code>) and gates salary initiation at the 85% merit threshold.
          </p>
        </div>

        <button
          onClick={handleReset}
          className="inline-flex items-center gap-2 text-xs font-medium text-black/60 hover:text-black bg-black/5 hover:bg-black/10 px-3.5 py-2 rounded-full transition-colors cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset Parameters
        </button>
      </div>

      {/* Grid: Interactive Controls + Live Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Controls Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#F5F5F5] p-6 rounded-2xl border border-black/5 space-y-5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-black flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-black" />
                Structured Weekly Lectures
              </label>
              <span className="font-mono text-sm font-medium text-black bg-white px-3 py-1 rounded-lg border border-black/10">
                {weeklyLectures} hrs/week ({weeklyLectures * 4} hrs/mo)
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={12}
              value={weeklyLectures}
              onChange={(e) => setWeeklyLectures(Number(e.target.value))}
              className="w-full accent-black cursor-pointer"
            />
            <div className="text-xs text-black/50 flex justify-between">
              <span>1 hr/wk</span>
              <span>Rate Card: 1.0 Credit / hr</span>
              <span>12 hrs/wk</span>
            </div>
          </div>

          <div className="bg-[#F5F5F5] p-6 rounded-2xl border border-black/5 space-y-5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-black flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                Weekly Practical Labs / Clinical Shifts
              </label>
              <span className="font-mono text-sm font-medium text-black bg-white px-3 py-1 rounded-lg border border-black/10">
                {weeklyLabs} labs/week ({weeklyLabs * 3.0 * 4} pts/mo)
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={6}
              value={weeklyLabs}
              onChange={(e) => setWeeklyLabs(Number(e.target.value))}
              className="w-full accent-black cursor-pointer"
            />
            <div className="text-xs text-black/50 flex justify-between">
              <span>0 labs</span>
              <span>Rate Card: 1.5x Multiplier (3.0 pts / 2hr session)</span>
              <span>6 labs/wk</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#F5F5F5] p-5 rounded-2xl border border-black/5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-black">Attendance & Slot Delivery</label>
                <span className="font-mono text-xs font-medium text-black bg-white px-2 py-0.5 rounded border border-black/10">
                  {attendanceCompliance}%
                </span>
              </div>
              <input
                type="range"
                min={40}
                max={100}
                step={5}
                value={attendanceCompliance}
                onChange={(e) => setAttendanceCompliance(Number(e.target.value))}
                className="w-full accent-black cursor-pointer"
              />
              <div className="text-[11px] text-black/50">Verified via timetable sync & HOD logs</div>
            </div>

            <div className="bg-[#F5F5F5] p-5 rounded-2xl border border-black/5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-black">Marketplace & Open Tasks</label>
                <span className="font-mono text-xs font-medium text-black bg-white px-2 py-0.5 rounded border border-black/10">
                  +{unstructuredCompleted} pts
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                value={unstructuredCompleted}
                onChange={(e) => setUnstructuredCompleted(Number(e.target.value))}
                className="w-full accent-black cursor-pointer"
              />
              <div className="text-[11px] text-black/50">Committees, emergency cover, mentoring</div>
            </div>
          </div>
        </div>

        {/* Live Calculation & Status Column (5 cols) */}
        <div className="lg:col-span-5 bg-black text-white p-7 md:p-8 rounded-3xl flex flex-col justify-between min-h-[460px] shadow-lg">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <span className="text-xs uppercase tracking-widest text-white/50 font-mono">
                Formula Engine Lock
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                Version Locked
              </span>
            </div>

            {/* Formula Breakdown Cards */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
                <div className="text-xs text-white/50">Denominator (C_target)</div>
                <div className="text-2xl font-medium tracking-tight text-white mt-1">
                  {cTarget} <span className="text-xs text-white/50 font-normal">pts</span>
                </div>
                <div className="text-[11px] text-white/40 font-mono mt-1">
                  {totalStructuredHours} base + {unstructuredQuota} quota
                </div>
              </div>

              <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
                <div className="text-xs text-white/50">Earned (C_earned)</div>
                <div className="text-2xl font-medium tracking-tight text-white mt-1">
                  {cEarned} <span className="text-xs text-white/50 font-normal">pts</span>
                </div>
                <div className="text-[11px] text-white/40 font-mono mt-1">
                  {structuredEarned} struct + {unstructuredCompleted} tasks
                </div>
              </div>
            </div>

            {/* Progress Gauge */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-white/70">Calculated Cycle Progress</span>
                <span
                  className={`font-mono font-medium text-lg ${
                    isEligibleForSalary ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {progressPercent}%
                </span>
              </div>
              <div className="w-full h-3.5 bg-white/10 rounded-full overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isEligibleForSalary
                      ? "bg-gradient-to-r from-emerald-500 to-teal-300"
                      : "bg-gradient-to-r from-amber-500 to-yellow-300"
                  }`}
                  style={{ width: `${Math.min(100, progressPercent)}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-white/40 font-mono mt-1.5">
                <span>0% Baseline</span>
                <span className="text-amber-300">85% Gate Threshold</span>
                <span>100% Target</span>
              </div>
            </div>

            {/* State Banner */}
            {isEligibleForSalary ? (
              <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 flex items-start gap-3 text-xs mb-6">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-emerald-300">Gate Active: "Initiate My Salary"</span>
                  <p className="text-emerald-200/80 mt-0.5">
                    Faculty exceeded the 85% credit threshold. HOD digital signature releases non-monetary claims to the employee wallet.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-500/30 text-amber-200 flex items-start gap-3 text-xs mb-6">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-amber-300">Gate Active: "Raise Work-Loan Request"</span>
                  <p className="text-amber-200/80 mt-0.5">
                    Deficit of {cTarget - cEarned} credits. Safety net activated; algorithmic fairness engine prioritizes open marketplace tasks to bridge the gap.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Button & Simulation Lifecycle */}
          <div>
            {simulatedStatus === "idle" && (
              <button
                onClick={handleSimulateAction}
                className={`w-full py-3 px-6 rounded-full font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer shadow-md ${
                  isEligibleForSalary
                    ? "bg-white text-black hover:bg-gray-100"
                    : "bg-amber-500 text-black hover:bg-amber-400"
                }`}
              >
                {isEligibleForSalary ? (
                  <>
                    <Send className="w-4 h-4" />
                    Trigger "Initiate My Salary" Transfer
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Trigger "Raise Work-Loan Request" Protocol
                  </>
                )}
              </button>
            )}

            {simulatedStatus === "initiated" && (
              <div className="w-full py-3 px-4 rounded-full bg-white/10 text-white text-xs font-mono text-center flex items-center justify-center gap-2">
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {isEligibleForSalary
                  ? "Transmitting claim request to HOD weekly triage..."
                  : "Creating work-loan request & flagging Director pool..."}
              </div>
            )}

            {simulatedStatus === "signed" && (
              <div className="w-full py-3 px-4 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono text-center flex items-center justify-center gap-2">
                <CheckCircle className="w-3.5 h-3.5" />
                {isEligibleForSalary
                  ? "HOD Signature Verified -> Claim tokens transferred to PERSONAL wallet!"
                  : "Director Loan Approved -> Work debt recorded in ledger."}
              </div>
            )}

            {simulatedStatus === "reconciled" && (
              <div className="w-full py-3 px-4 rounded-full bg-white text-black text-xs font-medium text-center flex items-center justify-center gap-2 shadow">
                <Coins className="w-3.5 h-3.5 text-black" />
                Finance Atomic Batch Reversal: 100% Pool Reconciled &rarr; Fiat Released
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
