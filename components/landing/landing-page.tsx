"use client"

import React, { useState } from "react"
import Link from "next/link"
import { ArrowRight, ChevronDown, Check, ExternalLink, ShieldCheck, Cpu } from "lucide-react"
import { LogoIcon } from "./logo-icon"
import { InteractiveEngineModes } from "./interactive-engine-modes"
import { ClaimCheckSimulator } from "./claim-check-simulator"
import { ArchitectureModal } from "./architecture-modal"

interface LandingPageProps {
  userSession?: {
    organizationId?: string | null
    workspacePath?: string | null
  } | null
}

export function LandingPage({ userSession }: LandingPageProps) {
  const [isArchModalOpen, setIsArchModalOpen] = useState<boolean>(false)

  const heroMarqueeItems = [
    { name: "Next.js 15", style: { fontFamily: "Georgia, serif", fontWeight: 700, letterSpacing: "-0.02em", fontSize: "15px" } },
    { name: "SUPABASE RLS", style: { fontFamily: "Arial, sans-serif", fontWeight: 900, letterSpacing: "0.08em", fontSize: "13px", textTransform: "uppercase" as const } },
    { name: "ERC-20 Ledger", style: { fontFamily: "'Trebuchet MS', sans-serif", fontWeight: 600, letterSpacing: "0.01em", fontSize: "15px", fontStyle: "italic" as const } },
    { name: "POSTGRESQL 16", style: { fontFamily: "'Courier New', monospace", fontWeight: 700, letterSpacing: "0.12em", fontSize: "13px", textTransform: "uppercase" as const } },
    { name: "OpenZeppelin", style: { fontFamily: "Palatino, 'Book Antiqua', serif", fontWeight: 400, letterSpacing: "-0.01em", fontSize: "16px" } },
    { name: "Viem Protocol", style: { fontFamily: "Impact, 'Arial Narrow', sans-serif", fontWeight: 400, letterSpacing: "0.04em", fontSize: "14px" } },
    { name: "Zero-Sum Engine", style: { fontFamily: "Verdana, sans-serif", fontWeight: 700, letterSpacing: "-0.03em", fontSize: "13px" } },
  ]

  const backerMarqueeItems = [
    { name: "Higher Education Consortia", style: { fontFamily: "'Times New Roman', serif", fontWeight: 400, letterSpacing: "0.02em", fontSize: "14px" } },
    { name: "ETH LEDGER", style: { fontFamily: "'Arial Black', sans-serif", fontWeight: 900, letterSpacing: "0.08em", fontSize: "16px" } },
    { name: "SUPABASE RLS", style: { fontFamily: "Impact, sans-serif", fontWeight: 700, letterSpacing: "0.05em", fontSize: "18px" } },
    { name: "Postgres 16", style: { fontFamily: "Georgia, serif", fontWeight: 600, letterSpacing: "-0.02em", fontSize: "17px" } },
    { name: "OpenZeppelin", style: { fontFamily: "Helvetica, Arial, sans-serif", fontWeight: 700, letterSpacing: "-0.01em", fontSize: "15px" } },
    { name: "VIEM PROTOCOL", style: { fontFamily: "Verdana, sans-serif", fontWeight: 700, letterSpacing: "0.06em", fontSize: "14px", textTransform: "uppercase" as const } },
    { name: "AUDIT ENGINE", style: { fontFamily: "'Courier New', monospace", fontWeight: 700, letterSpacing: "0.18em", fontSize: "14px" } },
    { name: "ZERO-SUM POOL", style: { fontFamily: "Palatino, serif", fontWeight: 500, letterSpacing: "0.03em", fontSize: "15px" } },
  ]

  const destinationHref = userSession?.workspacePath || (userSession?.organizationId ? `/${userSession.organizationId}` : "/login")

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <div className="flex flex-col bg-[#F5F5F5] min-h-screen text-black selection:bg-black selection:text-white">
      {/* ── 1. NAVBAR & HERO WRAPPER (h-screen overflow-hidden) ────────────────── */}
      <div className="h-screen flex flex-col overflow-hidden relative">
        {/* 1.1 Absolute Transparent Navbar */}
        <nav className="absolute top-0 left-0 right-0 z-20 px-6 py-5">
          <div className="max-w-[88rem] mx-auto flex items-center justify-between">
            {/* Left: Logo + Brand Name */}
            <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
              <LogoIcon className="w-7 h-7 text-black transition-transform duration-200 group-hover:scale-105" />
              <span
                className="text-2xl font-medium tracking-tight text-black"
                style={{ letterSpacing: "-0.03em" }}
              >
                WorkLedger
              </span>
            </Link>

            {/* Center: Nav links */}
            <div className="hidden md:flex items-center gap-8 text-base text-gray-700 font-medium">
              <button
                onClick={() => scrollToSection("meet-workledger")}
                className="hover:text-black transition-colors duration-200 cursor-pointer"
              >
                Protocol
              </button>
              <button
                onClick={() => scrollToSection("engine-modes")}
                className="hover:text-black transition-colors duration-200 cursor-pointer"
              >
                Engine
              </button>
              <button
                onClick={() => scrollToSection("claim-calculator")}
                className="hover:text-black transition-colors duration-200 cursor-pointer"
              >
                Denominator
              </button>
              <button
                onClick={() => setIsArchModalOpen(true)}
                className="hover:text-black transition-colors duration-200 cursor-pointer"
              >
                Architecture
              </button>
              <Link
                href="/accept-invite"
                className="hover:text-black transition-colors duration-200"
              >
                Accept Invite
              </Link>
            </div>

            {/* Right: Black Pill Button */}
            <div className="flex items-center gap-3">
              <Link
                href={destinationHref}
                className="bg-black text-white text-base font-medium px-7 py-2.5 rounded-full hover:bg-gray-800 transition-colors duration-200 shadow-sm"
              >
                {userSession?.workspacePath ? "Open Workspace" : "Open Ledger"}
              </Link>
            </div>
          </div>
        </nav>

        {/* 1.2 Hero Section */}
        <section className="flex-1 px-6 pt-20 pb-6 flex items-end">
          <div
            className="relative w-full rounded-2xl overflow-hidden shadow-sm"
            style={{ height: "calc(100vh - 96px)" }}
          >
            {/* Background Video */}
            <video
              autoPlay
              muted
              loop
              playsInline
              className="object-cover absolute inset-0 w-full h-full"
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260423_161253_c72b1869-400f-45ed-ac0c-52f68c2ed5bd.mp4"
            />

            {/* Content Overlay */}
            <div className="relative z-10 flex flex-col items-start justify-start h-full p-8 md:p-12 pt-28 md:pt-36 max-w-[88rem] mx-auto w-full">
              {/* Heading */}
              <h1
                className="text-black text-5xl md:text-6xl font-medium leading-tight max-w-xl mb-4"
                style={{ letterSpacing: "-0.04em" }}
              >
                Your Effort
                <br />
                Verified
              </h1>

              {/* Description */}
              <p
                className="text-black/70 text-base md:text-lg max-w-md mb-8 leading-relaxed"
                style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
              >
                An immutable, non-monetary merit verification layer built for native claim-check authorization and effortless connection into enterprise payroll.
              </p>

              {/* Pill Button "Explore Protocol" with Arrow Circle */}
              <button
                onClick={() => scrollToSection("meet-workledger")}
                className="group inline-flex items-center gap-3 bg-black text-white text-base md:text-lg font-medium pl-8 pr-2 py-2 rounded-full hover:bg-gray-800 transition-colors duration-200 cursor-pointer shadow-sm"
              >
                <span>Explore Protocol</span>
                <div className="bg-white rounded-full p-2 transition-transform duration-200 group-hover:scale-105">
                  <ArrowRight className="w-5 h-5 text-black" />
                </div>
              </button>

              {/* Brand Marquee inside Hero */}
              <div className="mt-16 md:mt-24 w-full max-w-md overflow-hidden pointer-events-auto">
                <div className="marquee-track">
                  {/* First iteration */}
                  {heroMarqueeItems.map((brand, i) => (
                    <span
                      key={`hero-b1-${i}`}
                      className="mx-7 shrink-0 text-black/60 whitespace-nowrap select-none"
                      style={brand.style}
                    >
                      {brand.name}
                    </span>
                  ))}
                  {/* Second iteration for seamless infinite loop */}
                  {heroMarqueeItems.map((brand, i) => (
                    <span
                      key={`hero-b2-${i}`}
                      className="mx-7 shrink-0 text-black/60 whitespace-nowrap select-none"
                      style={brand.style}
                    >
                      {brand.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── 2. INFO SECTION ("Meet WorkLedger.") ───────────────────────────────── */}
      <section id="meet-workledger" className="bg-[#F5F5F5] px-6 py-24">
        <div className="max-w-[88rem] mx-auto">
          {/* Row 1: 2-Col Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16 items-start">
            {/* Left Column */}
            <div>
              <h2
                className="text-black text-4xl md:text-5xl font-medium leading-tight mb-8"
                style={{ letterSpacing: "-0.03em" }}
              >
                Meet WorkLedger.
              </h2>
              <button
                onClick={() => scrollToSection("claim-calculator")}
                className="group inline-flex items-center gap-3 bg-black text-white text-base font-medium pl-7 pr-2 py-2 rounded-full hover:bg-gray-800 transition-colors duration-200 cursor-pointer shadow-sm"
              >
                <span>Discover it</span>
                <div className="bg-white rounded-full p-2 transition-transform duration-200 group-hover:scale-105">
                  <ArrowRight className="w-4 h-4 text-black" />
                </div>
              </button>
            </div>

            {/* Right Column */}
            <div>
              <p className="text-black/70 text-2xl md:text-3xl leading-relaxed">
                WorkLedger is a zero-sum digital claim-check protocol that transforms faculty duty delivery, clinical shifts, and ad-hoc initiatives into verifiable payroll authorization without altering statutory contracts.
              </p>
            </div>
          </div>

          {/* Row 2: 4-Col Card Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1 (Spans 2 cols on lg) with Background Image */}
            <div
              className="lg:col-span-2 rounded-2xl overflow-hidden p-7 min-h-80 flex flex-col justify-between relative shadow-xs"
              style={{
                backgroundImage: `url("https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260423_164207_f243351d-ed59-48ec-83a0-a5e996bdbe3c.png&w=1280&q=85")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {/* Subtle readability gradient */}
              <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] pointer-events-none" />

              <div className="relative z-10">
                <h3
                  className="text-black text-2xl font-medium leading-snug"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  The mathematical denominator
                </h3>
              </div>

              <div className="relative z-10">
                <p className="text-black/70 text-base max-w-xs leading-relaxed">
                  Every cycle dynamically calculates an immutable credit target baseline, anchoring the 85% progress ring to provable operational reality.
                </p>
              </div>
            </div>

            {/* Card 2: Solid #2B2644 */}
            <div className="bg-[#2B2644] rounded-2xl p-7 min-h-80 flex flex-col justify-between text-white shadow-xs">
              <div>
                <h3
                  className="text-white text-2xl font-medium leading-snug"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Zero-Sum,
                  <br />
                  always audited.
                </h3>
              </div>
              <div>
                <p className="text-white/60 text-base leading-relaxed">
                  Director mints total cycle budget to SALARY_POOL. Tokens return via atomic batch reversals before fiat wire release.
                </p>
              </div>
            </div>

            {/* Card 3: Solid #2B2644 */}
            <div className="bg-[#2B2644] rounded-2xl p-7 min-h-80 flex flex-col justify-between text-white shadow-xs">
              <div>
                <h3
                  className="text-white text-2xl font-medium leading-snug"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  Autonomous
                  <br />
                  marketplace.
                </h3>
              </div>
              <div>
                <p className="text-white/60 text-base leading-relaxed">
                  Foster agency through open task self-nomination, fairness routing for staff &lt;85%, and consolidated Monday sign-offs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. BACKED BY / ARCHITECTURAL ANCHORS SECTION ──────────────────────── */}
      <section className="bg-[#F5F5F5] px-6 py-12 border-t border-b border-black/5">
        <div className="max-w-[88rem] mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 items-center">
          {/* Left Column (1/4) */}
          <div className="text-black/70 text-base leading-relaxed font-normal">
            Architected for premier institutions
            <br />
            and mission-critical networks.
          </div>

          {/* Right Column (3/4): 30s Infinite Marquee */}
          <div className="md:col-span-3 overflow-hidden">
            <div className="backers-track">
              {/* First iteration */}
              {backerMarqueeItems.map((item, idx) => (
                <span
                  key={`backer-1-${idx}`}
                  className="mx-10 shrink-0 text-black/50 whitespace-nowrap select-none"
                  style={item.style}
                >
                  {item.name}
                </span>
              ))}
              {/* Second iteration */}
              {backerMarqueeItems.map((item, idx) => (
                <span
                  key={`backer-2-${idx}`}
                  className="mx-10 shrink-0 text-black/50 whitespace-nowrap select-none"
                  style={item.style}
                >
                  {item.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. USE CASES & ENGINE MODES SECTION ───────────────────────────────── */}
      <section id="engine-modes" className="bg-[#F5F5F5] px-6 py-24">
        <div className="max-w-[88rem] mx-auto">
          <InteractiveEngineModes onOpenArchitecture={() => setIsArchModalOpen(true)} />
        </div>
      </section>

      {/* ── 5. THE MATHEMATICAL DENOMINATOR SIMULATOR ──────────────────────────── */}
      <section id="claim-calculator" className="bg-[#F5F5F5] px-6 pb-24">
        <ClaimCheckSimulator />
      </section>

      {/* ── 6. PROTOCOL SPECIFICATION CTA BANNER ──────────────────────────────── */}
      <section className="bg-[#F5F5F5] px-6 pb-24">
        <div className="max-w-[88rem] mx-auto bg-black text-white rounded-3xl p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400 bg-white/10 px-3 py-1 rounded-full mb-4">
              <ShieldCheck className="w-3.5 h-3.5" />
              Non-Monetary Claim-Check Engine
            </div>
            <h3
              className="text-3xl md:text-5xl font-medium tracking-tight text-white leading-tight"
              style={{ letterSpacing: "-0.03em" }}
            >
              Ready to verify institutional effort with mathematical certainty?
            </h3>
            <p className="text-white/60 text-base md:text-lg max-w-xl mt-4 leading-relaxed">
              Deploy WorkLedger across your academic institution, healthcare network, or enterprise engineering teams.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full sm:w-auto">
            <Link
              href={destinationHref}
              className="group inline-flex items-center justify-center gap-3 bg-white text-black text-base font-medium px-8 py-3.5 rounded-full hover:bg-gray-100 transition-colors duration-200 text-center"
            >
              <span>Launch Workspace</span>
              <ArrowRight className="w-4 h-4 text-black transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <button
              onClick={() => setIsArchModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white text-base font-medium px-7 py-3.5 rounded-full transition-colors duration-200 border border-white/10 cursor-pointer"
            >
              <Cpu className="w-4 h-4" />
              System Specs
            </button>
          </div>
        </div>
      </section>

      {/* ── 7. FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="bg-[#F5F5F5] px-6 py-12 border-t border-black/10">
        <div className="max-w-[88rem] mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-black/60">
          <div className="flex items-center gap-2.5">
            <LogoIcon className="w-5 h-5 text-black" />
            <span className="font-medium text-black tracking-tight text-base">WorkLedger</span>
            <span className="text-xs text-black/40">· Non-Monetary Merit-Based Verification Layer</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-black/70">
            <button
              onClick={() => setIsArchModalOpen(true)}
              className="hover:text-black transition-colors cursor-pointer"
            >
              Engine Architecture
            </button>
            <Link href="/login" className="hover:text-black transition-colors">
              Sign In
            </Link>
            <Link href="/accept-invite" className="hover:text-black transition-colors">
              Accept Invitation
            </Link>
            <span>© {new Date().getFullYear()} WorkLedger Protocol</span>
          </div>
        </div>
      </footer>

      {/* Architecture Deep-Dive Modal */}
      <ArchitectureModal
        isOpen={isArchModalOpen}
        onClose={() => setIsArchModalOpen(false)}
      />
    </div>
  )
}
