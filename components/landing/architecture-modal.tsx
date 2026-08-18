"use client"

import React from "react"
import { X, Layers, Database, ShieldCheck, Cpu, Code2, ArrowRight, GitCommit } from "lucide-react"

interface ArchitectureModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ArchitectureModal({ isOpen, onClose }: ArchitectureModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#F5F5F5] rounded-3xl border border-black/10 shadow-2xl p-6 md:p-10 my-8 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-black transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title & Badge */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black text-white text-xs font-mono mb-3">
            <Cpu className="w-3.5 h-3.5" />
            MNC-Grade System Specification
          </div>
          <h2
            className="text-3xl md:text-4xl font-medium tracking-tight text-black"
            style={{ letterSpacing: "-0.03em" }}
          >
            WorkLedger Architecture & Engine Blueprint
          </h2>
          <p className="text-black/60 text-base max-w-2xl mt-2 leading-relaxed">
            Non-Monetary Merit-Based Verification Layer & Digital Claim-Check Engine. Next.js 15 App Router · Supabase PostgreSQL 16 (RLS) · ERC-20 Ledger Audit Anchor.
          </p>
        </div>

        {/* 3-Tier Layer Diagram */}
        <div className="space-y-6 mb-8">
          {/* Layer 1: Metadata Engine */}
          <div className="bg-white p-6 rounded-2xl border border-black/10 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-mono tracking-widest text-indigo-600 font-medium flex items-center gap-2">
                <Database className="w-4 h-4" />
                Layer 1: Metadata Engine Layer
              </span>
              <span className="text-xs text-black/50 font-mono">Version-Locked Rules</span>
            </div>
            <p className="text-black/70 text-sm mb-4">
              Governs all business rules and validation logic without hardcoded organizational assumptions.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#F5F5F5] p-3 rounded-xl">
                <div className="text-xs font-mono font-medium text-black">rate_card_versions</div>
                <div className="text-[11px] text-black/50 mt-0.5">Effective date lock & multiplier card</div>
              </div>
              <div className="bg-[#F5F5F5] p-3 rounded-xl">
                <div className="text-xs font-mono font-medium text-black">task_type_definitions</div>
                <div className="text-[11px] text-black/50 mt-0.5">Base credits, validation modes & tags</div>
              </div>
              <div className="bg-[#F5F5F5] p-3 rounded-xl">
                <div className="text-xs font-mono font-medium text-black">workflow_definitions</div>
                <div className="text-[11px] text-black/50 mt-0.5">State machine & approval triage rules</div>
              </div>
            </div>
          </div>

          {/* Layer 2: Operational Instance */}
          <div className="bg-white p-6 rounded-2xl border border-black/10 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-mono tracking-widest text-emerald-600 font-medium flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Layer 2: Operational Instance Layer
              </span>
              <span className="text-xs text-black/50 font-mono">Real-Time Execution</span>
            </div>
            <p className="text-black/70 text-sm mb-4">
              Captures structured timetable delivery and unstructured marketplace self-nominations.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#F5F5F5] p-3 rounded-xl">
                <div className="text-xs font-mono font-medium text-black">timetable_slots</div>
                <div className="text-[11px] text-black/50 mt-0.5">Weekly academic and clinical schedules</div>
              </div>
              <div className="bg-[#F5F5F5] p-3 rounded-xl">
                <div className="text-xs font-mono font-medium text-black">tasks (structured/unstructured)</div>
                <div className="text-[11px] text-black/50 mt-0.5">Marketplace tasks & ad-hoc duties</div>
              </div>
              <div className="bg-[#F5F5F5] p-3 rounded-xl">
                <div className="text-xs font-mono font-medium text-black">attendance_records</div>
                <div className="text-[11px] text-black/50 mt-0.5">Classroom & shift verification data</div>
              </div>
            </div>
          </div>

          {/* Layer 3: Immutable Ledger */}
          <div className="bg-white p-6 rounded-2xl border border-black/10 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-mono tracking-widest text-purple-600 font-medium flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Layer 3: Immutable Ledger Layer
              </span>
              <span className="text-xs text-black/50 font-mono">Zero-Sum Audit Trail</span>
            </div>
            <p className="text-black/70 text-sm mb-4">
              Dual-wallet isolation and cryptographic hash-chaining for provable zero-sum reconciliation.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#F5F5F5] p-3 rounded-xl">
                <div className="text-xs font-mono font-medium text-black">token_transactions</div>
                <div className="text-[11px] text-black/50 mt-0.5">Hash-chained state history with signature proofs</div>
              </div>
              <div className="bg-[#F5F5F5] p-3 rounded-xl">
                <div className="text-xs font-mono font-medium text-black">wallets</div>
                <div className="text-[11px] text-black/50 mt-0.5">SALARY_POOL, PERSONAL, and LOAN_POOL</div>
              </div>
            </div>
          </div>
        </div>

        {/* 6-Step Protocol Cycle */}
        <div className="bg-black text-white p-6 md:p-8 rounded-2xl mb-8">
          <div className="text-xs uppercase font-mono tracking-widest text-white/50 mb-4">
            The Zero-Sum Claim-Check Protocol Lifecycle
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <div className="font-medium text-white text-sm mb-1">1. Cycle Mint</div>
              <p className="text-white/60">Director mints total monthly budget into SALARY_POOL wallet.</p>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <div className="font-medium text-white text-sm mb-1">2. Credit Delivery</div>
              <p className="text-white/60">Staff complete structured timetable slots and open tasks.</p>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <div className="font-medium text-white text-sm mb-1">3. 85% Gate</div>
              <p className="text-white/60">&ge;85% activates &quot;Initiate My Salary&quot;, &lt;85% activates Work Loan.</p>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <div className="font-medium text-white text-sm mb-1">4. Lead Sign-Off</div>
              <p className="text-white/60">HOD digitally signs weekly claims, moving tokens to PERSONAL.</p>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <div className="font-medium text-white text-sm mb-1">5. Batch Reversal</div>
              <p className="text-white/60">Finance executes atomic return of all tokens to SALARY_POOL.</p>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <div className="font-medium text-white text-sm mb-1">6. Fiat Wire</div>
              <p className="text-white/60">100% pool reconciliation authorizes external bank wire release.</p>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-xs text-black/50 font-mono">
            Compliant with international higher education accreditation & enterprise audit standards.
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer"
          >
            Close Overview
          </button>
        </div>
      </div>
    </div>
  )
}
