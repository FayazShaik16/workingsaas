"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sparkles,
  Coins,
  Calendar,
  Layers,
  CheckCircle2,
  FileCheck,
  ShieldCheck,
  UserCheck,
  Users,
  Loader2,
  ArrowLeft,
  Tag,
} from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { formatDepartment } from "@/lib/utils/formatters"

interface OrgUnit {
  id: string
  name: string
}

interface TaskCreatorWizardProps {
  orgId: string
  role: "LEAD" | "DIRECTOR"
  orgUnits: OrgUnit[]
  defaultOrgUnitId?: string
}

const COMMON_SKILL_TAGS = [
  "NBA / NAAC Audit",
  "Exam Cell Coordination",
  "Curriculum Revision",
  "Hackathon Mentorship",
  "Department Website",
  "Research Grant Proposal",
  "Student Grievance",
  "Placement Drive Support",
  "Laboratory Maintenance",
  "Conference Organization",
]

export function TaskCreatorWizard({
  orgId,
  role,
  orgUnits,
  defaultOrgUnitId,
}: TaskCreatorWizardProps) {
  const router = useRouter()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [tokenValue, setTokenValue] = useState("5.0")
  const [orgUnitId, setOrgUnitId] = useState(defaultOrgUnitId || orgUnits[0]?.id || "")
  const [deadline, setDeadline] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  )
  const [validationMode, setValidationMode] = useState("FILE_PROOF")
  const [selectedTags, setSelectedTags] = useState<string[]>(["NBA / NAAC Audit"])
  const [customTagInput, setCustomTagInput] = useState("")
  const [requiresPeerReview, setRequiresPeerReview] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleAddCustomTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && customTagInput.trim()) {
      e.preventDefault()
      if (!selectedTags.includes(customTagInput.trim())) {
        setSelectedTags((prev) => [...prev, customTagInput.trim()])
      }
      setCustomTagInput("")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsSubmitting(true)
    setFeedback(null)

    try {
      const response = await fetch("/api/tasks/create-unstructured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          tokenValue: parseFloat(tokenValue),
          deadline,
          orgUnitId,
          skillTags: selectedTags,
          validationMode,
          requiresPeerReview,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to create task")
      }

      setFeedback({
        type: "success",
        text: `Unstructured task "${title}" published to Open Marketplace!`,
      })

      setTimeout(() => {
        const dest = role === "DIRECTOR" ? `/${orgId}/director` : `/${orgId}/lead`
        router.push(dest)
      }, 1500)
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "An unexpected error occurred.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const backHref = role === "DIRECTOR" ? `/${orgId}/director` : `/${orgId}/lead`

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" asChild className="rounded-xl text-xs">
          <Link href={backHref}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Dashboard
          </Link>
        </Button>
        <Badge variant="secondary" className="font-mono text-xs">
          {role === "DIRECTOR" ? "Directorate Open Pool" : "Department Open Pool"}
        </Badge>
      </div>

      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader className="pb-4 border-b border-muted/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold">Create Unstructured Marketplace Task</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Publish autonomous institutional, accreditation, or committee duties to the faculty open pool.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {feedback && (
              <div
                className={`p-4 rounded-xl border text-xs font-semibold ${
                  feedback.type === "success"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-destructive/10 text-destructive border-destructive/20"
                }`}
              >
                {feedback.text}
              </div>
            )}

            {/* Title & Department */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="title" className="text-xs font-semibold">
                  Task Title
                </Label>
                <Input
                  id="title"
                  placeholder="e.g. NBA Criterion 4: Student Performance Audit & Report"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="rounded-xl text-sm font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="orgUnit" className="text-xs font-semibold">
                  Hosting Department
                </Label>
                <Select value={orgUnitId} onValueChange={setOrgUnitId} disabled={isSubmitting}>
                  <SelectTrigger id="orgUnit" className="rounded-xl text-xs">
                    <SelectValue placeholder="Select department..." />
                  </SelectTrigger>
                  <SelectContent>
                    {orgUnits.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {formatDepartment(u.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Token Value & Deadline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-muted/80 bg-muted/20">
              <div className="space-y-2">
                <Label htmlFor="tokenValue" className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                  <Coins className="h-4 w-4 text-emerald-500" /> Reward Token Allocation (WORK)
                </Label>
                <Input
                  id="tokenValue"
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="50"
                  value={tokenValue}
                  onChange={(e) => setTokenValue(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="rounded-xl text-lg font-mono font-bold"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {["2.0", "3.0", "5.0", "8.0", "10.0"].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTokenValue(val)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors ${
                        tokenValue === val
                          ? "bg-primary text-primary-foreground font-bold"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      }`}
                    >
                      +{val}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline" className="text-xs font-semibold flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" /> Submission Deadline
                </Label>
                <Input
                  id="deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="rounded-xl text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Task will display a real-time countdown on the marketplace.
                </p>
              </div>
            </div>

            {/* Validation Mode & Verification */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" /> Verification Mode
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    key: "FILE_PROOF",
                    label: "File / Deliverable Proof",
                    desc: "Faculty uploads PDF, spreadsheet, or URL artifact.",
                    icon: <FileCheck className="h-4 w-4 text-sky-500" />,
                  },
                  {
                    key: "NAMED_SIGNOFF",
                    label: "HOD / Lead Sign-off",
                    desc: "Lead checks physical completion and signs off.",
                    icon: <UserCheck className="h-4 w-4 text-emerald-500" />,
                  },
                  {
                    key: "PEER_REVIEW",
                    label: "Peer Committee Review",
                    desc: "Requires sign-off by 2 colleague committee members.",
                    icon: <Users className="h-4 w-4 text-violet-500" />,
                  },
                ].map((mode) => (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => setValidationMode(mode.key)}
                    className={`p-3.5 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all ${
                      validationMode === mode.key
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-muted/80 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {mode.icon}
                      <span className="text-xs font-bold">{mode.label}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">{mode.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Skill Tags */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Tag className="h-4 w-4 text-primary" /> Skill & Competency Tags
              </Label>
              <div className="flex gap-1.5 flex-wrap">
                {COMMON_SKILL_TAGS.map((tag) => {
                  const isSelected = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className={`px-3 py-1 rounded-lg text-xs transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>

              <div className="pt-1 flex gap-2">
                <Input
                  placeholder="Type custom skill tag and press Enter..."
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={handleAddCustomTag}
                  className="rounded-xl text-xs h-8 max-w-sm"
                />
              </div>
            </div>

            {/* Description / Deliverable Checklist */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-semibold">
                Task Scope, Deliverables & Acceptance Criteria
              </Label>
              <Textarea
                id="description"
                placeholder="Detail what needs to be accomplished, required artifacts (e.g. Excel sheet with student marks analysis), and expected time commitment..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                required
                disabled={isSubmitting}
                className="rounded-xl text-xs"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl h-11 text-sm font-bold shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Publishing Task...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" /> Publish to Open Marketplace (+{tokenValue} WORK)
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
