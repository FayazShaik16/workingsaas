"use client"

import React, { useState } from "react"
import { ArrowRight, GraduationCap, Stethoscope, Cpu, Landmark, CheckCircle2, ShieldCheck, Database } from "lucide-react"

interface EngineMode {
  id: string
  name: string
  eyebrow: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  metrics: { label: string; value: string }[]
  keyFeatures: string[]
  formulaSnippet: string
}

const ENGINE_MODES: EngineMode[] = [
  {
    id: "academic",
    name: "Higher Education",
    eyebrow: "University & College Consortia",
    title: "Higher Education",
    description:
      "Eliminate unverified salary disbursement by replacing subjective impressions with immutable attendance rate cards, timetable slot verification, and weekly HOD digital signatures.",
    icon: GraduationCap,
    metrics: [
      { label: "Rate Card Baseline", value: "1.0 per Theory hr" },
      { label: "Lab / Practical", value: "1.5x Multiplier" },
      { label: "Sign-off Interval", value: "Weekly Batch" },
    ],
    keyFeatures: [
      "Timetable slot automated verification & attendance sync",
      "Algorithmic fairness routing for faculty under 85%",
      "NAAC & ABET compliant immutable audit trail",
    ],
    formulaSnippet: "C_structured = Σ (Slots × Weeks × RateCard)",
  },
  {
    id: "healthcare",
    name: "Healthcare Networks",
    eyebrow: "Hospital & Clinical Systems",
    title: "Clinical Networks",
    description:
      "Align high-intensity clinical shifts, on-call rotations, and emergency department baseline duties into zero-sum token claims verified by Department Chairs before monthly fiat payroll release.",
    icon: Stethoscope,
    metrics: [
      { label: "Clinical Shift", value: "2.0 per 8hr Block" },
      { label: "Emergency On-Call", value: "2.5x Multiplier" },
      { label: "Audit Gate", value: "Chair Sign-off" },
    ],
    keyFeatures: [
      "Dynamic shift rate-card version locks with zero downtime",
      "Emergency work-loan safety nets for unexpected off-duty coverage",
      "Dual-wallet isolation: PERSONAL vs CLINICAL_POOL",
    ],
    formulaSnippet: "C_earned = Σ (ApprovedShifts × RateCard) + OpenTasks",
  },
  {
    id: "enterprise",
    name: "Enterprise R&D",
    eyebrow: "Software Engineering & Research",
    title: "Enterprise R&D",
    description:
      "Structure sprint deliverables, architectural design reviews, and cross-functional ad-hoc initiatives into transparent, merit-backed claim tokens with single-pane Monday triage.",
    icon: Cpu,
    metrics: [
      { label: "Arch Review", value: "1.5 Credits" },
      { label: "Incident Triage", value: "2.0 Credits" },
      { label: "Marketplace Quota", value: "20% Baseline" },
    ],
    keyFeatures: [
      "Internal open task marketplace with self-nomination agency",
      "Automated task prioritization for contributors <85% target",
      "Immutable ERC-20 ledger state transition hash-chaining",
    ],
    formulaSnippet: "ActionGate = Progress >= 85% ? INITIATE : WORK_LOAN",
  },
  {
    id: "treasury",
    name: "Institutional Treasuries",
    eyebrow: "Corporate Finance & Auditing",
    title: "Finance & Treasuries",
    description:
      "Ensure 100% mathematical reconciliation before releasing external bank fiat wires. The Finance department executes atomic batch reversal transfers back to the Director pool.",
    icon: Landmark,
    metrics: [
      { label: "Reconciliation", value: "100% Zero-Sum" },
      { label: "Batch Reversal", value: "Atomic Execution" },
      { label: "Fiat Wire Gate", value: "Pool Restitution" },
    ],
    keyFeatures: [
      "Zero-sum digital claim-check protocol with non-monetary tokens",
      "Immutable state verification across Postgres 16 & Supabase RLS",
      "No alteration to statutory compensation, tax, or labor contracts",
    ],
    formulaSnippet: "FinanceRelease = (CurrentPool == MintedPool) ? OK : HOLD",
  },
]

interface InteractiveEngineModesProps {
  onOpenArchitecture?: () => void
}

export function InteractiveEngineModes({ onOpenArchitecture }: InteractiveEngineModesProps) {
  const [activeModeId, setActiveModeId] = useState<string>("academic")
  const activeMode = ENGINE_MODES.find((m) => m.id === activeModeId) || ENGINE_MODES[0]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
      {/* Left Column */}
      <div className="md:pr-12 md:pt-2 flex flex-col justify-between">
        <div>
          <span className="text-black/60 text-sm font-medium tracking-wide uppercase mb-2 block">
            WorkLedger in Practice
          </span>
          <h2
            className="text-5xl md:text-6xl font-medium leading-none mb-6 text-black"
            style={{ letterSpacing: "-0.04em" }}
          >
            Engine modes
          </h2>
          <p className="text-black/60 text-base leading-relaxed max-w-sm mb-8">
            WorkLedger powers a wide range of operational modes for universities, hospital systems, enterprise engineering teams, and institutional treasuries.
          </p>

          {/* Mode Selector Tabs */}
          <div className="space-y-3 mb-8">
            {ENGINE_MODES.map((mode) => {
              const isSelected = mode.id === activeModeId
              const Icon = mode.icon
              return (
                <button
                  key={mode.id}
                  onClick={() => setActiveModeId(mode.id)}
                  className={`w-full text-left p-4 rounded-2xl transition-all duration-200 flex items-center justify-between border ${
                    isSelected
                      ? "bg-white border-black/15 shadow-sm text-black"
                      : "bg-black/[0.02] border-transparent hover:bg-black/[0.05] text-black/70 hover:text-black"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        isSelected ? "bg-black text-white" : "bg-black/5 text-black/70"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium text-base text-black tracking-tight">{mode.name}</div>
                      <div className="text-xs text-black/50">{mode.eyebrow}</div>
                    </div>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                      isSelected ? "bg-black text-white" : "text-black/20"
                    }`}
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Feature Pills */}
        <div className="p-5 rounded-2xl bg-white/70 backdrop-blur border border-black/5 space-y-2.5">
          <div className="text-xs uppercase tracking-wider text-black/50 font-medium flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-black" />
            Active Architecture Highlights
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {activeMode.metrics.map((metric, idx) => (
              <div key={idx} className="bg-[#F5F5F5] p-2.5 rounded-xl text-center">
                <div className="text-xs text-black/50">{metric.label}</div>
                <div className="text-sm font-medium text-black mt-0.5">{metric.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column (Video + Dynamic Content Overlay) */}
      <div className="relative rounded-3xl overflow-hidden min-h-[720px] shadow-sm group">
        {/* Background Video */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="object-cover absolute inset-0 w-full h-full"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_183428_ab5e672a-f608-4dcb-b319-f3e040f02e2d.mp4"
        />

        {/* Subtle Frosted Tint Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-white/70 to-white/40 backdrop-blur-[2px]" />

        {/* Dynamic Overlay Content */}
        <div className="relative z-10 p-10 md:p-12 min-h-[720px] flex flex-col justify-between h-full">
          {/* Top Section */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur border border-black/10 text-xs font-medium text-black mb-6 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {activeMode.eyebrow}
            </div>

            <h3
              className="text-4xl md:text-5xl font-medium leading-tight mb-5 text-black"
              style={{ letterSpacing: "-0.03em" }}
            >
              {activeMode.title}
            </h3>

            <p className="text-black/75 text-base md:text-lg max-w-md mb-8 leading-relaxed">
              {activeMode.description}
            </p>

            {/* Mode Highlights Checklist */}
            <div className="space-y-3 max-w-md bg-white/60 backdrop-blur-md p-5 rounded-2xl border border-black/5 mb-6">
              {activeMode.keyFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-sm text-black/80">
                  <CheckCircle2 className="w-4 h-4 text-black shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>

            {/* Formula Badge */}
            <div className="inline-block px-3.5 py-1.5 rounded-lg bg-black text-white font-mono text-xs tracking-tight">
              {activeMode.formulaSnippet}
            </div>
          </div>

          {/* Bottom Action Link */}
          <div className="pt-8">
            <button
              onClick={onOpenArchitecture}
              className="group inline-flex items-center gap-3 bg-black text-white text-base font-medium pl-6 pr-2 py-2 rounded-full hover:bg-gray-800 transition-all duration-200 cursor-pointer shadow-sm"
            >
              <span>Explore Architecture & Schemas</span>
              <div className="w-9 h-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center group-hover:bg-white transition-colors">
                <ArrowRight className="w-4 h-4 text-black" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
